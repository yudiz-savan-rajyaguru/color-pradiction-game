const { body, query, param } = require('express-validator')

const { PAGINATION_LIMIT } = require('../../config/common')

const adminAddPayoutOption = [
  body('sTitle').not().isEmpty(), // Check if sTitle is provided
  body('eType').not().isEmpty(), // Check if eType is provided
  body('eKey').not().isEmpty() // Check if eKey is provided
]

const adminGetPayoutOptionSignedUrl = [
  body('sFileName').not().isEmpty(), // Check if sFileName is provided
  body('sContentType').not().isEmpty() // Check if sContentType is provided
]

const adminUpdatePayoutOption = [
  body('sTitle').not().isEmpty(), // Check if sTitle is provided
  body('eType').not().isEmpty(), // Check if eType is provided
  body('eKey').not().isEmpty(), // Check if eKey is provided
  param('id').isMongoId()
]

const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }) // Check if limit is an optional integer within the specified range
]

const calculatePlatformFee = [
  body('nAmount').not().isEmpty().isInt({ min: 1 }), // Check if nAmount is provided and is a positive integer
  param('id').isMongoId()
]

const validateId = [
  param('id').isMongoId() // Check if id is a valid MongoDB ObjectId
]
module.exports = {
  adminAddPayoutOption,
  adminGetPayoutOptionSignedUrl,
  adminUpdatePayoutOption,
  limitValidator,
  calculatePlatformFee,
  validateId
}
