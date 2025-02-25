// @ts-check
const { literal, Transaction } = require('sequelize')
const PassbookModel = require('../passbook/model')
const UserBalanceModel = require('../userbalance/model')
const db = require('../../database/sequelize')
const { jsonStatus, messages } = require('../../helper/api.responses')
const { APP_LANG } = require('../../config/common')
const { convertToDecimal, handleCatchError, mongify } = require('../../helper/utilities.services')
const { findSetting } = require('../setting/services')
const { createAdminLog } = require('../admin/adminLogs/handler')
const StatisticsModel = require('../user/statistics/model')

function doStreakPayment(payload) {
  return new Promise((resolve, reject) => {
    (async () => {
      // Extract relevant information from the payload
      const { eUserType, iUserId, nAmount, nCash, nBonus, transactionType, userLanguage, streakDay, sInfo } = payload
      // Define the transaction type for the passbook entry
      const passbookTransactionType = 'User-Streak'
      try {
        let dBonusExpiryDate = null
        // Handle bonus-related processing
        if (transactionType === 'B') {
          const bonusExpireDays = await findSetting('BonusExpireDays')
          if (!bonusExpireDays) return { status: jsonStatus.NotFound, message: messages[userLanguage].not_found.replace('##', messages[userLanguage].cbonusExpirySetting) }
          if (nBonus > 0) {
            dBonusExpiryDate = new Date()
            dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + bonusExpireDays.nMax)
            dBonusExpiryDate.setUTCHours(23, 59) // Set to 23:59 (End of Day)
          }
        }
        let statUpdate = {}
        // Perform the transaction in a database transaction
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          // Create a user deposit record - no need to save in deposit
          // const userDeposit = await UserDepositModel.create({ iUserId, nAmount, nCash, nBonus, ePaymentGateway: 'STREAK', ePaymentStatus: 'S', sInfo: 'Streak Day : ' + streakDay + ' ' + messagesLang[APP_LANG].streak_upgrade_admin_deposit, eUserType, dProcessedDate: new Date() }, { transaction: t, lock: true })
          // Fetch the old balance for further calculations
          const oldBalance = await UserBalanceModel.findOne({ where: { iUserId: iUserId?.toString() }, transaction: t, lock: true, raw: true })
          if (!oldBalance) return { status: jsonStatus.NotFound, message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].cBalance) }
          const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance
          // Update the user balance
          await UserBalanceModel.update({
            nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${nCash}`),
            nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nCash}`),
            nCurrentBonus: literal(`nCurrentBonus + ${nBonus}`),
            nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonus}`),
            nTotalDepositAmount: literal(`nTotalDepositAmount + ${nCash}`),
            nTotalDepositCount: literal('nTotalDepositCount + 1')
          }, {
            where: { iUserId },
            transaction: t
          })

          // Update the statistics
          statUpdate = { $inc: { nActualDepositBalance: convertToDecimal(nCash), nActualBonus: convertToDecimal(nBonus), nDeposits: convertToDecimal(nCash), nCash: convertToDecimal(nCash), nBonus: convertToDecimal(nBonus), nDepositCount: 1 } }
          const sRemarksText = getRemarksText({ transactionType, streakDay, sInfo })
          await PassbookModel.create({
            iUserId: iUserId?.toString(),
            nAmount,
            nCash,
            nBonus,
            nOldBonus,
            nOldTotalBalance,
            nOldDepositBalance,
            nOldWinningBalance,
            eTransactionType: passbookTransactionType,
            dBonusExpiryDate,
            eUserType,
            eType: 'Cr',
            sRemarks: sRemarksText + ' ' + messages[APP_LANG].streak_upgrade_admin_deposit,
            dActivityDate: new Date(),
            eStatus: 'CMP'
          }, { transaction: t, lock: true })
        })
        // Log the admin action and update user statistics
        const logData = {
          oOldFields: {},
          oNewFields: { eType: transactionType, eTransactionType: passbookTransactionType, nStreak: streakDay, nAmount: nCash + nBonus, sInfo },
          sIP: '',
          iUserId: mongify(iUserId),
          eKey: 'USR',
          sLatitude: '',
          sLongitude: ''
        }
        await Promise.all([
          createAdminLog(logData),
          StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, statUpdate, { upsert: true })
        ])
        return resolve({ type: 'SUCCESS', status: jsonStatus?.OK, message: messages[userLanguage].sClaim })
      } catch (error) {
        // Handle errors, log the error, and resolve with an error response
        handleCatchError(error)
        return resolve({ type: 'ERROR', status: jsonStatus?.OK, message: messages[userLanguage].sStreakRewardError })
      }
    })()
  })
}

function getRemarksText({ transactionType, streakDay, sInfo }) {
  try {
    let sRemarksText = 'streak : ' + (streakDay)
    if (transactionType === 'E') {
      sRemarksText = sInfo
    }
    return sRemarksText
  } catch (error) {
    return new Error(error)
  }
}

module.exports = {
  doStreakPayment
}
