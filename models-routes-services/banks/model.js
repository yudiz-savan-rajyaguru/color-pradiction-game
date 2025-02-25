//  @ts-check
const mongoose = require('mongoose')

const { StatisticsDBConnect } = require('../../database/mongoose')
const { status, bankProvider } = require('../../data')

const Schema = mongoose.Schema

const Bank = new Schema({
  sCode: { type: String },
  sName: { type: String, required: true },
  eProvider: { type: String, enum: bankProvider, default: 'ADMIN' },
  eStatus: { type: String, enum: status, default: 'Y' } // Y = Active, N = Inactive
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Bank.index({ eStatus: 1, sName: 1 })

const UserTeamModel = StatisticsDBConnect.model('banks', Bank)

UserTeamModel.syncIndexes().then(() => {
  console.log('Bank Model Indexes Synced')
}).catch((err) => {
  console.log('Bank Model Indexes Sync Error', err)
})
module.exports = UserTeamModel
