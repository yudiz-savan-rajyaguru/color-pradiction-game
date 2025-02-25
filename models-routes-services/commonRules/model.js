const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { commonRule, ruleType, status, rewardOn, kycDocs, eAmountType } = require('../../data')

const CommonRule = new Schema({
  eRule: { type: String, enum: commonRule, required: true, unique: true }, // BOC = BUY_ORDER_COMMISSION RB = REGISTER_BONUS, RCB = REFER_CODE_BONUS, RR = REGISTER_REFER, DB = DEPOSIT_BONUS, AC = ADMIN_COMMISSION, LCG = LEAGUE_CREATOR_GST, BB=BIRTDAY_BONUS, NUJD = NEW_USER_JOINING_BONUS, FLJ = FREE_LEAGUE_JOINING, KYCM = KYC_MANDATORY, KYCWL = KYC_WITHDRAW_LIMIT, KYCDOC = DOCUMENTS_REQUIRED_FOR_KYC, AKYC = AUTO_KYC
  sRuleName: { type: String },
  sDescription: { type: String },
  nAmount: { type: Number, required: true },
  eAmountType: { type: String, enum: eAmountType.value }, // P = Percentage, F = Fixed
  eType: { type: String, enum: ruleType }, // C = CASH, B = BONUS, W = WITHDRAW, D = DEPOSIT
  nMax: { type: Number },
  nMin: { type: Number },
  eStatus: { type: String, enum: status, default: 'N' }, // Y = Active, N = Inactive
  nExpireDays: { type: Number },
  sExternalId: { type: String },
  sRewardOn: { type: String, enum: rewardOn },
  sKYCDoc: { type: String, enum: kycDocs },
  nXP: { type: Number }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
CommonRule.index({ eStatus: 1, eRule: 1 })

const CommonRuleModel = StatisticsDBConnect.model('commonrules', CommonRule)
CommonRuleModel.syncIndexes().then(() => {
  console.log('CommonRule Model Indexes Synced')
}).catch((err) => {
  console.log('CommonRule Model Indexes Sync Error', err)
})

module.exports = CommonRuleModel
