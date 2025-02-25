const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const Version = new Schema({
  sName: { type: String, required: true },
  sDescription: { type: String },
  eType: { type: String, enum: data.versionType, default: 'A' },
  sVersion: { type: String, required: true },
  sForceVersion: { type: String },
  sUrl: { type: String },
  sQR: { type: String },
  bInAppUpdate: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Version.index({ eType: 1 })

module.exports = StatisticsDBConnect.model('versions', Version)
