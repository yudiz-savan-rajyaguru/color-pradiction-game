const router = require('express').Router()

const OtpVerifications = require('../auth/otpServices')
const { validate, changeDeviceTokenField } = require('../../../middlewares/middleware')

const validators = require('./validators')

// all APIs checking done ....
router.get('/user/auth/refresh-token/v1', OtpVerifications.refreshToken)

router.post('/user/auth/send-otp/v1', validators.sendOTP, validate, OtpVerifications.sendOTP)
router.post('/user/auth/verify-otp/v1', validators.verifyOTPV2, validate, changeDeviceTokenField, OtpVerifications.verifyOTPV2)
router.post('/user/auth/send-otp/v2', validators.sendOTP, validate, OtpVerifications.sendOTPV2)
router.post('/user/auth/verify-otp/v2', validators.verifyOTPV2, validate, changeDeviceTokenField, OtpVerifications.verifyOTPV3)

// router.get('/user/auth/unsubscribe/v1', OtpVerifications.unSubscribeMail)

module.exports = router
