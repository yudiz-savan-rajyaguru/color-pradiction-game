const { body, query } = require('express-validator')

const { PAGINATION_LIMIT } = require('../../config/common')

const userWithdraw = [
  body('ePaymentGateway').not().isEmpty(), // Ensures payment gateway is provided
  body('sInfo').not().isEmpty(), // Ensures withdrawal information is provided
  body('nAmount').not().isEmpty() // Ensures withdrawal amount is provided
]

const adminWithdraw = [
  body('iUserId').not().isEmpty(), // Ensures user ID is provided
  body('eType').not().isEmpty().isIn(['withdraw', 'winning', 'bonus']), // Ensures type is valid and within allowed values
  body('nAmount').not().isEmpty(), // Ensures withdrawal amount is provided
  body('sPassword').not().isEmpty() // Ensures admin password is provided
]

const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }) // Validates optional 'limit' query parameter as integer within maximum
]

module.exports = {
  userWithdraw,
  adminWithdraw,
  limitValidator
}
