const { body, query } = require('express-validator')

const sendOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty()
  // body('sType').not().isEmpty()
]

const verifyOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric()
]

const verifyOTPV2 = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sAuthToken').isString().optional()
]

const unSubscribeMail = [
  query('sEmail').not().isEmpty().isEmail()
]

module.exports = {
  sendOTP,
  verifyOTP,
  verifyOTPV2
}
