const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

// Define mongoose schema for Payout option
const PayoutOption = new Schema({
  sTitle: { type: String, required: true },
  eType: { type: String, enum: data.payoutOptionType, default: 'STD' },
  sImage: { type: String, trim: true, default: '' }, // Image URL for the payment option, trimmed
  eKey: { type: String, enum: data.payoutOptionKey, default: 'BANK' },
  sInfo: { type: String },
  nWithdrawFee: { type: Number, default: 0 },
  nMinAmount: { type: Number, default: 0 }, // Min amount to be withdrawn
  nMaxAmount: { type: Number, default: 0 }, // Max amount to be withdrawn
  bEnable: { type: Boolean, default: false },
  nPlatformFee: { type: Number, default: 0 }, // Platform fee for the payment option, default is 0
  bIsFeePercent: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PayoutOption.index({ eStatus: 1, eKey: 1 }) // Compound index on eKey and bEnable fields

const PayoutOptionModel = StatisticsDBConnect.model('payoutoptions', PayoutOption)
PayoutOptionModel.syncIndexes().then(() => {
  console.log('Payout Option Model Indexes Synced')
}).catch((err) => {
  console.log('Payout Option Model Indexes Sync Error', err)
})
module.exports = PayoutOptionModel
