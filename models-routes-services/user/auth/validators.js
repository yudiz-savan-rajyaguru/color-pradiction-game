const { body } = require('express-validator')

const { utmSource } = require('../../../data')

const register = [
  body('sUsername').not().isEmpty().escape(),
  body('sEmail').isEmail().not().isEmpty(),
  body('sMobNum').not().isEmpty(),
  body('sCode').not().isEmpty(),
  body('sDeviceToken').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

const checkExist = [
  body('sType').not().isEmpty(),
  body('sValue').not().isEmpty()
]

const checkExistV2 = [
  body('sUsername').not().isEmpty(),
  body('sEmail').not().isEmpty(),
  body('sMobNum').not().isEmpty()
]

const login = [
  body('sLogin').not().isEmpty(),
  body('sPassword').not().isEmpty(),
  body('sDeviceToken').not().isEmpty(),
  body('sUtmSource').isIn(utmSource).isString().optional(),
  body('sUtmMedium').isString().optional(),
  body('sUtmCampaign').isString().optional(),
  body('sUtmContent').isString().optional(),
  body('sUtmTerm').isString().optional()

]

const sendOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty()
]

const verifyOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric()
]

const resetPassword = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric(),
  body('sNewPassword').not().isEmpty()
]

const changePassword = [
  body('sOldPassword').not().isEmpty(),
  body('sNewPassword').not().isEmpty()
]

const validateToken = [
  body('sPushToken').not().isEmpty(),
  body('sDeviceToken').not().isEmpty()
]

const socialLogin = [
  body('sSocialType').not().isEmpty(),
  body('sSocialToken').not().isEmpty()
]

const validateTokenV2 = [
  body('sPushToken').not().isEmpty()
]

const loginV3 = [
  body('sLogin').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

const registerV3 = [
  // body('sUsername').optional(),
  body('sEmail').isEmail().optional(),
  body('sMobNum').not().isEmpty(),
  body('sCode').optional(),
  body('sProPic').optional()
]

const verifyOTPV2 = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric()
]

const sendOTPV2 = [
  body('sLogin').not().isEmpty()
]

const registerV5 = [
  body('sLogin').not().isEmpty(),
  body('sName').not().isEmpty().escape()
]

const verifyOTPV3 = [
  body('sLogin').not().isEmpty(),
  body('sCode').isNumeric()
]

const deleteUser = [
  body('sReason').not().isEmpty()
]

const deleteUserV2 = [
  body('sReason').not().isEmpty(),
  body('sLatitude').optional(),
  body('sLongitude').optional()
]

const checkReferCode = [
  body('sCode').not().isEmpty().isString()
]

const validateSession = [
  body('oDeviceInfo.sOsName').not().isEmpty(),
  body('oDeviceInfo.sScreenResolution').not().isEmpty()
]

module.exports = {
  register,
  checkExist,
  login,
  sendOTP,
  verifyOTP,
  deleteUser,
  resetPassword,
  changePassword,
  validateToken,
  socialLogin,
  checkExistV2,
  validateTokenV2,
  loginV3,
  registerV3,
  verifyOTPV2,
  sendOTPV2,
  registerV5,
  verifyOTPV3,
  checkReferCode,
  deleteUserV2,
  validateSession
}
