// @ts-check
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const enums = require('../../data')
const AdminModel = require('../admin/model')

const ProfileLevel = new Schema({
  nLevel: { type: Number, required: true, default: 1 },
  sHexCode: { type: String, default: '' },
  sName: { type: String, required: true, unique: true },
  sDescription: { type: String, default: '' },
  iCreatedById: { type: Schema.Types.ObjectId, ref: AdminModel },
  sImage: { type: String, default: '' },
  oCriteria: {
    nMinXP: { type: Number, required: true }
  },
  oRules: {
    nDailyWithdrawLimit: { type: Number, required: true },
    nDailyWithdrawCount: { type: Number, required: true },
    nCommission: { type: Number, required: true },
    eCommissionFeeType: { type: String, enum: enums.eAmountType?.value, default: enums?.eAmountType?.map.FIXED }
  },
  eStatus: { type: String, enum: enums.eStatus?.value, default: enums?.eStatus?.map.ACTIVE }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

ProfileLevel.index({ eStatus: 1 })

const ProfileLevelModel = UsersDBConnect.model('profileLevel', ProfileLevel)

ProfileLevelModel.syncIndexes().then(() => {
  console.log('Profile Level Model Indexes Synced')
}).catch((err) => {
  console.log('Profile Level Model Indexes Sync Error', err)
})

module.exports = ProfileLevelModel
