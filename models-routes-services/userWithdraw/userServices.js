// @ts-check
const { literal, Op, Transaction } = require('sequelize')
const PassbookModel = require('../passbook/model')
const { catchError, convertToDecimal, mongify } = require('../../helper/utilities.services')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const db = require('../../database/sequelize')
const UserBalanceModel = require('../userbalance/model')
const { APP_LANG } = require('../../config/common')
const UserWithdrawModel = require('./model')
const StatisticsModel = require('../user/statistics/model')
const UsersModel = require('../user/model')
const SettingsModel = require('../setting/model')
const PayoutOptionModel = require('../payoutOptions/model')
const KYCModel = require('../kyc/model')
const CommonRuleModel = require('../commonRules/model')
const BankDetailsModel = require('../bankDetails/model')
const { validateWithdrawRateLimit } = require('./common')
const { getPlatformFeeWithdraw } = require('../payment/common')
const { getTaxForTransaction } = require('../userbalance/common')
const oWithdrawControl = require('./withdrawControl/services')

class UserWithdraw {
  async addV3(req, res) {
    try {
      // Retrieve withdrawal details from request and validate payout option
      let { nAmount, eWithdrawType, sUPIId, iBankDetailId } = req.body
      const payoutOption = await PayoutOptionModel.findOne({ eKey: eWithdrawType }).lean()
      // Check if the payout option exists and is enabled
      if (!payoutOption || payoutOption.bEnable === false) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].invalid_payout) })
      // Extract payment details and fees
      const { eKey: ePaymentGateway, nMinAmount, nMaxAmount } = payoutOption
      if (ePaymentGateway === 'UPI' && !sUPIId) {
        return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cUPIId) })
      }
      if (ePaymentGateway === 'BANK' && !iBankDetailId) {
        sUPIId = ''
        return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cbankDetails) })
      }
      const nFee = payoutOption.nWithdrawFee
      nAmount = Number(nAmount) || 0
      const iUserId = req.user._id.toString()
      // Check if the user is an internal account
      if (req.user.bIsInternalAccount === true) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].withdraw_not_permitted.replace('##', messages[req.userLanguage].internal_user) })
      }
      // Validate withdrawal settings
      const withdrawValidation = await SettingsModel.findOne({ sKey: 'Withdraw' }).lean()
      if (!withdrawValidation || !withdrawValidation?.nMin) return res.status(status.BadRequest).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cvalidationSetting) })
      if (nAmount < withdrawValidation?.nMin) return res.status(status.BadRequest).jsonp({ status: jsonStatus[400], message: messages[req.userLanguage].min_err.replace('##', messages[req.userLanguage].withdraw).replace('#', `${withdrawValidation.nMin}`) })
      // Initialize error message variable
      let sErrorMessage = ''
      // Check user verification status
      const user = await UsersModel.findOne({ _id: req.user._id, eStatus: 'Y' }).populate('oProfileLevel').lean()
      if (!user?.oProfileLevel?.oRules) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      // Check mobile verification status
      if (!user.bIsMobVerified) sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].mob_verify_err}`) : sErrorMessage.concat(messages[req.userLanguage].mob_verify_err)

      const oWithdrawStatistics = await oWithdrawControl.checkWithdrawLimit({ iUserId: req.user._id?.toString(), period: 'Day' })
      if ((oWithdrawStatistics.nWithdrawCount + 1) > user?.oProfileLevel?.oRules?.nDailyWithdrawCount) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages?.[req.userLanguage]?.withdraw_count_limit_exceeded })
      }
      if ((oWithdrawStatistics.nWithdrawAmount + nAmount) > user?.oProfileLevel?.oRules?.nDailyWithdrawLimit) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages?.[req.userLanguage].withdraw_amount_limit_exceeded })
      }

      // Check KYC status and rules
      const kycDetails = await KYCModel.findOne({ iUserId: req.user._id, $or: [{ 'oPan.eStatus': 'A' }, { 'oAadhaar.eStatus': 'A' }] }).lean()
      const kycRules = await CommonRuleModel.find({ eRule: { $in: ['KYCM', 'KYCWL', 'KYCDOC'] }, eStatus: 'Y' }).lean()

      // Function to handle KYC error messages
      const kycErrorMessage = () => {
        if (!kycDetails) sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].kyc_not_approved}`) : sErrorMessage.concat(messages[req.userLanguage].kyc_not_approved)
        if (kycDetails && kycDetails?.oPan?.eStatus !== 'A') sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].pancard_not_approved}`) : sErrorMessage.concat(messages[req.userLanguage].pancard_not_approved)
        if (kycDetails && kycDetails?.oAadhaar?.eStatus !== 'A') sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].aadharcard_not_approved}`) : sErrorMessage.concat(messages[req.userLanguage].aadharcard_not_approved)
      }

      // Loop through KYC rules
      for (const rule of kycRules) {
        if (rule.eRule === 'KYCM') {
          if (!kycDetails) {
            sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].kyc_not_approved}`) : sErrorMessage.concat(messages[req.userLanguage].kyc_not_approved)
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: sErrorMessage })
          }
          kycErrorMessage()
          if (sErrorMessage) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: sErrorMessage })
        }

        if (rule.eRule === 'KYCWL') {
          if (rule.nAmount <= nAmount) {
            kycErrorMessage()
            if (sErrorMessage) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: sErrorMessage })
          }
        }

        if (rule.eRule === 'KYCDOC') {
          if (!kycDetails) {
            kycErrorMessage()
            if (sErrorMessage) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: sErrorMessage })
          }
          if (rule.sKYCDoc === 'A' && kycDetails?.oAadhaar?.eStatus !== 'A') {
            sErrorMessage = sErrorMessage
              ? sErrorMessage.concat(` ${messages[req.userLanguage].aadharcard_not_approved}`)
              : sErrorMessage.concat(messages[req.userLanguage].aadharcard_not_approved)
          }

          if (rule.sKYCDoc === 'P' && kycDetails?.oPan?.eStatus !== 'A') {
            sErrorMessage = sErrorMessage
              ? sErrorMessage.concat(` ${messages[req.userLanguage].pancard_not_approved}`)
              : sErrorMessage.concat(messages[req.userLanguage].pancard_not_approved)
          }

          if (sErrorMessage) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: sErrorMessage })
        }
      }

      if (eWithdrawType === 'BANK') {
        // Check bank details
        const bankDetails = await BankDetailsModel.findOne({ iUserId: req.user._id }).lean()
        if (!bankDetails || !bankDetails.sAccountNo || !bankDetails.sIFSC) sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].fill_bankdetails_err}`) : sErrorMessage.concat(messages[req.userLanguage].fill_bankdetails_err)
      }

      if (sErrorMessage) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: sErrorMessage })

      let nWithdrawFee = 0
      // Calculate withdrawal fee based on amount
      if (nAmount >= nMinAmount && nAmount <= nMaxAmount) {
        nWithdrawFee = nFee
      }

      // Validate withdrawal rate limit
      await validateWithdrawRateLimit(iUserId, req.userLanguage)

      // Transaction block for processing withdrawal
      try {
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
          if (!oldBalance) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBalance) })

          const [{ nPlatformFee, nActualAmount, bIsFailed, sMessage }, { nApplicableTax, nTaxPercentage }] = await Promise.all([
            getPlatformFeeWithdraw({ nAmount, ePaymentGateway, iPayoutId: payoutOption?._id?.toString() }),
            getTaxForTransaction({ nAmount, transactionKey: 'WITHDRAW_TAX' })
          ])
          // Handle platform fee error
          const rejectFee = { status: jsonStatus.UnprocessableEntity, message: sMessage }
          if (bIsFailed) return Promise.reject(rejectFee)
          const oldWithdraw = await UserWithdrawModel.findOne({ where: { iUserId }, order: [['id', 'DESC']], transaction: t, lock: true })
          const existWithdraw = await UserWithdrawModel.findOne({
            where: { iUserId, ePaymentStatus: 'P', ePaymentGateway: { [Op.ne]: 'ADMIN' } },
            attributes: ['id', 'iUserId', 'ePaymentGateway', 'ePaymentStatus', 'sInfo', 'nAmount', 'nParentId', 'dWithdrawalTime', 'iWithdrawalDoneBy', 'nWithdrawFee', 'ePlatform', 'dProcessedDate', 'dCreatedAt', 'iBankDetailId', 'sUPIId'],
            transaction: t,
            lock: true
          })
          // Check for existing pending withdrawal
          if (existWithdraw) {
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cPendingWithdraw), data: { bPending: true, existWithdraw } })
          } else {
            const nParentId = !oldWithdraw ? null : oldWithdraw.id
            const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

            // Update user balance and statistics based on withdrawal
            const updateObj = {
              nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${nAmount}`),
              nTotalWithdrawAmount: literal(`nTotalWithdrawAmount + ${nAmount}`),
              nTotalWithdrawCount: literal('nTotalWithdrawCount + 1')
            }

            let updateStatsObj, resetFieldObj
            const winBifurcate = await SettingsModel.findOne({ sKey: 'WinBifurcate' }).lean()
            if (!winBifurcate) {
              if (nAmount > nOldWinningBalance) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].insuff_balance.replace('##', messages[req.userLanguage].withdraw) })
              updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance - ${nAmount}`)
              updateStatsObj = {
                nActualWinningBalance: -convertToDecimal(nAmount),
                nWinnings: -convertToDecimal(nAmount)
              }
            } else {
              if (nOldWinningBalance < nAmount) {
                if (nOldWinningBalance < 0) {
                  if (nAmount > nOldDepositBalance) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].insuff_balance.replace('##', messages[req.userLanguage].withdraw) })
                  updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance - ${nAmount}`)
                  updateStatsObj = {
                    nActualDepositBalance: -convertToDecimal(nAmount),
                    nCash: -convertToDecimal(nAmount)
                  }
                } else {
                  if ((nOldDepositBalance - (nAmount - nOldWinningBalance)) < 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].insuff_balance.replace('##', messages[req.userLanguage].withdraw) })

                  updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance - ${(nAmount - nOldWinningBalance)}`)
                  updateObj.nCurrentWinningBalance = 0
                  updateStatsObj = {
                    nActualDepositBalance: -convertToDecimal(nAmount - nOldWinningBalance),
                    nCash: -convertToDecimal(nAmount - nOldWinningBalance)
                  }
                  resetFieldObj = { nActualWinningBalance: 0, nWinnings: 0 }
                }
              } else {
                updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance - ${nAmount}`)
                updateStatsObj = {
                  nActualWinningBalance: -convertToDecimal(nAmount),
                  nWinnings: -convertToDecimal(nAmount)
                }
              }
            }
            updateStatsObj = { ...updateStatsObj, nWithdraw: convertToDecimal(nAmount), nWithdrawCount: 1 }

            // Create withdrawal record
            const userWithdraw = await UserWithdrawModel.create({ iUserId, sUPIId, iBankDetailId, eUserType: user.eType, nAmount, dWithdrawalTime: new Date(), nParentId, ePaymentGateway, nWithdrawFee, nPlatformFee, nApplicableTax, nTaxPercentage, nActualAmount }, { transaction: t, lock: true })

            // Update user balance
            await UserBalanceModel.update(updateObj,
              {
                where: { iUserId },
                transaction: t
              })
            // Create passbook entry for withdrawal
            const sRemarks = messages[APP_LANG].withdraw_from_fee.replace('##', ePaymentGateway).replace('#', nWithdrawFee) + ', ' + messages[APP_LANG].platform_fee_debited.replace('##', messages[APP_LANG].withdraw).replace('#', nPlatformFee).replace('###', nActualAmount)
            await PassbookModel.create({ iUserId, eUserType: user.eType, nAmount, nActualAmount, nPlatformFee, nApplicableTax, nTaxPercentage, nCash: nAmount, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Withdraw', iWithdrawId: userWithdraw.id, eType: 'Dr', eStatus: 'CMP', sRemarks, nWithdrawFee }, { transaction: t })

            // we need to store platform fee in statistics collection
            updateStatsObj.nPlatformFee = convertToDecimal(nPlatformFee)
            updateStatsObj.nApplicableTax = convertToDecimal(nApplicableTax)

            // Update user statistics
            await StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, { $inc: updateStatsObj, ...resetFieldObj }, { upsert: true })
            return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].withdraw_request_success })
          }
        })
      } catch (error) {
        const { status = '', message = '' } = error
        if (status && message) return res.status(status).jsonp({ status, message })
        return catchError('UserWithdraw.addV3', error, req, res)
      }
    } catch (error) {
      const { status = '', message = '' } = error
      if (!status) { return catchError('UserWithdraw.addV3', error, req, res) }
      return res.status(status).jsonp({ status, message })
    }
  }

  /**
   * Checks if the user has a pending withdrawal request.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   */
  async checkWithdrawRequestV2(req, res) {
    try {
      // Retrieve user ID from the request
      const iUserId = req.user._id.toString()
      // Find user by ID
      const user = await UsersModel.findOne({ _id: iUserId }).lean()
      // Check if the user exists
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages.err_unauthorized })

      // Check if the user is an internal account
      // if (user.bIsInternalAccount === true) {
      //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages.withdraw_not_permitted.replace('##', messages.internal_user) })
      // }

      try {
        let userWithdraw
        let bFlag = true

        // Transaction: Start
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          // Find a pending withdrawal request for the user
          userWithdraw = await UserWithdrawModel.findOne({ where: { iUserId, ePaymentStatus: 'P' }, transaction: t, lock: true })
          // If no pending withdrawal request, set the flag to false
          if (!userWithdraw) { bFlag = false }
        })
        // If no pending withdrawal, return success
        if (!bFlag) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].withdraw), data: { pending: false } })
        // If pending withdrawal, return information about it
        userWithdraw.eUserType = undefined
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cPendingWithdraw), data: { pending: true, userWithdraw } })
      } catch (error) {
        return catchError('UserWithdraw.checkWithdrawLimitV2', error, req, res)
      }
    } catch (error) {
      return catchError('UserWithdraw.checkWithdrawRequestV2', error, req, res)
    }
  }

  /**
 * Handles user cancellation of a withdrawal request.
 * This function cancels a pending withdrawal, updates user balances, and logs the transaction.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
  async userCancelWithdraw(req, res) {
    try {
      // Extract withdrawal ID from request parameters
      const { iWithdrawId } = req.params

      try {
        // Transaction: Start
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          // Find the withdrawal request
          const withdraw = await UserWithdrawModel.findOne({ where: { id: iWithdrawId, iUserId: req.user._id.toString() }, transaction: t, lock: true })
          // Check if the withdrawal request exists
          if (!withdraw) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].withdraw) })

          // Check if the withdrawal is in the pending state
          if (withdraw?.ePaymentStatus !== 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].withdraw_process_err })

          const { iUserId, nAmount, ePaymentGateway, eUserType } = withdraw
          // Find the user's old balance, Check if the user's balance exists
          const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
          if (!oldBalance) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBalance) })
          const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

          // Update withdrawal status to canceled
          await UserWithdrawModel.update({ ePaymentStatus: 'C', sInfo: 'Withdraw cancelled by self.', dProcessedDate: new Date() }, { where: { id: iWithdrawId }, transaction: t })

          let updateStatsObj
          // Update user balances
          const updateObj = {
            nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
            nTotalWithdrawAmount: literal(`nTotalWithdrawAmount - ${nAmount}`),
            nTotalWithdrawCount: literal('nTotalWithdrawCount - 1')
          }
          // Find the corresponding passbook entry
          const passbook = await PassbookModel.findOne({ where: { iUserId, iWithdrawId }, transaction: t, lock: true })
          // Calculate differences for deposit and winning balances
          const winDiff = passbook?.nOldWinningBalance - passbook?.nNewWinningBalance
          const depositDiff = passbook?.nOldDepositBalance - passbook?.nNewDepositBalance
          if (depositDiff > 0) {
            if (winDiff > 0) {
              // Update winning and deposit balances
              updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance + ${winDiff}`)
              updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance + ${depositDiff}`)
              updateStatsObj = {
                nActualDepositBalance: convertToDecimal(depositDiff),
                nCash: convertToDecimal(depositDiff),
                nActualWinningBalance: convertToDecimal(winDiff),
                nWinnings: convertToDecimal(winDiff)
              }
            } else {
              // Update only deposit balance
              updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance + ${nAmount}`)
              updateStatsObj = {
                nActualDepositBalance: convertToDecimal(nAmount),
                nCash: convertToDecimal(nAmount)
              }
            }
          } else {
            // Update only winning balance
            updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance + ${nAmount}`)
            updateStatsObj = {
              nActualWinningBalance: convertToDecimal(nAmount),
              nWinnings: convertToDecimal(nAmount)
            }
          }
          // Update withdrawal-related stats
          updateStatsObj = { ...updateStatsObj, nWithdraw: -convertToDecimal(nAmount), nWithdrawCount: -1 }

          await UserBalanceModel.update(updateObj, { where: { iUserId }, transaction: t })
          // Create passbook entry for canceled withdrawal
          await PassbookModel.create({ iUserId, eUserType, nAmount, nCash: nAmount, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Withdraw-Return', iWithdrawId: withdraw?.id, eType: 'Cr', sRemarks: messages[APP_LANG].withdraw_cancelled.replace('##', ePaymentGateway), eStatus: 'C' }, { transaction: t })
          // Update user statistics
          await StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, { $inc: updateStatsObj }, { upsert: true })

          // Transaction: End
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cancel_success.replace('##', messages[req.userLanguage].withdraw) })
        })
      } catch (error) {
        return catchError('UserWithdraw.userCancelWithdraw', error, req, res)
      }
    } catch (error) {
      return catchError('UserWithdraw.userCancelWithdraw', error, req, res)
    }
  }
}

module.exports = new UserWithdraw()
