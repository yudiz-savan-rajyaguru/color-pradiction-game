const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const Streak = new Schema({
  sTitle: { type: String, required: true },
  nDay: { type: Number, required: true },
  nAmount: { type: Number, required: true },
  eType: { type: String, enum: data.streakAmountType, default: 'B', required: true },
  sInfo: { type: String },
  sImage: { type: String },
  eStatus: { type: String, enum: data.status, default: 'N', required: true } // Y = Active, N = Inactive
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Streak.index({ nDay: 1, sTitle: 1 })

const StreakModel = UsersDBConnect.model('streak', Streak)

StreakModel.syncIndexes().then(() => {
  console.log('streak Model Indexes Synced')
}).catch((err) => {
  console.log('streak Model Indexes Sync Error', err)
})

module.exports = StreakModel
