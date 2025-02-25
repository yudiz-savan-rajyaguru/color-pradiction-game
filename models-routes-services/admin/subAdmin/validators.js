const { body, query } = require('express-validator')

const { PAGINATION_LIMIT } = require('../../../config/common')

// Validator for updating a sub-admin (version 2)
const updateSubAdminV2 = [
  body('sName').not().isEmpty(), // Check that the name is not empty
  body('sUsername').not().isEmpty(), // Check that the username is not empty
  body('sEmail').isEmail().escape(), // Check that the email is in a valid format
  body('sMobNum').not().isEmpty(), // Check that the mobile number is not empty
  body('iRoleId').not().isEmpty() // Check that the role id is not empty
]

// Validator for updating a sub-admin (version 3)
const updateSubAdminV3 = [
  body('sName').not().isEmpty(), // Check that the name is not empty
  body('sUsername').not().isEmpty(), // Check that the username is not empty
  body('sEmail').isEmail().escape(), // Check that the email is in a valid format
  body('sMobNum').not().isEmpty(), // Check that the mobile number is not empty
  body('aRole').not().isEmpty() // Check that the role is not empty
]

// Validator for the limit query parameter
const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }) // Check that the limit is an optional integer with a maximum value
]

module.exports = {
  updateSubAdminV2,
  updateSubAdminV3,
  limitValidator
}
