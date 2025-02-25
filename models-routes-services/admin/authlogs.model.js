const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../database/mongoose')
const { platform, adminLogTypes } = require('../../data')

const AdminModel = require('./model')

// Define the AdminAuthLogs schema
const AdminAuthLogs = new Schema({
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel }, // Admin ID, referencing AdminModel
  ePlatform: { type: String, enum: platform, required: true }, // Platform used (Android, iOS, Web, Other, Admin)
  eType: { type: String, enum: adminLogTypes }, // Type of log (Login, Password Change, Reset Password)
  sDeviceToken: { type: String }, // Device token
  sIpAddress: { type: String }, // IP address
  dUpdatedAt: { type: Date }, // Date of last update
  dCreatedAt: { type: Date, default: Date.now }, // Date of creation, defaults to current date
  sExternalId: { type: String } // External ID

})

// Create an index on the Admin ID field
AdminAuthLogs.index({ iAdminId: 1 })

module.exports = AdminsDBConnect.model('adminauthlogs', AdminAuthLogs)
