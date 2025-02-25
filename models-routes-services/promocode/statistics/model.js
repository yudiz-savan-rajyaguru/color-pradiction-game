const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../../database/mongoose')
const data = require('../../../data')
const PromocodeModel = require('../model')
const UserModel = require('../../user/model')

const PromocodeStatistic = new Schema({
  iPromocodeId: { type: Schema.Types.ObjectId, ref: PromocodeModel, required: true },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  idepositId: { type: Number },
  nAmount: { type: Number },
  sTransactionType: { type: String },
  eStatus: { type: String, enum: data.status, default: 'Y' }, // Y = Active, N = Inactive
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
PromocodeStatistic.index({ iPromocodeId: 1, iUserId: 1 })

PromocodeStatistic.index({ iUserId: 1 })

module.exports = AdminsDBConnect.model('Promocodestatistics', PromocodeStatistic)
