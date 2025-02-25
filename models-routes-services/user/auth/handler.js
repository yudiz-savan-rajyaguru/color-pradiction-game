// @ts-check
const { Transaction, Sequelize, Op } = require('sequelize')
const OrderModel = require('../../orders/model')
const PassbookModel = require('../../passbook/model')
const { getPortfolioKey, getPortfolioCardAndCountKey } = require('./helper')
const db = require('../../../database/sequelize')
const EventModel = require('../../event/model')
const enums = require('../../../data')
const { removeRedisKey, queuePush } = require('../../../helper/redis')
const { ObjectId, convertToDecimal, handleCatchError } = require('../../../helper/utilities.services')
const EventParticipantModel = require('../../event-participant/model')
const { isValidObjectId } = require('mongoose')

const oUserHandler = {}
oUserHandler.getUserPL = async ({ iUserId }) => {
  try {
    const oPL = await EventParticipantModel.aggregate([
      {
        $match: {
          iUserId: ObjectId(iUserId)
        }
      },
      {
        $group: {
          _id: {
            iUserId: '$iUserId'
          },
          nNetProfit: {
            $sum: '$nNetProfit'
          },
          nTotalInvested: {
            $sum: '$nTotalInvested'
          }
        }
      },
      {
        $project: {
          _id: 0,
          iUserId: '$_id.iUserId',
          nNetProfit: 1,
          nTotalInvested: 1
        }
      }
    ])
    return oPL?.[0] ? oPL[0] : { iUserId, nNetProfit: 0, nTotalInvested: 0 }
  } catch (error) {
    console.log('error', error)
  }
}

oUserHandler.generateUserPLReportByEvent = async ({ iEventId, nBatch = 500 }) => {
  try {
    return await db.sequelize.transaction(
      {
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      }, async (t) => {
        const oEventInfo = await EventModel.findOne({ _id: iEventId }, { dStartDate: 1, dEndDate: 1, _id: 1, sName: 1, nTotalPrice: 1, aAnswerOptions: 1, eStatus: 1 }).lean()
        if (!oEventInfo) return { success: false, message: 'Event not found' }
        const oQuery = {
          iEventId
        }
        const aUserList = await OrderModel.findAll({
          where: oQuery,
          attributes: [
            [Sequelize.fn('DISTINCT', Sequelize.col('iUserId')), 'iUserId']
          ],
          raw: true,
          lock: true,
          transaction: t
        })
        if (!aUserList?.length) {
          return { success: false, message: `No orders found for event ${iEventId}` }
        }
        // clear cache of the closed event user portfolio
        const aRemoveKey = []
        aUserList?.forEach(({ iUserId }) => {
          const portfolioKey = getPortfolioKey({ iUserId, eHistoryStatus: enums?.historyStatus?.map?.CLOSED })
          const countPortfolioKey = getPortfolioCardAndCountKey({ iUserId, eHistoryStatus: enums?.historyStatus?.map?.CLOSED })
          aRemoveKey.push(portfolioKey, countPortfolioKey)
        })
        await removeRedisKey({ aExactRedisKey: aRemoveKey })

        // add event participant for the pnl report
        await oUserHandler.addEventParticipant({ aOrders: aUserList, nBatch, oEventInfo })
        aUserList?.forEach(({ iUserId }) => {
          // push notification for the user
          const data = { iUserId: iUserId, sEventName: oEventInfo?.sName, iEventId }
          queuePush('pushNotification:EVENT_OUTCOME', data)
        })
      })
  } catch (error) {
    console.log('error', error)
  }
}

oUserHandler.calculateUserPLByEvent = async ({ iEventId, iUserId, eEventStatus }) => {
  try {
    const PL = {
      nTotalInvested: 0,
      nTotalPlayReturn: 0,
      nTotalWin: 0,
      nNetProfit: 0,
      nTotalCommission: 0,
      nTotalPlatformFee: 0,
      nTotalReturnPlatformFee: 0,
      nMatchOrderInvested: 0,
      nYesAvgPrice: 0,
      nNoAvgPrice: 0
    }

    const aOrderPassBookList = await PassbookModel.findAll({
      where: {
        iEventId,
        iUserId
      },
      attributes: [
        'eTransactionType',
        'nAmount',
        'eUserType',
        'nBuyCommission',
        'nSellCommission'
      ],
      raw: true
    })
    if (!aOrderPassBookList?.length) {
      return { success: false, message: 'No orders found' }
    }
    const eUserType = aOrderPassBookList[0]?.eUserType

    aOrderPassBookList?.forEach((oPassBookInfo) => {
      if (oPassBookInfo?.eTransactionType === enums?.transactionType?.map?.PLAY_OT) {
        PL.nTotalInvested += convertToDecimal(oPassBookInfo?.nAmount)
        PL.nTotalPlatformFee += convertToDecimal(oPassBookInfo?.nBuyCommission)
      } else if (oPassBookInfo?.eTransactionType === enums?.transactionType?.map?.PLAY_RETURN_OT) {
        PL.nTotalPlayReturn += convertToDecimal(oPassBookInfo?.nAmount)
        PL.nTotalReturnPlatformFee += convertToDecimal(oPassBookInfo?.nBuyCommission)
      } else if (oPassBookInfo?.eTransactionType === enums?.transactionType?.map?.WIN_OT) {
        PL.nTotalWin += convertToDecimal(oPassBookInfo?.nAmount)
        PL.nTotalCommission += convertToDecimal(oPassBookInfo?.nSellCommission)
      }
    })
    PL.nNetProfit = convertToDecimal(PL.nTotalWin - (PL.nTotalInvested - PL.nTotalPlayReturn))

    // calculate the user match order pnl
    if (![enums.eventStatus?.map?.COMPLETED, enums.eventStatus?.map?.PENDING_OUTCOME]?.includes(eEventStatus)) {
      const oOrderInvested = await OrderModel.findOne({
        attributes: [
          [Sequelize.literal('SUM(nFilledQty * nPrice)'), 'nTotalBuyInvested'],
          // find the nYesAvgPrice and nNoAvgPrice
          [Sequelize.literal('AVG(CASE WHEN sSymbol = \'YES\' THEN nPrice ELSE 0 END)'), 'nYesAvgPrice'],
          [Sequelize.literal('AVG(CASE WHEN sSymbol = \'NO\' THEN nPrice ELSE 0 END)'), 'nNoAvgPrice']
          // [Sequelize.literal('SUM(CASE WHEN eBidType = \'SELL\' THEN nFilledQty * nPrice ELSE 0 END)'), 'nTotalSellWin']
        ],
        where: {
          iEventId,
          iUserId,
          eBidType: enums?.bidType?.map?.BUY,
          eOrderStatus: { [Op.in]: [enums?.orderStatus?.map?.MATCHED, enums?.orderStatus?.map?.PARTIALLY_FILLED] }
        },
        raw: true
      })
      PL.nMatchOrderInvested = convertToDecimal(oOrderInvested?.nTotalBuyInvested || 0)
      PL.nYesAvgPrice = isNaN(oOrderInvested?.nYesAvgPrice) ? 0 : convertToDecimal(oOrderInvested?.nYesAvgPrice || 0)
      PL.nNoAvgPrice = isNaN(oOrderInvested?.nNoAvgPrice) ? 0 : convertToDecimal(oOrderInvested?.nNoAvgPrice || 0)
    }
    return {
      ...PL,
      eUserType,
      iUserId
    }
  } catch (error) {
    console.log('error', error)
  }
}

oUserHandler.addEventParticipant = async ({ aOrders, nBatch = 500, oEventInfo }) => {
  try {
    const iEventId = oEventInfo._id.toString()
    const userPLReport = await Promise.all(
      aOrders?.filter(({ iUserId }) => isValidObjectId(iUserId))?.map(({ iUserId }) => oUserHandler.calculateUserPLByEvent({ iEventId, iUserId, eEventStatus: oEventInfo?.eStatus }))
    )
    if (userPLReport?.length > nBatch) {
      for (let i = 0; i < userPLReport.length; i += nBatch) {
        const batch = userPLReport.slice(i, i + nBatch)
        try {
          const aBulkUserPLPayload = []
          batch?.forEach((oUserPL) => {
            const oUpdatePayload = {
              iEventId: iEventId,
              iCategoryId: oEventInfo?.iCategoryId,
              iSubCategoryId: oEventInfo?.iSubCategoryId,
              dStartDate: oEventInfo?.dStartDate,
              dEndDate: oEventInfo?.dEndDate,
              eUserType: oUserPL?.eUserType,
              iUserId: oUserPL?.iUserId,
              nTotalInvested: convertToDecimal(oUserPL?.nTotalInvested),
              nTotalPlayReturn: convertToDecimal(oUserPL?.nTotalPlayReturn),
              nTotalWin: convertToDecimal(oUserPL?.nTotalWin),
              nNetProfit: convertToDecimal(oUserPL?.nNetProfit),
              nTotalCommission: convertToDecimal(oUserPL?.nTotalCommission),
              nTotalPlatformFee: convertToDecimal(oUserPL?.nTotalPlatformFee),
              nTotalReturnPlatformFee: convertToDecimal(oUserPL?.nTotalReturnPlatformFee)
            }
            if (![enums.eventStatus?.map?.COMPLETED, enums.eventStatus?.map?.PENDING_OUTCOME]?.includes(oEventInfo?.eStatus)) {
              oUpdatePayload.nMatchOrderInvested = convertToDecimal(oUserPL?.nMatchOrderInvested)
              oUpdatePayload.nYesAvgPrice = convertToDecimal(oUserPL?.nYesAvgPrice)
              oUpdatePayload.nNoAvgPrice = convertToDecimal(oUserPL?.nNoAvgPrice)
            }
            aBulkUserPLPayload.push({
              updateOne: {
                filter: { iUserId: ObjectId(oUserPL?.iUserId), iEventId: ObjectId(iEventId) },
                update: {
                  $set: oUpdatePayload
                },
                upsert: true
              }

            })
          })
          await EventParticipantModel.bulkWrite(aBulkUserPLPayload)
          console.log(`Processed batch ${i / nBatch + 1}`)
        } catch (error) {
          console.error(`Error in batch ${i / nBatch + 1}:`, error)
        }
      }
      console.log('Batch processing end')
    } else {
      const aBulkUserPLPayload = []
      userPLReport?.forEach((oUserPL) => {
        const oUpdatePayload = {
          iEventId: iEventId,
          iCategoryId: oEventInfo?.iCategoryId,
          iSubCategoryId: oEventInfo?.iSubCategoryId,
          dStartDate: oEventInfo?.dStartDate,
          dEndDate: oEventInfo?.dEndDate,
          eUserType: oUserPL?.eUserType,
          iUserId: oUserPL?.iUserId,
          nTotalInvested: convertToDecimal(oUserPL?.nTotalInvested),
          nTotalPlayReturn: convertToDecimal(oUserPL?.nTotalPlayReturn),
          nTotalWin: convertToDecimal(oUserPL?.nTotalWin),
          nNetProfit: convertToDecimal(oUserPL?.nNetProfit),
          nTotalCommission: convertToDecimal(oUserPL?.nTotalCommission),
          nTotalPlatformFee: convertToDecimal(oUserPL?.nTotalPlatformFee),
          nTotalReturnPlatformFee: convertToDecimal(oUserPL?.nTotalReturnPlatformFee)
        }
        if (![enums.eventStatus?.map?.COMPLETED, enums.eventStatus?.map?.PENDING_OUTCOME]?.includes(oEventInfo?.eStatus)) {
          oUpdatePayload.nMatchOrderInvested = convertToDecimal(oUserPL?.nMatchOrderInvested)
          oUpdatePayload.nYesAvgPrice = convertToDecimal(oUserPL?.nYesAvgPrice)
          oUpdatePayload.nNoAvgPrice = convertToDecimal(oUserPL?.nNoAvgPrice)
        }
        aBulkUserPLPayload.push({
          updateOne: {
            filter: { iUserId: ObjectId(oUserPL?.iUserId), iEventId: ObjectId(iEventId) },
            update: {
              $set: oUpdatePayload
            },
            upsert: true
          }

        })
      })
      await EventParticipantModel.bulkWrite(aBulkUserPLPayload)
      return { success: true, message: `User PL Report generated successfully for event ${iEventId}` }
    }
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = oUserHandler
