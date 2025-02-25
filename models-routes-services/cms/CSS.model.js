const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { cssTypes } = require('../../data')

const CSS = new Schema({
  sTitle: { type: String, required: true },
  eType: { type: String, enum: cssTypes, default: 'N' },
  sContent: { type: String, required: true }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

CSS.index({ eType: 1 })
const CSSModel = StatisticsDBConnect.model('css', CSS)
CSSModel.syncIndexes().then(() => {
  console.log('CSS Model Indexes Synced')
}).catch((err) => {
  console.log('CSS Model Indexes Sync Error', err)
})

module.exports = CSSModel
