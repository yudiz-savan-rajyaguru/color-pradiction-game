const mongoose = require('mongoose')

const { AdminsDBConnect } = require('../../../database/mongoose')
const Schema = mongoose.Schema

// Create BackupAdminLogs schema
const BackupAdminLogs = new Schema({
  _id: { type: Schema.Types.ObjectId },
  eKey: { type: String },
  iUserId: { type: Schema.Types.ObjectId },
  oOldFields: { type: Object }, // Old field values before the update
  oNewFields: { type: Object }, // New field values after the update
  oDetails: { type: Object }, // Additional details related to the log
  sIP: { type: String },
  iAdminId: { type: Schema.Types.ObjectId },
  sExternalId: { type: String }, // External identifier (if applicable)
  dCreatedAt: { type: Date },
  dUpdatedAt: { type: Date },
  __v: { type: Number }
}, {
  timestamps: false, // Disable automatic timestamps (createdAt, updatedAt)
  _id: false, // Disable automatic generation of _id
  versionKey: false // Disable versioning (__v field)
})

module.exports = AdminsDBConnect.model('backupadminlogs', BackupAdminLogs)
