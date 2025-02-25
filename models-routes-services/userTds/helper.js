const SettingModel = require('../setting/model')
const UserWithdrawModel = require('../userWithdraw/model')
const PassbookModel = require('../passbook/model')
const UserTdsModel = require('../userTds/model')
const UserBalanceModel = require('../userbalance/model')
const moment = require('moment')
const { Op } = require('sequelize')
const { convertToDecimal, handleCatchError } = require('../../helper/utilities.services')

const oTDSHelper = {}

oTDSHelper.calculateTDS = async(oData) => {
  try {
    const { iUserId, nFinalAmount: nWithdrawAmount } = oData
    // Find out the TDS percentage
    let nPercentage = 0
    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nPercentage = tdsSetting.nMax

    // Get the Financial Year Start and End Dates
    let FINANCIAL_YEAR_START_DATE = `${new Date().getFullYear()}-04-01`
    if (new Date().getMonth() >= 5 && new Date().getFullYear() === 2023) {
      FINANCIAL_YEAR_START_DATE = `${new Date().getFullYear()}-07-01`
    }
    let FINANCIAL_YEAR_END_DATE = `${new Date().getFullYear() + 1}-03-31`
    FINANCIAL_YEAR_START_DATE = moment(new Date(FINANCIAL_YEAR_START_DATE)).startOf('day').toISOString()
    FINANCIAL_YEAR_END_DATE = moment(new Date(FINANCIAL_YEAR_END_DATE)).endOf('day').toISOString()

    // Find out Taxable amount and TDS breakup
    /*
    New Formula of TDS : A-Total Withdraw amount, B-Total Deposit Amount, C-Opening Balance of Year, D: Already Deducted TDS on Amount
    nTaxableAmount = A - B - C - D
  */
    const oCommonQuery = {
      iUserId,
      dUpdatedAt: { [Op.gte]: new Date(FINANCIAL_YEAR_START_DATE), [Op.lte]: new Date(FINANCIAL_YEAR_END_DATE) }
    }
    // Find out total withdraw, deposit, tds deducted amount and opening balance of year
    let [nTotalWithdrawnAmount, nTotalDepositedAmount, nTotalGSTAmount, nTotalProcessedAmount] = await Promise.all([
      UserWithdrawModel.sum('nAmount', { where: { ...oCommonQuery, ePaymentStatus: 'S' }, raw: true }),
      PassbookModel.sum('nCash', { where: { ...oCommonQuery, eStatus: 'CMP', eTransactionType: 'Deposit' }, raw: true }),
      PassbookModel.sum('nCash', { where: { ...oCommonQuery, eStatus: 'CMP', eTransactionType: 'GST' }, raw: true }),
      UserTdsModel.sum('nOriginalAmount', { where: { ...oCommonQuery, eStatus: 'A' }, raw: true })
    ])

    nTotalDepositedAmount = nTotalDepositedAmount - nTotalGSTAmount

    let nOpeningBalanceOfYear = await PassbookModel.findOne({ where: { iUserId, dUpdatedAt: { [Op.lt]: FINANCIAL_YEAR_START_DATE } }, attributes: ['nNewWinningBalance'], order: [['id', 'desc']], limit: 1, raw: true })
    if (!nOpeningBalanceOfYear || (new Date().getMonth() >= 5 && new Date().getFullYear() === 2023)) nOpeningBalanceOfYear = { nNewWinningBalance: 0 }

    const nActualWithdrawalAmount = Number(nTotalWithdrawnAmount + nWithdrawAmount)
    const nTaxableAmount = convertToDecimal(nActualWithdrawalAmount - nTotalDepositedAmount - nOpeningBalanceOfYear?.nNewWinningBalance - nTotalProcessedAmount) // GOVT. TDS Formula

    const nTDSAmount = convertToDecimal(nTaxableAmount * Number(nPercentage / 100)) // Calculate TDS as per TDS percentage
    const nAmountAfterTax = convertToDecimal(nWithdrawAmount - nTDSAmount)
    const nTaxFreeAmount = convertToDecimal(Number(nTotalDepositedAmount + nOpeningBalanceOfYear?.nNewWinningBalance + nTotalProcessedAmount) - Number(nTotalWithdrawnAmount))

    const oTDSBreakUp = {
      nAmountAfterTax,
      nTotalWithdrawalAmount: nActualWithdrawalAmount || 0,
      nTotalDepositedAmount: nTotalDepositedAmount || 0,
      nOpeningBalanceOfYear: nOpeningBalanceOfYear.nNewWinningBalance || 0,
      nTotalProcessedAmount: nTotalProcessedAmount || 0,
      nTaxableAmount: nTaxableAmount > 0 ? nTaxableAmount : 0,
      nRequestedAmount: nWithdrawAmount,
      nTDSAmount: nTDSAmount > 0 ? nTDSAmount : 0,
      nPercentage,
      nTaxFreeAmount: nTaxFreeAmount || 0,
      dFinancialYear: `${new Date().getFullYear()}-${new Date().getFullYear() % 100 + 1}`,
      bEligible: false
    }

    if (nTaxableAmount <= 0) return { isSuccess: false, oTDS: oTDSBreakUp, oData }
    return { isSuccess: true, oTDS: oTDSBreakUp, oData }
  } catch (error) {
    handleCatchError(error)
  }
}

oTDSHelper.getAndProcessTDS = async(oWithdrawalData) => {
  try {
    console.log('=========== TDS PROCESS STARTED ===========')
    const oTransferData = {
      ...oWithdrawalData,
      oldBalance: {}
    }
    const { isSuccess, oTDS } = await oTDSHelper.calculateTDS(oWithdrawalData)
    if (!isSuccess) return { isSuccess: true, oTDS, oData: oTransferData }
    const { nAmountAfterTax } = oTDS
    if (nAmountAfterTax <= 0) {
      return { isSuccess: false, isTDS: false, oTDS, oData: oTransferData }
    }

    oTransferData.nFinalAmount = nAmountAfterTax
    console.log('=========== TDS PROCESS COMPLETED ===========')
    return { isSuccess: true, oTDS, oData: oTransferData }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

oTDSHelper.createTDSEntry = async(oData, t) => {
  try {
    // Fetch User Balance
    const oldBalance = await UserBalanceModel.findOne(
      { where: { iUserId: oData.iUserId.toString() }, transaction: t, lock: true }
    )
    const {
      nCurrentBonus: nOldBonus,
      nCurrentTotalBalance: nOldTotalBalance,
      nCurrentDepositBalance: nOldDepositBalance,
      nCurrentWinningBalance: nOldWinningBalance
    } = oldBalance

    // Calculate And Get TDS breakup
    const { oTDS } = await oTDSHelper.calculateTDS(oData)
    const { nTDSAmount, nTaxableAmount, nPercentage, nRequestedAmount } = oTDS

    if (nTDSAmount > 0) {
      // Make TDS Entry In Passbook
      const passbook = await PassbookModel.create({
        iUserId: oData.iUserId.toString(),
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

      // Make TDS Entry In Passbook
      await UserTdsModel.create({
        iUserId: oData.iUserId.toString(),
        iWithdrawId: Number(oData.iWithdrawId),
        nPercentage,
        nOriginalAmount: nTaxableAmount,
        nAmount: nTDSAmount,
        nActualAmount: convertToDecimal(nTaxableAmount - nTDSAmount),
        nWithdrawAmount: nRequestedAmount,
        iPassbookId: passbook.id,
        iTransactionId: passbook.iTransactionId,
        eUserType: 'U',
        eStatus: 'P'
      }, { transaction: t })
    }

    return { isSuccess: true, oTDS }
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = oTDSHelper
