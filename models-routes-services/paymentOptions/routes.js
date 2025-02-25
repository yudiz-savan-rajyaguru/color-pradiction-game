const router = require('express').Router()
const { validateAdmin, isUserAuthenticated, validate, checkToken } = require('../../middlewares/middleware')

const paymentOptionServices = require('./services')
const validators = require('./validators')

// User routes
router.get('/user/payment-option/list/v1', paymentOptionServices.listV2) // Endpoint for listing payment options (user, version 2)
router.post('/user/payment-option/calculate-fee/:id/v1', validators.calculatePlatformFee, validate, isUserAuthenticated, paymentOptionServices.calculatePlatformFee) // Endpoint for calculating platform fee for a user's payment option

// Admin routes
router.get('/admin/payment-option/list/v1', validators.limitValidator, checkToken, validateAdmin('PAYMENT_OPTION', 'R'), paymentOptionServices.adminListV1) // Endpoint for listing payment options (admin, version 1)
router.get('/admin/payment-option/:id/v1', validators.validateId, checkToken, validateAdmin('PAYMENT_OPTION', 'R'), paymentOptionServices.get) // Endpoint for retrieving details of a specific payment option (admin)
router.post('/admin/payment-option/add/v1', validators.adminAddPaymentOption, checkToken, validateAdmin('PAYMENT_OPTION', 'W'), paymentOptionServices.add) // Endpoint for adding a new payment option (admin)
router.post('/admin/payment-option/pre-signed-url/v1', validators.adminGetPaymentOptionSignedUrl, checkToken, validateAdmin('PAYMENT_OPTION', 'W'), paymentOptionServices.getSignedUrl) // Endpoint for obtaining a pre-signed URL (admin)
router.put('/admin/payment-option/:id/v1', validators.adminUpdatePaymentOption, checkToken, validateAdmin('PAYMENT_OPTION', 'W'), paymentOptionServices.update) // Endpoint for updating details of a specific payment option (admin)

module.exports = router
