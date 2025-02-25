const mongoose = require('mongoose')

const { StatisticsDBConnect } = require('../../database/mongoose')
const ObjectId = mongoose.Types.ObjectId
const Schema = mongoose.Schema
const data = require('../../data')
const AdminModel = require('../admin/model')

// Define the Admin schema
const NetAccess = new Schema({
  sName: { type: String, trim: true, required: true },
  eIpType: { type: String, enum: data.ipType, required: 'IPv6' },
  eStatus: { type: String, enum: data.status, default: 'Y' },
  sDescription: { type: String },
  iAdminId: { type: ObjectId, ref: AdminModel }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

// Define indexes for Admin schema
NetAccess.index({ sName: 1 })
NetAccess.index({ eStatus: 1 })

// Create the Admin model from the schema
const NetAccessesModel = StatisticsDBConnect.model('netaccesses', NetAccess)

// Sync indexes for the Admin model
NetAccessesModel.syncIndexes().then(() => {
  console.log('NetAccess Model Indexes Synced')
}).catch((err) => {
  console.log('NetAccess Model Indexes Sync Error', err)
})

module.exports = NetAccessesModel
