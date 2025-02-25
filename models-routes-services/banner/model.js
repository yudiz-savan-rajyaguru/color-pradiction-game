const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { bannerType, status, bannerScreen, bannerPlace } = require('../../data')
const ObjectId = mongoose.Types.ObjectId

const Banner = new Schema({
  sImage: { type: String, trim: true, required: true },
  eType: { type: String, enum: bannerType, default: 'S' }, // S = SCREEN, l = lINK, CR = CONTEST REDIRECT
  eStatus: { type: String, enum: status, default: 'N' },
  sLink: { type: String, trim: true },
  eScreen: { type: String, enum: bannerScreen }, // D = DEPOSIT S = SHARE
  ePlace: { type: String, enum: bannerPlace, default: 'H' },
  sDescription: { type: String, trim: true },
  nPosition: { type: Number },
  iCategoryId: { type: ObjectId },
  iSubCategoryId: { type: ObjectId },
  iEventId: { type: ObjectId },
  sExternalId: { type: String }

}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Banner.index({ eStatus: 1, ePlace: 1 })

const BannerModel = StatisticsDBConnect.model('banners', Banner)

BannerModel.syncIndexes().then(() => {
  console.log('Banner Model Indexes Synced')
}).catch((err) => {
  console.log('Banner Model Indexes Sync Error', err)
})

module.exports = BannerModel
