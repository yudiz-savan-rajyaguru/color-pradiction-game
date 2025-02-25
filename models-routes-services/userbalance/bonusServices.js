// @ts-check
const UserBalanceModel = require('./model')
const StatisticsModel = require('../user/statistics/model')
const db = require('../../database/sequelize')
const { literal, Transaction } = require('sequelize')
const PassbookModel = require('../passbook/model')
const { messages } = require('../../helper/api.responses')
const { handleCatchError, convertToDecimal, mongify } = require('../../helper/utilities.services')
// const { findSetting } = require('../setting/services')
const { checkProcessed, queuePush } = require('../../helper/redis')
// const { ObjectId } = require('mongoose').Types
const { APP_LANG } = require('../../config/common')
const UserModel = require('../user/model')
const { findSettingV2 } = require('../setting/services')
const { findRule } = require('../commonRules/services')

class Bonus {
  // done
  async referBonus(data) {
    try {
      let { iUserId, rule, sUserName, eType: eUserType, iReferById } = data
      if (!rule) rule = {}
      let { eType, nAmount = 0, eRule = '', nExpireDays = 0 } = rule
      iUserId = iUserId.toString()
      nAmount = parseFloat(nAmount)
      const dBonusExpiryDate = new Date()
      dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + nExpireDays)

      const eTransactionType = (eRule === 'RB') ? 'Bonus' : 'Refer-Bonus'
      if (eRule === 'RR' && iReferById) {
        const passbookProcessed = await checkProcessed(`referBonus:${iUserId}:${iReferById}`, 20)
        if (passbookProcessed === 'EXIST') return { isSuccess: true }
      }

      return db.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      }, async (t) => {
        const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
        const { nCurrentWinningBalance = 0, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance
        if (eType === 'C') {
          await UserBalanceModel.update({
            nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
            nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${nAmount}`)
            // nTotalDepositAmount: literal(`nTotalDepositAmount + ${nAmount}`),
            // nTotalDepositCount: literal('nTotalDepositCount + 1')
          }, { where: { iUserId }, transaction: t })
        } else if (eType === 'B') {
          await UserBalanceModel.update({
            nCurrentBonus: literal(`nCurrentBonus + ${nAmount}`),
            nTotalBonusEarned: literal(`nTotalBonusEarned + ${nAmount}`)
          }, { where: { iUserId }, transaction: t })
        }
        if (iReferById && eRule === 'RR') {
          await UserModel.updateOne({ _id: mongify(iReferById) }, { $set: { eReferStatus: 'S' } })
        }
        let sRemarks
        if (eRule === 'RCB') {
          sRemarks = messages[APP_LANG].get_refer_bonus.replace('##', sUserName)
        } else if (eRule === 'RR') {
          sRemarks = messages[APP_LANG].get_register_refer_bonus.replace('##', sUserName)
        } else {
          sRemarks = messages[APP_LANG].get_register_bonus.replace('##', sUserName)
        }

        await PassbookModel.create({
          iUserId,
          nAmount: nAmount,
          nCash: eType === 'C' ? nAmount : 0,
          nBonus: eType === 'B' ? nAmount : 0,
          eTransactionType,
          eType: 'Cr',
          eUserType,
          nOldWinningBalance: nCurrentWinningBalance,
          nOldDepositBalance: nCurrentDepositBalance,
          nOldTotalBalance: nCurrentTotalBalance,
          nOldBonus: nCurrentBonus,
          dBonusExpiryDate,
          sRemarks,
          sCommonRule: eRule,
          dActivityDate: new Date()
        }, { transaction: t })
        const nCash = eType === 'C' ? nAmount : 0
        // const nCount = eType === 'C' ? 1 : 0
        const nBonus = eType === 'B' ? nAmount : 0
        const isExist = await StatisticsModel.countDocuments({ iUserId: mongify(data.iUserId) })
        if (!isExist) {
          await StatisticsModel.create({ iUserId: mongify(data.iUserId) })
        }
        await StatisticsModel.updateOne({ iUserId: mongify(data.iUserId) }, {
          $inc: {
            // nReferrals: !nReferrals ? 0 : 1,
            nActualBonus: convertToDecimal(nBonus),
            nActualDepositBalance: convertToDecimal(nCash),
            // nDeposits: Number(parseFloat(nCash).toFixed(2)),
            nCash: convertToDecimal(nCash),
            nBonus: convertToDecimal(nBonus)
            // nDepositCount: nCount
          }
        }, { upsert: true })
        if (eRule === 'RCB') {
          await StatisticsModel.updateOne({ iUserId: mongify(iReferById) }, {
            $inc: {
              nReferrals: 1
            }
          }, { upsert: true })

          // in all the possible criteria for level up, we will push into to profileLevelUp queue.
          // if user profile level flag is active then push into queue
          if (await findSettingV2({ sKey: 'USER_PROFILE_LEVEL' })) {
            await queuePush('profileLevelUp', { iUserId: iReferById })
          }
        }

        return { isSuccess: true }
      })
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  // async birthdayBonus(data) {
  //   try {
  //     let { iUserId, sUsername, eType: eUserType, birthdayBonus, year } = data

  //     iUserId = iUserId.toString()

  //     await db.sequelize.transaction({
  //       isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
  //     }, async (t) => {
  //       const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
  //       const { nCurrentBonus } = userBalance
  //       const nNewBonus = nCurrentBonus + birthdayBonus
  //       await UserBalanceModel.update({
  //         nTotalBonusEarned: literal(`nTotalBonusEarned + ${birthdayBonus}`),
  //         nCurrentBonus: literal(`nCurrentBonus + ${birthdayBonus}`)
  //       }, {
  //         where: { iUserId },
  //         transaction: t,
  //         lock: true
  //       })
  //       await PassbookModel.create({
  //         iUserId,
  //         nAmount: birthdayBonus,
  //         nBonus: birthdayBonus,
  //         eUserType,
  //         eTransactionType: 'Bonus',
  //         nOldBonus: nCurrentBonus,
  //         nNewBonus,
  //         sCommonRule: 'BB',
  //         eType: 'Cr',
  //         sRemarks: messages[APP_LANG].get_birthday_bonus.replace('##', sUsername),
  //         dActivityDate: new Date()
  //       }, { transaction: t, lock: true })
  //       await UserModel.updateOne({ _id: ObjectId(iUserId) }, { $set: { sDobBonusIn: year } })
  //       await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: { nActualBonus: convertToDecimal(birthdayBonus), nBonus: convertToDecimal(birthdayBonus) } }, { upsert: true })
  //     })
  //     await queuePush('pushNotification:BirthdayBonus', { _id: iUserId, bonus: birthdayBonus })
  //     return { isSuccess: true }
  //   } catch (error) {
  //     handleCatchError(error)
  //     return { isSuccess: false }
  //   }
  // }

  // currently in development mode, not in live.
  async creatorBonusReturn(data) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let { iUserId, _id, iMatchId, eCategory } = data
          iUserId = iUserId.toString()
          const iMatchLeagueId = _id.toString()
          iMatchId = iMatchId.toString()

          await db.sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          }, async (t) => {
            const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Creator-Bonus-Return', iMatchLeagueId, iMatchId }, raw: true, transaction: t, lock: true })
            if (!isProcessed) {
              const isCashbackProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Creator-Bonus', iMatchLeagueId, iMatchId }, raw: true, transaction: t, lock: true })
              if (isCashbackProcessed) {
                const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, raw: true, transaction: t, lock: true })
                const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus, eUserType } = userBalance
                const { nAmount } = isCashbackProcessed

                const lcc = await findRule('LCC')
                // const lcc = await CommonRuleModel.findOne({ eRule: 'LCC', eStatus: 'Y' }, { eType: 1 }).lean()
                const lccType = lcc && lcc.eType ? lcc.eType : 'C'

                let sValue = 'WIN'
                if (lccType === 'D') {
                  sValue = 'DEPOSIT'
                } else if (lccType === 'B') {
                  sValue = 'BONUS'
                }

                let updateBalance = {
                  nCurrentWinningBalance: literal(`nCurrentWinningBalance - ${nAmount}`),
                  nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${nAmount}`),
                  nTotalWinningAmount: literal(`nTotalWinningAmount - ${nAmount}`)
                }

                let updatePassBook = {
                  iUserId,
                  nAmount: nAmount,
                  eTransactionType: 'Creator-Bonus-Return',
                  eType: 'Dr',
                  eUserType: eUserType,
                  nCash: nAmount,
                  nBonus: 0,
                  iMatchLeagueId,
                  iMatchId,
                  eCategory,
                  nOldWinningBalance: nCurrentWinningBalance,
                  nOldDepositBalance: nCurrentDepositBalance,
                  nOldTotalBalance: nCurrentTotalBalance,
                  nOldBonus: nCurrentBonus,
                  sRemarks: messages[APP_LANG].creator_bonus_cash_win_returned,
                  dActivityDate: new Date()
                }

                if (sValue === 'DEPOSIT') {
                  updateBalance = {
                    nCurrentDepositBalance: literal(`nCurrentDepositBalance - ${nAmount}`),
                    nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${nAmount}`),
                    nTotalDepositAmount: literal(`nTotalDepositAmount - ${nAmount}`),
                    nTotalDepositCount: literal('nTotalDepositCount - 1')
                  }

                  updatePassBook = {
                    iUserId,
                    nAmount: nAmount,
                    eTransactionType: 'Creator-Bonus-Return',
                    eType: 'Dr',
                    eUserType: eUserType,
                    nCash: nAmount,
                    nBonus: 0,
                    iMatchLeagueId,
                    iMatchId,
                    eCategory,
                    nOldWinningBalance: nCurrentWinningBalance,
                    nOldDepositBalance: nCurrentDepositBalance,
                    nOldTotalBalance: nCurrentTotalBalance,
                    nOldBonus: nCurrentBonus,
                    sRemarks: messages[APP_LANG].creator_bonus_cash_deposit_returned,
                    dActivityDate: new Date()
                  }
                } else if (sValue === 'BONUS') {
                  updateBalance = {
                    nCurrentBonus: literal(`nCurrentBonus - ${nAmount}`),
                    nTotalBonusEarned: literal(`nTotalBonusEarned - ${nAmount}`)
                  }

                  updatePassBook = {
                    iUserId,
                    nAmount: nAmount,
                    eTransactionType: 'Creator-Bonus-Return',
                    eType: 'Dr',
                    eUserType: eUserType,
                    nCash: 0,
                    nBonus: nAmount,
                    iMatchLeagueId,
                    iMatchId,
                    eCategory,
                    nOldWinningBalance: nCurrentWinningBalance,
                    nOldDepositBalance: nCurrentDepositBalance,
                    nOldTotalBalance: nCurrentTotalBalance,
                    nOldBonus: nCurrentBonus,
                    sRemarks: messages[APP_LANG].creator_bonus_returned,
                    dActivityDate: new Date()
                  }
                }

                await UserBalanceModel.update(updateBalance, { where: { iUserId }, transaction: t })
                await PassbookModel.create(updatePassBook, { transaction: t })
                await PassbookModel.update({
                  bCreatorBonusReturn: true
                }, {
                  where: { iUserId, eTransactionType: 'Creator-Bonus', iMatchLeagueId, iMatchId },
                  transaction: t
                })
              }
              return resolve({ isSuccess: true })
            } else {
              return resolve({ isSuccess: true })
            }
          })
          return resolve({ isSuccess: true })
        } catch (error) {
          handleCatchError(error)
          return resolve({ isSuccess: false, error })
        }
      })()
    })
  }

  async checkUserBalance(data) {
    try {
      const { iUserId, nPromoDiscount = 0, matchLeague, remainTeams } = data
      const userBalance = await UserBalanceModel.findOne({ where: { iUserId: iUserId.toString() }, plain: true, raw: true })
      const nJoinPrice = (nPromoDiscount) ? matchLeague.nPrice - nPromoDiscount : matchLeague.nPrice
      let { nCurrentTotalBalance, nCurrentBonus } = userBalance
      const { nBonusUtil } = matchLeague

      let nTotalAmount = 0
      let bValid = true
      remainTeams.forEach(t => {
        let nActualBonus = 0
        if (nBonusUtil && nBonusUtil > 0 && nJoinPrice > 0) {
          const nBonus = (nJoinPrice * nBonusUtil) / 100
          if (nCurrentBonus - nBonus >= 0) {
            nActualBonus = nBonus
            if (nCurrentTotalBalance < nJoinPrice - nBonus) {
              nTotalAmount = nTotalAmount + nJoinPrice - nBonus - nCurrentTotalBalance
              bValid = false
              return
            }
          } else {
            nActualBonus = userBalance.nCurrentBonus
            if (nCurrentTotalBalance < nJoinPrice - nCurrentBonus) {
              nTotalAmount = nTotalAmount + nJoinPrice - nCurrentBonus - nCurrentTotalBalance
              bValid = false
              return
            }
          }
        } else if (nCurrentTotalBalance < nJoinPrice) {
          nTotalAmount = nTotalAmount + nJoinPrice - nCurrentTotalBalance
          bValid = false
          return
        }

        const nPrice = nActualBonus ? nJoinPrice - nActualBonus : nJoinPrice
        nCurrentTotalBalance = nCurrentTotalBalance - nPrice
        nCurrentBonus = nCurrentBonus - nActualBonus
      })
      return { bValid, nTotalAmount }
    } catch (err) {
      handleCatchError(err)
    }
  }
}

module.exports = new Bonus()
