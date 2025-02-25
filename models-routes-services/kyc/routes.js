// @ts-check
const router = require('express').Router()

const { isUserAuthenticated, validateAdmin, checkToken } = require('../../middlewares/middleware')

const kycServices = require('./services')
const validators = require('./validators')
const userKycServices = require('./userKycServices')
// admin
router.get('/admin/kyc-list/v1', validators.limitValidator, validateAdmin('KYC', 'R'), kycServices.pendingKycListV2)
router.get('/admin/kyc-list/counts/v1', checkToken, validateAdmin('KYC', 'R'), kycServices.getKycCount)

router.post('/admin/kyc/add/:id/v1', validators.userKycAdd, checkToken, validateAdmin('KYC', 'W'), kycServices.add)
router.get('/admin/kyc-info/:id/v1', checkToken, validateAdmin('KYC', 'R'), kycServices.getKycDetails)
router.put('/admin/kyc-status/:id/v1', validators.updateKycStatus, checkToken, validateAdmin('KYC', 'W'), kycServices.updateKycStatus)
router.post('/admin/pre-signed-url-kyc/v1', validators.getSignedUrlKyc, checkToken, validateAdmin('KYC', 'R'), userKycServices.getSignedUrlKyc)
router.post('/admin/pre-signed-url/:type/:id/v1', validators.getSignedUrl, checkToken, validateAdmin('KYC', 'W'), userKycServices.getSignedUrl)
router.put('/admin/kyc/:id/v1', validators.adminKycUpdate, checkToken, validateAdmin('KYC', 'W'), kycServices.update)

// User
router.get('/user/kyc/v1', isUserAuthenticated, userKycServices.getKycDetailsV2)
router.get('/user/kyc/disclaimer/v1', userKycServices.getDisclaimer)
// router.post('/user/kyc/aadhaar-send-otp/v1', validators.sendKycOTP, isUserAuthenticated, userKycServices.sendKycOTP)

module.exports = router
