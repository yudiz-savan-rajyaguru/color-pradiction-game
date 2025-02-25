const { body } = require('express-validator')

const { paymentGetaways } = require('../../data')

const userPayment = [
  body('nAmount').not().isEmpty().isNumeric(), // Check if nAmount is provided and numeric
  body('eType').not().isEmpty().isIn(paymentGetaways).custom((value, { req }) => { // Check if eType is provided, valid, and handle custom validation
    if (value === 'CONFIRMO' && !req.body.sSettlementCurrency) { // Custom validation for CONFIRMO type requiring sSettlementCurrency
      throw new Error('Settlement Currency is required')
    }
    return value
  })
]

module.exports = {
  userPayment
}
