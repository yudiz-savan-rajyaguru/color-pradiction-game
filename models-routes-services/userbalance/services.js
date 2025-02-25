const { handleCatchError, convertToDecimal, mongify, catchError } = require('../../helper/utilities.services')
const UserBalanceModel = require('./model')
const PassbookModel = require('../passbook/model')
const db = require('../../database/sequelize')
const { Transaction } = require('sequelize')
const { messages, jsonStatus, status } = require('../../helper/api.responses')
const { APP_LANG } = require('../../config/common')
const StatisticsModel = require('../user/statistics/model')

const userBalanceService = {}

userBalanceService.adminGet = async (req, res) => {
  try {
    const data = await UserBalanceModel.findOne({ where: { iUserId: req.params.id }, raw: true })

    if (!data) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user) })

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cBalance), data })
  } catch (error) {
    return catchError('UserBalance.adminGet', error, req, res)
  }
}

userBalanceService.getUserBalance = async function ({ iUserId, nBonusUtil, nPrice }) {
  try {
    const userBalance = await UserBalanceModel.findOne({ where: { iUserId: iUserId.toString() }, raw: true })
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

/**
   * It will opens account
   * @param { Object } data
   * @returns { Object } of isSuccess true or false
   */
// common
userBalanceService.openAccount = async (data) => {
  try {
    let { iUserId, sUsername, eType: eUserType } = data

    iUserId = iUserId.toString()

    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      await PassbookModel.create({
        iUserId,
        eUserType,
        eTransactionType: 'Opening',
        eType: 'Cr',
        sRemarks: messages[APP_LANG].initial_account_opened.replace('##', sUsername),
        dActivityDate: new Date()
      }, { transaction: t })

      await UserBalanceModel.create({
        iUserId,
        eUserType
      }, { transaction: t })
      await StatisticsModel.create({ iUserId: mongify(iUserId), eUserType })
    })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

/**
   * It will revert previously opened account
   * @param { Object } data
   * @returns { Object } of isSuccess true or false
   */
// common
userBalanceService.revertOpenedAccount = async (data) => {
  try {
    let { iUserId, eType: eUserType } = data

    iUserId = iUserId.toString()

    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      await PassbookModel.destroy({
        where: {
          iUserId,
          eUserType,
          eTransactionType: 'Opening',
          eType: 'Cr'
        }
      }, { transaction: t, lock: true })

      await UserBalanceModel.destroy({
        where: {
          iUserId,
          eUserType
        }
      }, { transaction: t, lock: true })
      await StatisticsModel.deleteOne({ iUserId: mongify(iUserId), eUserType })
    })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

module.exports = userBalanceService
