const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../../database/mongoose')
const { permissionModule, status } = require('../../../data')

// Define the Permissions schema
const Permissions = new Schema({
  sName: { type: String, required: true }, // Name of the permission
  sKey: { type: String, required: true }, // Key of the permission
  sModuleName: { type: String, enum: permissionModule, required: true }, // Module name to which the permission belongs
  eStatus: { type: String, enum: status, default: 'Y' }, // Status of the permission
  sExternalId: { type: String } // External ID of the permission
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

// Create indexes for efficient querying
Permissions.index({ sKey: 1 })
Permissions.index({ eStatus: 1 })

// Create the Permissions model
const PermissionsModel = AdminsDBConnect.model('permissions', Permissions)

// Sync the indexes
PermissionsModel.syncIndexes().then(() => {
  console.log('Permissions Model Indexes Synced')
}).catch((err) => {
  console.log('Permissions Model Indexes Sync Error', err)
})

module.exports = PermissionsModel
