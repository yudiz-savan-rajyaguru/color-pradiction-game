/* eslint-disable no-inner-declarations */
const PromocodeModel = require('./model')
const PromocodeStatisticModel = require('./statistics/model')
const CommonRuleModel = require('../commonRules/model')
const checkPromoUsage = require('./common')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, convertToDecimal } = require('../../helper/utilities.services')
const settingServices = require('../setting/services')
const { countDepositPromo } = require('./common')
const UserModel = require('../user/model')
const PassbookModel = require('../passbook/model')
const { Op, fn, col } = require('sequelize')

class Promocode {
  // Deposit promocode list for users
  async userPromocodeListV2(req, res) {
    try {
      const data = await PromocodeModel.find({ eStatus: 'Y', bShow: true, eType: 'DEPOSIT', dStartTime: { $lt: new Date(Date.now()) }, dExpireTime: { $gt: new Date(Date.now()) } }, { sName: 0, dUpdatedAt: 0, __v: 0 }).sort({ _id: -1 }).lean()

      const aCode = data.map(item => item.sCode)
      const aPassbook = await PassbookModel.findAll({ where: { iUserId: req.user._id.toString(), eTransactionType: 'DEPOSIT', sPromocode: { [Op.in]: aCode } }, group: 'sPromocode', attributes: [[fn('count', col('id')), 'nCount'], 'sPromocode'], raw: true })
      let aData = data

      if (aPassbook.length) {
        aData = []

        for (const oData of data) {
          const oStalePromode = aPassbook[aPassbook.findIndex(oEntry => oData.sCode === oEntry.sPromocode && oEntry.nCount >= oData.nPerUserUsage)]
          if (oStalePromode) continue
          else aData.push(oData)
        }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: aData })
    } catch (error) {
      return catchError('Promocode.userPromocodeList', error, req, res)
    }
  }

  // Check and validate deposit promocode
  async checkPromocode(req, res) {
    try {
      const { sPromo, nAmount } = req.body

      const promocode = await PromocodeModel.findOne({ eStatus: 'Y', eType: 'DEPOSIT', sCode: sPromo.toUpperCase(), dStartTime: { $lt: new Date(Date.now()) }, dExpireTime: { $gt: new Date(Date.now()) } }, { _id: 1, nMaxAllow: 1, sCode: 1, sInfo: 1, nAmount: 1, nMinAmount: 1, nMaxAmount: 1, bMaxAllowForAllUser: 1, nPerUserUsage: 1, nMaxUsed: 1, dStartTime: 1, dExpireTime: 1, dCreatedAt: 1, nMaxDiscount: 1, bIsSegmentInclude: 1, aSegmentIds: 1 }).lean()

      if (!promocode) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid_promo_err })

      const symbol = await settingServices.getCurrencySymbol()
      if ((nAmount || Number(nAmount) === 0) && !(promocode.nMaxAmount >= convertToDecimal(nAmount, 2) && promocode.nMinAmount <= convertToDecimal(nAmount, 2))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].promo_amount_err.replace('#', promocode.nMinAmount).replace('##', promocode.nMaxAmount).replace('₹', symbol) })

      let bFlag = false
      let rejectInvalid

      const data = await countDepositPromo({ sPromocode: sPromo.toUpperCase(), iUserId: req.user._id.toString() })

      const allCount = data?.allCount || 0
      const count = data?.count || 0

      if (!promocode.bMaxAllowForAllUser && (count >= promocode.nMaxAllow)) {
        rejectInvalid = { status: jsonStatus.BadRequest, message: messages.English.promo_usage_limit }
        bFlag = true
      } else if ((allCount >= promocode.nMaxAllow) || (count >= promocode.nPerUserUsage)) {
        rejectInvalid = { status: jsonStatus.BadRequest, message: messages.English.promo_usage_limit }
        bFlag = true
      }

      if (bFlag) return res.status(status.BadRequest).jsonp(rejectInvalid)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].is_active.replace('##', messages[req.userLanguage].cpromocode) })
    } catch (error) {
      return catchError('Promocode.checkPromo', error, req, res)
    }
  }

  // FLJ is FREE LEAGUE JOINING -> User can join any league for free if this common rule is set from admin and for the number of days set by admin
  // NULJD is NEW USER LEAGUE JOIN DISCOUNT -> User can join certain leagues at discount set by admin for a certain period of time
  // If there are no rules set or there are no promocodes the API returns empty data
  async newUserBenifits(req, res) {
    try {
      const iUserId = req.user._id
      const user = await UserModel.findOne({ _id: iUserId, eType: 'U', eStatus: 'Y', bEligibleForBenifits: true }).lean()
      if (!user) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_found.replace('##', 'user') })

      let commonRules = await CommonRuleModel.find({ eStatus: 'Y', eRule: { $in: ['FLJ', 'NULJD'] } }).lean()
      if (!commonRules.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].promo_success_message })

      for (const rule of commonRules) {
        if (rule.eRule === 'FLJ') {
          commonRules = rule
          break
        } else commonRules = rule
      }

      const userCreationDate = new Date(user.dCreatedAt)
      const currentDate = new Date()
      const days = Math.ceil(Math.abs(currentDate - userCreationDate) / (1000 * 60 * 60 * 24))

      if (days > commonRules.nExpireDays) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].promo_success_message })
      else {
        const freeLeaguePromo = await PromocodeModel.findOne({ eStatus: 'Y', bShow: true, eType: 'NEWUSER' }).lean()

        if (freeLeaguePromo && commonRules.eRule === 'FLJ' && freeLeaguePromo.nDecrementValue === 0) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: freeLeaguePromo })
        }

        if (commonRules.eRule === 'NULJD' && freeLeaguePromo && freeLeaguePromo.nDecrementValue !== 0) {
          const promocodeStatistics = await PromocodeStatisticModel.countDocuments({ iUserId, iPromocodeId: freeLeaguePromo._id })
          if (promocodeStatistics) {
            const checkValue = await checkPromoUsage(freeLeaguePromo, iUserId, user.dCreatedAt, commonRules)
            if (!checkValue) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].promo_success_message })
            return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: freeLeaguePromo })
          }
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: freeLeaguePromo })
        }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].promo_success_message })
    } catch (error) {
      return catchError('Promocode.addMultiplePromocodes', error, req, res)
    }
  }
}
module.exports = new Promocode()
