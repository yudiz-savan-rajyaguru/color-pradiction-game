const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../../database/mongoose')
const data = require('../../../data')
const BannerModel = require('../model')

const BannerStatistic = new Schema({
  iBannerId: { type: Schema.Types.ObjectId, ref: BannerModel, required: true },
  iUserId: { type: Schema.Types.ObjectId, required: true }, // ref : UserModel
  eStatus: { type: String, enum: data.status, default: 'Y' }, // Y = Active, N = Inactive
  sExternalId: { type: String },

  ePlatform: { type: String, enum: data.bannerPlatform, default: 'O' }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

BannerStatistic.index({ iBannerId: 1 })
BannerStatistic.index({ eStatus: 1 })

module.exports = AdminsDBConnect.model('Bannerstatistics', BannerStatistic)
