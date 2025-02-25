const { body, oneOf, param, query } = require('express-validator')

const { PAGINATION_LIMIT } = require('../../config/common')

const adminDeposit = [
  body('iUserId').not().isEmpty(), // User ID should not be empty
  oneOf([
    body('nCash').not().isEmpty().isNumeric(), // Either nCash should not be empty and should be numeric
    body('nBonus').not().isEmpty().isNumeric() // Or nBonus should not be empty and should be numeric
  ]),
  body('eType').not().isEmpty().isIn(['deposit', 'winning']), // eType should not be empty and should be 'deposit' or 'winning'
  body('sPassword').not().isEmpty() // Password should not be empty
]

const userDeposit = [
  body('ePaymentGateway').not().isEmpty(), // Payment Gateway should not be empty
  body('nAmount').not().isEmpty() // Amount should not be empty
]

const userDepositStatus = [
  param('id').not().isEmpty() // ID parameter should not be empty
]

const processDeposit = [
  param('id').not().isEmpty()
]

const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }) // Limit should be an optional integer with a maximum value
]

module.exports = {
  adminDeposit,
  userDeposit,
  userDepositStatus,
  limitValidator,
  processDeposit
}
