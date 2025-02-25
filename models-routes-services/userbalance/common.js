// @ts-check
const BonusServices = require('./bonusServices')
const { convertToDecimal } = require('../../helper/utilities.services')
const SettingsModel = require('../setting/model')

async function userReferBonus(query = {}) {
  try {
    // Call the referBonus method from your BonusServices and pass the query object
    const data = await BonusServices.referBonus(query)
    // Return the data in a similar structure
    return data
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * Get tax for a transaction.
 * @param {Object} dataObj - The data object containing information about the transaction.
 * @returns {Promise<Object>} - A promise that resolves with the tax for the transaction.
 */
async function getTaxForTransaction(dataObj) {
  try {
    const { transactionKey, nAmount } = dataObj
    const taxSetting = await SettingsModel.findOne({ sKey: transactionKey }).lean()
    let { sValue = 0 } = taxSetting
    sValue = parseInt(sValue)
    const nTaxValue = convertToDecimal(sValue * nAmount / 100)
    return { nApplicableTax: nTaxValue, nTaxPercentage: sValue }
  } catch (error) {
    throw new Error(error)
  }
}

module.exports = {
  userReferBonus,
  getTaxForTransaction
}
