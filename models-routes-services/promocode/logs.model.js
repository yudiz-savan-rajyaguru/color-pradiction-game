const mongoose = require('mongoose')
const { AdminsDBConnect } = require('../../database/mongoose')
const Schema = mongoose.Schema

const PromoCodeLogs = new Schema({
  sPrefix: { type: String },
  sSuffix: { type: String },
  nLength: { type: Number }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = AdminsDBConnect.model('promoCodeLogs', PromoCodeLogs)
