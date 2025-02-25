// @ts-check
const { literal, Op, Transaction, QueryTypes } = require('sequelize')
const bcrypt = require('bcryptjs')
const moment = require('moment')

const UserBalanceModel = require('../userbalance/model')
const PassbookModel = require('../passbook/model')
const { catchError, getIp, convertToDecimal, mongify, createResponse } = require('../../helper/utilities.services')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const db = require('../../database/sequelize')
const { redisClient } = require('../../helper/redis')
const { getAdminWithdrawDepositListQuery } = require('../userWithdraw/common')
const { checkAdminAuthorization } = require('../../helper/authorization')
const { findSettingV2 } = require('../setting/services')
const { createAdminLog } = require('../admin/adminLogs/handler')
const { findCredential } = require('../admin/common')
const UserDepositModel = require('./model')
const { APP_LANG } = require('./../../config/common')
const { DB_SQL_NAME } = require('./../../config/config')
const { processPaymentGateway } = require('./userDepositCommon')
const UsersModel = require('../user/model')
const StatisticsModel = require('../user/statistics/model')
const { addUserFields, generateReport } = require('./common')
const { processTransactionLog } = require('../queue/transactionLogQueue')
const PromocodeModel = require('../promocode/model')
const { logStats } = require('../promocode/statistics/services')

class UserDeposit {
  /**
 * This function is used when an admin wants to deposit some amount in internal users.
 * After a successful deposit, the user balance and statistics will be updated, along with a Passbook entry.
 * @param {Object} req - The request object containing user input data.
 * @param {Object} res - The response object for sending HTTP responses.
 * @returns {Object} - Success or error response.
 */
  async adminDeposit(req, res) {
    try {
      let { iUserId, nCash, nBonus, eType, sPassword } = req.body
      const { _id: iAdminId } = req.admin

      nBonus = Number(nBonus) || 0
      nCash = Number(nCash) || 0
      const nAmount = nBonus + nCash

      // Fetch admin payment credential
      const pass = await findCredential({ eKey: 'PAY' })
      // // Validate admin password
      if (!bcrypt.compareSync(sPassword, pass.sPassword)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].auth_failed })
      }
      // Fetch bonus expiration days setting
      const bonusExpireDays = await findSettingV2({ sKey: 'BonusExpireDays' })
      if (!bonusExpireDays) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cbonusExpirySetting) })

      // Calculate bonus expiry date
      let dBonusExpiryDate = null
      if (nBonus > 0) {
        dBonusExpiryDate = new Date()
        dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + Number(bonusExpireDays.sValue))
        dBonusExpiryDate.setUTCHours(23, 59) // 23:59 EOD
      }
      // Fetch user data for logging and balance updates
      const userData = await UsersModel.findOne({ _id: mongify(iUserId) }, { eType: 1, sUsername: 1 })

      try {
        let statUpdate = {}
        const { eType: eUserType, sUsername } = userData
        // Execute transaction for atomic updates
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          // Create a deposit record
          const userDeposit = await UserDepositModel.create({ iUserId, nAmount, nCash, nBonus, ePaymentStatus: 'S', sInfo: 'Deposit by admin', eUserType, dProcessedDate: new Date() }, { transaction: t, lock: true })
          // Fetch old balance for updating
          const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true, raw: true })
          if (!oldBalance) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBalance) })
          const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

          // Update user balance based on deposit type
          if (eType === 'deposit') {
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
            // Fetch the updated record after the update operation
            await UserBalanceModel.findOne({
              where: { iUserId },
              transaction: t,
              lock: true
            })
            statUpdate = { $inc: { nActualDepositBalance: convertToDecimal(nCash), nActualBonus: convertToDecimal(nBonus), nDeposits: convertToDecimal(nCash), nCash: convertToDecimal(nCash), nBonus: convertToDecimal(nBonus), nDepositCount: 1 } }
          } else if (eType === 'winning') {
            await UserBalanceModel.update({
              nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nCash}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nCash}`),
              nTotalWinningAmount: literal(`nTotalWinningAmount + ${nCash}`),
              nTotalDepositCount: literal('nTotalDepositCount + 1')
            }, {
              where: { iUserId },
              transaction: t
            })
            statUpdate = { $inc: { nActualWinningBalance: convertToDecimal(nCash), nWinnings: convertToDecimal(nCash), nTotalWinnings: convertToDecimal(nCash), nDepositCount: 1 } }
          }
          // Create a Passbook entry
          await PassbookModel.create({ iUserId, nAmount, nCash, nBonus, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', eUserType, iUserDepositId: userDeposit.id, eType: 'Cr', sRemarks: messages[APP_LANG].admin_deposit, dBonusExpiryDate, dActivityDate: new Date(), eStatus: 'CMP' }, { transaction: t, lock: true })
        })

        // Update user statistics
        await StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, statUpdate, { upsert: true })

        // Log admin deposit activity
        const logData = { oOldFields: {}, oNewFields: { eType: nBonus ? 'BONUS' : eType === 'deposit' ? 'DEPOSIT' : 'WINNING', nCash, nBonus, iUserId, sUsername }, sIP: getIp(req), iAdminId: mongify(iAdminId), iUserId: mongify(iUserId), eKey: 'AD', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
        await createAdminLog(logData)
      } catch (error) {
        return catchError('UserDeposit.adminDeposit', error, req, res)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cDeposit) })
    } catch (error) {
      return catchError('UserDeposit.adminDeposit', error, req, res)
    }
  }

  /**
   * Retrieves the list of pending deposits for the authenticated user.
   * @param {Object} req - The request object containing user information.
   * @param {Object} res - The response object for sending HTTP responses.
   * @returns {Object} - Success response with the list of pending deposits or an error response if none are found.
   */
  async userPendingDeposit(req, res) {
    try {
      const iUserId = req.user._id.toString()
      // Fetch pending deposit data for the user
      const data = await UserDepositModel.findAll({ where: { iUserId, ePaymentStatus: 'P' }, attributes: ['ePaymentGateway', 'iReferenceId', 'nAmount', 'dCreatedAt'], raw: true })
      // If no pending deposits are found, return a not found response
      if (!data.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cPendingDeposit), data: [] })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cPendingDeposit), data })
    } catch (error) {
      // Handle any unexpected errors and return an error response
      return catchError('UserDeposit.userPendingDeposit', error, req, res)
    }
  }

  async processDeposit(req, res) {
    try {
      // Retrieve payment status from request body
      const { ePaymentStatus } = req.body
      // Retrieve admin ID from request object
      const { _id: iAdminId } = req.admin
      // Initiate a database transaction with READ_COMMITTED isolation level
      try {
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const bProcessing = await redisClient.incr(`processDeposit:${req.params.id}`)
          if (bProcessing > 1) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].wait_for_proccessing.replace('##', messages[req.userLanguage].cDeposit) })

          const deposit = await UserDepositModel.findOne({ where: { id: req.params.id }, transaction: t, lock: true })
          if (deposit.ePaymentStatus !== 'P') {
            await redisClient.del(`processDeposit:${req.params.id}`)
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].depo_already_process })
          } else {
            await redisClient.expire(`processDeposit:${req.params.id}`, 20)
            const { iUserId, nCash, nBonus = 0, ePaymentStatus: ePaymentOldStatus, sInfo, sPromocode, iPromocodeId, nAmount, ePlatform, ePaymentGateway, nActualAmount = 0, nPlatformFee = 0, nTaxPercentage } = deposit || {}
            const oOldFields = { nCash, nBonus, ePaymentStatus: ePaymentOldStatus, sInfo, sPromocode, iPromocodeId, nAmount, ePlatform }
            const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
            let nOldBonus = 0
            let nOldTotalBalance = 0
            let nOldDepositBalance = 0
            let nOldWinningBalance = 0
            if (oldBalance) {
              const { nCurrentBonus, nCurrentTotalBalance, nCurrentDepositBalance, nCurrentWinningBalance } = oldBalance
              nOldBonus = nCurrentBonus
              nOldTotalBalance = nCurrentTotalBalance
              nOldDepositBalance = nCurrentDepositBalance
              nOldWinningBalance = nCurrentWinningBalance
            } else {
              await UserBalanceModel.create({ iUserId, eUserType: deposit?.eUserType }, { transaction: t, lock: true })
            }

            const dProcessedDate = new Date()

            if (ePaymentStatus === 'S') {
              let dBonusExpiryDate
              if (deposit?.iPromocodeId) {
                const promoCode = await PromocodeModel.findOne({ _id: deposit?.iPromocodeId.toString() }, { nBonusExpireDays: 1 }).lean()

                const { nBonusExpireDays = 0 } = promoCode || {}
                dBonusExpiryDate = new Date()
                dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + nBonusExpireDays)
                dBonusExpiryDate.setUTCHours(23, 59) // 23:59 EOD
              } else {
                dBonusExpiryDate = null
              }
              await UserDepositModel.update({ ePaymentStatus: 'S', iTransactionId: deposit?.id, dProcessedDate }, { where: { id: req.params.id }, transaction: t, lock: true })

              await UserBalanceModel.update({
                nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${nAmount}`),
                nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
                nTotalDepositAmount: literal(`nTotalDepositAmount + ${nAmount}`),
                nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonus}`),
                nCurrentBonus: literal(`nCurrentBonus + ${nBonus}`),
                nTotalDepositCount: literal('nTotalDepositCount + 1')
              }, {
                where: { iUserId },
                transaction: t
              })
              const sRemarks = messages[APP_LANG].depsoit_approved.replace('##', ePaymentGateway) + ', ' + messages[APP_LANG].platform_fee_debited.replace('##', messages[APP_LANG].cDeposit).replace('#', nPlatformFee).replace('###', nActualAmount)
              await PassbookModel.create({ iUserId, nAmount, nActualAmount, nPlatformFee: 0, nApplicableTax: 0, nTaxPercentage, nCash, nBonus, eUserType: deposit.eUserType, dBonusExpiryDate, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', iUserDepositId: deposit.id, eType: 'Cr', sRemarks, dProcessedDate, sPromocode, eStatus: 'CMP' }, { transaction: t, lock: true })
              await StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, { $inc: { nPlatformFee: convertToDecimal(nPlatformFee) || 0, nApplicableTax: 0, nActualDepositBalance: convertToDecimal(nCash), nActualBonus: convertToDecimal(nBonus), nDeposits: convertToDecimal(nCash), nCash: convertToDecimal(nCash), nBonus: convertToDecimal(nBonus), nDepositCount: 1 } }, { upsert: true })
              if (deposit?.iPromocodeId) {
                await logStats({ iUserId, iPromocodeId, nAmount: nBonus, sTransactionType: 'DEPOSIT', idepositId: deposit.id })
              }
            } else if (ePaymentStatus === 'C') {
              await UserDepositModel.update({ ePaymentStatus: 'R', dProcessedDate }, { where: { id: req.params.id }, transaction: t, lock: true })
            }
            const oNewFields = { ...oOldFields, ePaymentStatus }
            const logData = { oOldFields, oNewFields, sIP: getIp(req), iAdminId: mongify(iAdminId), iUserId: mongify(iUserId), eKey: 'D', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
            await createAdminLog(logData)
            return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cprocessedDeposit) })
          }
        })
      } catch (error) {
        return catchError('UserDeposit.processDeposit', error, req, res)
      }
    } catch (error) {
      return catchError('UserDeposit.processDeposit', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      // Destructure query parameters
      let { datefrom, dateto, start = 0, limit = 10, sort = 'dCreatedAt', order, search, status: paymentStatus, method, isFullResponse, iUserId } = req.query

      // Set default order to 'DESC' if not provided
      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'

      // Set default values for start, limit, and sort if not provided
      start = !start ? 0 : start
      limit = !limit ? 0 : limit
      sort = !sort ? 'dCreatedAt' : sort

      // Get query and user type array based on parameters
      const { query, aUsers } = await getAdminWithdrawDepositListQuery(paymentStatus, method, search, 'D')

      // Check if date range is required for a full response
      if ((!datefrom || !dateto) && [true, 'true'].includes(isFullResponse)) {
        return createResponse({ req, res, statusCode: status.BadRequest, messageKey: messages[req.userLanguage].date_filter_err })
      }

      // Include user type 'U' if a full response is requested
      if ([true, 'true'].includes(isFullResponse)) query.push({ eUserType: 'U' })

      // Add date range to the query
      if (datefrom && dateto) {
        query.push({ dUpdatedAt: { [Op.gte]: datefrom } })
        query.push({ dUpdatedAt: { [Op.lte]: dateto } })
      }

      // Define pagination fields based on the response type
      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : { offset: parseInt(start), limit: parseInt(limit) }

      if (iUserId) query.push({ iUserId })

      // Fetch deposit data based on the query and pagination
      const data = await UserDepositModel.findAll({
        where: {
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        raw: true
      })

      // Initialize arrays to store unique user IDs and additional user data
      const aUserIds = []

      // Check if there is data
      if (data.length) {
        data.forEach(record => {
          // Check if the user is not already included in the user array
          if (!aUsers.includes(user => user._id.toString() === record.iUserId.toString())) {
            aUserIds.push(record.iUserId.toString())
          }
        })

        // Fetch additional user data based on unique user IDs
        if (aUserIds.length) {
          const aWithdrawUsers = await UsersModel.find({ _id: { $in: aUserIds } }, { sName: 1, sUsername: 1, sMobNum: 1 })

          // Add additional user data to the user array
          if (aWithdrawUsers.length) aUsers.push(...aWithdrawUsers)
        }
      }

      // Check admin authorization for accessing personal info
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      let allowDecrypt = false
      if (response.status === 200) {
        allowDecrypt = true
      }

      // Add user fields and create the final deposit data
      const depositData = await addUserFields(data, aUsers, allowDecrypt)

      // Return success response with deposit data
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDeposit), data: { rows: depositData } })
    } catch (error) {
      // Handle errors and return error response
      catchError('UserDeposit.adminList', error, req, res)
    }
  }

  async getCounts(req, res) {
    try {
      const { datefrom, dateto, search, status: paymentStatus, method, isFullResponse, iUserId } = req.query

      // Get query based on parameters
      const { query } = await getAdminWithdrawDepositListQuery(paymentStatus, method, search, 'D')

      // Add date range to the query if provided
      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: datefrom } })
        query.push({ dCreatedAt: { [Op.lte]: dateto } })
      }
      // Include user type 'U' if a full response is requested
      if ([true, 'true'].includes(isFullResponse)) query.push({ eUserType: 'U' })

      if (iUserId) query.push({ iUserId })

      // Get count of deposits based on the query
      const count = await UserDepositModel.count({
        where: {
          [Op.and]: query
        },
        raw: true
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDeposit), data: { count } })
    } catch (error) {
      // Handle errors and return error response
      catchError('UserDeposit.getCounts', error, req, res)
    }
  }

  async checkUserDepositStatus(req, res) {
    try {
      const iUserId = req.user._id.toString()
      const { id: orderId } = req.params
      const ePlatform = req.header('Platform')
      const user = await UsersModel.countDocuments({ _id: iUserId })
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      // Get deposit data
      let data
      await db.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (t) => {
          data = await UserDepositModel.findOne({ where: { iUserId, id: orderId }, attributes: ['id', 'iOrderId', 'ePaymentGateway', 'ePaymentStatus', 'iTransactionId'], order: [['id', 'DESC']], raw: true, transaction: t, lock: true })
        })
      // If no data found, return not found response
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cDeposit) })

      // Extract payment status and gateway from the data
      let { ePaymentStatus, ePaymentGateway } = data

      // Update payment status for pending orders
      if (ePaymentStatus === 'P' && ePaymentGateway !== 'ADMIN') {
        const response = await processPaymentGateway({
          iTransactionId: data.iTransactionId,
          iDepositId: data.id,
          orderId: data.iOrderId,
          ePaymentGateway,
          ePlatform,
          ePaymentStatus
        })
        ePaymentStatus = response
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDeposit), data: { ...data, ePaymentStatus } })
    } catch (error) {
      // Handle errors and return error response
      return catchError('UserDeposit.checkUserDepositStatus', error, req, res)
    }
  }

  async firstDepositReport(req, res) {
    try {
      // Extract date range from the request query
      const { datefrom, dateto } = req.query
      // Build query for retrieving first deposits within the date range
      const query = [{ ePaymentStatus: 'S' }]
      if (datefrom && dateto) {
        query.push({ dUpdatedAt: { [Op.gte]: datefrom } })
        query.push({ dUpdatedAt: { [Op.lte]: dateto } })
      }

      const sqlQuery = `
        SELECT *
        FROM (
          SELECT id, iUserId, MIN(dUpdatedAt) as dDepositDate, dProcessedDate,ePaymentStatus,nAmount
          FROM ${DB_SQL_NAME}.userdeposits
          WHERE ePaymentStatus = 'S'
          GROUP BY iUserId
        ) AS d
        WHERE d.dDepositDate >= '${moment(datefrom).format('YYYY-MM-DD HH:MM:SS')}' AND d.dDepositDate <= '${moment(dateto).format('YYYY-MM-DD HH:MM:SS')}';
      `

      let aUsers = await db.sequelize.query(sqlQuery, {
        type: QueryTypes.SELECT,
        logging: true
      })

      const aUserIds = []
      const foundUsers = []
      if (aUsers.length) {
        aUsers.forEach(record => {
          aUserIds.push(record.iUserId.toString())
        })
        if (aUserIds.length) {
          const aWithdrawUsers = await UsersModel.find({ _id: { $in: aUserIds } }, { sUsername: 1, dCreatedAt: 1 })
          if (aWithdrawUsers.length) {
            foundUsers.push(...aWithdrawUsers)
            aUsers = await addUserFields(aUsers, foundUsers)
          }
        }
      }
      // Generate a report key
      const userReportKey = await generateReport(aUsers)
      // Return success response with the report key
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].report_generated, data: { key: userReportKey } })
    } catch (error) {
      // Handle errors and return error response
      catchError('Passbook.transactionReport', error, req, res)
    }
  }
}

setTimeout(() => {
  processTransactionLog()
}, 2000)

module.exports = new UserDeposit()
