const { isUserAuthenticated } = require('../../middlewares/middleware')
const oRazorpayServices = require('./razorpay')
const oCoinbaseServices = require('./coinbase')
const oPaymentService = require('./services')
const validators = require('./validators')

const router = require('express').Router()

router.get('/user/verify-payment/v1', oRazorpayServices.verifyPayment)
router.all('/payment/razorpay/webhook/v1', oRazorpayServices.webhook)
router.post('/user/payment/create/v1', isUserAuthenticated, validators.userPayment, oPaymentService.createOrder) // Create user payment order
router.all('/admin/payment/coinbase-webhook-url/v1', oCoinbaseServices.verifyCoinBaseOrder)
module.exports = router
