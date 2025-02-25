const { status, jsonStatus, messages } = require('../../helper/api.responses')
const { catchError, ObjectId, handleCatchError } = require('../../helper/utilities.services')
const { getUserCount, findTotalCashDeposit, getDepositOfPG, getPlatformFeeDataDeposit, getPlatformFeeDataWithdraw, getWithdrawOfPG, droppedRegistrationCount, getDatesObj, getDateRangeQuery, getDepositOfDateRange, getDepositOfPgInDateRange, getPlatformFeeDataDepositDateRange, getDateRangeWithdrawOfPG, getPlatformFeeDataWithdrawDateRange } = require('../../middlewares/common')
const ReportModel = require('./model')
const AuthLogsModel = require('../user/authlogs.model')
const PassbookModel = require('../passbook/model')
const UsersModel = require('../user/model')
const { fn, col, Op } = require('sequelize')
const { fetchReportData, fetchTotalTax, fetchParticipants, fetchMapOfCategory, buildOrderReportData, buildPassbookReportData, mergeUserOrderArrays, fetchSubCategoryReportData } = require('./helper')
const CategoryModel = require('../category/model')
const AppDownloadModel = require('../appDownload/model')
const UserTdsModel = require('../userTds/model')
const { eCategoryType, appPlatform, orderStatus, transactionType, userType, eventStatus, aTaxTransactions } = require('../../data')
const EventModel = require('../event/model')
const SubCategoryModel = require('../sub-category/model')
const oReportService = {}

oReportService.fetchReport = async (req, res) => {
  try {
    const data = await ReportModel.find({}).lean()
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cReport), data })
  } catch (error) {
    return catchError('Report.fetchReport', error, req, res)
  }
}

oReportService.fetchUserReport = async (req, res) => {
  try {
    let report
    const { eKey, eType } = req.body

    const dateQuery = getDatesObj()

    if (eKey === 'TU') { // Total User
      const oTotalUser = {}
      oTotalUser.nTotalUsers = await getUserCount({ eType })
      // oTotalUser.nTotalEmailVerifiedUsers = await getUserCount({ bIsEmailVerified: true, eType })
      oTotalUser.nTotalPhoneVerifiedUsers = await getUserCount({ bIsMobVerified: true, eType })
      report = { oTotalUser: { ...oTotalUser, dUpdatedAt: new Date() } }
    } else if (eKey === 'RU') { // Register User
      const oRegisterUser = {}
      oRegisterUser.nToday = await getUserCount({ eType, dCreatedAt: dateQuery.toDay })
      oRegisterUser.nYesterday = await getUserCount({ eType, dCreatedAt: dateQuery.yesterDay })
      oRegisterUser.nLastWeek = await getUserCount({ eType, dCreatedAt: dateQuery.week })
      oRegisterUser.nLastMonth = await getUserCount({ eType, dCreatedAt: dateQuery.month })
      oRegisterUser.nLastYear = await getUserCount({ eType, dCreatedAt: dateQuery.year })
      oRegisterUser.aPlatformWiseUser = await AuthLogsModel.aggregate([
        {
          $match: {
            eType: 'R'
          }
        },
        {
          $group: {
            _id: '$ePlatform',
            count: {
              $sum: 1
            }
          }
        },
        {
          $project: {
            _id: 0,
            eTitle: '$_id',
            nValue: '$count'
          }
        }
      ]).allowDiskUse(true).exec()
      report = { oRegisterUser: { ...oRegisterUser, dUpdatedAt: new Date() } }
    } else if (eKey === 'LU') { // Login User
      const oLoginUser = {}
      oLoginUser.nToday = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.toDay })
      oLoginUser.nYesterday = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.yesterDay })
      oLoginUser.nLastWeek = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.week })
      oLoginUser.nLastMonth = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.month })
      oLoginUser.nLastYear = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.year })
      report = { oLoginUser: { ...oLoginUser, dUpdatedAt: new Date() } }
    } else if (eKey === 'TUT') { // Total User Transaction
      const oDeposit = {}
      const eUserType = eType
      const nTotalWinnings = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Win-OT', eUserType }, raw: true })
      oDeposit.nTotalWinnings = nTotalWinnings.length ? (!nTotalWinnings[0].total ? 0 : nTotalWinnings[0].total) : 0

      const [nTotalDeposits, nTotalPendingDeposits, nTotalSuccessDeposits, nTotalCancelledDeposits, nTotalRejectedDeposits, aDeposits, nFeesData] = await Promise.all([
        findTotalCashDeposit({ where: { eUserType }, raw: true }), // get total of nCash
        findTotalCashDeposit({ where: { eUserType, ePaymentStatus: 'P' }, raw: true }),
        findTotalCashDeposit({ where: { eUserType, ePaymentStatus: 'S' }, raw: true }),
        findTotalCashDeposit({ where: { eUserType, ePaymentStatus: 'C' }, raw: true }),
        findTotalCashDeposit({ where: { eUserType, ePaymentStatus: 'R' }, raw: true }),
        getDepositOfPG({ group: 'ePaymentGateway', where: { eUserType, ePaymentStatus: 'S' }, raw: true }),
        getPlatformFeeDataDeposit({ where: { eUserType, ePaymentStatus: 'S' }, raw: true })
      ])

      oDeposit.nTotalDeposits = nTotalDeposits.length ? (!nTotalDeposits[0].total ? 0 : nTotalDeposits[0].total) : 0
      oDeposit.nTotalPendingDeposits = nTotalPendingDeposits.length ? (!nTotalPendingDeposits[0].total ? 0 : nTotalPendingDeposits[0].total) : 0
      oDeposit.nTotalSuccessDeposits = nTotalSuccessDeposits.length ? (!nTotalSuccessDeposits[0].total ? 0 : nTotalSuccessDeposits[0].total) : 0
      oDeposit.nTotalCancelledDeposits = nTotalCancelledDeposits.length ? (!nTotalCancelledDeposits[0].total ? 0 : nTotalCancelledDeposits[0].total) : 0
      oDeposit.nTotalRejectedDeposits = nTotalRejectedDeposits.length ? (!nTotalRejectedDeposits[0].total ? 0 : nTotalRejectedDeposits[0].total) : 0
      oDeposit.aDeposits = aDeposits
      oDeposit.nTotalPlatformFee = nFeesData.length ? (!nFeesData[0].feeTotal ? 0 : nFeesData[0].feeTotal) : 0
      oDeposit.nActualDepositAmount = nFeesData.length ? (!nFeesData[0].actualAmountTotal ? 0 : nFeesData[0].actualAmountTotal) : 0
      oDeposit.nTotalApplicableTax = nFeesData.length ? (!nFeesData[0].applicableTaxAmountTotal ? 0 : nFeesData[0].applicableTaxAmountTotal) : 0
      report = { oDeposit: { ...oDeposit, dUpdatedAt: new Date() } }
    } else if (eKey === 'W') { // Withdraw
      const oWithdraw = {}
      const eUserType = eType

      const [aSuccessWithdrawals, aPendingWithdrawals, nFeesData] = await Promise.all([
        getWithdrawOfPG({ group: 'ePaymentGateway', where: { ePaymentStatus: 'S', eUserType }, raw: true }),
        getWithdrawOfPG({ group: 'ePaymentGateway', where: { ePaymentStatus: 'P', eUserType }, raw: true }),
        getPlatformFeeDataWithdraw({ where: { eUserType, ePaymentStatus: 'S' }, raw: true })
      ])

      oWithdraw.aSuccessWithdrawals = aSuccessWithdrawals
      oWithdraw.aPendingWithdrawals = aPendingWithdrawals
      oWithdraw.nTotalPlatformFee = nFeesData.length ? (!nFeesData[0].feeTotal ? 0 : nFeesData[0].feeTotal) : 0
      oWithdraw.nActualWithdrawAmount = nFeesData.length ? (!nFeesData[0].actualAmountTotal ? 0 : nFeesData[0].actualAmountTotal) : 0
      oWithdraw.nTotalWithdrawals = oWithdraw.aSuccessWithdrawals.length ? oWithdraw.aSuccessWithdrawals.reduce((acc, { nValue }) => acc + nValue, 0) : 0
      oWithdraw.nTotalApplicableTax = nFeesData.length ? (!nFeesData[0].applicableTaxAmountTotal ? 0 : nFeesData[0].applicableTaxAmountTotal) : 0
      report = { oWithdraw: { ...oWithdraw, dUpdatedAt: new Date() } }
    } else if (eKey === 'UB') { // User Bonus
      const oUserBonus = {}
      const eUserType = eType

      const nTotal = await PassbookModel.findAll({
        attributes: [[fn('sum', col('nBonus')), 'total']],
        where: {
          eUserType,
          [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }]
        },
        raw: true
      })
      oUserBonus.nTotal = nTotal.length ? (!nTotal[0].total ? 0 : nTotal[0].total) : 0

      const nToday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.toDay.$lt } }] }, raw: true })
      oUserBonus.nToday = nToday.length ? (!nToday[0].total ? 0 : nToday[0].total) : 0

      const nYesterday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.yesterDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.yesterDay.$lt } }] }, raw: true })
      oUserBonus.nYesterday = nYesterday.length ? (!nYesterday[0].total ? 0 : nYesterday[0].total) : 0

      const nLastWeek = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.week.$lt } }] }, raw: true })
      oUserBonus.nLastWeek = nLastWeek.length ? (!nLastWeek[0].total ? 0 : nLastWeek[0].total) : 0

      const nLastMonth = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.month.$lt } }] }, raw: true })
      oUserBonus.nLastMonth = nLastMonth.length ? (!nLastMonth[0].total ? 0 : nLastMonth[0].total) : 0

      const nLastYear = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.year.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.year.$lt } }] }, raw: true })
      oUserBonus.nLastYear = nLastYear.length ? (!nLastYear[0].total ? 0 : nLastYear[0].total) : 0
      report = { oUserBonus: { ...oUserBonus, dUpdatedAt: new Date() } }
    } else if (eKey === 'BE') { // Bonus Expire
      const oBonusExpire = {}
      const eUserType = eType

      const nTotal = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'Bonus-Expire', eUserType }, raw: true })
      oBonusExpire.nTotal = nTotal.length ? (!nTotal[0].total ? 0 : nTotal[0].total) : 0

      const nToday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.toDay.$lt } }] }, raw: true })
      oBonusExpire.nToday = nToday.length ? (!nToday[0].total ? 0 : nToday[0].total) : 0

      const nYesterday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.yesterDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.yesterDay.$lt } }] }, raw: true })
      oBonusExpire.nYesterday = nYesterday.length ? (!nYesterday[0].total ? 0 : nYesterday[0].total) : 0

      const nLastWeek = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.week.$lt } }] }, raw: true })
      oBonusExpire.nLastWeek = nLastWeek.length ? (!nLastWeek[0].total ? 0 : nLastWeek[0].total) : 0

      const nLastMonth = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.month.$lt } }] }, raw: true })
      oBonusExpire.nLastMonth = nLastMonth.length ? (!nLastMonth[0].total ? 0 : nLastMonth[0].total) : 0

      const nLastYear = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.year.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.year.$lt } }] }, raw: true })
      oBonusExpire.nLastYear = nLastYear.length ? (!nLastYear[0].total ? 0 : nLastYear[0].total) : 0
      report = { oBonusExpire: { ...oBonusExpire, dUpdatedAt: new Date() } }
    } else if (eKey === 'TDS') {
      const oTds = {}
      const eUserType = eType

      const nTotalTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType }, raw: true })
      oTds.nTotalTds = nTotalTds.length ? (!nTotalTds[0].total ? 0 : nTotalTds[0].total) : 0

      const nTotalActiveTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eStatus: 'A', eUserType }, raw: true })
      oTds.nTotalActiveTds = nTotalActiveTds.length ? (!nTotalActiveTds[0].total ? 0 : nTotalActiveTds[0].total) : 0

      const nTotalPendingTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eStatus: 'P', eUserType }, raw: true })
      oTds.nTotalPendingTds = nTotalPendingTds.length ? (!nTotalPendingTds[0].total ? 0 : nTotalPendingTds[0].total) : 0

      report = { oTds: { ...oTds, dUpdatedAt: new Date() } }
    } else if (eKey === 'DR') { // dropped registrations counts
      const dateQuery = getDatesObj()

      const [todayObj, yesterdayObj, lastWeekObj, lastMonthObj, lastYearObj] = await Promise.all([
        droppedRegistrationCount(dateQuery.toDay),
        droppedRegistrationCount(dateQuery.yesterDay),
        droppedRegistrationCount(dateQuery.week),
        droppedRegistrationCount(dateQuery.month),
        droppedRegistrationCount(dateQuery.year)
      ])

      const oDroppedRegistrations = {}
      oDroppedRegistrations.nToday = todayObj ? todayObj.finalCount : 0
      oDroppedRegistrations.nYesterday = yesterdayObj ? yesterdayObj.finalCount : 0
      oDroppedRegistrations.nLastWeek = lastWeekObj ? lastWeekObj.finalCount : 0
      oDroppedRegistrations.nLastMonth = lastMonthObj ? lastMonthObj.finalCount : 0
      oDroppedRegistrations.nLastYear = lastYearObj ? lastYearObj.finalCount : 0
      report = { oDroppedRegistrations: { ...oDroppedRegistrations, dUpdatedAt: new Date() } }
    } else if (eKey === 'IC') {
      const oInactivityCharge = {}
      const nTotalInActivityCharge = await PassbookModel.findOne({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'Deactivate-User' }, raw: true })
      oInactivityCharge.nTotalInActivityCharge = nTotalInActivityCharge?.total || 0
      oInactivityCharge.dUpdatedAt = new Date()
      report = { oInactivityCharge }
    }
    // else if (eKey === 'SR') {
    //   // streak reward
    //   const oStreakReward = {}
    //   const eUserType = eType

    //   const nTotal = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'User-Streak', eUserType }, raw: true })
    //   oStreakReward.nTotal = nTotal.length ? (!nTotal[0].total ? 0 : nTotal[0].total) : 0

    //   const nToday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'User-Streak', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.toDay.$lt } }] }, raw: true })
    //   oStreakReward.nToday = nToday.length ? (!nToday[0].total ? 0 : nToday[0].total) : 0

    //   const nYesterday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'User-Streak', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.yesterDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.yesterDay.$lt } }] }, raw: true })
    //   oStreakReward.nYesterday = nYesterday.length ? (!nYesterday[0].total ? 0 : nYesterday[0].total) : 0

    //   const nLastWeek = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'User-Streak', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.week.$lt } }] }, raw: true })
    //   oStreakReward.nLastWeek = nLastWeek.length ? (!nLastWeek[0].total ? 0 : nLastWeek[0].total) : 0

    //   const nLastMonth = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'User-Streak', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.month.$lt } }] }, raw: true })
    //   oStreakReward.nLastMonth = nLastMonth.length ? (!nLastMonth[0].total ? 0 : nLastMonth[0].total) : 0

    //   const nLastYear = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'User-Streak', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.year.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.year.$lt } }] }, raw: true })
    //   oStreakReward.nLastYear = nLastYear.length ? (!nLastYear[0].total ? 0 : nLastYear[0].total) : 0

    //   report = { oStreakReward: { ...oStreakReward, dUpdatedAt: new Date() } }
    // }
    // else if (eKey === 'USTD') {
    //   // user streak detail
    //   const oUserStreakDetails = {}

    //   const [dayWiseStreak, maxAndAvgStreak] = await Promise.all([
    //     UserStreakModel.aggregate([
    //       {
    //         $group: {
    //           _id: '$day',
    //           count: { $sum: 1 }
    //         }
    //       },
    //       {
    //         $project: {
    //           nDay: '$_id',
    //           count: '$count',
    //           _id: false
    //         }
    //       }
    //     ]), UserStreakModel.aggregate([
    //       {
    //         $project: {
    //           nAvgStreak: { $avg: '$day' },
    //           nMaximum: { $max: '$day' }
    //         }
    //       }
    //     ])])
    //   oUserStreakDetails.aDayWise = dayWiseStreak
    //   oUserStreakDetails.avgStreak = maxAndAvgStreak[0].nAvgStreak
    //   oUserStreakDetails.maxStreak = maxAndAvgStreak[0].nMaximum
    //   report = { oUserStreakDetails: { ...oUserStreakDetails, dUpdatedAt: new Date() } }
    // }
    else {
      return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
    }
    await ReportModel.updateOne({ eType }, { ...report }, { upsert: true })

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: { ...report } })
  } catch (error) {
    return catchError('Report.fetchUserReport', error, req, res)
  }
}

oReportService.playReport = async (req, res) => {
  try {
    const { eCategory, eType } = req.body

    const dateQuery = getDatesObj()

    // if (eKey !== 'PL') {
    //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
    // }
    const data = await ReportModel.findOne({
      eType,
      aPlayed: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }).lean()
    if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cReport) }) }

    const oCategory = await CategoryModel.findOne({ eCategoryType: eCategory.toUpperCase() }, { _id: 1 }).lean()
    if (!oCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCategory) }) }
    const iCategoryId = oCategory._id.toString()
    const { playedCash: nTotalCash, playedBonus: nTotalBonus } = await fetchReportData(iCategoryId, 'Played', eType, { $lte: new Date() })
    const { playedCash: nTodayCash, playedBonus: nTodayBonus } = await fetchReportData(iCategoryId, 'Played', eType, dateQuery.toDay)
    const { playedCash: nYesterCash, playedBonus: nYesterBonus } = await fetchReportData(iCategoryId, 'Played', eType, dateQuery.yesterDay)
    const { playedCash: nWeekCash, playedBonus: nWeekBonus } = await fetchReportData(iCategoryId, 'Played', eType, dateQuery.week)
    const { playedCash: nMonthCash, playedBonus: nMonthBonus } = await fetchReportData(iCategoryId, 'Played', eType, dateQuery.month)
    const { playedCash: nYearCash, playedBonus: nYearBonus } = await fetchReportData(iCategoryId, 'Played', eType, dateQuery.year)

    const report = {
      'aPlayed.$.nTotalCash': nTotalCash,
      'aPlayed.$.nTotalBonus': nTotalBonus,
      'aPlayed.$.nTodayCash': nTodayCash,
      'aPlayed.$.nTodayBonus': nTodayBonus,
      'aPlayed.$.nYesterCash': nYesterCash,
      'aPlayed.$.nYesterBonus': nYesterBonus,
      'aPlayed.$.nWeekCash': nWeekCash,
      'aPlayed.$.nWeekBonus': nWeekBonus,
      'aPlayed.$.nMonthCash': nMonthCash,
      'aPlayed.$.nMonthBonus': nMonthBonus,
      'aPlayed.$.nYearCash': nYearCash,
      'aPlayed.$.nYearBonus': nYearBonus,
      'aPlayed.$.dUpdatedAt': new Date()
    }

    const updateData = await ReportModel.findOneAndUpdate({
      eType,
      aPlayed: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
    const responseData = updateData.aPlayed.find(({ _id }) => _id.toString() === req.params.id.toString())

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: responseData })
  } catch (error) {
    return catchError('UpdateReport.playReport', error, req, res)
  }
}

oReportService.playReturnReport = async (req, res) => {
  try {
    const { eCategory, eType } = req.body
    // if (eKey !== 'PR') {
    //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
    // }
    const data = await ReportModel.findOne({
      eType,
      aPlayReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }).lean()
    if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cReport) }) }

    const dateQuery = getDatesObj()
    const oCategory = await CategoryModel.findOne({ eCategoryType: eCategory.toUpperCase() }, { _id: 1 }).lean()
    if (!oCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCategory) }) }
    const iCategoryId = oCategory._id.toString()

    const { playReturnCash: nTotalCash, playReturnBonus: nTotalBonus } = await fetchReportData(iCategoryId, 'PlayReturn', eType, { $lte: new Date() })
    const { playReturnCash: nTodayCash, playReturnBonus: nTodayBonus } = await fetchReportData(iCategoryId, 'PlayReturn', eType, dateQuery.toDay)
    const { playReturnCash: nYesterCash, playReturnBonus: nYesterBonus } = await fetchReportData(iCategoryId, 'PlayReturn', eType, dateQuery.yesterDay)
    const { playReturnCash: nWeekCash, playReturnBonus: nWeekBonus } = await fetchReportData(iCategoryId, 'PlayReturn', eType, dateQuery.week)
    const { playReturnCash: nMonthCash, playReturnBonus: nMonthBonus } = await fetchReportData(iCategoryId, 'PlayReturn', eType, dateQuery.month)
    const { playReturnCash: nYearCash, playReturnBonus: nYearBonus } = await fetchReportData(iCategoryId, 'PlayReturn', eType, dateQuery.year)

    const report = {
      'aPlayReturn.$.nTotalCash': nTotalCash || 0,
      'aPlayReturn.$.nTotalBonus': nTotalBonus || 0,
      'aPlayReturn.$.nTodayCash': nTodayCash || 0,
      'aPlayReturn.$.nTodayBonus': nTodayBonus || 0,
      'aPlayReturn.$.nYesterCash': nYesterCash || 0,
      'aPlayReturn.$.nYesterBonus': nYesterBonus || 0,
      'aPlayReturn.$.nWeekCash': nWeekCash || 0,
      'aPlayReturn.$.nWeekBonus': nWeekBonus || 0,
      'aPlayReturn.$.nMonthCash': nMonthCash || 0,
      'aPlayReturn.$.nMonthBonus': nMonthBonus || 0,
      'aPlayReturn.$.nYearCash': nYearCash || 0,
      'aPlayReturn.$.nYearBonus': nYearBonus || 0,
      'aPlayReturn.$.dUpdatedAt': new Date()
    }

    const updateData = await ReportModel.findOneAndUpdate({
      eType,
      aPlayReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
    const responseData = updateData.aPlayReturn.find(({ _id }) => _id.toString() === req.params.id.toString())

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: responseData })
  } catch (error) {
    return catchError('UpdateReport.playReturnReport', error, req, res)
  }
}

oReportService.fetchWinReport = async (req, res) => {
  try {
    const { eCategory, eType } = req.body
    // if (eKey !== 'TW') {
    //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
    // }
    const data = await ReportModel.findOne({
      eType,
      aWins: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }).lean()
    if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cReport) }) }

    const dateQuery = getDatesObj()

    const oCategory = await CategoryModel.findOne({ eCategoryType: eCategory.toUpperCase() }, { _id: 1 }).lean()
    if (!oCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCategory) }) }
    const iCategoryId = oCategory._id.toString()
    const { winCash: nTotalCash, winBonus: nTotalBonus } = await fetchReportData(iCategoryId, 'Wins', eType, { $lte: new Date() })
    console.log({ winCash: nTotalCash, winBonus: nTotalBonus })
    const { winCash: nTodayCash, winBonus: nTodayBonus } = await fetchReportData(iCategoryId, 'Wins', eType, dateQuery.toDay)
    const { winCash: nYesterCash, winBonus: nYesterBonus } = await fetchReportData(iCategoryId, 'Wins', eType, dateQuery.yesterDay)
    const { winCash: nWeekCash, winBonus: nWeekBonus } = await fetchReportData(iCategoryId, 'Wins', eType, dateQuery.week)
    const { winCash: nMonthCash, winBonus: nMonthBonus } = await fetchReportData(iCategoryId, 'Wins', eType, dateQuery.month)
    const { winCash: nYearCash, winBonus: nYearBonus } = await fetchReportData(iCategoryId, 'Wins', eType, dateQuery.year)

    const report = {
      'aWins.$.nTotalCash': nTotalCash || 0,
      'aWins.$.nTotalBonus': nTotalBonus || 0,
      'aWins.$.nTodayCash': nTodayCash || 0,
      'aWins.$.nTodayBonus': nTodayBonus || 0,
      'aWins.$.nYesterCash': nYesterCash || 0,
      'aWins.$.nYesterBonus': nYesterBonus || 0,
      'aWins.$.nWeekBonus': nWeekBonus || 0,
      'aWins.$.nWeekCash': nWeekCash || 0,
      'aWins.$.nMonthCash': nMonthCash || 0,
      'aWins.$.nMonthBonus': nMonthBonus || 0,
      'aWins.$.nYearCash': nYearCash || 0,
      'aWins.$.nYearBonus': nYearBonus || 0,
      'aWins.$.dUpdatedAt': new Date()
    }

    const updateData = await ReportModel.findOneAndUpdate({
      eType,
      aWins: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
    const responseData = updateData.aWins.find(({ _id }) => _id.toString() === req.params.id.toString())

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: responseData })
  } catch (error) {
    return catchError('UpdateReport.fetchWinReport', error, req, res)
  }
}

oReportService.creatorBonusReport = async (req, res) => {
  try {
    const { eCategory } = req.body
    // if (eKey !== 'CB') {
    //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
    // }
    const data = await ReportModel.findOne({
      eType: 'U',
      aCreatorBonus: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }).lean()
    if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cReport) }) }

    const dateQuery = getDatesObj()

    const oCategory = await CategoryModel.findOne({ eCategoryType: eCategory.toUpperCase() }, { _id: 1 }).lean()
    if (!oCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCategory) }) }
    const iCategoryId = oCategory._id.toString()
    const nTotal = await fetchReportData(iCategoryId, 'CreatorBonus', 'U', { $lte: new Date() })
    const nToday = await fetchReportData(iCategoryId, 'CreatorBonus', 'U', dateQuery.toDay)
    const nYesterday = await fetchReportData(iCategoryId, 'CreatorBonus', 'U', dateQuery.yesterDay)
    const nWeek = await fetchReportData(iCategoryId, 'CreatorBonus', 'U', dateQuery.week)
    const nMonth = await fetchReportData(iCategoryId, 'CreatorBonus', 'U', dateQuery.month)
    const nYear = await fetchReportData(iCategoryId, 'CreatorBonus', 'U', dateQuery.year)

    const report = {
      'aCreatorBonus.$.nTotal': nTotal || 0,
      'aCreatorBonus.$.nToday': nToday || 0,
      'aCreatorBonus.$.nYesterday': nYesterday || 0,
      'aCreatorBonus.$.nLastWeek': nWeek || 0,
      'aCreatorBonus.$.nLastMonth': nMonth || 0,
      'aCreatorBonus.$.nLastYear': nYear || 0,
      'aCreatorBonus.$.dUpdatedAt': new Date()
    }

    const updateData = await ReportModel.findOneAndUpdate({
      eType: 'U',
      aCreatorBonus: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
    const responseData = updateData.aCreatorBonus.find(({ _id }) => _id.toString() === req.params.id.toString())

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: responseData })
  } catch (error) {
    return catchError('UpdateReport.creatorBonusReport', error, req, res)
  }
}

oReportService.creatorBonusReturnReport = async (req, res) => {
  try {
    const { eCategory } = req.body
    // if (eKey !== 'CBR') {
    //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
    // }
    const data = await ReportModel.findOne({
      eType: 'U',
      aCreatorBonusReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }).lean()
    if (!data) {
      return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cReport) })
    }

    const dateQuery = getDatesObj()

    const oCategory = await CategoryModel.findOne({ eCategoryType: eCategory.toUpperCase() }, { _id: 1 }).lean()
    if (!oCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCategory) }) }
    const iCategoryId = oCategory._id.toString()
    const nTotal = await fetchReportData(iCategoryId, 'CreatorBonusReturn', 'U', { $lte: new Date() })
    const nToday = await fetchReportData(iCategoryId, 'CreatorBonusReturn', 'U', dateQuery.toDay)
    const nYesterday = await fetchReportData(iCategoryId, 'CreatorBonusReturn', 'U', dateQuery.yesterDay)
    const nWeek = await fetchReportData(iCategoryId, 'CreatorBonusReturn', 'U', dateQuery.week)
    const nMonth = await fetchReportData(iCategoryId, 'CreatorBonusReturn', 'U', dateQuery.month)
    const nYear = await fetchReportData(iCategoryId, 'CreatorBonusReturn', 'U', dateQuery.year)

    const report = {
      'aCreatorBonusReturn.$.nTotal': nTotal || 0,
      'aCreatorBonusReturn.$.nToday': nToday || 0,
      'aCreatorBonusReturn.$.nYesterday': nYesterday || 0,
      'aCreatorBonusReturn.$.nLastWeek': nWeek || 0,
      'aCreatorBonusReturn.$.nLastMonth': nMonth || 0,
      'aCreatorBonusReturn.$.nLastYear': nYear || 0,
      'aCreatorBonusReturn.$.dUpdatedAt': new Date()
    }

    const updateData = await ReportModel.findOneAndUpdate({
      eType: 'U',
      aCreatorBonusReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
    const responseData = updateData.aCreatorBonusReturn.find(({ _id }) => _id.toString() === req.params.id.toString())

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: responseData })
  } catch (error) {
    return catchError('UpdateReport.creatorBonusReturnReport', error, req, res)
  }
}

oReportService.fetchAppDownloadReport = async (req, res) => {
  try {
    const { ePlatform } = req.body
    // if (eKey !== 'AD') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })

    const data = await ReportModel.findOne({
      eType: 'U',
      aAppDownload: { $elemMatch: { _id: ObjectId(req.params.id), ePlatform: ePlatform.toUpperCase() } }
    }).lean()
    if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cReport) }) }

    const dateQuery = getDatesObj()
    const countData = await Promise.all([
      AppDownloadModel.countDocuments({ dCreatedAt: { $lte: new Date() }, ePlatform }),
      AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.toDay, ePlatform }),
      AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.yesterDay, ePlatform }),
      AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.week, ePlatform }),
      AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.month, ePlatform }),
      AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.year, ePlatform })
    ])

    const report = {
      'aAppDownload.$.nTotal': countData[0] || 0,
      'aAppDownload.$.nToday': countData[1] || 0,
      'aAppDownload.$.nYesterday': countData[2] || 0,
      'aAppDownload.$.nLastWeek': countData[3] || 0,
      'aAppDownload.$.nLastMonth': countData[4] || 0,
      'aAppDownload.$.nLastYear': countData[5] || 0,
      'aAppDownload.$.dUpdatedAt': new Date()
    }
    const updateData = await ReportModel.findOneAndUpdate({
      eType: 'U',
      aAppDownload: { $elemMatch: { _id: ObjectId(req.params.id), ePlatform: ePlatform.toUpperCase() } }
    }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
    const responseData = updateData.aAppDownload.find((platform) => platform.ePlatform === ePlatform)
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: responseData })
  } catch (error) {
    return catchError('UpdateReport.fetchAppDownloadReport', error, req, res)
  }
}

oReportService.fetchTaxReport = async (req, res) => {
  try {
    const { eCategory = null, eTransactionType = null, eType } = req.body
    // if (eKey !== 'TX') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })

    const [query, field] = eTransactionType ? [{
      eType,
      'oApplicableTax.aCategoryTax': { $elemMatch: { _id: ObjectId(req.params.id), eTransactionType: eTransactionType.toUpperCase() } }
    }, 'aCategoryTax'] : [{
      eType,
      'oApplicableTax.aContestJoinTax': { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }, 'aContestJoinTax']

    const data = await ReportModel.findOne(query).lean()
    if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cReport) }) }

    const dateQuery = getDatesObj()

    const { nTotalTax: nTotal } = await fetchTotalTax(eCategory, eTransactionType, { $lte: new Date() }, eType)
    const { nTotalTax: nToday } = await fetchTotalTax(eCategory, eTransactionType, dateQuery.toDay, eType)
    const { nTotalTax: nYesterday } = await fetchTotalTax(eCategory, eTransactionType, dateQuery.yesterDay, eType)
    const { nTotalTax: nLastWeek } = await fetchTotalTax(eCategory, eTransactionType, dateQuery.week, eType)
    const { nTotalTax: nLastMonth } = await fetchTotalTax(eCategory, eTransactionType, dateQuery.month, eType)
    const { nTotalTax: nLastYear } = await fetchTotalTax(eCategory, eTransactionType, dateQuery.year, eType)

    const report = {
      [`oApplicableTax.${field}.$.nTotal`]: nTotal || 0,
      [`oApplicableTax.${field}.$.nToday`]: nToday || 0,
      [`oApplicableTax.${field}.$.nYesterday`]: nYesterday || 0,
      [`oApplicableTax.${field}.$.nLastWeek`]: nLastWeek || 0,
      [`oApplicableTax.${field}.$.nLastMonth`]: nLastMonth || 0,
      [`oApplicableTax.${field}.$.nLastYear`]: nLastYear || 0,
      [`oApplicableTax.${field}.$.dUpdatedAt`]: new Date()
    }
    // console.log('last object', report, query)
    const updatedData = await ReportModel.findOneAndUpdate(query, { ...report }, { new: true, runValidators: true }).lean()
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: updatedData.oApplicableTax })
  } catch (error) {
    return catchError('UpdateReport.fetchTaxReport', error, req, res)
  }
}

oReportService.fetchfilterReport = async (req, res) => {
  try {
    const { dStartDate, dEndDate, eKey, eType } = req.query

    const { isError, query } = await getDateRangeQuery([dStartDate, dEndDate])
    if (isError) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].daterange_not_proper })

    const oDateCondition = query.dStartDate
    const dDate = new Date()
    const report = {}
    if (eKey === 'USER_REPORT') {
      const query = { dCreatedAt: oDateCondition }
      const oTotalUser = {}
      oTotalUser.nTotalUsers = await UsersModel.countDocuments({ ...query, eType })
      // oTotalUser.nTotalEmailVerifiedUsers = await UsersModel.countDocuments({ bIsEmailVerified: true, ...query, eType: 'U' })
      oTotalUser.nTotalPhoneVerifiedUsers = await UsersModel.countDocuments({ bIsMobVerified: true, ...query, eType: 'U' })
      report.oTotalUser = { ...oTotalUser, dUpdatedAt: dDate }

      const oRegisterUser = {}
      oRegisterUser.Total = await UsersModel.countDocuments({ ...query, eType })
      oRegisterUser.aPlatformWiseUser = await AuthLogsModel.aggregate([
        {
          $match: {
            eType: 'R'
          }
        },
        {
          $group: {
            _id: '$ePlatform',
            count: {
              $sum: 1
            }
          }
        },
        {
          $project: {
            _id: 0,
            eTitle: '$_id',
            nValue: '$count'
          }
        }
      ]).allowDiskUse(true).exec()
      report.oRegisterUser = { ...oRegisterUser, dUpdatedAt: new Date() }

      const oLoginUser = {}
      oLoginUser.Total = await UsersModel.countDocuments({ dLoginAt: oDateCondition, eType })
      report.oLoginUser = { ...oLoginUser, dUpdatedAt: new Date() }

      const oDroppedRegistrations = {}
      const resObj = await droppedRegistrationCount(oDateCondition)
      oDroppedRegistrations.Total = resObj ? resObj.finalCount : 0
      report.oDroppedRegistrations = { ...oDroppedRegistrations, dUpdatedAt: new Date() }

      const oDeposit = {}
      const eUserType = eType

      const nTotalWinnings = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Win-OT', eUserType, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
      oDeposit.nTotalWinnings = nTotalWinnings.length ? (!nTotalWinnings[0].total ? 0 : nTotalWinnings[0].total) : 0

      const [nTotalDeposits, nTotalPendingDeposits, nTotalSuccessDeposits, nTotalCancelledDeposits, nTotalRejectedDeposits, aDeposits, nFeesData] = await Promise.all([
        getDepositOfDateRange({ where: { eUserType }, raw: true }, { dStartDate, dEndDate }),
        getDepositOfDateRange({ where: { eUserType, ePaymentStatus: 'P' }, raw: true }, { dStartDate, dEndDate }),
        getDepositOfDateRange({ where: { eUserType, ePaymentStatus: 'S' }, raw: true }, { dStartDate, dEndDate }),
        getDepositOfDateRange({ where: { eUserType, ePaymentStatus: 'C' }, raw: true }, { dStartDate, dEndDate }),
        getDepositOfDateRange({ where: { eUserType, ePaymentStatus: 'R' }, raw: true }, { dStartDate, dEndDate }),
        getDepositOfPgInDateRange({ group: 'ePaymentGateway', where: { ePaymentStatus: 'S', eUserType }, raw: true }, { dStartDate, dEndDate }),
        getPlatformFeeDataDepositDateRange({ where: { eUserType, ePaymentStatus: 'S' }, raw: true }, { dStartDate, dEndDate })
      ])

      oDeposit.nTotalDeposits = nTotalDeposits.length ? (!nTotalDeposits[0].total ? 0 : nTotalDeposits[0].total) : 0
      oDeposit.nTotalPendingDeposits = nTotalPendingDeposits.length ? (!nTotalPendingDeposits[0].total ? 0 : nTotalPendingDeposits[0].total) : 0
      oDeposit.nTotalSuccessDeposits = nTotalSuccessDeposits.length ? (!nTotalSuccessDeposits[0].total ? 0 : nTotalSuccessDeposits[0].total) : 0
      oDeposit.nTotalCancelledDeposits = nTotalCancelledDeposits.length ? (!nTotalCancelledDeposits[0].total ? 0 : nTotalCancelledDeposits[0].total) : 0
      oDeposit.nTotalRejectedDeposits = nTotalRejectedDeposits.length ? (!nTotalRejectedDeposits[0].total ? 0 : nTotalRejectedDeposits[0].total) : 0
      oDeposit.aDeposits = aDeposits
      oDeposit.nTotalPlatformFee = nFeesData.length ? (!nFeesData[0].feeTotal ? 0 : nFeesData[0].feeTotal) : 0
      oDeposit.nActualDepositAmount = nFeesData.length ? (!nFeesData[0].actualAmountTotal ? 0 : nFeesData[0].actualAmountTotal) : 0
      oDeposit.nTotalApplicableTax = nFeesData.length ? (!nFeesData[0].applicableTaxAmountTotal ? 0 : nFeesData[0].applicableTaxAmountTotal) : 0
      report.oDeposit = { ...oDeposit, dUpdatedAt: dDate }

      const oWithdraw = {}

      const [aSuccessWithdrawals, aPendingWithdrawals, nFeesDataWithdraw] = await Promise.all([
        getDateRangeWithdrawOfPG({ group: 'ePaymentGateway', where: { ePaymentStatus: 'S', eUserType }, raw: true }, { dStartDate, dEndDate }),
        getDateRangeWithdrawOfPG({ group: 'ePaymentGateway', where: { ePaymentStatus: 'P', eUserType }, raw: true }, { dStartDate, dEndDate }),
        getPlatformFeeDataWithdrawDateRange({ where: { eUserType, ePaymentStatus: 'S' }, raw: true }, { dStartDate, dEndDate })
      ])

      oWithdraw.aSuccessWithdrawals = aSuccessWithdrawals
      oWithdraw.aPendingWithdrawals = aPendingWithdrawals
      oWithdraw.nTotalWithdrawals = oWithdraw.aSuccessWithdrawals.length ? oWithdraw.aSuccessWithdrawals.reduce((acc, { nValue }) => acc + nValue, 0) : 0
      oWithdraw.nTotalPlatformFee = nFeesDataWithdraw.length ? (!nFeesDataWithdraw[0].feeTotal ? 0 : nFeesDataWithdraw[0].feeTotal) : 0
      oWithdraw.nActualWithdrawAmount = nFeesDataWithdraw.length ? (!nFeesDataWithdraw[0].actualAmountTotal ? 0 : nFeesDataWithdraw[0].actualAmountTotal) : 0
      oWithdraw.nTotalApplicableTax = nFeesDataWithdraw.length ? (!nFeesDataWithdraw[0].applicableTaxAmountTotal ? 0 : nFeesDataWithdraw[0].applicableTaxAmountTotal) : 0

      report.oWithdraw = { ...oWithdraw, dUpdatedAt: dDate }

      const oUserBonus = {}
      const nTotal = await PassbookModel.findAll({
        attributes: [[fn('sum', col('nBonus')), 'total']],
        where: {
          eUserType,
          [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }],
          [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }]
        },
        raw: true
      })
      oUserBonus.nTotal = nTotal.length ? (!nTotal[0].total ? 0 : nTotal[0].total) : 0
      report.oUserBonus = { ...oUserBonus, dUpdatedAt: dDate }

      const oBonusExpire = {}
      const nTotals = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
      oBonusExpire.nTotal = nTotals.length ? (!nTotals[0].total ? 0 : nTotals[0].total) : 0
      report.oBonusExpire = { ...oBonusExpire, dUpdatedAt: dDate }

      const oInactivityCharge = {}
      const nTotalInActivityCharge = await PassbookModel.findOne({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'Deactivate-User', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
      oInactivityCharge.nTotalInActivityCharge = nTotalInActivityCharge?.total || 0
      oInactivityCharge.dUpdatedAt = dDate
      report.oInactivityCharge = oInactivityCharge

      // const oTds = {}
      // const nTotalTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
      // oTds.nTotalTds = nTotalTds.length ? (!nTotalTds[0].total ? 0 : nTotalTds[0].total) : 0

      // const nTotalActiveTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eStatus: 'A', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
      // oTds.nTotalActiveTds = nTotalActiveTds.length ? (!nTotalActiveTds[0].total ? 0 : nTotalActiveTds[0].total) : 0

      // const nTotalPendingTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eStatus: 'P', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
      // oTds.nTotalPendingTds = nTotalPendingTds.length ? (!nTotalPendingTds[0].total ? 0 : nTotalPendingTds[0].total) : 0
      // report.oTds = { ...oTds, dUpdatedAt: dDate }
    } else if (eKey === 'WIN_REPORT') {
      report.aWins = []
      const oCategory = await fetchMapOfCategory()
      for (const eCategory of eCategoryType.value) {
        const iCategoryId = oCategory[eCategory]
        const { winCash: nTotalCash, winBonus: nTotalBonus } = await fetchReportData(iCategoryId, 'Wins', eType, oDateCondition)
        report.aWins.push({
          nTotalCash,
          nTotalBonus,
          eCategory,
          dUpdatedAt: new Date()
        })
      }
    } else if (eKey === 'PLAY_REPORT') {
      report.aPlayed = []
      const oCategory = await fetchMapOfCategory()
      for (const eCategory of eCategoryType.value) {
        const iCategoryId = oCategory[eCategory]
        const { playedCash: nTotalCash, playedBonus: nTotalBonus } = await fetchReportData(iCategoryId, 'Played', eType, oDateCondition)
        report.aPlayed.push({
          nTotalCash,
          nTotalBonus,
          eCategory,
          dUpdatedAt: new Date()
        })
      }
    } else if (eKey === 'PLAY_RETURN_REPORT') {
      report.aPlayReturn = []
      const oCategory = await fetchMapOfCategory()
      for (const eCategory of eCategoryType.value) {
        const iCategoryId = oCategory[eCategory]
        const { playReturnCash: nTotalCash, playReturnBonus: nTotalBonus } = await fetchReportData(iCategoryId, 'PlayReturn', eType, oDateCondition)
        report.aPlayReturn.push({
          nTotalCash,
          nTotalBonus,
          eCategory,
          dUpdatedAt: new Date()
        })
      }
    } else if (eKey === 'WIN_RETURN_REPORT') {
      report.aWinReturn = []
      const oCategory = await fetchMapOfCategory()
      for (const eCategory of eCategoryType.value) {
        const iCategoryId = oCategory[eCategory]
        const { winReturnCash: nTotalCash, winReturnBonus: nTotalBonus } = await fetchReportData(iCategoryId, 'Wins-Return', eType, oDateCondition)
        report.aWinReturn.push({
          nTotalCash,
          nTotalBonus,
          eCategory,
          dUpdatedAt: new Date()
        })
      }
    } else if (eKey === 'APP_DOWNLOAD_REPORT') {
      report.aAppDownload = []
      for (const platform of appPlatform.value) {
        const nTotal = await AppDownloadModel.countDocuments({ ePlatform: platform, dCreatedAt: oDateCondition })
        report.aAppDownload.push({
          nTotal,
          ePlatform: platform,
          dUpdatedAt: new Date()
        })
      }
    } else if (eKey === 'PARTICIPANT_REPORT') {
      report.aParticipants = []
      const oCategory = await fetchMapOfCategory()
      for (const eCategory of eCategoryType.value) {
        const iCategoryId = oCategory[eCategory]
        const { nTotals: nTotal } = await fetchParticipants(iCategoryId, oDateCondition, eType)
        report.aParticipants.push({
          nTotal: nTotal || 0,
          eCategory,
          dUpdatedAt: new Date()
        })
      }
    } else if (eKey === 'TAX_REPORT') {
      report.aCategoryTax = []
      oDateCondition.$lt = oDateCondition.$lte
      delete oDateCondition.$lte

      for (const eTransactionType of aTaxTransactions) {
        const { nTotalTax: nTotal } = await fetchTotalTax(null, eTransactionType, oDateCondition, eType)
        report.aCategoryTax.push({
          nTotal,
          eTransactionType,
          dUpdatedAt: new Date()
        })
      }
    }
    // else if (eKey === 'CREATOR_BONUS_REPORT') {
    //   report.aCreatorBonus = []
    //   const oCategory = await fetchMapOfCategory()
    //   for (const eCategory of eCategoryType.value) {
    //     const iCategoryId = oCategory[eCategory]
    //     const nTotal = await fetchReportData(iCategoryId, 'CreatorBonus', 'U', oDateCondition)
    //     report.aCreatorBonus.push({
    //       nTotal,
    //       eCategory,
    //       dUpdatedAt: new Date()
    //     })
    //   }
    // } else if (eKey === 'CREATOR_BONUS_RETURN_REPORT') {
    //   report.aCreatorBonusReturn = []
    //   const oCategory = await fetchMapOfCategory()
    //   for (const eCategory of eCategoryType.value) {
    //     const iCategoryId = oCategory[eCategory]
    //     const nTotal = await fetchReportData(iCategoryId, 'CreatorBonusReturn', 'U', oDateCondition)
    //     report.aCreatorBonusReturn.push({
    //       nTotal,
    //       eCategory,
    //       dUpdatedAt: new Date()
    //     })
    //   }
    // }

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cReport), data: report })
  } catch (error) {
    return catchError('Report.fetchfilterReport', error, req, res)
  }
}

oReportService.fetchParticipantReport = async (req, res) => {
  try {
    const { eCategory, eType } = req.body
    // if (eKey !== 'LP') {
    //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
    // }
    const data = await ReportModel.findOne({
      eType,
      aParticipants: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }).lean()
    if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cReport) }) }

    const dateQuery = getDatesObj()

    const oCategory = await CategoryModel.findOne({ eCategoryType: eCategory.toUpperCase() }, { _id: 1 }).lean()
    if (!oCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCategory) }) }
    const iCategoryId = oCategory._id.toString()
    const { nTotals: nTotal } = await fetchParticipants(iCategoryId, { $lte: new Date() }, eType)
    const { nTotals: nToday } = await fetchParticipants(iCategoryId, dateQuery.toDay, eType)
    const { nTotals: nYesterday } = await fetchParticipants(iCategoryId, dateQuery.yesterDay, eType)
    const { nTotals: nLastWeek } = await fetchParticipants(iCategoryId, dateQuery.week, eType)
    const { nTotals: nLastMonth } = await fetchParticipants(iCategoryId, dateQuery.month, eType)
    const { nTotals: nLastYear } = await fetchParticipants(iCategoryId, dateQuery.year, eType)

    const report = {
      'aParticipants.$.nTotal': nTotal || 0,
      'aParticipants.$.nToday': nToday || 0,
      'aParticipants.$.nYesterday': nYesterday || 0,
      'aParticipants.$.nLastWeek': nLastWeek || 0,
      'aParticipants.$.nLastMonth': nLastMonth || 0,
      'aParticipants.$.nLastYear': nLastYear || 0,
      'aParticipants.$.dUpdatedAt': new Date()
    }
    const updateData = await ReportModel.findOneAndUpdate({
      eType,
      aParticipants: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
    }, { ...report }, { new: true, runValidators: true }).lean()
    const responseData = updateData.aParticipants.find(({ _id }) => _id.toString() === req.params.id.toString())
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: responseData })
  } catch (error) {
    return catchError('UpdateReport.fetchParticipantReport', error, req, res)
  }
}

oReportService.updateSubCategoryReport = async (req, res) => {
  try {
    const { id: iSubCategoryId } = req.params
    const oSubCategory = await SubCategoryModel.findOne({ _id: iSubCategoryId }, { _id: 1 }).lean()
    if (!oSubCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cSubCategory) }) }
    const [oUserOrder, oAdminOrder, oUserTran, oAdminTran] = await Promise.all([
      fetchSubCategoryReportData({ iSubCategoryId, oUnwindField: 'aUserOrders', eEventStatus: eventStatus.map.COMPLETED }),
      fetchSubCategoryReportData({ iSubCategoryId, oUnwindField: 'aAdminOrders', eEventStatus: eventStatus.map.COMPLETED }),
      fetchSubCategoryReportData({ iSubCategoryId, oUnwindField: 'aUserTransaction', eEventStatus: eventStatus.map.COMPLETED }),
      fetchSubCategoryReportData({ iSubCategoryId, oUnwindField: 'aAdminTransaction', eEventStatus: eventStatus.map.COMPLETED })
    ])
    const bIsUpdate = await SubCategoryModel.updateOne({ _id: iSubCategoryId }, { $set: { aUserOrders: oUserOrder || [], aAdminOrders: oAdminOrder || [], aUserTransaction: oUserTran || [], aAdminTransaction: oAdminTran || [] } })
    if (!bIsUpdate?.modifiedCount || !bIsUpdate?.matchedCount) return { success: false, message: 'Event report not updated' }
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport), data: { oUserOrder, oAdminOrder, oUserTran, oAdminTran } })
  } catch (error) {
    return catchError('UpdateReport.updateSubCategoryReport', error, req, res)
  }
}

oReportService.createEventReport = async (data) => {
  try {
    const { iEventId } = data
    const oOrder = await buildOrderReportData({ id: iEventId, eUserType: userType.value, eOrderStatus: orderStatus.value, eIdType: 'Event', bOrderStatus: true })
    const oOrders = await buildOrderReportData({ id: iEventId, eUserType: userType.value, eOrderStatus: orderStatus.value, eIdType: 'Event', bOrderStatus: false })
    const oOrderData = mergeUserOrderArrays({ obj1: oOrder, obj2: oOrders })
    const aTran = await buildPassbookReportData({ id: iEventId, eUserType: userType.value, eTransactionType: [transactionType.map.PLAY_OT, transactionType.map.WIN_OT, transactionType.map.PLAY_RETURN_OT], eIdType: 'Event' })
    const bIsUpdate = await EventModel.updateOne({ _id: iEventId }, { $set: { aUserOrders: oOrderData?.U || [], aAdminOrders: oOrderData?.B || [], aUserTransaction: aTran?.U || [], aAdminTransaction: aTran?.B || [] } })
    if (!bIsUpdate?.modifiedCount || !bIsUpdate?.matchedCount) return { status: false, message: 'Event report not updated' }
    return { status: true, message: 'Event report updated' }
  } catch (error) {
    handleCatchError('createEventReport', error)
  }
}

oReportService.updateEventReport = async (req, res) => {
  try {
    const { id: iEventId } = req.params
    const oEvent = await EventModel.findOne({ _id: iEventId, eStatus: eventStatus.map.COMPLETED }, { _id: 1 }).lean()
    if (!oEvent) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].event_not_completed }) }
    const result = await oReportService.createEventReport({ iEventId })
    if (!result?.status) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: result?.message })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cReport) })
  } catch (error) {
    return catchError('UpdateReport.updateEventReport', error, req, res)
  }
}

module.exports = oReportService
