const { body, query } = require('express-validator')

const { status } = require('../../../data')
const { PAGINATION_LIMIT } = require('../../../config/common')

// Validator for adding a role
const roleAdd = [
  body('sName').not().isEmpty(), // Checks that 'sName' is not empty
  body('aPermissions').not().isEmpty().isArray() // Checks that 'aPermissions' is not empty and is an array
]

// Validator for updating a role
const roleUpdate = [
  body('sName').not().isEmpty(), // Checks that 'sName' is not empty
  body('eStatus').not().isEmpty().toUpperCase().isIn(status), // Checks that 'eStatus' is not empty, converts it to uppercase, and checks that it is in the 'status' array
  body('aPermissions').not().isEmpty().isArray() // Checks that 'aPermissions' is not empty and is an array
]

// Validator for the 'limit' query parameter
const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }) // Checks that 'limit' is optional, is an integer, and does not exceed the pagination limit
]

module.exports = {
  roleAdd,
  roleUpdate,
  limitValidator
}
