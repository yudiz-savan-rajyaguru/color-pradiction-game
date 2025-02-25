const { status, messages } = require('../../helper/api.responses')
const { queuePush } = require('../../helper/redis')
const { decryptValue, pick, catchError, encryptKey } = require('../../helper/utilities.services')
const PaymentOptionModel = require('../paymentOptions/model')
const { findSettingV2 } = require('../setting/services')
const UserModel = require('../user/model')
const UserDepositModel = require('../userDeposit/model')
const { createDeposit, validateDepositRateLimit } = require('../userDeposit/common')
const oRazorpayServices = require('./razorpay')
const oCoinbaseServices = require('./coinbase')
const CommonModel = require('../common/model')
const config = require('../../config/config')
const { logStats } = require('../promocode/statistics/services')

const oPaymentService = {}

oPaymentService.createOrder = async (req, res) => {
  try {
    const ePlatform = req.header('Platform')
    if (!ePlatform) {
      return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages?.[req.userLanguage]?.fields_missing.replace('##', messages[req.userLanguage].cPlatformHeaders) })
    }
    if (!['A', 'I', 'W'].includes(ePlatform)) {
      return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cPlatformHeaders) })
    }

    const { eType, nAmount, sPromocode } = req.body
    const oPayload = { ePaymentGateway: eType, nAmount, sPromocode }

    const data = await PaymentOptionModel.countDocuments({ eKey: eType, bEnable: true })
    if (!data) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].cpaymentOption) })
    // Retrieving user information
    const iUserId = req.user._id.toString()
    const oUserData = await UserModel.findOne({ _id: iUserId }, { sEmail: 1, sMobNum: 1, bIsInternalAccount: 1, sName: 1, _id: 1, eType: 1, sUsername: 1 }).lean()
    // Handling user not found scenario
    if (!oUserData) return res.status(status.Unauthorized).jsonp({ status: status.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
    if (oUserData.sMobNum) oUserData.sMobNum = decryptValue(oUserData.sMobNum)
    req.user = oUserData

    // Find deposit validation settings
    const depositValidation = await findSettingV2({ sKey: 'Deposit' }, { nMin: 1, nMax: 1 })
    if (!depositValidation) {
      return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages?.not_exist.replace('##', messages.cvalidationSetting) })
    }
    // Validate deposit amount based on settings
    if (req.body?.orderAmount < depositValidation.nMin) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].min_err.replace('##', messages[req.userLanguage].cDeposit).replace('#', `${depositValidation.nMin}`) })
    if (req.body?.orderAmount > depositValidation.nMax) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].max_err.replace('##', messages[req.userLanguage].cDeposit).replace('#', `${depositValidation.nMax}`) })

    await validateDepositRateLimit(iUserId, req.userLanguage)
    // Creating deposit and handling internal account scenario
    const { data: userDeposit } = await createDeposit(oPayload, req.user)
    if (oUserData.bIsInternalAccount === true) return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].deposit_success, data: { bIsInternalUserDeposit: true } })
    // Handling payment based on the payment gateway type (eType)
    // Here,in iOrderId we are passing iOrderId to avoid conflicts in dev and stag env
    req.body.iOrderId = userDeposit.iOrderId
    if (['RAZORPAY'].includes(eType)) {
      const oCommon = await CommonModel.findOne({ eType: 'L' }).lean()
      // .cache(CACHE_6, 'LOGO')

      req.body = pick(req.body, ['iOrderId', 'nAmount'])
      const { iOrderId: orderId, nAmount: orderAmount } = req.body
      const oRazorpayPayload = { nAmount: orderAmount, iOrderId: orderId, sUserName: oUserData?.sUsername }
      const oRazorPayResponse = await oRazorpayServices.createOrder(oRazorpayPayload)
      await UserDepositModel.update({ iTransactionId: oRazorPayResponse?.id }, {
        where: {
          iOrderId: orderId
        }
      })
      if (userDeposit?.iPromocodeId) {
        await logStats({ iUserId, iPromocodeId: userDeposit?.iPromocodeId, nAmount: userDeposit?.nBonus, sTransactionType: 'DEPOSIT', idepositId: userDeposit?.id })
      }
      const logData = {
        iUserId,
        iDepositId: userDeposit.id,
        iOrderId: userDeposit.iOrderId,
        ePlatform,
        eGateway: eType,
        eType: 'D',
        sTriggeredByFunction: 'createOrder',
        oBody: req.body,
        oReq: oRazorpayPayload,
        oRes: oRazorPayResponse
      }
      queuePush('TransactionLog', logData)
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].order_created, data: { iDepositId: userDeposit.id, ...oRazorPayResponse, sLogo: oCommon?.sUrl !== '' || oCommon?.sUrl !== undefined ? oCommon?.sUrl : 'logo/1726134151292_logo.png' } })
    } else if (eType === 'COINBASE') {
      req.body = pick(req.body, ['iOrderId', 'nAmount'])
      const { iOrderId: orderId, nAmount } = req.body
      const nOrderAmount = nAmount
      const sOrderCurrency = 'INR'
      let chargeData = {
        pricing_type: 'fixed_price',
        local_price: {
          amount: nOrderAmount,
          currency: sOrderCurrency
        },
        cancel_url: config.FRONTEND_HOST_URL,
        redirect_url: `${config.FRONTEND_HOST_URL}/profile`,
        will_redirect_after_success: 'true',
        metadata: {
          customer_details: {
            customer_id: oUserData._id.toString(),
            customer_email: oUserData.sEmail || 'user@fansportiz.com',
            customer_phone: oUserData.sMobNum
          },
          order_id: `${orderId}`,
          order_amount: nOrderAmount,
          order_currency: sOrderCurrency
        }
      }
      // the below function is used to create order in Cashfree and let frontend devs redirect to its page
      const response = await oCoinbaseServices.coinbasePaymentV2(chargeData)
      const { result = {} } = response

      const { customer_details: oCustomer } = chargeData.metadata
      const { customer_id: sCustId, customer_email: sCustEmail, customer_phone: sCustPhone } = oCustomer

      chargeData = { ...chargeData, customer_details: { ...chargeData.customer_details, customer_email: encryptKey(sCustEmail), customer_phone: encryptKey(sCustPhone) } }
      const logData = { iUserId, iDepositId: userDeposit.id, iOrderId: userDeposit.iOrderId, ePlatform, eGateway: eType, eType: 'D', sTriggeredByFunction: 'generatePayment', oBody: req.body, oReq: chargeData, oRes: result }

      await queuePush('TransactionLog', logData) // this queue is for maintaing response that we get from payment gateways
      await queuePush('profileLevelUp', { iUserId })

      if (result.hosted_url) {
        return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cCoinBasePaymentLink), data: { ...result, iOrderId: orderId, nOrderAmount, sOrderCurrency, sCustId, sCustEmail, sCustName: oUserData.sName, sCustPhone } })
      }
      return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].cCoinBasePaymentLink) })
    } else {
      return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cPaymentGateway) })
    }
  } catch (error) {
    const { status: errorStatus = '', message: errorMessage = '' } = error
    if (!errorStatus) { return catchError('UserPayment.create', error, req, res) }
    return res.status(errorStatus).jsonp({ status: errorStatus, message: errorMessage })
  }
}

module.exports = oPaymentService
