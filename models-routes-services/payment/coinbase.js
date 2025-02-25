const CoinbaseCommerce = require('coinbase-commerce-node')

const config = require('../../config/config')
const { Client, Webhook } = CoinbaseCommerce
const API_KEY = config.COINBASE_API_KEY
const Charge = CoinbaseCommerce.resources.Charge
Client.init(API_KEY)
const { updateBalance } = require('../userDeposit/common')
const { messages, status } = require('../../helper/api.responses')
const UserDepositModel = require('../userDeposit/model')
const { Op } = require('sequelize')
const { queuePush } = require('../../helper/redis')

const oCoinbaseServices = {}

oCoinbaseServices.coinbasePaymentV2 = async (payload) => {
  try {
    const charge = await Charge.create(payload)
    return { result: charge || '' }
  } catch (err) {
    const res = { status: err.response.status, message: err.response.data }
    return res
  }
}
oCoinbaseServices.verifyCoinBaseOrder = async (req, res) => {
  try {
    const WEBHOOK_SECRET = config.COINBASE_WEBHOOK_SECRET

    const rawBody = req.body // Ensure raw body is available for verification
    const signature = req.headers['x-cc-webhook-signature']

    const event = Webhook.verifyEventBody(JSON.stringify(rawBody), signature, WEBHOOK_SECRET)

    if (!event) {
      return res.status(status.BadRequest).send(messages.event_not_verified)
    } else {
      const ePaymentGateway = 'COINBASE'

      const oDeposit = await UserDepositModel.findOne({ where: { [Op.or]: [{ iOrderId: event?.data?.metadata?.order_id || '' }, { iReferenceId: event?.data?.metadata?.order_id || '' }] }, order: [['id', 'DESC']], raw: true })

      if (!oDeposit) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cDeposit) })
      }

      const result = await oCoinbaseServices.processCoinbaseEvent(event, oDeposit, ePaymentGateway)

      if (result.status && result.message) {
        return res.status(result.status).jsonp({ status: result.status, message: result.message })
      }
      return res.json({ received: true, event })
    }
  } catch (error) {
    console.error('Webhook verification failed:', error)
    return res.status(400).send('Webhook Error')
  }
}

// Function to process payment succeeded event
oCoinbaseServices.processPaymentSucceeded = async (oDeposit, ePaymentGateway) => {
  try {
    const oSuccessResponse = { txStatus: 'SUCCESS', orderId: oDeposit.iOrderId, referenceId: oDeposit.iReferenceId }
    const { status, message } = await updateBalance(oSuccessResponse, ePaymentGateway)
    return { status, message }
  } catch (error) {
    // Handle unexpected errors
    return { success: false, status: status.InternalServerError, message: error.message }
  }
}

// Function to process payment failed event
oCoinbaseServices.processPaymentFailed = async (oDeposit, ePaymentGateway) => {
  try {
    const oFailureResponse = { txStatus: 'FAILED', orderId: oDeposit.iOrderId, referenceId: oDeposit.iReferenceId }
    const { status, message } = await oCoinbaseServices.updateBalance(oFailureResponse, ePaymentGateway)
    return { status, message }
  } catch (error) {
    // Handle unexpected errors
    return { success: false, status: status.InternalServerError, message: error.message }
  }
}

oCoinbaseServices.processCoinbaseEvent = async (event, oDeposit, ePaymentGateway) => {
  try {
    const oRes = event.data

    await oCoinbaseServices.logTransactionDetails(oDeposit, oRes)

    switch (event.type) {
      case 'charge:confirmed': {
        return await oCoinbaseServices.processPaymentSucceeded(oDeposit, ePaymentGateway)
      }
      case 'charge:failed': {
        return await oCoinbaseServices.processPaymentFailed(oDeposit, ePaymentGateway)
      }
      default:
        // eslint-disable-next-line no-console
        console.log(`Unhandled event type ${event.type}`)
    }

    return { success: true }
  } catch (error) {
    return { success: false, status: 'Unexpected Error', message: error.message }
  }
}

// Function to log transaction details
oCoinbaseServices.logTransactionDetails = async (oDeposit, eventObject = {}) => {
  try {
    const logData = {
      iDepositId: oDeposit?.id || '',
      iOrderId: oDeposit?.iOrderId || '',
      iTransactionId: oDeposit?.iTransactionId || '',
      eGateway: oDeposit?.ePaymentGateway || 'CASHFREEE',
      eType: 'D',
      sTriggeredByFunction: 'verifyCoinBaseOrder',
      oReq: { sInfo: `${oDeposit?.ePaymentGateway || 'CASHFREE'} payment gateway webhook event called.` },
      oRes: eventObject
    }

    queuePush('TransactionLog', logData)
  } catch (error) {
    return Promise.reject(error)
  }
}

module.exports = oCoinbaseServices
