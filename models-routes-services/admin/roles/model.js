const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../../database/mongoose')
const { status, adminPermission, adminPermissionType, permissionModule } = require('../../../data')
// Define the Roles schema
const Roles = new Schema({
  sName: { type: String, required: true }, // Name of the role, required field
  aPermissions: [{ // Array of permissions for the role
    sKey: { type: String, enum: adminPermission }, // Key of the permission, should be in the list of admin permissions
    eType: { type: String, enum: adminPermissionType }, // Type of the permission (R = READ, W = WRITE, N = NONE - Rights), should be in the list of admin permission types
    sModuleName: { type: String, enum: permissionModule } // Module name of the permission, should be in the list of permission modules
  }],
  eStatus: { type: String, enum: status, default: 'Y' }, // Status of the role, should be in the list of statuses, default is 'Y'
  sExternalId: { type: String } // External ID of the role
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } }) // Timestamps for the role, with custom field names for created at and updated at

// Create indexes for the Roles schema
Roles.index({ 'aPermissions.sKey': 1 })
Roles.index({ eStatus: 1 })
Roles.index({ sName: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })

// Create the RolesModel using the AdminsDBConnect connection
const RolesModel = AdminsDBConnect.model('roles', Roles)

// Synchronize indexes for the RolesModel
RolesModel.syncIndexes().then(() => {
  console.log('Roles Model Indexes Synced')
}).catch((err) => {
  console.log('Roles Model Indexes Sync Error', err)
})

module.exports = RolesModel
