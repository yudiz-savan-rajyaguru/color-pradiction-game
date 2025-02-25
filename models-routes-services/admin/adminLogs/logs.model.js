/* eslint-disable no-console */
const mongoose = require('mongoose')

const { AdminsDBConnect } = require('../../../database/mongoose')
const Schema = mongoose.Schema
const { adminLogKeys } = require('../../../data')
const AdminModel = require('../model')
const UserModel = require('../../user/model')

// Define Mongoose schema for AdminLogs
const AdminLogs = new Schema({
  eKey: { type: String, trim: true, required: true, enum: adminLogKeys },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  oOldFields: { type: Object }, // Old field values before the update
  oNewFields: { type: Object }, // New field values after the update
  oDetails: { type: Object },
  sIP: { type: String },
  sLatitude: { type: String }, // Latitude information associated with the log
  sLongitude: { type: String }, // Longitude information associated with the log
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  sExternalId: { type: String }, // External identifier (if applicable)
  sCity: { type: String },
  sCountry: { type: String },
  sState: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } }) // Enable timestamps

// Create indexes for improved query performance
AdminLogs.index({ eKey: 1 })
AdminLogs.index({ iUserId: 1 })
AdminLogs.index({ iAdminId: 1 })
AdminLogs.index({ eKey: 1, oOldFields: 1, oNewFields: 1 })
AdminLogs.index({ 'oNewFields.iMatchId': 1, dCreatedAt: -1, eKey: 1 })
AdminLogs.index({ 'oOldFields.iMatchId': 1, dCreatedAt: -1, eKey: 1 })
AdminLogs.index({ 'oNewFields._id': 1, dCreatedAt: -1, eKey: 1 })
AdminLogs.index({ 'oOldFields._id': 1, dCreatedAt: -1, eKey: 1 })
AdminLogs.index({ dCreatedAt: -1 })

// Create AdminLogs model using the schema
const AdminLogsModel = AdminsDBConnect.model('adminlogs', AdminLogs)

// Sync indexes and log the result
AdminLogsModel.syncIndexes().then(() => {
  console.log('Admin Logs Model Indexes Synced')
}).catch((err) => {
  console.log('Admin Logs Model Indexes Sync Error', err)
})

module.exports = AdminLogsModel
