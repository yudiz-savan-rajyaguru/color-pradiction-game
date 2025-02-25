// @ts-check
const { Transaction, Op, literal } = require('sequelize')
const db = require('../../database/sequelize')
const UserBalanceModel = require('../userbalance/model')
const PassbookModel = require('../passbook/model')
const { APP_LANG } = require('../../config/common')
const { handleCatchError, convertToDecimal, decryptValue, mongify } = require('../../helper/utilities.services')
const { jsonStatus, messages } = require('../../helper/api.responses')
const config = require('../../config/config')
const StatisticsModel = require('../user/statistics/model')
const UserWithdrawModel = require('./model')
const SettingsModel = require('../setting/model')
const UsersModel = require('../user/model')
const AdminsModel = require('../admin/model')

/**
 * Reverse a withdrawal transaction by updating the UserWithdrawModel with reversed date.
 * @param {Object} data - Data related to the transaction.
 * @param {number} iWithdrawId - ID of the withdrawal transaction to be reversed.
 * @returns {Object} Object indicating success or failure of the operation.
 */
async function reversedTransaction(data, iWithdrawId) {
  try {
    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      await UserWithdrawModel.update({ dReversedDate: new Date(), bReversed: true }, { where: { id: iWithdrawId }, transaction: t })
    })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

/**
 * Cancel or reject a withdrawal transaction by updating relevant models and balances.
 * @param {Object} data - Data related to the transaction.
 * @param {string} ePaymentStatus - Payment status for the transaction.
 * @param {number} iWithdrawId - ID of the withdrawal transaction to be cancelled or rejected.
 * @returns {Object} Object indicating success or failure of the operation.
 */
async function cancellOrRejectTransaction(data, ePaymentStatus, iWithdrawId) {
  try {
    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      const withdraw = await UserWithdrawModel.findOne({ where: { id: iWithdrawId, ePaymentStatus: { [Op.notIn]: ['C', 'R'] } }, raw: true, transaction: t, lock: true })
      if (withdraw) {
        const { iUserId, nAmount, ePaymentGateway } = withdraw
        const dProcessedDate = new Date()
        const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
        const { eUserType, nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance
        await UserWithdrawModel.update({ ePaymentStatus, iTransactionId: data.referenceId, dProcessedDate }, { where: { id: iWithdrawId }, transaction: t })
        let updateStatsObj
        const updateObj = {
          nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
          nTotalWithdrawAmount: literal(`nTotalWithdrawAmount - ${nAmount}`),
          nTotalWithdrawCount: literal('nTotalWithdrawCount - 1')
        }
        const passbook = await PassbookModel.findOne({ where: { iUserId, iWithdrawId }, transaction: t, lock: true })
        // imp: add projection here
        const winDiff = passbook?.nOldWinningBalance - passbook?.nNewWinningBalance
        const depositDiff = passbook?.nOldDepositBalance - passbook?.nNewDepositBalance
        if (depositDiff > 0) {
          if (winDiff > 0) {
            updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance + ${winDiff}`)
            updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance + ${depositDiff}`)
            updateStatsObj = {
              nActualDepositBalance: convertToDecimal(depositDiff),
              nCash: convertToDecimal(depositDiff),
              nActualWinningBalance: convertToDecimal(winDiff),
              nWinnings: convertToDecimal(winDiff)
            }
          } else {
            updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance + ${nAmount}`)
            updateStatsObj = {
              nActualDepositBalance: convertToDecimal(nAmount),
              nCash: convertToDecimal(nAmount)
            }
          }
        } else {
          updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance + ${nAmount}`)
          updateStatsObj = {
            nActualWinningBalance: convertToDecimal(nAmount),
            nWinnings: convertToDecimal(nAmount)
          }
        }
        updateStatsObj = { ...updateStatsObj, nWithdraw: -convertToDecimal(nAmount), nWithdrawCount: -1 }

        await UserBalanceModel.update(updateObj,
          {
            where: { iUserId },
            transaction: t
          })
        await PassbookModel.create({ iUserId, eUserType, nAmount, nCash: nAmount, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Withdraw-Return', iWithdrawId: withdraw.id, eType: 'Cr', sRemarks: messages[APP_LANG].withdraw_rejected_webhook.replace('##', ePaymentGateway), dProcessedDate, eStatus: 'R' }, { transaction: t })
        await StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, { $inc: updateStatsObj }, { upsert: true })
      }
    })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

/**
 * Mark a withdrawal transaction as successful by updating relevant models.
 * @param {Object} data - Data related to the transaction.
 * @param {number} iWithdrawId - ID of the withdrawal transaction to be marked as successful.
 * @returns {Object} Object indicating success or failure of the operation.
 */
async function successTransaction(data, iWithdrawId) {
  try {
    const { referenceId } = data
    const dProcessedDate = new Date()
    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      const withdraw = await UserWithdrawModel.count({ where: { id: iWithdrawId, ePaymentStatus: { [Op.in]: ['P', 'I'] } }, col: 'id', transaction: t, lock: true })

      if (withdraw) {
        await UserWithdrawModel.update({ ePaymentStatus: 'S', dProcessedDate, iTransactionId: referenceId }, { where: { id: iWithdrawId }, transaction: t })
        await PassbookModel.update({ dProcessedDate }, { where: { iWithdrawId }, transaction: t })
      }
    })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

/**
 * Get a list of admin withdrawals or deposits based on various filters.
 * @param {string} ePaymentStatus - Payment status filter ['P','S','R','C'].
 * @param {string} ePaymentGateway - Payment gateway filter.
 * @param {string} sSearch - Search value.
 * @param {string} sFlag - Flag indicating type ('D' for deposit, 'W' for withdraw).
 * @param {string} bReversedFlag - Flag indicating if the transaction is reversed ('y' or 'n').
 * @returns {Object} Object with isSuccess, status, message, and data.
 */
async function getAdminWithdrawDepositListQuery(ePaymentStatus, ePaymentGateway, sSearch, sFlag, bReversedFlag) {
  const query = []
  if (ePaymentStatus) {
    query.push({ ePaymentStatus })
  }
  if (ePaymentGateway) {
    query.push({ ePaymentGateway })
  }
  if (bReversedFlag && ['y', 'n'].includes(bReversedFlag)) {
    const bReversed = (bReversedFlag === 'y')
    query.push({ bReversed })
  }
  const aUsers = []
  if (sSearch && sSearch.length) {
    const aSearchQuery = []
    const nSearchNumber = Number(sSearch)
    if (!isNaN(nSearchNumber)) {
      // we got error from grpc , as we are receiving to much record(approx 36k) so we have added new params limit
      aSearchQuery.push({
        [Op.or]: [
          { id: nSearchNumber },
          { iTransactionId: nSearchNumber }
        ]
      })
    }

    // if type is deposit then search from transaction id or order id
    if (sFlag === 'D') {
      aSearchQuery.push({ iTransactionId: { [Op.like]: sSearch + '%' } })
      aSearchQuery.push({ iOrderId: { [Op.like]: sSearch + '%' } })
    } else if (sFlag === 'W') {
      // search from transaction id when type is withdraw
      aSearchQuery.push({ iTransactionId: { [Op.like]: sSearch + '%' } })
    }
    query.push({ [Op.or]: aSearchQuery })
  }
  return { query, aUsers }
}

/**  Function to validate withdrawal rate limit for a user.
* @param {number} iUserId - User ID for which the rate limit is to be validated.
* @param {string} lang - Language for error messages.
* @returns {Promise} Promise that resolves with success or rejects with an error.
*/
function validateWithdrawRateLimit(iUserId, lang) {
  // Returns a promise that resolves with success or rejects with error
  return new Promise((resolve, reject) => {
    // Wrap logic in an async IIFE to use await
    (async () => {
      try {
        // Skip rate limiting in non-production environments
        if (config.NODE_ENV !== 'production') {
          return resolve({ status: 'success' })
        }
        // Fetch withdrawal rate limit settings
        const withdrawRateLimit = await SettingsModel.findOne({ sKey: 'UserWithdrawRateLimit' }).lean()
        const withdrawRateLimitTimeFrame = await SettingsModel.findOne({ sKey: 'UserWithdrawRateLimitTimeFrame' }).lean()
        // Resolve with success if settings are missing
        if (!withdrawRateLimit || !withdrawRateLimitTimeFrame) {
          return resolve({ status: 'success' })
        }
        // Determine the time frame for counting withdrawals
        const currentDate = new Date().toISOString()
        const fromDate = new Date(new Date().setMinutes(new Date().getMinutes() - parseInt(withdrawRateLimitTimeFrame.nMax))).toISOString()
        // Count withdrawals within the specified time frame
        const count = await UserWithdrawModel.count({
          where: {
            iUserId,
            dCreatedAt: {
              [Op.lte]: currentDate,
              [Op.gte]: fromDate
            }
          },
          col: 'id' // Optimize query by selecting only the ID column
        })
        // Reject with rate limit exceeded error if count exceeds limit
        if (count >= parseInt(withdrawRateLimit?.nMax)) {
          const limitExceed = { status: jsonStatus.TooManyRequest, message: messages[lang].limit_reached.replace('##', messages[lang].cWithdrawRequest) }
          return reject(limitExceed)
        }
        // Resolve with success if rate limit is not exceeded
        resolve({ status: 'success' })
      } catch (error) {
        // Reject with any caught errors
        reject(error)
      }
    })()
  })
}

/**
 * Function to add user fields for admin withdraw list.
 * @param {Array} withdraw - Array of withdrawal objects.
 * @param {Array} users - Array of user objects.
 * @param {boolean} allowDecrypt - Flag indicating whether to allow decryption of sensitive information.
 * @returns {Array} Array of all users who have completed withdrawals.
 */
async function addUserFields(withdraw, users = [], allowDecrypt = false) {
  try {
    const oUser = {}
    const oAdmin = {}
    const length = withdraw.length
    // Finding users data
    const data = await findUsersData({ users, withdraw })
    data.forEach((usr, i) => { oUser[usr._id.toString()] = i })
    // Getting admin ids
    // eslint-disable-next-line array-callback-return
    const aAdminIds = withdraw.map(({ iWithdrawalDoneBy }) => {
      if (iWithdrawalDoneBy) return mongify(iWithdrawalDoneBy)
    })
    const aAdmin = await AdminsModel.find({ _id: { $in: aAdminIds } }, { sUsername: 1 }).lean()
    aAdmin.forEach((usr, i) => { oAdmin[usr._id.toString()] = i })
    // Processing with withdrawal data
    getWithdrawData({ length, oAdmin, allowDecrypt, aAdmin, withdraw, oUser, data })
    return withdraw
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * Getting and decrypting user data
 * @param {*} object
 */
function getWithdrawData({ length, oAdmin, allowDecrypt, aAdmin, withdraw, oUser, data }) {
  try {
    for (let i = 0; i < length; i++) {
      let user = getUserData({ withdrawal: withdraw[i], oUser, data, oAdmin, aAdmin })
      user = decryptUserData({ user, allowDecrypt })
      withdraw[i] = { ...withdraw[i], ...user, _id: undefined }
    }
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * @param {*} object
 * @returns - return decrypted user as per flag
 */
function decryptUserData({ user, allowDecrypt }) {
  try {
    if (allowDecrypt) {
      user.sEmail = user.sEmail ? decryptValue(user.sEmail) : ''
      user.sMobNum = user.sMobNum ? decryptValue(user.sMobNum) : ''
    } else {
      user.sEmail = ''
      user.sMobNum = ''
    }
    return user
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * @param {*} object
 * @returns - returns updated user data
 */
function getUserData({ withdrawal, oUser, data, oAdmin, aAdmin }) {
  try {
    const { iUserId, iWithdrawalDoneBy, ePaymentStatus } = withdrawal
    const user = (typeof oUser[iUserId.toString()] === 'number') ? { ...data[oUser[iUserId.toString()]] } : {}

    if (user && !['P', 'C'].includes(ePaymentStatus) && iWithdrawalDoneBy) {
      const admin = (typeof oAdmin[iWithdrawalDoneBy.toString()] === 'number') ? { ...aAdmin[oAdmin[iWithdrawalDoneBy.toString()]] } : {}
      user.sName = !admin ? '' : admin.sUsername
    }

    return user
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * @param {*} object - users and withdraw list
 * @returns - return users data
 */
async function findUsersData({ users, withdraw }) {
  try {
    let data
    if (users.length) {
      data = users
    } else {
      const withdrawIds = withdraw.map(p => mongify(p.iUserId))
      data = await UsersModel.find({ _id: { $in: withdrawIds } }, { sMobNum: 1, sEmail: 1, sUsername: 1 })
    }
    return data
  } catch (error) {
    throw new Error(error)
  }
}

module.exports = {
  reversedTransaction,
  successTransaction,
  cancellOrRejectTransaction,
  getAdminWithdrawDepositListQuery,
  validateWithdrawRateLimit,
  addUserFields
}
