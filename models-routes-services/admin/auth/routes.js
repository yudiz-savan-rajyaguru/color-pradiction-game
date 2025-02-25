// @ts-check
const router = require('express').Router()

const { validateAdmin, validate, isAdminAuthenticated, decrypt, checkToken } = require('../../../middlewares/middleware')

const adminAuthServices = require('./services')
const validators = require('./validators')

router.post('/admin/auth/login/v1', validators.adminLoginV4, validate, decrypt, adminAuthServices.loginV3) // Admin login route

router.post('/admin/auth/verify-otp/v1', validators.verifyOTP, validate, adminAuthServices.verifyOTPV2) // OTP verification route
router.post('/admin/auth/sub-admin/v1', validators.createSubAdminV4, checkToken, validateAdmin('SUBADMIN', 'W'), decrypt, adminAuthServices.createSubAdminV4) // Sub-admin creation route

router.put('/admin/auth/logout/v1', checkToken, isAdminAuthenticated, adminAuthServices.logout) // Admin logout route
router.get('/admin/auth/refresh-token/v1', adminAuthServices.refreshToken) // Token refresh route
router.put('/admin/auth/change-password/v1', validators.changePassword, validate, isAdminAuthenticated, decrypt, adminAuthServices.changePassword)
router.put('/admin/auth/change-username/v1', validators.changeUsername, validate, isAdminAuthenticated, adminAuthServices.changeUsername)
router.get('/admin/auth/get-profile/v1', isAdminAuthenticated, adminAuthServices.getAdminDetails)

// router.get('/admin/auth/thirdParty-token/v1',checkToken, adminAuthServices.thirdPartyToken1) // Token creation route

module.exports = router
