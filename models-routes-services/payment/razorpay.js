// @ts-check
const Razorpay = require('razorpay')
const { RAZORPAY_KEY_ID, RAZORPAY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../../config/thirdPartyConfig')
const crypto = require('crypto')
const UserDepositModel = require('../userDeposit/model')
const { updateBalance } = require('../userDeposit/common')
const { queuePush } = require('../../helper/redis')

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_SECRET
})

const oRazorpayServices = {}

oRazorpayServices.createOrder = async({ nAmount, iOrderId, sUserName = '' }) => {
  console.log('ORDER RECEIVED FOR AMOUNT', nAmount)
  const oOptions = {
    amount: nAmount * 100,
    currency: 'INR',
    method: 'upi',
    receipt: iOrderId,
    customer_details: {
      name: sUserName
    },
    partial_payment: false
  }
  const oOrder = await razorpay.orders.create(oOptions)
  return oOrder
}

oRazorpayServices.verifyPayment = async(req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    const generatedSignature = crypto
      .createHmac('sha256', 'YOUR_RAZORPAY_SECRET')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')
    if (generatedSignature === razorpay_signature) {
      // Payment is verified
      res.json({ success: true, message: 'Payment verified successfully' })
    } else {
      // Payment verification failed
      res.status(400).json({ success: false, message: 'Payment verification failed' })
    }
  } catch (error) {
    console.log('error', error)
  }
}

oRazorpayServices.getPaymentStatus = async(oPayload) => {
  const { iDepositId = '', orderId, iTransactionId } = oPayload
  try {
    const order = await razorpay.orders.fetch(iTransactionId)
    const oRes = order
    const logData = { iDepositId, iOrderId: orderId, ePlatform: 'AD', eGateway: 'RAZORPAY', eType: 'D', sTriggeredByFunction: 'getOrderPaymentStatus', oBody: oPayload, oReq: { orderId: iTransactionId }, oRes }
    queuePush('TransactionLog', logData)
    return { isSuccess: order?.status === 'paid', result: { iRazorpayOrderId: iTransactionId } }
  } catch (error) {
    const res = { status: error.response.status, message: error.response.data, isSuccess: false }
    const logData = { iDepositId, iOrderId: orderId, ePlatform: 'AD', eGateway: 'RAZORPAY', eType: 'D', sTriggeredByFunction: 'getOrderPaymentStatus', oBody: oPayload, oReq: { orderId: iTransactionId }, oRes: res }
    queuePush('TransactionLog', logData)
    return res
  }
}

oRazorpayServices.webhook = async(req, res) => {
  try {
    const { body } = req
    const { payload } = body

    const webhookSecret = RAZORPAY_WEBHOOK_SECRET
    const shasum = crypto.createHmac('sha256', webhookSecret)
    shasum.update(JSON.stringify(req.body))
    const digest = shasum.digest('hex')
    if (digest === req.headers['x-razorpay-signature']) {
      console.log('WEBHOOK SIGNATURE VERIFIED')
      // Process the webhook payload
      const ePaymentGateway = 'RAZORPAY'
      const event = req?.body?.event
      switch (event) {
        case 'order.paid':
          if (payload?.payment?.entity?.status === 'captured') {
            // Handle successful payment
            const orderId = payload?.order?.entity?.receipt
            const oPayload = { txStatus: 'SUCCESS', orderId, referenceId: payload?.payment?.entity?.order_id }
            const { ePaymentStatus, alreadySuccess } = await updateBalance(oPayload, ePaymentGateway)
            if (ePaymentStatus === 'S' && alreadySuccess === false) {
              const oDeposit = await UserDepositModel.findOne({ where: { iOrderId: orderId }, order: [['id', 'DESC']], raw: true })
              if (oDeposit) {
                const logData = { iDepositId: oDeposit?.id, iOrderId: orderId, eGateway: oDeposit?.ePaymentGateway, eType: 'D', sTriggeredByFunction: 'RazorPay order.paid webhook event', oReq: { sInfo: `${oDeposit?.ePaymentGateway} payment gateway web-hook(v2) event called.` }, oRes: req.body }
                queuePush('TransactionLog', logData)
              }
            }
          }
          break
        case 'payment.failed':
          {
            // Handle failed payment
            const order = await razorpay.orders.fetch(payload?.payment?.entity?.order_id)
            const orderId = order.receipt
            const oFailureResponse = { txStatus: 'FAILED', orderId, referenceId: payload?.payment?.entity?.order_id }
            const { ePaymentStatus, alreadySuccess } = await updateBalance(oFailureResponse, ePaymentGateway)
            if (ePaymentStatus === 'S' && alreadySuccess === false) {
              const oDeposit = await UserDepositModel.findOne({ where: { iOrderId: orderId }, order: [['id', 'DESC']], raw: true })
              if (oDeposit) {
                const logData = { iDepositId: oDeposit?.id, iOrderId: orderId, eGateway: oDeposit?.ePaymentGateway, eType: 'D', sTriggeredByFunction: 'RazorPay payment.failed webhook event', oReq: { sInfo: `${oDeposit?.ePaymentGateway} payment gateway web-hook(v2) event called.` }, oRes: req.body }
                queuePush('TransactionLog', logData)
              }
            }
          }
          break
      }
      return res.status(200).json({ status: 'ok' })
    } else {
      return res.status(400).json({ status: 'invalid signature' })
    }
  } catch (error) {
    console.log('error', error)
    return res.status(500).json({ status: 500, message: 'Internal server error' })
  }
}

module.exports = oRazorpayServices
