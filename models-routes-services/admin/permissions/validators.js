const { body } = require('express-validator')

const { status, adminPermission, permissionModule } = require('../../../data')

// Validation rules for adding a permission
const permissionAdd = [
  body('sName').not().isEmpty(), // Name field should not be empty
  body('sKey').not().isEmpty().isIn(adminPermission), // Key field should not be empty and should be in the list of admin permissions
  body('sModuleName').not().isEmpty().isIn(permissionModule) // Module field should not be empty
]

// Validation rules for updating a permission
const permissionUpdate = [
  body('sName').not().isEmpty(), // Name field should not be empty
  body('sKey').not().isEmpty().isIn(adminPermission), // Key field should not be empty and should be in the list of admin permissions
  body('eStatus').not().isEmpty().toUpperCase().isIn(status) // Status field should not be empty, should be converted to upper case, and should be in the list of statuses
]

// Validation rules for deleting a permission
const permissionDelete = [
  body('sKey').not().isEmpty().isIn(adminPermission), // The 'sKey' field should not be empty and should be in the list of admin permissions
  body('sModuleName').not().isEmpty().isIn(permissionModule)// The 'sModuleName' field should not be empty and should be in the list of permission modules
]

module.exports = {
  permissionAdd,
  permissionUpdate,
  permissionDelete
}
