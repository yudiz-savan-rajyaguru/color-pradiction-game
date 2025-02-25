const CommonRuleModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, getIp, ObjectId } = require('../../helper/utilities.services')
const { CACHE_2 } = require('../../config/config')
const cachegoose = require('recachegoose')
const { commonRule, rewardOn } = require('../../data')
const { createAdminLog } = require('../admin/adminLogs/handler')
class Rule {
  /**
   * To find rule by its key (eRule)
   * @param  { string } rule
   */
  findRule(rule) {
    return CommonRuleModel.findOne({ eRule: rule.toUpperCase(), eStatus: 'Y' }).lean()
    // .cache(CACHE_2, `rule:${rule}`)
  }

  async getRuleByType(req, res) {
    try {
      const oRule = await CommonRuleModel.findOne({ eRule: req?.query?.eRule.toUpperCase(), eStatus: 'Y' }).lean()
      if (!oRule) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].rule) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data: oRule })
    } catch (error) {
      return catchError('Rule.getRuleByType', error, req, res)
    }
  }

  async add(req, res) {
    try {
      const { eRule, nAmount, nMin, nMax, eAmountType } = req.body
      const { _id: iAdminId } = req.admin

      switch (eRule) {
        case 'AC': // AC = ADMIN_COMMISSION
        case 'BOC': // BOC = BUY_ORDER_COMMISSION
          // For this rule type, we required this field for particular rule data usage purpose. so, sanitize input here accordingly
          req.body = pick(req.body, ['eRule', 'nAmount', 'eAmountType', 'eStatus', 'sRuleName'])
          break
        case 'DB':
          // DB = 'DEPOSIT_BONUS'
          // For this rule type, we required this field for particular rule data usage purpose. so, sanitize input here accordingly
          pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nMax', 'nMin', 'nExpireDays', 'sRuleName'])
          break
        case 'KYCDOC':
          pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nMax', 'nMin', 'nExpireDays', 'sRuleName', 'sKYCDoc'])
          break
        default:
          req.body = pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nExpireDays', 'sRuleName', 'sRewardOn', 'nXP'])
          break
      }
      removenull(req.body)
      const rule = await CommonRuleModel.findOne({ eRule }).lean()
      if (rule) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', `${eRule} Rule`) })

      if (nMin && nMax && parseInt(nMin) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].minAmount).replace('#', messages[req.userLanguage].cmaximumAmount) })
      if (eRule && nAmount && (eRule === 'BOC' || eRule === 'AC') && (parseInt(nAmount) > 100 || parseInt(nAmount) < 0)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })
      if (eRule && nAmount && (eRule === 'BOC' || eRule === 'AC') && (!eAmountType || eAmountType === undefined)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].amountType) })

      const data = await CommonRuleModel.create({ ...req.body })

      const logData = { oOldFields: {}, oNewFields: data, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'CR', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.add', error, req, res)
    }
  }

  async listV1(req, res) {
    try {
      const { start = 0, limit = 10, isFullResponse } = req.query
      let data = []
      if ([true, 'true'].includes(isFullResponse)) {
        data = await CommonRuleModel.find().lean()
      } else {
        data = await CommonRuleModel.find().skip(Number(start)).limit(Number(limit)).lean()
      }
      const count = await CommonRuleModel.countDocuments()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data: { data, count } })
    } catch (error) {
      return catchError('Rule.list', error, req, res)
    }
  }

  async ruleList(req, res) {
    try {
      const data = !commonRule && !commonRule.length ? [] : commonRule

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.list', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await CommonRuleModel.findById(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].rule) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.get', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { eRule, nAmount, nMin, nMax, eAmountType } = req.body
      const { _id: iAdminId } = req.admin

      switch (eRule) {
        case 'AC': // AC = ADMIN_COMMISSION
        case 'BOC': // BOC = BUY_ORDER_COMMISSION
          req.body = pick(req.body, ['eRule', 'nAmount', 'eAmountType', 'eStatus', 'sRuleName'])
          break
        case 'DB':
          pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nMax', 'nMin', 'nExpireDays', 'sRuleName'])
          break
        case 'KYCDOC':
          pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nMax', 'nMin', 'nExpireDays', 'sRuleName', 'sKYCDoc'])
          break
        default:
          req.body = pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nExpireDays', 'sRuleName', 'sRewardOn'])
          break
      }
      removenull(req.body)

      const rule = await Promise.all([
        CommonRuleModel.findOne({ eRule, _id: { $ne: ObjectId(req.params.id) }, eStatus: 'Y' }).lean(),
        CommonRuleModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      ])

      if (rule[0]) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', `${eRule} Rule`) })

      if (nMin && nMax && parseInt(nMin) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].minAmount).replace('#', messages[req.userLanguage].cmaximumAmount) })
      if (eRule && nAmount && (eRule === 'BOC' || eRule === 'AC') && (parseInt(nAmount) > 100 || parseInt(nAmount) < 0)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })
      if (eRule && nAmount && (eRule === 'BOC' || eRule === 'AC') && (!eAmountType || eAmountType === undefined)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].amountType) })

      const data = await CommonRuleModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true })

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].rule) })
      // cachegoose.clearCache(`rule:${data.eRule}`) // remove cached data from cachegoose also from update and delete time

      const logData = { oOldFields: rule[1], oNewFields: data, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'CR', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.update', error, req, res)
    }
  }

  async currentReferRule(req, res) {
    try {
      let [oUserReward, oNewUserReward] = await Promise.all([
        CommonRuleModel.findOne({ eRule: 'RR', eStatus: 'Y' }).lean(),
        CommonRuleModel.findOne({ eRule: 'RCB', eStatus: 'Y' }).lean()
      ])
      oUserReward = pick(oUserReward, ['_id', 'sRewardOn', 'sRuleName', 'sDescription', 'nAmount', 'eType', 'nExpireDays'])
      oNewUserReward = pick(oNewUserReward, ['_id', 'sRewardOn', 'sRuleName', 'sDescription', 'nAmount', 'eType', 'nExpireDays'])
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserreferradreward), data: { oUserReward, oNewUserReward } })
    } catch (error) {
      return catchError('Users.currentReferReward', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const { _id: iAdminId } = req.admin

      const data = await CommonRuleModel.findByIdAndUpdate(req.params.id, { eStatus: 'N' }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].rule) })
      // cachegoose.clearCache(`rule:${data.eRule}`)

      const logData = { oOldFields: data, oNewFields: { ...data, eStatus: 'N' }, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'CR', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.remove', error, req, res)
    }
  }

  async rewardsRuleList(req, res) {
    try {
      const data = !rewardOn && !rewardOn.length ? [] : rewardOn

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.list', error, req, res)
    }
  }

  async getKYCRules() {
    try {
      // Fetch KYC-related rules from the database
      const kycRules = await CommonRuleModel.find({ eRule: { $in: ['KYCM', 'KYCWL', 'KYCDOC'] }, eStatus: 'Y' }).lean()
      // Return the rules as JSON
      return kycRules
    } catch (error) {
      // Handle errors
      throw new Error(error)
    }
  }
}

module.exports = new Rule()
