const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { eLinkType } = require('../../data')

const DeepLinks = new Schema({
  sLink: { type: String, trim: true, required: true },
  sWebLink: { type: String, trim: true, required: true },
  sDeepLink: { type: String, trim: true, required: true },
  sCode: { type: String, trim: true, required: true },
  iEventId: { type: Schema.Types.ObjectId },
  eType: { type: String, enum: eLinkType?.value },
  nTotalClicks: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

DeepLinks.index({ sCode: 1 }, { unique: true })
DeepLinks.index({ sLink: 1 }, { unique: true })
DeepLinks.index({ sWebLink: 1 }, { unique: true })
DeepLinks.index({ sDeepLink: 1 }, { unique: true })
const DeepLinksModel = StatisticsDBConnect.model('deeplinks', DeepLinks)

DeepLinksModel.syncIndexes().then(() => { // Sync the indexes
  console.log('Deep Link Model Indexes Synced')
}).catch((err) => {
  console.log('Deep Link Model Indexes Sync Error', err)
})

module.exports = DeepLinksModel
