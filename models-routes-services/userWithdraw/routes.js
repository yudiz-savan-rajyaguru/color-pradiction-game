// @ts-check
const router = require('express').Router()

const { validateAdmin, isUserAuthenticated, decrypt, isBlockedByAdmin, checkToken } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

const validators = require('./validators')
const adminWithdrawServices = require('./services')
const userWithdrawServices = require('./userServices')

router.get('/admin/withdraw/list/v1', validators.limitValidator, checkToken, validateAdmin('WITHDRAW', 'R'), adminWithdrawServices.adminList) // Admin: Withdraw list
router.get('/admin/withdraw/counts/v1', checkToken, validateAdmin('WITHDRAW', 'R'), adminWithdrawServices.getCounts) // Admin: Withdraw counts
router.post('/admin/withdraw/:id/v1', checkToken, validateAdmin('WITHDRAW', 'W'), adminWithdrawServices.processWithdrawV2) // Admin: Process withdrawal v2
router.post('/admin/withdraw/v1', validators.adminWithdraw, checkToken, validateAdmin('WITHDRAW', 'W'), decrypt, adminWithdrawServices.adminWithdraw) // Admin: Withdraw v2
router.get('/admin/withdraw/list-payment-gateways/v1', checkToken, validateAdmin('WITHDRAW', 'R'), cacheRoute(60), adminWithdrawServices.listPaymentGateways) // Admin: List payment gateways

// Add this route's full URL in the webhook URL of PayPal
router.post('/user/withdraw/v2', isUserAuthenticated, isBlockedByAdmin, userWithdrawServices.addV3.bind(userWithdrawServices)) // User: Withdraw v2

router.get('/user/withdraw-request/v1', isUserAuthenticated, userWithdrawServices.checkWithdrawRequestV2) // User: Check withdraw request v2
router.get('/user/withdraw/cancel/:iWithdrawId/v1', isUserAuthenticated, userWithdrawServices.userCancelWithdraw) // User: Cancel withdraw v2

module.exports = router
