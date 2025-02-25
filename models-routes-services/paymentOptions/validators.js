const { body, query, param } = require('express-validator')

const { PAGINATION_LIMIT } = require('../../config/common')

const adminAddPaymentOption = [
  body('sName').not().isEmpty(), // Check if sName is provided
  body('nAutoCancelTimeFrame').optional().isInt({ min: 0 })
]

const adminGetPaymentOptionSignedUrl = [
  body('sFileName').not().isEmpty(), // Check if sFileName is provided
  body('sContentType').not().isEmpty() // Check if sContentType is provided
]

const adminUpdatePaymentOption = [
  param('id').isMongoId(),
  body('sName').not().isEmpty(), // Check if sName is provided
  body('nAutoCancelTimeFrame').optional().isInt({ min: 0 })
]

const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }) // Check if limit is optional and an integer within the specified limit
]

const calculatePlatformFee = [
  param('id').isMongoId(),
  body('nAmount').not().isEmpty().isInt({ min: 1 }) // Check if nAmount is provided and an integer greater than or equal to 1
]

const validateId = [
  param('id').isMongoId()
]

module.exports = {
  adminAddPaymentOption,
  adminGetPaymentOptionSignedUrl,
  adminUpdatePaymentOption,
  limitValidator,
  calculatePlatformFee,
  validateId
}
