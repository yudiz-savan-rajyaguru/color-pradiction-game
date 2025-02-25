// @ts-check
const { literal, Op, Transaction } = require('sequelize')
const bcrypt = require('bcryptjs')
const UserTdsModel = require('../userTds/model')
const PassbookModel = require('../passbook/model')
const { catchError, getIp, convertToDecimal, mongify } = require('../../helper/utilities.services')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const db = require('../../database/sequelize')
const UserBalanceModel = require('../userbalance/model')
const { redisClient, queuePush } = require('../../helper/redis')
const { createAdminLog } = require('../admin/adminLogs/handler')
const { checkAdminAuthorization } = require('../../helper/authorization')
const { APP_LANG } = require('../../config/common')
const UsersModel = require('../user/model')
const UserWithdrawModel = require('./model')
const { getAdminWithdrawDepositListQuery } = require('./common')
const { addUserFields } = require('./common')
const { findCredential } = require('../admin/common')
const StatisticsModel = require('../user/statistics/model')
const SettingsModel = require('../setting/model')
const { withdrawPaymentGetaways, paymentGetaways } = require('../../data')
const oTDSHelper = require('../userTds/helper')

class AdminUserWithdraw {
  // Admin: List of withdrawals with optional filters
  async adminList(req, res) {
    try {
      let { start = 0, limit = 10, sort = 'dCreatedAt', order, search, status: paymentStatus, method, datefrom, dateto, isFullResponse, reversedFlag, IsbApprovedDate, iUserId } = req.query
      // Set default values if not provided
      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'
      start = !start ? 0 : start
      limit = !limit ? 0 : limit
      sort = !sort ? 'dCreatedAt' : sort
      // Get the query and user data
      const { query, aUsers } = await getAdminWithdrawDepositListQuery(paymentStatus, method, search, 'W', reversedFlag)

      // Check if date filters are required for a full response
      if ((!datefrom || !dateto) && [true, 'true'].includes(isFullResponse)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
      }

      // Apply date filters based on the IsbApprovedDate flag
      if (datefrom && dateto) {
        if (IsbApprovedDate === 'RD') {
          query.push({ dProcessedDate: { [Op.gte]: datefrom } })
          query.push({ dProcessedDate: { [Op.lte]: dateto } })
        } else if (IsbApprovedDate === 'AD') {
          query.push({ dWithdrawalTime: { [Op.gte]: datefrom } })
          query.push({ dWithdrawalTime: { [Op.lte]: dateto } })
        } else {
          query.push({
            [Op.or]: [{
              dProcessedDate: { [Op.gte]: datefrom, [Op.lte]: dateto }
            },
            {
              dWithdrawalTime: { [Op.gte]: datefrom, [Op.lte]: dateto }
            }]
          })
        }
      }

      // Include user type filter for a full response
      if ([true, 'true'].includes(isFullResponse)) query.push({ eUserType: 'U' })
      // Set pagination fields for query
      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : { offset: parseInt(start), limit: parseInt(limit) }

      if (iUserId) {
        query.push({ iUserId })
      }

      // Retrieve withdrawal data based on the query
      const data = await UserWithdrawModel.findAll({
        where: {
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        raw: true
      })

      // Fetch additional user information for withdrawals
      const aUserIds = []

      if (data.length) {
        data.forEach(record => {
          if (!aUsers.includes(user => user._id.toString() === record?.iUserId?.toString())) {
            aUserIds.push(record?.iUserId?.toString())
          }
        })

        if (aUserIds.length) {
          const aWithdrawUsers = await UsersModel.find({ _id: { $in: aUserIds } }, { sName: 1, sUsername: 1, sMobNum: 1 }).lean()

          if (aWithdrawUsers.length) aUsers.push(...aWithdrawUsers)
        }
      }
      // Check admin authorization for personal information
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      let allowDecrypt = false
      if (response.status === 200) {
        allowDecrypt = true
      }
      // Add user fields to withdrawal data
      const withdrawData = await addUserFields(data, aUsers, allowDecrypt)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].withdraw), data: { rows: withdrawData } })
    } catch (error) {
      catchError('UserWithdraw.adminList', error, req, res)
    }
  }

  // Admin: Get counts of withdrawals with searching and filtering
  async getCounts(req, res) {
    try {
      const { search, status: paymentStatus, method, datefrom, dateto, reversedFlag, isFullResponse, IsbApprovedDate, iUserId } = req.query

      // Get the query based on filters
      const { query } = await getAdminWithdrawDepositListQuery(paymentStatus, method, search, 'W', reversedFlag)

      // Apply date filters based on the IsbApprovedDate flag
      if (datefrom && dateto) {
        if ([true, 'true'].includes(IsbApprovedDate)) {
          query.push({ dProcessedDate: { [Op.gte]: datefrom } })
          query.push({ dProcessedDate: { [Op.lte]: dateto } })
        } else if ([false, 'false'].includes(IsbApprovedDate)) {
          query.push({ dWithdrawalTime: { [Op.gte]: datefrom } })
          query.push({ dWithdrawalTime: { [Op.lte]: dateto } })
        } else {
          query.push({
            [Op.or]: [{
              dProcessedDate: { [Op.gte]: datefrom, [Op.lte]: dateto }
            },
            {
              dWithdrawalTime: { [Op.gte]: datefrom, [Op.lte]: dateto }
            }]
          })
        }
      }

      // Include user type filter for a full response
      if ([true, 'true'].includes(isFullResponse)) query.push({ eUserType: 'U' })
      if (iUserId) query.push({ iUserId })
      // Count the number of withdrawals based on the query
      const count = await UserWithdrawModel.count({
        where: {
          [Op.and]: query
        },
        col: 'id'
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cWithdrawCounts), data: { count } })
    } catch (error) {
      catchError('UserWithdraw.getCounts', error, req, res)
    }
  }

  // Admin: Process user withdrawal request
  async adminWithdraw(req, res) {
    try {
      let { iUserId, nAmount, eType, sPassword, nBonus = 0 } = req.body

      // Ensure nAmount is a number, default to 0 if not provided
      nAmount = Number(nAmount) || 0
      const iWithdrawalDoneBy = req.admin._id.toString()

      // Verify admin password
      const pass = await findCredential({ eKey: 'PAY' })
      if (!bcrypt.compareSync(sPassword, pass.sPassword)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].auth_failed })
      }
      // Retrieve user data
      const userData = await UsersModel.findOne({ _id: iUserId }, { eType: 1, sUsername: 1 })
      if (!userData) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      try {
        const { eType: eUserType, sUsername } = userData
        // Begin database transaction
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          // Retrieve the most recent withdrawal
          const oldWithdraw = await UserWithdrawModel.findOne({ where: { iUserId }, order: [['id', 'DESC']], transaction: t, lock: true })
          const nParentId = !oldWithdraw ? null : oldWithdraw.id
          // Create a new withdrawal record
          const userWithdraw = await UserWithdrawModel.create({ iUserId, eUserType, nAmount, sIP: getIp(req), ePaymentGateway: 'ADMIN', ePaymentStatus: 'S', dWithdrawalTime: new Date(), dProcessedDate: new Date(), iWithdrawalDoneBy, nParentId }, { transaction: t, lock: true })
          // Retrieve the user's old balance
          const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true, raw: true })
          if (!oldBalance) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBalance) })
          const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

          let nCash = 0
          let nWin = 0
          // Update balances based on withdrawal type
          if (eType === 'withdraw') {
            nCash = nAmount
            await UserBalanceModel.update({
              nCurrentDepositBalance: literal(`nCurrentDepositBalance - ${nAmount}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${nAmount}`),
              nTotalWithdrawAmount: literal(`nTotalWithdrawAmount + ${nAmount}`),
              nTotalWithdrawCount: literal('nTotalWithdrawCount + 1')
            }, {
              where: { iUserId },
              transaction: t
            })
          } else if (eType === 'bonus') {
            nBonus = nAmount
            nAmount = 0
            await UserBalanceModel.update({ nCurrentBonus: literal(`nCurrentBonus - ${nBonus}`), nTotalWithdrawAmount: literal(`nTotalWithdrawAmount + ${nBonus}`), nTotalWithdrawCount: literal('nTotalWithdrawCount + 1') }, {
              where: { iUserId },
              transaction: t
            })
          } else if (eType === 'winning') {
            nWin = nAmount
            await UserBalanceModel.update({
              nCurrentWinningBalance: literal(`nCurrentWinningBalance - ${nAmount}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${nAmount}`),
              nTotalWithdrawAmount: literal(`nTotalWithdrawAmount + ${nAmount}`),
              nTotalWithdrawCount: literal('nTotalWithdrawCount + 1')
            }, {
              where: { iUserId },
              transaction: t
            })
          }

          // Create a passbook entry for the withdrawal
          await PassbookModel.create({ iUserId, eUserType, nAmount: nAmount + nBonus, nCash: nAmount, nBonus, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Withdraw', iWithdrawId: userWithdraw.id, eType: 'Dr', sRemarks: messages[APP_LANG].admin_withdraw, dActivityDate: new Date(), eStatus: 'CMP' }, { transaction: t })
          // Update user statistics
          await StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, { $inc: { nActualWinningBalance: -convertToDecimal(nWin), nActualDepositBalance: -convertToDecimal(nCash), nWinnings: -convertToDecimal(nWin), nTotalWinReturn: convertToDecimal(nCash), nWithdraw: convertToDecimal(nAmount) + convertToDecimal(nBonus), nWithdrawCount: 1, nActualBonus: -convertToDecimal(nBonus) } }, { upsert: true })
          // Create an admin log entry for the withdrawal
          const logData = { oOldFields: {}, oNewFields: { eType: nBonus ? 'BONUS' : eType === 'withdraw' ? 'DEPOSIT' : 'WINNING', nCash: nAmount, nBonus, iUserId, sUsername }, sIP: getIp(req), iAdminId: mongify(req.admin._id), iUserId: mongify(iUserId), eKey: 'AW', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
          await createAdminLog(logData)
        })
      } catch (error) {
        return catchError('UserWithdraw.adminWithdraw', error, req, res)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].withdraw) })
    } catch (error) {
      return catchError('UserWithdraw.adminWithdraw', error, req, res)
    }
  }

  // Admin: Processes the withdrawal status update (approve/reject)
  async processWithdrawV2(req, res) {
    try {
      // Extract relevant details from the request
      const { ePaymentStatus, sRejectReason } = req.body
      const { _id: iAdminId } = req.admin

      try {
        // Retrieve withdrawal information based on the provided ID
        // Initiating a database transaction using Sequelize
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const oTDSSetting = await SettingsModel.findOne({ sKey: 'TDS' }).lean()
          // Increment a counter in Redis to track the withdrawal process
          const bProcessing = await redisClient.incr(`processWithdraw:${req.params.id}`)
          // If there are multiple processes for the same withdrawal, return an error
          if (bProcessing > 1) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].wait_for_proccessing.replace('##', messages[req.userLanguage].withdraw) })

          // Retrieve withdrawal details within the transaction scope
          const withdraw = await UserWithdrawModel.findOne({ where: { id: req.params.id, ePaymentStatus: { [Op.in]: ['P', 'I', 'V'] } }, raw: true, transaction: t, lock: true })

          // If the withdrawal does not exist, clean up and return an error
          if (!withdraw) {
            await redisClient.del(`processWithdraw:${req.params.id}`)
            return res.status(status.NotFound).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].withdraw_process_err })
          } else {
            // Set an expiration for the withdrawal processing counter in Redis
            await redisClient.expire(`processWithdraw:${req.params.id}`, 20)
            const { iUserId, eUserType, nAmount, ePaymentStatus: ePaymentOldStatus, sInfo, ePlatform, sIP, ePaymentGateway } = withdraw
            const oOldFields = { nAmount, ePaymentStatus: ePaymentOldStatus, sInfo, ePlatform, sIP }

            // Retrieve the old balance of the user
            const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
            // If the old balance does not exist, return an error
            if (!oldBalance) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBalance) })
            const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

            // Set the processed date for the withdrawal
            const dProcessedDate = new Date()
            // Check if the withdrawal is successful
            if (ePaymentStatus === 'S') {
              // Additional logic for a successful withdrawal
              if (['P', 'V'].includes(ePaymentOldStatus)) {
                console.log('ePaymentOldStatus', ePaymentOldStatus)

                // ************** Add money to the user account Remaining **************
                const { iUserId, nAmount, id: iWithdrawId, nWithdrawFee = 0, nPlatformFee = 0 } = withdraw

                // Retrieve the corresponding passbook entry
                const passbook = await PassbookModel.findOne({ where: { iUserId, iWithdrawId: req.params.id }, attributes: ['id'], transaction: t, lock: true })

                // Calculate the final amount after deducting fees
                const nFinalAmount = nAmount - nWithdrawFee - nPlatformFee

                await UserWithdrawModel.update({ ePaymentStatus: 'S', iWithdrawalDoneBy: iAdminId.toString(), dProcessedDate, iTransactionId: '' }, { where: { id: req.params.id }, transaction: t })
                await PassbookModel.update({ dProcessedDate }, { where: { iWithdrawId: req.params.id }, transaction: t })

                if (oTDSSetting?.eStatus === 'Y') {
                  const oWithdrawalData = {
                    iUserId,
                    nFinalAmount,
                    iWithdrawId,
                    iAdminId,
                    iPassbookId: passbook?.id,
                    oldBalance
                  }
                  // here, we need to calculate tds before process
                  const { isSuccess, oTDS, oData } = await oTDSHelper.getAndProcessTDS(oWithdrawalData)
                  console.log('TDS::::', oTDS)
                  if (!isSuccess || oData.nFinalAmount <= 0) {
                    return res.status(status.BadRequest).jsonp({
                      status: jsonStatus.BadRequest,
                      message: messages[req.userLanguage].withdraw_process_err
                    })
                  }

                  // Create TDS Entry
                  const { nTDSAmount, nTaxableAmount, nPercentage, nRequestedAmount } = oTDS
                  if (nTDSAmount > 0) {
                    const oPassbookResponse = await PassbookModel.create({
                      iUserId,
                      eTransactionType: 'TDS',
                      eUserType: 'U',
                      eType: 'Dr',
                      nAmount: nTDSAmount,
                      nCash: nTDSAmount,
                      nOldWinningBalance,
                      nOldDepositBalance,
                      nOldTotalBalance,
                      nOldBonus,
                      sRemarks: `You have paid ${nTDSAmount} ₹ as TDS on the withdrawal of ${nRequestedAmount} ₹`,
                      dActivityDate: new Date()
                    }, { transaction: t })

                    await UserTdsModel.create({
                      iUserId,
                      iWithdrawId: Number(req.params.id),
                      nPercentage,
                      nOriginalAmount: nTaxableAmount, // Amount on which TDS calculated
                      nAmount: nTDSAmount, // Actual TDS Amount
                      nActualAmount: convertToDecimal(nTaxableAmount - nTDSAmount), // Amount which will be given to user after TDS
                      nWithdrawAmount: nRequestedAmount,
                      iPassbookId: oPassbookResponse?.id,
                      eUserType: 'U',
                      eStatus: 'P'
                    }, { transaction: t })
                  }
                }
              }

              // If the old status is 'I', update the withdrawal status to 'S' (Success)
              if (ePaymentOldStatus === 'I') {
                await UserWithdrawModel.update({ ePaymentStatus: 'S', iWithdrawalDoneBy: iAdminId.toString(), dProcessedDate }, { where: { id: req.params.id }, transaction: t })
                // Update the corresponding passbook entry with the processed date
                await PassbookModel.update({ dProcessedDate }, { where: { iWithdrawId: req.params.id }, transaction: t })

                if (oTDSSetting?.eStatus === 'Y') {
                  // Fetch TDS BreakUp
                  const oData = {
                    iUserId,
                    nFinalAmount: Number(nAmount),
                    iWithdrawId: Number(req.params.id)
                  }
                  await oTDSHelper.createTDSEntry(oData, t)
                }
              }
            } else if (ePaymentStatus === 'C') {
              // Actions for withdrawal cancellation
              // Update the withdrawal status to 'R' (Rejected)
              await UserWithdrawModel.update({ ePaymentStatus: 'R', iWithdrawalDoneBy: iAdminId.toString(), dProcessedDate }, { where: { id: req.params.id }, transaction: t })

              let updateStatsObj
              // Update the user's balance and related statistics for withdrawal cancellation
              const updateObj = {
                nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
                nTotalWithdrawAmount: literal(`nTotalWithdrawAmount - ${nAmount}`),
                nTotalWithdrawCount: literal('nTotalWithdrawCount - 1')
              }

              // Retrieve the corresponding passbook entry
              const passbook = await PassbookModel.findOne({ where: { iUserId, iWithdrawId: req.params.id }, transaction: t, lock: true })
              // Calculate differences in winning and deposit balances
              const winDiff = passbook?.nOldWinningBalance - passbook?.nNewWinningBalance
              const depositDiff = passbook?.nOldDepositBalance - passbook?.nNewDepositBalance
              // Update the balance and statistics based on the differences
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
              // Include additional statistics for withdrawal cancellation
              updateStatsObj = { ...updateStatsObj, nWithdraw: -convertToDecimal(nAmount), nWithdrawCount: -1 }

              // Update the user's balance with the calculated values
              await UserBalanceModel.update(updateObj,
                {
                  where: { iUserId },
                  transaction: t
                })
              // Create a new passbook entry for the withdrawal cancellation
              await PassbookModel.create({ iUserId, eUserType, nAmount, nCash: nAmount, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Withdraw-Return', iWithdrawId: withdraw.id, eType: 'Cr', sRemarks: messages[APP_LANG].withdraw_rejected_admin.replace('##', ePaymentGateway).replace('#', sRejectReason), dProcessedDate, eStatus: 'R' }, { transaction: t })
              // Update user statistics with the additional withdrawal cancellation statistics
              await StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, { $inc: updateStatsObj }, { upsert: true })

              // Retrieve user and setting information for withdrawal rejection notifications
              const [setting] = await Promise.all([
                SettingsModel.findOne({ sKey: 'WITHDRAW_REJECT' }).lean()
              ])

              const { sValue } = setting || {}

              if (sValue === 'NOTIFICATION') {
                await queuePush('pushNotification:rejectWithdraw', { _id: iUserId, sRejectReason })
              }
            } else if (ePaymentStatus === 'V') {
              await UserWithdrawModel.update({ ePaymentStatus: 'V', iVerifiedBy: iAdminId.toString(), dProcessedDate }, { where: { id: req.params.id }, transaction: t })
            }
            // Prepare data for logging the changes
            const oNewFields = { ...oOldFields, ePaymentStatus, sIP: getIp(req) }
            const logData = { oOldFields, oNewFields, sIP: getIp(req), iAdminId: mongify(iAdminId), iUserId: mongify(iUserId), eKey: 'W', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
            // Create a log entry for the withdrawal processing
            await createAdminLog(logData)
            return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].processWithdraw) })
          }
        })
      } catch (error) {
        return catchError('UserWithdraw.processWithdrawV2', error, req, res)
      }
    } catch (error) {
      return catchError('UserWithdraw.processWithdrawV2', error, req, res)
    }
  }

  /**
 * Method for listing available payment gateways for deposits and withdrawals.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise representing the handling of the payment gateways listing.
 */
  listPaymentGateways(req, res) {
    try {
      // Constructing data object with deposit and withdrawal payment gateways
      const data = {
        aDepositPaymentGateways: paymentGetaways,
        aWithdrawPaymentGateways: withdrawPaymentGetaways
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cPaymentGateway), data })
    } catch (error) {
      return catchError('UserPayment.listPaymentGateways', error, req, res)
    }
  }
}

module.exports = new AdminUserWithdraw()
