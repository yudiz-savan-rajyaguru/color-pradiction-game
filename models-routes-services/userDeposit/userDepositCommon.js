const { queuePush } = require('../../helper/redis')
const oRazorpayServices = require('../payment/razorpay')

const { updateBalance } = require('./common')

async function processPaymentGateway({ iDepositId, orderId, ePaymentGateway, ePlatform, ePaymentStatus, iTransactionId }) {
  try {
    // Initialize logData
    let logData = { iDepositId, iOrderId: orderId, eGateway: ePaymentGateway, ePlatform, eType: 'D', sTriggeredByFunction: 'checkUserDepositStatus', oReq: { sInfo: `${ePaymentGateway} payment gateway order payment status.` }, oRes: {} }

    let response

    // Choose the appropriate payment processing function based on the ePaymentGateway
    if (ePaymentGateway === 'RAZORPAY') {
      response = await processRazorpayPayment({ iDepositId, orderId, ePaymentStatus, logData, ePaymentGateway, iTransactionId })
    }
    // Update logData with the response
    logData = response.logData

    // Push logData to the 'TransactionLog' queue
    queuePush('TransactionLog', logData)

    // Return the updated ePaymentStatus
    return response.ePaymentStatus
  } catch (error) {
    // Handle errors and log them
    return Promise.reject(error)
  }
}

async function processRazorpayPayment({ iDepositId, orderId, ePaymentStatus, logData = {}, ePaymentGateway, iTransactionId }) {
  try {
    // Get payment status from the order
    const response = await oRazorpayServices.getPaymentStatus({ iDepositId, orderId, iTransactionId })
    const oRes = response

    // Update logData with the response
    logData.oRes = oRes

    const { isSuccess, result = {} } = response

    // If the payment status retrieval is successful, update the balance
    if (isSuccess) {
      const postData = { txStatus: 'PAID', orderId, referenceId: result?.iRazorpayOrderId }
      const { ePaymentStatus: eUpdatedStatus } = await updateBalance(postData, ePaymentGateway)
      // If the balance update is successful, update ePaymentStatus
      if (eUpdatedStatus) {
        ePaymentStatus = eUpdatedStatus
      }
    }
    // Return the updated ePaymentStatus and logData
    return { ePaymentStatus, logData }
  } catch (error) {
  // Handle errors and log them
    return Promise.reject(error)
  }
}
module.exports = {
  processRazorpayPayment,
  processPaymentGateway
}
