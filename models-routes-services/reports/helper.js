const { Op, fn, col, literal } = require('sequelize')
const { convertToDecimal, handleCatchError, ObjectId } = require('../../helper/utilities.services')
const EventModel = require('../event/model')
const OrderModel = require('../orders/model')
const PassbookModel = require('../passbook/model')
const CategoryModel = require('../category/model')
const EventParticipantModel = require('../event-participant/model')
const { eventStatus } = require('../../data')

async function fetchReportData(iCategoryId, sKey, eType, oQuery) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let data = 0
        const Event = await EventModel.find({ dStartDate: oQuery, eStatus: eventStatus.map.COMPLETED, iCategoryId }, { _id: 1 }).lean()
        if (Event.length) {
          const aEventId = Event.map(({ _id }) => _id.toString())
          switch (sKey) {
            case 'PlayReturn':
              data = await fetchData(aEventId, sKey, eType)
              break

            case 'Played':
              data = await fetchData(aEventId, sKey, eType)
              console.log(data)
              break

            case 'Cashback':
              data = await fetchData(aEventId, sKey, eType)
              break

            case 'CashbackReturn':
              data = await fetchData(aEventId, sKey, eType)
              break

            case 'CreatorBonus':
              data = await fetchData(aEventId, sKey, eType)
              break

            case 'CreatorBonusReturn':
              data = await fetchData(aEventId, sKey, eType)
              break

            case 'Wins':
              data = await fetchData(aEventId, sKey, eType)
              break

            case 'Wins-Return':
              data = await fetchData(aEventId, sKey, eType)
              break
          }
          return resolve(data)
        }

        switch (sKey) {
          case 'PlayReturn':
            resolve({ playReturnCash: 0, playReturnBonus: 0 })
            break

          case 'Played':
            resolve({ playedCash: 0, playedBonus: 0 })
            break

          case 'Cashback':
            resolve({ cashbackCash: 0, cashbackBonus: 0 })
            break

          case 'CashbackReturn':
            resolve({ cashbackReturnCash: 0, cashbackReturnBonus: 0 })
            break

          case 'CreatorBonus':
            resolve(data)
            break

          case 'CreatorBonusReturn':
            resolve(data)
            break

          case 'Wins':
            resolve({ winCash: 0, winBonus: 0 })
            break

          case 'Wins-Return':
            resolve({ winReturnCash: 0, winReturnBonus: 0 })
            break
        }
      } catch (error) {
        reject(error)
      }
    })()
  })
}
async function fetchData(aEventId, sKey, eType) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const data = { eUserType: eType, aEventId }
        if (sKey === 'PlayReturn') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Play-Return-OT')

          resolve({ playReturnCash: nCash, playReturnBonus: nBonus })
        }
        if (sKey === 'Played') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Play-OT')

          resolve({ playedCash: nCash, playedBonus: nBonus })
        }
        if (sKey === 'Cashback') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Cashback-Contest')

          resolve({ cashbackCash: nCash, cashbackBonus: nBonus })
        }
        if (sKey === 'CashbackReturn') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Cashback-Return')

          resolve({ cashbackReturnCash: nCash, cashbackReturnBonus: nBonus })
        }
        if (sKey === 'CreatorBonus') {
          const { nBonus } = await calculatePassbook(data, 'Creator-Bonus')

          resolve(nBonus)
        }
        if (sKey === 'CreatorBonusReturn') {
          const { nBonus } = await calculatePassbook(data, 'Creator-Bonus-Return')

          resolve(nBonus)
        }
        if (sKey === 'Wins') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Win-OT')

          resolve({ winCash: nCash, winBonus: nBonus })
        }
        if (sKey === 'Wins-Return') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Win-Return')

          resolve({ winReturnCash: nCash, winReturnBonus: nBonus })
        }
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function calculatePassbook(users, eTransactionType) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let { eUserType, aEventId } = users
        eUserType = eUserType !== 'U' ? { [Op.ne]: 'U' } : eUserType

        let nCash = await PassbookModel.sum('nCash', { where: { eUserType, iEventId: { [Op.in]: aEventId }, eTransactionType } })
        let nBonus = await PassbookModel.sum('nBonus', { where: { eUserType, iEventId: { [Op.in]: aEventId }, eTransactionType } })

        nBonus = !nBonus ? 0 : nBonus
        nCash = !nCash ? 0 : nCash

        resolve({ nCash: convertToDecimal(nCash), nBonus: convertToDecimal(nBonus) })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function fetchTotalTax(eCategory, eTransactionType, oQuery, eType) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const eUserType = eType !== 'U' ? { [Op.ne]: 'U' } : eType
        let nTax = 0
        if (eCategory) {
          const match = await EventModel.find({ dStartDate: oQuery, eStatus: 'C' }, { _id: 1 }).lean()
          if (match.length) {
            const aMatchId = match.map(({ _id }) => _id.toString())
            nTax = await PassbookModel.sum('nApplicableTax', { where: { eUserType, iEventId: { [Op.in]: aMatchId }, eTransactionType: 'Play' } })
            nTax = !nTax ? 0 : nTax
          }
        } else {
          switch (eTransactionType) {
            case 'DEPOSIT_TAX':
              nTax = oQuery.$gte && oQuery.$lt ? await PassbookModel.sum('nApplicableTax', { where: { eUserType, eStatus: 'CMP', eTransactionType: 'Deposit', [Op.and]: [{ dCreatedAt: { [Op.gte]: oQuery.$gte } }, { dCreatedAt: { [Op.lte]: oQuery.$lt } }] }, raw: true }) : await PassbookModel.sum('nApplicableTax', { where: { eUserType, eStatus: 'CMP', eTransactionType: 'Deposit' }, raw: true })
              break
            case 'WITHDRAW_TAX':
              nTax = oQuery.$gte && oQuery.$lt ? await PassbookModel.sum('nApplicableTax', { where: { eUserType, eStatus: 'CMP', eTransactionType: 'Withdraw', [Op.and]: [{ dCreatedAt: { [Op.gte]: oQuery.$gte } }, { dCreatedAt: { [Op.lte]: oQuery.$lt } }] }, raw: true }) : await PassbookModel.sum('nApplicableTax', { where: { eUserType, eStatus: 'CMP', eTransactionType: 'Withdraw' }, raw: true })
              break
            // case 'CONTEST_JOIN_TAX': {
            //   const match = await EventModel.find({ dStartDate: oQuery, eStatus: 'CMP', eCategory }, { _id: 1 }).lean()
            //   if (match.length) {
            //     const aMatchId = match.map(({ _id }) => _id.toString())
            //     nTax = await PassbookModel.sum('nApplicableTax', { where: { eUserType, iEventId: { [Op.in]: aMatchId }, eStatus: 'CMP', eTransactionType: 'Play-OT' } })
            //   }
            //   break
            // }
          }
          nTax = !nTax ? 0 : nTax
        }
        return resolve({ nTotalTax: nTax })
      } catch (error) {
        return reject(error)
      }
    })()
  })
}

async function fetchMapOfCategory() {
  try {
    const aCategory = await CategoryModel.find({}, { eCategoryType: 1, _id: 1 }).lean()
    // build a map of category
    const oCategory = {}
    aCategory.forEach(({ _id, eCategoryType }) => {
      oCategory[eCategoryType] = _id.toString()
    })
    return oCategory
  } catch (error) {
    handleCatchError(error)
  }
}

async function fetchParticipants(iCategoryId, oQuery, eType) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const queryObj = { eUserType: eType, iCategoryId, dCreatedAt: oQuery }
        if (eType !== 'U') queryObj.eUserType = { $ne: 'U' }

        const aParticipants = await EventParticipantModel.countDocuments(queryObj)
        const nTotals = aParticipants
        resolve({ nTotals })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function fetchReportOrders({ id, eUserType, eOrderStatus, eIdType, bOrderStatus = false }) {
  try {
    let query = {}
    const sOrderStatusField = bOrderStatus ? 'eOrderStatus' : 'eOrderPreviousStatus'
    query = bOrderStatus ? { eOrderStatus: { [Op.in]: eOrderStatus } } : { eOrderPreviousStatus: { [Op.in]: eOrderStatus } }
    const groupData = ['eUserType', `${sOrderStatusField}`, 'sSymbol', 'eOrderType', 'eBidType']
    switch (eIdType) {
      case 'Event':
        query = { iEventId: id, ...query }
        groupData.push('iEventId')
        break
      case 'SubCategory':
        query = { iSubCategoryId: id, ...query }
        groupData.push('iSubCategoryId')
        break
      case 'Category':
        query = { iCategoryId: id, ...query }
        groupData.push('iCategoryId')
        break
      default:
        return { message: 'Invalid eIdType' }
    }
    const oOrderData = await OrderModel.findAll({
      where: {
        ...query,
        eUserType: { [Op.in]: eUserType }
      },
      attributes: [
        'eUserType',
        `${sOrderStatusField}`,
        'sSymbol',
        'eBidType',
        'eOrderType',
        // 'nQty',
        // 'nFilledQty',
        [fn('COUNT', col('id')), 'nTotalOrders'],
        [fn('SUM', col('nQty')), 'nTotalQty'],
        [fn('SUM', col('nFilledQty')), 'nTotalFilledQty'],
        [fn('SUM', literal('CASE WHEN sSymbol = "YES" THEN nQty ELSE 0 END')), 'nTotalYesQty'],
        [fn('SUM', literal('CASE WHEN sSymbol = "NO" THEN nQty ELSE 0 END')), 'nTotalNoQty'],
        [fn('SUM', literal('CASE WHEN eOrderType = "LIMIT" THEN 1 ELSE 0 END')), 'nTotalLimitOrder'],
        [fn('SUM', literal('CASE WHEN eOrderType = "MARKET" THEN 1 ELSE 0 END')), 'nTotalMarketOrder'],
        [fn('SUM', literal('CASE WHEN bIsTrigger = true THEN 1 ELSE 0 END')), 'nTotalTriggerOrder'],
        [fn('SUM', literal('CASE WHEN eBidType = "BUY" THEN 1 ELSE 0 END')), 'nTotalBuyOrder'],
        [fn('SUM', literal('CASE WHEN eBidType = "SELL" THEN 1 ELSE 0 END')), 'nTotalSellOrder'],
        [fn('SUM', literal('CASE WHEN eBidType = "BUY" THEN nQty ELSE 0 END')), 'nTotalBuyQty'],
        [fn('SUM', literal('CASE WHEN eBidType = "SELL" THEN nQty ELSE 0 END')), 'nTotalSellQty']
      ],
      group: groupData,
      raw: true
      // logging: console.log
    })
    if (bOrderStatus) oOrderData.forEach((item) => item.eOrderPreviousStatus = item.eOrderStatus)
    return oOrderData
  } catch (error) {
    handleCatchError(error)
  }
}

async function fetchReportPassbook({ id, eUserType, eTransactionType, eIdType }) {
  try {
    let query = {}
    const groupData = ['eUserType', 'eTransactionType']
    switch (eIdType) {
      case 'Event':
        query = { iEventId: id }
        groupData.push('iEventId')
        break
      case 'SubCategory':
        query = { iSubCategoryId: id }
        groupData.push('iSubCategoryId')
        break
      case 'Category':
        query = { iCategoryId: id }
        groupData.push('iCategoryId')
        break
      default:
        return { message: 'Invalid eIdType' }
    }
    const passbookData = await PassbookModel.findAll({
      where: {
        eUserType: { [Op.in]: eUserType },
        eTransactionType: { [Op.in]: eTransactionType },
        ...query
      },
      attributes: [
        'eUserType',
        'eTransactionType',
        [fn('SUM', col('nAmount')), 'nTotalAmount'],
        [fn('SUM', col('nBonus')), 'nTotalBonus'],
        [fn('SUM', col('nCash')), 'nTotalCash'],
        [fn('SUM', literal('CASE WHEN eTransactionType = "Play-Return-OT" THEN nAmount ELSE 0 END')), 'nTotalPlayReturn'],
        [fn('SUM', literal('CASE WHEN eTransactionType = "Play-OT" THEN nAmount ELSE 0 END')), 'nTotalPlay'],
        [fn('SUM', literal('CASE WHEN eTransactionType = "Win-OT" THEN nAmount ELSE 0 END')), 'nTotalWinning'],
        [fn('SUM', col('nBuyCommission')), 'nTotalBuyCommission'],
        [fn('SUM', col('nSellCommission')), 'nTotalSellCommission']
      ],
      group: groupData,
      raw: true
    })
    return passbookData
  } catch (error) {
    handleCatchError(error)
  }
}

async function buildOrderReportData({ id, eUserType, eOrderStatus, eIdType, bOrderStatus = false }) {
  try {
    const aOrderData = await fetchReportOrders({ id, eUserType, eOrderStatus, eIdType, bOrderStatus })
    // console.log({ aOrderData })
    const userTypeMap = new Map()

    aOrderData?.forEach(item => {
      if (!userTypeMap.has(item.eUserType)) {
        userTypeMap.set(item.eUserType, [])
      }

      const userTypeArray = userTypeMap.get(item.eUserType)
      let orderStatus = userTypeArray.find(s => s.eOrderStatus === item.eOrderPreviousStatus)

      if (!orderStatus) {
        orderStatus = {
          eOrderStatus: item.eOrderPreviousStatus,
          nTotalQty: 0,
          nTotalFilledQty: 0,
          nTotalOrder: 0,
          nTotalOrders: 0,
          nTotalYesQty: 0,
          nTotalNoQty: 0,
          nTotalLimitOrder: 0,
          nTotalMarketOrder: 0,
          nTotalTriggerOrder: 0,
          nTotalBuyOrder: 0,
          nTotalSellOrder: 0,
          nTotalBuyQty: 0,
          nTotalSellQty: 0
        }
        userTypeArray.push(orderStatus)
      }

      // Update the orderStatus with the current item's data
      orderStatus.nTotalQty += Number(item.nTotalQty)
      orderStatus.nTotalFilledQty += Number(item.nTotalFilledQty)
      orderStatus.nTotalOrder += Number(item.nTotalOrders)
      orderStatus.nTotalOrders += Number(item.nTotalOrders)
      orderStatus.nTotalYesQty += Number(item.nTotalYesQty)
      orderStatus.nTotalNoQty += Number(item.nTotalNoQty)
      orderStatus.nTotalLimitOrder += Number(item.nTotalLimitOrder)
      orderStatus.nTotalMarketOrder += Number(item.nTotalMarketOrder)
      orderStatus.nTotalTriggerOrder += Number(item.nTotalTriggerOrder)
      orderStatus.nTotalBuyOrder += Number(item.nTotalBuyOrder)
      orderStatus.nTotalSellOrder += Number(item.nTotalSellOrder)
      orderStatus.nTotalBuyQty += Number(item.nTotalBuyQty)
      orderStatus.nTotalSellQty += Number(item.nTotalSellQty)
    })

    // Convert Map to a plain object
    const result = Object.fromEntries(userTypeMap)
    return result
  } catch (error) {
    handleCatchError(error)
  }
}

async function buildPassbookReportData({ id, eUserType, eTransactionType, eIdType }) {
  try {
    const aPassbookData = await fetchReportPassbook({ id, eUserType, eTransactionType, eIdType })
    const userTypeMap = new Map()

    aPassbookData?.forEach(item => {
      if (!userTypeMap.has(item.eUserType)) {
        userTypeMap.set(item.eUserType, [])
      }

      const userTypeArray = userTypeMap.get(item.eUserType)
      let transactionType = userTypeArray.find(t => t.eTransactionType === item.eTransactionType)

      if (!transactionType) {
        transactionType = {
          eTransactionType: item.eTransactionType,
          nTotalAmount: 0,
          nTotalBonus: 0,
          nTotalCash: 0,
          nTotalPlayReturn: 0,
          nTotalWinning: 0,
          nTotalBuyCommission: 0,
          nTotalSellCommission: 0
        }
        userTypeArray.push(transactionType)
      }

      // Update the transactionType with the current item's data
      transactionType.nTotalAmount += Number(item.nTotalAmount)
      transactionType.nTotalBonus += Number(item.nTotalBonus)
      transactionType.nTotalCash += Number(item.nTotalCash)
      transactionType.nTotalPlayReturn += Number(item.nTotalPlayReturn)
      transactionType.nTotalWinning += Number(item.nTotalWinning)
      transactionType.nTotalBuyCommission += Number(item.nTotalBuyCommission)
      transactionType.nTotalSellCommission += Number(item.nTotalSellCommission)
    })

    // Convert Map to a plain object
    const result = Object.fromEntries(userTypeMap)
    return result
  } catch (error) {
    handleCatchError(error)
  }
}
function mergeUserOrderArrays({ obj1, obj2 }) {
  const result = {}

  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])

  allKeys.forEach(key => {
    // Initialize with an empty array if the key doesn't exist in one of the objects
    const arr1 = obj1[key] || []
    const arr2 = obj2[key] || []

    // Combine the arrays
    result[key] = [...arr1, ...arr2]
  })

  return result
}

function fetchGroupFields({ oUnwindField, sGroupField }) {
  const query = {
    path: {},
    group: {},
    unwind: ''
  }
  switch (oUnwindField) {
    case 'aUserOrders':
      query.path = { path: `$${sGroupField}` }
      query.unwind = 'eOrderStatus'
      query.group = {
        eOrderStatus: `$${sGroupField}.eOrderStatus`,
        nTotalQty: { $sum: `$${sGroupField}.nTotalQty` },
        nTotalFilledQty: { $sum: `$${sGroupField}.nTotalFilledQty` },
        nTotalOrder: { $sum: `$${sGroupField}.nTotalOrder` },
        nTotalYesQty: { $sum: `$${sGroupField}.nTotalYesQty` },
        nTotalNoQty: { $sum: `$${sGroupField}.nTotalNoQty` },
        nTotalLimitOrder: { $sum: `$${sGroupField}.nTotalLimitOrder` },
        nTotalMarketOrder: { $sum: `$${sGroupField}.nTotalMarketOrder` },
        nTotalTriggerOrder: { $sum: `$${sGroupField}.nTotalTriggerOrder` },
        nTotalBuyOrder: { $sum: `$${sGroupField}.nTotalBuyOrder` },
        nTotalSellOrder: { $sum: `$${sGroupField}.nTotalSellOrder` },
        nTotalBuyQty: { $sum: `$${sGroupField}.nTotalBuyQty` },
        nTotalSellQty: { $sum: `$${sGroupField}.nTotalSellQty` }
      }
      query.project = {
        nTotalQty: 1,
        nTotalFilledQty: 1,
        nTotalOrder: 1,
        nTotalYesQty: 1,
        nTotalNoQty: 1,
        nTotalLimitOrder: 1,
        nTotalMarketOrder: 1,
        nTotalTriggerOrder: 1,
        nTotalBuyOrder: 1,
        nTotalSellOrder: 1,
        nTotalBuyQty: 1,
        nTotalSellQty: 1
      }
      if (sGroupField === 'aData') delete query.group.eOrderStatus
      break
    case 'aAdminOrders':
      query.path = { path: `$${sGroupField}` }
      query.unwind = 'eOrderStatus'
      query.group = {
        eOrderStatus: `$${sGroupField}.eOrderStatus`,
        nTotalQty: { $sum: `$${sGroupField}.nTotalQty` },
        nTotalFilledQty: { $sum: `$${sGroupField}.nTotalFilledQty` },
        nTotalOrder: { $sum: `$${sGroupField}.nTotalOrder` },
        nTotalYesQty: { $sum: `$${sGroupField}.nTotalYesQty` },
        nTotalNoQty: { $sum: `$${sGroupField}.nTotalNoQty` },
        nTotalLimitOrder: { $sum: `$${sGroupField}.nTotalLimitOrder` },
        nTotalMarketOrder: { $sum: `$${sGroupField}.nTotalMarketOrder` },
        nTotalTriggerOrder: { $sum: `$${sGroupField}.nTotalTriggerOrder` },
        nTotalBuyOrder: { $sum: `$${sGroupField}.nTotalBuyOrder` },
        nTotalSellOrder: { $sum: `$${sGroupField}.nTotalSellOrder` },
        nTotalBuyQty: { $sum: `$${sGroupField}.nTotalBuyQty` },
        nTotalSellQty: { $sum: `$${sGroupField}.nTotalSellQty` }
      }
      query.project = {
        nTotalQty: 1,
        nTotalFilledQty: 1,
        nTotalOrder: 1,
        nTotalYesQty: 1,
        nTotalNoQty: 1,
        nTotalLimitOrder: 1,
        nTotalMarketOrder: 1,
        nTotalTriggerOrder: 1,
        nTotalBuyOrder: 1,
        nTotalSellOrder: 1,
        nTotalBuyQty: 1,
        nTotalSellQty: 1
      }
      if (sGroupField === 'aData') delete query.group.eOrderStatus
      break
    case 'aUserTransaction':
      query.path = { path: `$${sGroupField}` }
      query.unwind = 'eTransactionType'
      query.group = {
        eTransactionType: `$${sGroupField}.eTransactionType`,
        nTotalAmount: { $sum: `$${sGroupField}.nTotalAmount` },
        nTotalBonus: { $sum: `$${sGroupField}.nTotalBonus` },
        nTotalCash: { $sum: `$${sGroupField}.nTotalCash` },
        nTotalPlayReturn: { $sum: `$${sGroupField}.nTotalPlayReturn` },
        nTotalWinning: { $sum: `$${sGroupField}.nTotalWinning` },
        nTotalBuyCommission: { $sum: `$${sGroupField}.nTotalBuyCommission` },
        nTotalSellCommission: { $sum: `$${sGroupField}.nTotalSellCommission` }
      }
      query.project = {
        nTotalAmount: 1,
        nTotalBonus: 1,
        nTotalCash: 1,
        nTotalPlayReturn: 1,
        nTotalWinning: 1,
        nTotalBuyCommission: 1,
        nTotalSellCommission: 1
      }
      if (sGroupField === 'aData') delete query.group.eTransactionType
      break
    case 'aAdminTransaction':
      query.path = { path: `$${sGroupField}` }
      query.unwind = 'eTransactionType'
      query.group = {
        eTransactionType: `$${sGroupField}.eTransactionType`,
        nTotalAmount: { $sum: `$${sGroupField}.nTotalAmount` },
        nTotalBonus: { $sum: `$${sGroupField}.nTotalBonus` },
        nTotalCash: { $sum: `$${sGroupField}.nTotalCash` },
        nTotalPlayReturn: { $sum: `$${sGroupField}.nTotalPlayReturn` },
        nTotalWinning: { $sum: `$${sGroupField}.nTotalWinning` },
        nTotalBuyCommission: { $sum: `$${sGroupField}.nTotalBuyCommission` },
        nTotalSellCommission: { $sum: `$${sGroupField}.nTotalSellCommission` }
      }
      query.project = {
        nTotalAmount: 1,
        nTotalBonus: 1,
        nTotalCash: 1,
        nTotalPlayReturn: 1,
        nTotalWinning: 1,
        nTotalBuyCommission: 1,
        nTotalSellCommission: 1
      }
      if (sGroupField === 'aData') delete query.group.eTransactionType
      break
    default:
      return { message: 'Invalid oUnwindField' }
  }
  return query
}

async function fetchSubCategoryReportData({ iSubCategoryId, oUnwindField, eEventStatus = eventStatus.map.COMPLETED }) {
  try {
    const query = fetchGroupFields({ oUnwindField, sGroupField: oUnwindField })
    const queryData = fetchGroupFields({ oUnwindField, sGroupField: 'aData' })
    const oEventData = await EventModel.aggregate([
      {
        $match: {
          iSubCategoryId: ObjectId(iSubCategoryId),
          aAdminOrders: { $exists: true },
          aAdminTransaction: { $exists: true },
          aUserOrders: { $exists: true },
          aUserTransaction: { $exists: true },
          eStatus: eEventStatus
        }
      },
      { $unwind: query.path },
      {
        $group: {
          _id: '$iSubCategoryId',
          aData: {
            $push: query.group
          }
        }
      },
      { $unwind: { path: '$aData' } },
      {
        $group: {
          _id: `$aData.${query.unwind}`,
          ...queryData.group
        }
      },
      {
        $project: {
          _id: 0,
          [query.unwind]: '$_id',
          ...query.project
        }
      }
    ]).allowDiskUse(true).exec()
    if (!oEventData.length) return []
    return oEventData
  } catch (error) {
    handleCatchError(error)
  }
}

function getReportKey({ iEventId }) { return `OT:EVENT:${iEventId}:REPORT` }
function getSetGlobalLeaderboardKey({ iEventId }) { return `OT:EVENT:${iEventId}:LEADERBOARD` }

module.exports = {
  fetchReportData,
  calculatePassbook,
  fetchData,
  fetchTotalTax,
  fetchParticipants,
  fetchMapOfCategory,
  buildOrderReportData,
  buildPassbookReportData,
  mergeUserOrderArrays,
  getReportKey,
  fetchSubCategoryReportData,
  getSetGlobalLeaderboardKey
}
