const { handleCatchError, convertToDecimal } = require('../../helper/utilities.services')
const UserBalanceModel = require('./model')

const userBalanceService = {}

userBalanceService.getUserBalanceCheck = async function ({ iUserId, nBonusUtil, nPrice }) {
  try {
    const userBalance = await UserBalanceModel.findOne({ where: { iUserId: iUserId.toString() }, raw: true })
    if (!userBalance) {
      return { isSuccess: false, message: 'User balance not found' }
    }
    let nActualBonus = 0
    if (nBonusUtil && nBonusUtil > 0 && nPrice > 0) {
      const nBonus = (nPrice * nBonusUtil) / 100

      if (userBalance.nCurrentBonus - nBonus >= 0) {
        nActualBonus = nBonus
        if (userBalance.nCurrentTotalBalance < nPrice - nBonus) {
          return {
            isSuccess: false,
            nPrice: convertToDecimal(nPrice - nBonus - userBalance.nCurrentTotalBalance),
            nActualBonus: nActualBonus
          }
        }
      } else {
        nActualBonus = userBalance.nCurrentBonus
        if (userBalance.nCurrentTotalBalance < nPrice - userBalance.nCurrentBonus) {
          return {
            isSuccess: false,
            nPrice: convertToDecimal(nPrice - userBalance.nCurrentBonus - userBalance.nCurrentTotalBalance),
            nActualBonus: nActualBonus
          }
        }
      }
    } else if (userBalance.nCurrentTotalBalance < nPrice) {
      return {
        isSuccess: false,
        nPrice: convertToDecimal(nPrice - userBalance.nCurrentTotalBalance),
        nActualBonus: nActualBonus
      }
    }
    return { status: true, nActualBonus: nActualBonus, nPrice }
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = userBalanceService
