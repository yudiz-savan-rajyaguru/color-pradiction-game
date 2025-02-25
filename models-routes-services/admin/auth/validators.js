const { body } = require('express-validator')

const adminLoginV4 = [
  body('sLogin').not().isEmpty(), // Login field should not be empty
  body('sPassword').not().isEmpty().optional() // Password field should not be empty, but it's optional
]

const createSubAdminV4 = [
  body('sName').not().isEmpty(), // Name field should not be empty
  body('sUsername').not().isEmpty(), // Username field should not be empty
  body('sEmail').isEmail().not().isEmpty().escape(), // Email field should be a valid email and not empty
  body('sMobNum').not().isEmpty(), // Mobile number field should not be empty
  body('sPassword').not().isEmpty(), // Password field should not be empty
  body('aRole').not().isEmpty() // Role field should not be empty
]

const verifyOTP = [
  body('sLogin').not().isEmpty(), // Login field should not be empty
  body('sAuth').not().isEmpty(), // Auth field should not be empty
  body('sType').not().isEmpty(), // Type field should not be empty
  body('sCode').isNumeric() // Code field should be numeric
]

const changePassword = [
  body('sOldPassword').not().isEmpty(),
  body('sNewPassword').not().isEmpty()
]
const changeUsername = [
  body('sName').not().isEmpty()
]

module.exports = {
  verifyOTP,
  createSubAdminV4,
  adminLoginV4,
  changePassword,
  changeUsername
}
