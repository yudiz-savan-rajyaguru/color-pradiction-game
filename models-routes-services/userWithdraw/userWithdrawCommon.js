// @ts-check
const { Op, literal } = require('sequelize')
const SettingsModel = require('../setting/model')
const KYCModel = require('../kyc/model')
const UsersModel = require('../user/model')
const { getPlatformFeeWithdraw } = require('../payment/common')
const { jsonStatus, status, messages } = require('../../helper/api.responses')
const UserBalanceModel = require('../userbalance/model')
const { convertToDecimal } = require('../../helper/utilities.services')
const { CACHE_2 } = require('../../config/config')
const UserWithdrawModel = require('./model')
const CommonRuleModel = require('../commonRules/model')
const BankDetailsModel = require('../bankDetails/model')
const { getTaxForTransaction } = require('../userbalance/common')

async function findBalanceAndValidate({ req, iUserId, t, nAmount, ePaymentGateway }) {
  try {
    const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
    if (!oldBalance) return { status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBalance), isSuccess: false }

    const [{ nPlatformFee, nActualAmount, bIsFailed, sMessage }, { nApplicableTax, nTaxPercentage }] = await Promise.all([
      getPlatformFeeWithdraw({ nAmount, ePaymentGateway, iPayoutId: req.params.id }),
      getTaxForTransaction({ nAmount, transactionKey: 'WITHDRAW_TAX' })
    ])
    const rejectFee = { status: jsonStatus.UnprocessableEntity, message: sMessage }
    if (bIsFailed) return Promise.reject(rejectFee)
    const oldWithdraw = await UserWithdrawModel.findOne({ where: { iUserId }, order: [['id', 'DESC']], transaction: t, lock: true })

    const existWithdraw = await UserWithdrawModel.findOne({
      where: { iUserId, ePaymentStatus: 'P', ePaymentGateway: { [Op.ne]: 'ADMIN' } },
      attributes: ['id', 'iUserId', 'ePaymentGateway', 'ePaymentStatus', 'sInfo', 'nAmount', 'nParentId', 'dWithdrawalTime', 'iWithdrawalDoneBy', 'nWithdrawFee', 'ePlatform', 'dProcessedDate', 'dCreatedAt'],
      transaction: t,
      lock: true
    })
    if (existWithdraw) {
      return { status: jsonStatus.BadRequest, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cPendingWithdraw), data: { bPending: true, existWithdraw }, isSuccess: false }
    }
    return { nPlatformFee, nActualAmount, oldWithdraw, oldBalance, nApplicableTax, nTaxPercentage }
  } catch (error) {
    throw new Error(error)
  }
}

async function commonConditionChecks({ req, nAmount, payoutOption }) {
  try {
    const condRes = await withdrawConditionCheck({ req, nAmount })
    if (condRes?.isSuccess === false) {
      return {
        status: condRes.status,
        message: condRes.message,
        isSuccess: false
      }
    }
    let { sErrorMessage, user } = condRes
    // start : need to change kyc section as per country
    const kycRes = await kycRelatedInfo({ req, sErrorMessage, nAmount })
    if (kycRes?.isSuccess === false) {
      return {
        status: kycRes.status,
        message: kycRes.message,
        isSuccess: false
      }
    }
    sErrorMessage = kycRes.sErrorMessage
    // need to change for paypal we need to store paypal id or email or mobile number

    const bankRes = await bankAndWithdrawFee({ req, sErrorMessage, nAmount, payoutOption })
    if (bankRes?.isSuccess === false) {
      return {
        status: bankRes.status,
        message: bankRes.message,
        isSuccess: false
      }
    }
    return { bankRes, user }
  } catch (error) {
    throw new Error(error)
  }
}

async function bankAndWithdrawFee({ req, sErrorMessage, nAmount, payoutOption }) {
  try {
    const { nMinAmount, nMaxAmount, nFee } = payoutOption

    const bankDetails = await BankDetailsModel.findOne({ iUserId: req.user._id }).lean()
    if (!bankDetails || !bankDetails.sAccountNo || !bankDetails.sIFSC) sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].fill_bankdetails_err}`) : sErrorMessage.concat(messages[req.userLanguage].fill_bankdetails_err)

    if (sErrorMessage) return { status: jsonStatus.BadRequest, message: sErrorMessage, isSuccess: false }

    let nWithdrawFee = 0
    if (nAmount >= nMinAmount && nAmount <= nMaxAmount) {
      nWithdrawFee = nFee
    }
    return { nWithdrawFee }
  } catch (error) {
    throw new Error(error)
  }
}

async function getUpdateData({ req, oldBalance, nAmount, updateObj }) {
  try {
    const { nCurrentWinningBalance: nOldWinningBalance } = oldBalance

    let updateStatsObj, resetFieldObj
    const winBifurcate = await SettingsModel.findOne({ sKey: 'WinBifurcate' }).lean()
    if (!winBifurcate) {
      if (nAmount > nOldWinningBalance) return { status: jsonStatus.BadRequest, message: messages[req.userLanguage].insuff_balance.replace('##', messages[req.userLanguage].withdraw), isSuccess: false }
      updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance - ${nAmount}`)
      updateStatsObj = {
        nActualWinningBalance: -convertToDecimal(nAmount),
        nWinnings: -convertToDecimal(nAmount)
      }
    } else {
      const resData = getUpdatedBalanceObject({ req, oldBalance, nAmount, updateObj, updateStatsObj, resetFieldObj })
      if (resData?.isSuccess === false) return { status: resData.status, message: resData.message, isSuccess: false }
      updateObj = resData.updateObj
      updateStatsObj = resData.updateStatsObj
      resetFieldObj = resData.resetFieldObj
    }
    updateStatsObj = { ...updateStatsObj, nWithdraw: convertToDecimal(nAmount), nWithdrawCount: 1 }
    return { updateStatsObj, resetFieldObj, updateObj }
  } catch (error) {
    throw new Error(error)
  }
}

function getUpdatedBalanceObject({ req, oldBalance, nAmount, updateObj, updateStatsObj, resetFieldObj }) {
  try {
    const { nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance
    if (nOldWinningBalance < nAmount) {
      if (nOldWinningBalance < 0) {
        if (nAmount > nOldDepositBalance) return { status: jsonStatus.BadRequest, message: messages[req.userLanguage].insuff_balance.replace('##', messages[req.userLanguage].withdraw), isSuccess: false }
        updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance - ${nAmount}`)
        updateStatsObj = {
          nActualDepositBalance: -convertToDecimal(nAmount),
          nCash: -convertToDecimal(nAmount)
        }
      } else {
        if ((nOldDepositBalance - (nAmount - nOldWinningBalance)) < 0) return { status: jsonStatus.BadRequest, message: messages[req.userLanguage].insuff_balance.replace('##', messages[req.userLanguage].withdraw), isSuccess: false }
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
    return { updateObj, updateStatsObj, resetFieldObj }
  } catch (error) {
    throw new Error()
  }
}

const addErrorMessage = (sErrorMessage, message) => {
  try {
    return sErrorMessage ? sErrorMessage.concat(` ${message}`) : sErrorMessage.concat(message)
  } catch (error) {
    throw new Error(error)
  }
}

const kycErrorMessage = ({ req, kycDetails, sErrorMessage }) => {
  try {
    if (!kycDetails) sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].kyc_not_approved}`) : sErrorMessage.concat(messages[req.userLanguage].kyc_not_approved)
    if (kycDetails && kycDetails.oPan.eStatus !== 'A') sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].pancard_not_approved}`) : sErrorMessage.concat(messages[req.userLanguage].pancard_not_approved)
    if (kycDetails && kycDetails.oAadhaar.eStatus !== 'A') sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].aadharcard_not_approved}`) : sErrorMessage.concat(messages[req.userLanguage].aadharcard_not_approved)
    return sErrorMessage
  } catch (error) {
    throw new Error(error)
  }
}

const checkKYCM = ({ req, kycDetails, sErrorMessage }) => {
  try {
    if (!kycDetails) {
      sErrorMessage = addErrorMessage(messages[req.userLanguage].kyc_not_approved)
      return { isSuccess: false, sErrorMessage }
    }
    sErrorMessage = kycErrorMessage({ req, kycDetails, sErrorMessage })
    return { isSuccess: true, sErrorMessage }
  } catch (error) {
    throw new Error(error)
  }
}

const checkKYCWL = ({ req, kycDetails, sErrorMessage, rule, nAmount }) => {
  try {
    if (rule.nAmount <= nAmount) {
      sErrorMessage = kycErrorMessage({ req, kycDetails, sErrorMessage })
      return { isSuccess: true, sErrorMessage }
    }
    return { isSuccess: false, sErrorMessage }
  } catch (error) {
    throw new Error(error)
  }
}

const checkKYCDOC = ({ req, kycDetails, sErrorMessage, rule }) => {
  try {
    if (!kycDetails) {
      sErrorMessage = kycErrorMessage({ req, kycDetails, sErrorMessage })
      return { isSuccess: true, sErrorMessage }
    }
    if (rule.sKYCDoc === 'A' && kycDetails.oAadhaar.eStatus !== 'A') {
      sErrorMessage = addErrorMessage(messages[req.userLanguage].aadharcard_not_approved)
    }
    if (rule.sKYCDoc === 'P' && kycDetails.oPan.eStatus !== 'A') {
      sErrorMessage = addErrorMessage(messages[req.userLanguage].pancard_not_approved)
    }
    return { isSuccess: true, sErrorMessage }
  } catch (error) {
    throw new Error(error)
  }
}

async function kycRelatedInfo({ req, sErrorMessage, nAmount }) {
  try {
    const kycDetails = await KYCModel.findOne({ iUserId: req.user._id, $or: [{ 'oPan.eStatus': 'A' }, { 'oAadhaar.eStatus': 'A' }] }).lean()
    const kycRules = await CommonRuleModel.find({ eRule: { $in: ['KYCM', 'KYCWL', 'KYCDOC'] }, eStatus: 'Y' }).lean()
    for (const rule of kycRules) {
      if (rule.eRule === 'KYCM') {
        const { isSuccess, sErrorMessage: message } = checkKYCM({ req, kycDetails, sErrorMessage })
        if (!isSuccess) return { status: jsonStatus.BadRequest, message, isSuccess: false }
      }
      if (rule.eRule === 'KYCWL') {
        const { isSuccess, sErrorMessage: message } = checkKYCWL({ req, kycDetails, sErrorMessage, rule, nAmount })
        if (isSuccess) return { status: jsonStatus.BadRequest, message, isSuccess: false }
      }
      if (rule.eRule === 'KYCDOC') {
        const { isSuccess, sErrorMessage: message } = checkKYCDOC({ req, kycDetails, sErrorMessage, rule })
        if (isSuccess) return { status: jsonStatus.BadRequest, message, isSuccess: false }
      }
    }
    return { sErrorMessage }
  } catch (error) {
    throw new Error()
  }
}
/**
 * Some condition check for user withdraw
 * @param {*} object
 */
async function withdrawConditionCheck({ req, nAmount }) {
  try {
    if (req.user.bIsInternalAccount === true) {
      return {
        status: jsonStatus.BadRequest,
        message: messages[req.userLanguage].withdraw_not_permitted.replace('##', messages[req.userLanguage].internal_user),
        isSuccess: false
      }
    }
    // Validate withdrawal amount against configured limits
    const withdrawValidation = await SettingsModel.findOne({ sKey: 'Withdraw' }).lean()
    if (!withdrawValidation) return { status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cvalidationSetting), isSuccess: false }
    const setting = await SettingsModel.findOne({ sKey: 'CURRENCY' }, { sLogo: 1 }).lean()
    // .cache(CACHE_2, 'setting:CURRENCY')
    const symbol = setting?.sLogo || '₹'
    if (nAmount < withdrawValidation?.nMin) return { status: jsonStatus.BadRequest, message: messages[req.userLanguage].min_err.replace('##', messages[req.userLanguage].withdraw).replace('#', `${withdrawValidation.nMin}`).replace('₹', symbol), isSuccess: false }
    if (nAmount > withdrawValidation?.nMax) return { status: jsonStatus.BadRequest, message: messages[req.userLanguage].max_err.replace('##', messages[req.userLanguage].withdraw).replace('#', `${withdrawValidation.nMax}`).replace('₹', symbol), isSuccess: false }
    // Initialize error message variable
    let sErrorMessage = ''
    // Find user and check if mobile number is verified
    const user = await UsersModel.findOne({ _id: req.user._id, eStatus: 'Y' }).lean()
    if (!user) return { status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized, isSuccess: false }
    if (!user.bIsMobVerified) sErrorMessage = sErrorMessage ? sErrorMessage.concat(` ${messages[req.userLanguage].mob_verify_err}`) : sErrorMessage.concat(messages[req.userLanguage].mob_verify_err)
    return { sErrorMessage, user, symbol }
  } catch (error) {
    throw new Error(error)
  }
}

module.exports = {
  getUpdateData,
  commonConditionChecks,
  findBalanceAndValidate
}
