const { convertToDecimal } = require('./../../helper/utilities.services')
const PayoutOptionModel = require('../payoutOptions/model')
const PaymentOptionModel = require('../paymentOptions/model')
const { messages } = require('../../helper/api.responses')

/**
 * Get platform fee for withdrawal transactions.
 * @param {Object} dataObj - The data object containing information about the transaction.
 * @returns {Promise<Object>} - A promise that resolves with the platform fee for withdrawal transactions.
 */
async function getPlatformFeeWithdraw(dataObj) {
  try {
    const { nAmount, ePaymentGateway, iPayoutId } = dataObj
    const payoutOption = await PayoutOptionModel.findOne({ eKey: ePaymentGateway, _id: iPayoutId }).lean()
    const { bIsFeePercent = true, nPlatformFee = 0 } = payoutOption
    let nPlatformFeeValue = 0
    let nActualAmount = parseFloat(nAmount)
    if (bIsFeePercent) {
      nPlatformFeeValue = convertToDecimal(parseInt(nPlatformFee) * nAmount / 100)
    } else {
      nPlatformFeeValue = parseInt(nPlatformFee)
    }
    nActualAmount = convertToDecimal(nAmount - nPlatformFeeValue)
    if (nActualAmount <= 0) return { bIsFailed: true, sMessage: messages.English.unable_due_to_higher_fee.replace('##', messages.English.sWithdraw) }
    return { nPlatformFee: nPlatformFeeValue, nActualAmount }
  } catch (error) {
    throw new Error(error)
  }
}

async function getPlatformFeeDeposit(dataObj) {
  const { nAmount, ePaymentGateway } = dataObj
  const paymentOption = await PaymentOptionModel.findOne({ eKey: ePaymentGateway }).lean()
  const { bIsFeePercent = true, nPlatformFee = 0 } = paymentOption
  let nPlatformFeeValue = 0
  let nActualAmount = parseFloat(nAmount)
  if (bIsFeePercent) {
    nPlatformFeeValue = convertToDecimal(parseInt(nPlatformFee) * nAmount / 100)
  } else {
    nPlatformFeeValue = parseInt(nPlatformFee)
  }
  nActualAmount = convertToDecimal(nAmount - nPlatformFeeValue)
  if (nActualAmount <= 0) return { bIsFailed: true, sMessage: messages.English.unable_due_to_higher_fee.replace('##', messages.English.cDeposit) }
  return { nPlatformFee: nPlatformFeeValue, nActualAmount }
}

module.exports = {
  getPlatformFeeWithdraw,
  getPlatformFeeDeposit
}
