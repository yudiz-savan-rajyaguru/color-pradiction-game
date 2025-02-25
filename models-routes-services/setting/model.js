// @ts-check
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../database/mongoose')
const { status, settingValueType, settingCategory } = require('../../data')

const Setting = new Schema({
  sTitle: { type: String, required: true },
  sKey: { type: String, required: true, unique: true },
  nMax: { type: Number },
  nMin: { type: Number },
  sLogo: { type: String },
  sImage: { type: String },
  sDescription: { type: String },
  sShortName: { type: String, trim: true },
  eStatus: { type: String, enum: status, default: 'Y' }, // Y = Active, N = Inactive
  sExternalId: { type: String },
  sValue: { type: String },
  eValueType: { type: String, enum: settingValueType },
  eCategory: { type: String, enum: settingCategory, default: 'ADMIN' },
  eType: { type: String } // for in-app notification settings
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
Setting.index({ sTitle: 1 })

const SettingModel = AdminsDBConnect.model('settings', Setting)

SettingModel.syncIndexes().then(() => {
  console.log('Setting Model Indexes Synced')
}).catch((err) => {
  console.log('Setting Model Indexes Sync Error', err)
})

module.exports = SettingModel
