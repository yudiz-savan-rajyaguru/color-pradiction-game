const DashboardModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, handleCatchError, getDatesForDashboard, convertToDecimal, getAllDatesBetweenTwoRange } = require('../../helper/utilities.services')
const { Op, fn, col } = require('sequelize')
const UserDepositModel = require('../userDeposit/model')
const UserWithdrawModel = require('../userWithdraw/model')
const redis = require('../../helper/redis')
const UserModel = require('../user/model')
const PassbookModel = require('../passbook/model')
const EventModel = require('../event/model')
const CategoryModel = require('../category/model')
const { droppedRegistrationCount } = require('../../middlewares/common')
const { eventStatus } = require('../../data')
const UserBalanceModel = require('../userbalance/model')
async function getUserData(query) {
  try {
    const activeUserKey = 'a:user:1:hr:*'
    const activeUserSince15DayKey = 'a:user:15:day:*'
    const [totalActiveUser, totalActiveUserSince15Day] = await Promise.all([
      redis.totalKeysCount(activeUserKey),
      redis.totalKeysCount(activeUserSince15DayKey)
    ])
    return { totalActiveUser, totalActiveUserSince15Day }
  } catch (error) {
    return handleCatchError(error)
  }
}

async function getAdminCommissionData(dateQuery) {
  try {
    const [totalCommissionToday, totalCommissionWeek, totalCommissionMonth] = await Promise.all([
      PassbookModel.findAll({
        where: { eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.toDay.$lt } }] },
        attributes: [[fn('sum', col('nSellCommission')), 'nSellCommission']],
        raw: true
      }),
      PassbookModel.findAll({
        where: { eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.week.$lt } }] },
        attributes: [[fn('sum', col('nSellCommission')), 'nSellCommission']],
        raw: true
      }),
      PassbookModel.findAll({
        where: { eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.month.$lt } }] },
        attributes: [[fn('sum', col('nSellCommission')), 'nSellCommission']],
        raw: true
      })
    ])
    return { totalCommissionToday, totalCommissionWeek, totalCommissionMonth }
  } catch (error) {
    return handleCatchError(error)
  }
}

async function getAdminPlatformFeesData(dateQuery) {
  try {
    const [totalPlatformFeeToday, totalPlatformFeesWeek, totalPlatformFeesMonth] = await Promise.all([
      PassbookModel.findAll({
        where: { eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.toDay.$lt } }] },
        attributes: [[fn('sum', col('nBuyCommission')), 'nBuyCommission']],
        raw: true
      }),
      PassbookModel.findAll({
        where: { eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.week.$lt } }] },
        attributes: [[fn('sum', col('nBuyCommission')), 'nBuyCommission']],
        raw: true
      }),
      PassbookModel.findAll({
        where: { eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.month.$lt } }] },
        attributes: [[fn('sum', col('nBuyCommission')), 'nBuyCommission']],
        raw: true
      })
    ])
    return { totalPlatformFeeToday, totalPlatformFeesWeek, totalPlatformFeesMonth }
  } catch (error) {
    return handleCatchError(error)
  }
}

async function getDepositOfDateRange(condition, dateRange) {
  try {
    // Parse the date range from the request
    const { dStartDate, dEndDate } = dateRange
    let query = condition
    query = { ...query, attributes: [[fn('sum', col('nCash')), 'total']] }
    query.where = { ...query.where, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }
    const data = await UserDepositModel.findAll(query)
    return { success: true, data }
  } catch (error) {
    return { success: false }
  }
}

async function getDateRangeWithdrawOfPG(condition, dateRange) {
  try {
    const { dStartDate, dEndDate } = dateRange
    let query = condition
    query = { ...query, attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue'], ['ePaymentGateway', 'eTitle'], [fn('sum', col('nPlatformFee')), 'nPlatformFee'], ['ePaymentGateway', 'eTitle'], [fn('sum', col('nActualAmount')), 'nActualAmount']] }
    query.where = { ...query.where, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }
    const data = await UserWithdrawModel.findAll(query)
    return { success: true, data }
  } catch (error) {
    return { success: false }
  }
}

async function getDepositData(dateQuery) {
  try {
    const userTypeQuery = { eUserType: 'U' }

    const dDayStartDate = dateQuery.toDay.$gte
    const dDayEndDate = dateQuery.toDay.$lt

    const dWeekStartDate = dateQuery.week.$gte
    const dWeekEndDate = dateQuery.week.$lt

    const dMonthStartDate = dateQuery.month.$gte
    const dMonthEndDate = dateQuery.month.$lt

    const [totalDepositToday, totalDepositWeek, totalDepositMonth, totalWithDrawToday, totalWithDrawWeek, totalWithDrawMonth] = await Promise.all([
      getDepositOfDateRange({ where: userTypeQuery, raw: true }, { dStartDate: dDayStartDate, dEndDate: dDayEndDate }),
      getDepositOfDateRange({ where: userTypeQuery, raw: true }, { dStartDate: dWeekStartDate, dEndDate: dWeekEndDate }),
      getDepositOfDateRange({ where: userTypeQuery, raw: true }, { dStartDate: dMonthStartDate, dEndDate: dMonthEndDate }),
      getDateRangeWithdrawOfPG({ group: 'ePaymentGateway', where: { ePaymentStatus: 'S', eUserType: 'U' }, raw: true }, { dStartDate: dDayStartDate, dEndDate: dDayEndDate }),
      getDateRangeWithdrawOfPG({ group: 'ePaymentGateway', where: { ePaymentStatus: 'S', eUserType: 'U' }, raw: true }, { dStartDate: dWeekStartDate, dEndDate: dWeekEndDate }),
      getDateRangeWithdrawOfPG({ group: 'ePaymentGateway', where: { ePaymentStatus: 'S', eUserType: 'U' }, raw: true }, { dStartDate: dMonthStartDate, dEndDate: dMonthEndDate })
    ])
    return { totalDepositToday: totalDepositToday?.data, totalDepositWeek: totalDepositWeek?.data, totalDepositMonth: totalDepositMonth?.data, totalWithDrawToday: totalWithDrawToday?.data, totalWithDrawWeek: totalWithDrawWeek?.data, totalWithDrawMonth: totalWithDrawMonth?.data }
  } catch (error) {
    return handleCatchError(error)
  }
}

async function getBotData(dateQuery) {
  try {
    const [totalBotCountToday, totalBotCountWeek, totalBotCountMonth] = await Promise.all([
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Win-Return-OT'] }, eUserType: 'B', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.toDay.$lt } }] },
        attributes: [[fn('count', col('id')), 'total'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      }),
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Win-Return-OT'] }, eUserType: 'B', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.week.$lt } }] },
        attributes: [[fn('count', col('id')), 'total'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      }),
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Win-Return-OT'] }, eUserType: 'B', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.month.$lt } }] },
        attributes: [[fn('count', col('id')), 'total'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      })
    ])
    return { totalBotCountToday, totalBotCountWeek, totalBotCountMonth }
  } catch (error) {
    return handleCatchError(error)
  }
}

async function getMoneyData(dateQuery) {
  try {
    const [totalWeekDetails, totalMonthDetails, totalTodayDetails] = await Promise.all([
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Win-Return-OT', 'Play-OT', 'Play-Return-OT'] }, eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.week.$lt } }] },
        attributes: [[fn('sum', col('nCash')), 'nCash'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      }),
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Win-Return-OT', 'Play-OT', 'Play-Return-OT'] }, eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.month.$lt } }] },
        attributes: [[fn('sum', col('nCash')), 'nCash'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      }),
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Win-Return-OT', 'Play-OT', 'Play-Return-OT'] }, eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.toDay.$lt } }] },
        attributes: [[fn('sum', col('nCash')), 'nCash'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      })
    ])
    return { totalWeekDetails, totalMonthDetails, totalTodayDetails }
  } catch (error) {
    return handleCatchError(error)
  }
}

async function getEventCount(dateQuery, oCategory) {
  try {
    const [oTodaysEvent, oWeekEvent, oMonthEvent] = await Promise.all([
      EventModel?.countDocuments({ iCategoryId: oCategory?._id, eStatus: { $nin: [eventStatus?.map?.DELETED, eventStatus?.map?.SUSPEND] }, dStartDate: { $gte: dateQuery.toDay.$gte, $lt: dateQuery.toDay.$lt } }).lean(),
      EventModel?.countDocuments({ iCategoryId: oCategory?._id, eStatus: { $nin: [eventStatus?.map?.DELETED, eventStatus?.map?.SUSPEND] }, dStartDate: { $gte: dateQuery.week.$gte, $lt: dateQuery.week.$lt } }).lean(),
      EventModel?.countDocuments({ iCategoryId: oCategory?._id, eStatus: { $nin: [eventStatus?.map?.DELETED, eventStatus?.map?.SUSPEND] }, dStartDate: { $gte: dateQuery.month.$gte, $lt: dateQuery.month.$lt } }).lean()
    ])

    return {
      oLiveEvents: {
        nToday: oTodaysEvent,
        nWeek: oWeekEvent,
        nMonth: oMonthEvent
      },
      eCategory: oCategory?.eCategoryType,
      iCategoryId: oCategory?._id
    }
  } catch (error) {
    return handleCatchError(error)
  }
}

async function getUserWinDetails(dateQuery) {
  try {
    const [totalCountToday, totalCountWeek, totalCountMonth] = await Promise.all([
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Play-Return-OT'] }, eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.toDay.$lt } }] },
        attributes: [[fn('count', col('id')), 'total'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      }),
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Play-Return-OT'] }, eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.week.$lt } }] },
        attributes: [[fn('count', col('id')), 'total'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      }),
      PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Play-Return-OT'] }, eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lt]: dateQuery.month.$lt } }] },
        attributes: [[fn('count', col('id')), 'total'], 'eTransactionType'],
        group: 'eTransactionType',
        raw: true
      })
    ])
    return { totalCountToday, totalCountWeek, totalCountMonth }
  } catch (error) {
    return handleCatchError(error)
  }
}

class AdminDashboard {
  // default api, when dashboard loaded
  async fetchDashboard(req, res) {
    try {
      const data = await DashboardModel.find({}).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDashboard), data })
    } catch (error) {
      catchError('AdminDashboard.fetchDashboard', error, req, res)
    }
  }

  async updateDashboardDetails(req, res) {
    try {
      const query = { eType: 'U', eStatus: { $ne: 'D' } }
      const { totalActiveUser, totalActiveUserSince15Day } = await getUserData(query)

      const totalUsers = await UserModel.countDocuments(query, { hint: { _id: 1 } })
      const inactiveUser = totalUsers - totalActiveUserSince15Day
      const droppedRegs = await droppedRegistrationCount()
      const totalDroppedRegs = droppedRegs ? droppedRegs.finalCount : 0
      const aCategoryList = await CategoryModel.find({ eStatus: 'Y' }).lean()

      const dateQuery = getDatesForDashboard()
      const aEventData = await Promise.all(aCategoryList?.map(function (oCategory) {
        return getEventCount(dateQuery, oCategory)
      }))
      let totalWinCountToday = 0
      let totalWinReturnCountToday = 0
      let totalPlayReturnCountToday = 0

      let totalWinCountWeek = 0
      let totalWinReturnCountWeek = 0
      let totalPlayReturnCountWeek = 0

      let totalWinCountMonth = 0
      let totalWinReturnCountMonth = 0
      let totalPlayReturnCountMonth = 0

      const { totalCommissionToday, totalCommissionWeek, totalCommissionMonth } = await getAdminCommissionData(dateQuery)
      const { totalPlatformFeeToday, totalPlatformFeesWeek, totalPlatformFeesMonth } = await getAdminPlatformFeesData(dateQuery)

      const aEventPendingOrders = await getEventPendingOrders()
      const { totalCountToday, totalCountWeek, totalCountMonth } = await getUserWinDetails(dateQuery)
      totalCountToday.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalWinCountToday = rec.total
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalWinReturnCountToday = rec.total
        } else if (rec.eTransactionType === 'Play-Return-OT') {
          totalPlayReturnCountToday = rec.total
        }
      })

      totalCountWeek.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalWinCountWeek = rec.total
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalWinReturnCountWeek = rec.total
        } else if (rec.eTransactionType === 'Play-Return-OT') {
          totalPlayReturnCountWeek = rec.total
        }
      })

      totalCountMonth.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalWinCountMonth = rec.total
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalWinReturnCountMonth = rec.total
        } else if (rec.eTransactionType === 'Play-Return-OT') {
          totalPlayReturnCountMonth = rec.total
        }
      })

      // ACTUAL USER WIN
      const actualUserWinCountToday = totalWinCountToday - totalWinReturnCountToday
      const actualUserWinCountWeek = totalWinCountWeek - totalWinReturnCountWeek
      const actualUserWinCountMonth = totalWinCountMonth - totalWinReturnCountMonth

      const { totalBotCountToday, totalBotCountWeek, totalBotCountMonth } = await getBotData(dateQuery)

      let totalBotWinCountMonth = 0
      let totalBotWinReturnCountMonth = 0
      let totalBotWinCountWeek = 0
      let totalBotWinReturnCountWeek = 0
      let totalBotWinCountToday = 0
      let totalBotWinReturnToday = 0

      totalBotCountMonth.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalBotWinCountMonth = rec.total
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalBotWinReturnCountMonth = rec.total
        }
      })

      totalBotCountWeek.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalBotWinCountWeek = rec.total
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalBotWinReturnCountWeek = rec.total
        }
      })

      totalBotCountToday.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalBotWinCountToday = rec.total
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalBotWinReturnToday = rec.total
        }
      })

      // bot winners count
      const actualBotWinCountToday = totalBotWinCountToday - totalBotWinReturnToday
      const actualBotWinCountWeek = totalBotWinCountWeek - totalBotWinReturnCountWeek
      const actualBotWinCountMonth = totalBotWinCountMonth - totalBotWinReturnCountMonth

      const { totalWeekDetails, totalMonthDetails, totalTodayDetails } = await getMoneyData(dateQuery)

      let totalWinWeek = 0
      let totalWinReturnWeek = 0
      let totalPlayWeek = 0
      let totalPlayReturnWeek = 0
      let totalWinToday = 0
      let totalWinReturnToday = 0
      let totalPlayToday = 0
      let totalPlayReturnToday = 0
      let totalWinMonth = 0
      let totalWinReturnMonth = 0
      let totalPlayMonth = 0
      let totalPlayReturnMonth = 0
      totalWeekDetails.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalWinWeek = rec.nCash
        } else if (rec.eTransactionType === 'Play-OT') {
          totalPlayWeek = rec.nCash
        } else if (rec.eTransactionType === 'Play-Return-OT') {
          totalPlayReturnWeek = rec.nCash
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalWinReturnWeek = rec.nCash
        }
      })

      totalMonthDetails.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalWinMonth = rec.nCash
        } else if (rec.eTransactionType === 'Play-OT') {
          totalPlayMonth = rec.nCash
        } else if (rec.eTransactionType === 'Play-Return-OT') {
          totalPlayReturnMonth = rec.nCash
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalWinReturnMonth = rec.nCash
        }
      })

      totalTodayDetails.map(function (rec) {
        if (rec.eTransactionType === 'Win-OT') {
          totalWinToday = rec.nCash
        } else if (rec.eTransactionType === 'Play-OT') {
          totalPlayToday = rec.nCash
        } else if (rec.eTransactionType === 'Play-Return-OT') {
          totalPlayReturnToday = rec.nCash
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          totalWinReturnToday = rec.nCash
        }
      })

      const actualTotalPlay = totalPlayToday - totalPlayReturnToday
      const actualTotalWin = totalWinToday - totalWinReturnToday

      const actualTotalPlayWeek = totalPlayWeek - totalPlayReturnWeek
      const actualTotalWinWeek = totalWinWeek - totalWinReturnWeek

      const actualTotalPlayMonth = totalPlayMonth - totalPlayReturnMonth
      const actualTotalWinMonth = totalWinMonth - totalWinReturnMonth

      // total loss to user
      // s1 : total play 100 and total win is 200 so, 100 - 200 loss is in minus that means no loss(as per below calculation) so we will send zero in response.
      // s2 : total play 300 and total win is 100 so, 300 - 100 = 200 so 200 rs loss.
      const totalLossToUser = actualTotalPlay - actualTotalWin
      const totalLossToUserWeek = actualTotalPlayWeek - actualTotalWinWeek
      const totalLossToUserMonth = actualTotalPlayMonth - actualTotalWinMonth

      let { totalDepositToday, totalDepositWeek, totalDepositMonth, totalWithDrawToday, totalWithDrawWeek, totalWithDrawMonth } = await getDepositData(dateQuery)
      totalDepositToday = totalDepositToday.length ? (!totalDepositToday[0].total ? 0 : totalDepositToday[0].total) : 0
      totalDepositWeek = totalDepositWeek.length ? (!totalDepositWeek[0].total ? 0 : totalDepositWeek[0].total) : 0
      totalDepositMonth = totalDepositMonth.length ? (!totalDepositMonth[0].total ? 0 : totalDepositMonth[0].total) : 0
      totalWithDrawToday = totalWithDrawToday.length ? totalWithDrawToday.reduce((acc, { nValue }) => acc + nValue, 0) : 0
      totalWithDrawWeek = totalWithDrawWeek.length ? totalWithDrawWeek.reduce((acc, { nValue }) => acc + nValue, 0) : 0
      totalWithDrawMonth = totalWithDrawMonth.length ? totalWithDrawMonth.reduce((acc, { nValue }) => acc + nValue, 0) : 0

      const updateObject = {
        oLiveEventPendingOrders: aEventPendingOrders,
        oAdminCommission: {
          nToday: convertToDecimal(totalCommissionToday[0]?.nSellCommission) || 0,
          nWeek: convertToDecimal(totalCommissionWeek[0]?.nSellCommission) || 0,
          nMonth: convertToDecimal(totalCommissionMonth[0]?.nSellCommission) || 0
        },
        oAdminPlatformFees: {
          nToday: convertToDecimal(totalPlatformFeeToday[0]?.nBuyCommission) || 0,
          nWeek: convertToDecimal(totalPlatformFeesWeek[0]?.nBuyCommission) || 0,
          nMonth: convertToDecimal(totalPlatformFeesMonth[0]?.nBuyCommission) || 0
        },
        oUser: {
          nActive: totalActiveUser,
          nInActive: inactiveUser,
          nTotal: totalUsers,
          nDroppedRegistrations: totalDroppedRegs
        },
        oDeposit: {
          nToday: totalDepositToday,
          nWeek: totalDepositWeek,
          nMonth: totalDepositMonth
        },
        oWithdraw: {
          nToday: totalWithDrawToday,
          nWeek: totalWithDrawWeek,
          nMonth: totalWithDrawMonth
        },
        oLoss: {
          nToday: totalLossToUser < 0 ? 0 : convertToDecimal(totalLossToUser),
          nWeek: totalLossToUserWeek < 0 ? 0 : convertToDecimal(totalLossToUserWeek),
          nMonth: totalLossToUserMonth < 0 ? 0 : convertToDecimal(totalLossToUserMonth)
        },
        oWinning: {
          nToday: actualTotalWin,
          nWeek: actualTotalWinWeek,
          nMonth: actualTotalWinMonth
        },
        oPlayReturn: {
          nToday: totalPlayReturnCountToday,
          nWeek: totalPlayReturnCountWeek,
          nMonth: totalPlayReturnCountMonth
        },
        oBotWinners: {
          nToday: actualBotWinCountToday,
          nWeek: actualBotWinCountWeek,
          nMonth: actualBotWinCountMonth
        },
        oRealWinners: {
          nToday: actualUserWinCountToday,
          nWeek: actualUserWinCountWeek,
          nMonth: actualUserWinCountMonth
        },
        aEventData
      }

      const transactionDetails = await PassbookModel.findAll({
        where: { eTransactionType: { [Op.in]: ['Win-OT', 'Win-Return-OT', 'Play-Return-OT', 'Play-OT'] }, eUserType: 'U', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.month.$lt } }] },
        attributes: [
          'eTransactionType',
          [fn('sum', col('nCash')), 'nCash'],
          [fn('DATE_FORMAT', col('dCreatedAt'), '%Y-%m-%d'), 'formattedCreatedAt']
        ],
        group: ['formattedCreatedAt', 'eTransactionType'],
        raw: true
      })

      const mapOfWinTransactionType = {}
      const mapOfPlayTransactionType = {}
      transactionDetails.sort((a, b) => a.eTransactionType > b.eTransactionType ? 1 : -1)

      for (const rec of transactionDetails) {
        if (rec.eTransactionType === 'Win-OT') {
          mapOfWinTransactionType[rec.formattedCreatedAt] = rec.nCash
        } else if (rec.eTransactionType === 'Win-Return-OT') {
          if (mapOfWinTransactionType[rec.formattedCreatedAt]) {
            mapOfWinTransactionType[rec.formattedCreatedAt] -= rec.nCash
          }
        } else if (rec.eTransactionType === 'Play-OT') {
          mapOfPlayTransactionType[rec.formattedCreatedAt] = rec.nCash
        } else if (rec.eTransactionType === 'Play-Return-OT') {
          if (mapOfPlayTransactionType[rec.formattedCreatedAt]) {
            mapOfPlayTransactionType[rec.formattedCreatedAt] -= rec.nCash
          }
        }
      }

      const monthStartDate = dateQuery.month.$gte
      let todayDate = new Date()
      const weekStartDate = dateQuery.week.$gte
      const allDatesFromMonthStart = getAllDatesBetweenTwoRange(monthStartDate, todayDate)
      const allDatesFromWeekStart = getAllDatesBetweenTwoRange(weekStartDate, todayDate)
      todayDate = getAllDatesBetweenTwoRange(new Date())
      const actualWinWeekly = []
      const actualWinMonthly = []
      const actualWinToday = []

      // to plot data in graph we have to send data from month start till today.
      for (const rec of allDatesFromMonthStart) {
        // if win amount is 300 and play amount is 400 then profit of 100 rs.
        // if win amount is 200 and play amount is 100 then loss of 100 rs

        const playTransaction = mapOfPlayTransactionType[rec] || 0
        const winTransaction = mapOfWinTransactionType[rec] || 0

        const amount = playTransaction - winTransaction
        if (allDatesFromWeekStart.includes(rec)) {
          actualWinWeekly.push({ nCash: parseFloat(amount.toFixed(4)), createdAt: rec })
        }
        if (todayDate.includes(rec)) {
          actualWinToday.push({ nCash: parseFloat(amount.toFixed(4)), createdAt: rec })
        }
        actualWinMonthly.push({ nCash: parseFloat(amount.toFixed(4)), createdAt: rec })
      }

      updateObject['oEarning.aMonth'] = actualWinMonthly
      updateObject['oEarning.aWeek'] = actualWinWeekly
      updateObject['oEarning.aToday'] = actualWinToday

      await DashboardModel.updateOne({}, { $set: updateObject }, { upsert: true })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cDashboard) })
    } catch (error) {
      return catchError('DashboardCron.updateDashboardDetails', error, req, res)
    }
  }

  async fetchCurrentBalance(req, res) {
    try {
      const data = await UserBalanceModel.findOne({
        attributes: [
          [fn('SUM', col('nCurrentDepositBalance')), 'totalDepositBalance'],
          [fn('SUM', col('nCurrentWinningBalance')), 'totalWinningBalance'],
          [fn('SUM', col('nCurrentBonus')), 'totalBonusBalance']
        ]
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cBalance), data })
    } catch (error) {
      catchError('AdminDashboard.fetchDashboard', error, req, res)
    }
  }
}

module.exports = new AdminDashboard()
