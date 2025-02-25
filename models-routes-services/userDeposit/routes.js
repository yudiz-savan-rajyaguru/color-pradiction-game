/* eslint-disable no-unused-vars */
const router = require('express').Router()

const { validateAdmin, isUserAuthenticated, decrypt, isAdminAuthenticatedToDeposit, checkToken } = require('../../middlewares/middleware')
const { listPaymentGateways } = require('./common')
const { cacheRoute } = require('../../helper/redis')

const validators = require('./validators')
const userDepositServices = require('./services')

// Admin routes for deposit
// router.post('/admin/deposit/v1', validators.adminDeposit, checkToken, isAdminAuthenticatedToDeposit, userDepositServices.adminDeposit) // Internal bot service used for deposit
router.post('/admin/deposit/v1', validators.adminDeposit, checkToken, validateAdmin('DEPOSIT', 'W'), decrypt, userDepositServices.adminDeposit) // Admin deposit route with additional validation
router.post('/admin/deposit/:id/v1', validators.processDeposit, checkToken, validateAdmin('DEPOSIT', 'W'), userDepositServices.processDeposit) // Process specific admin deposit
router.get('/admin/deposit/list/v1', validators.limitValidator, checkToken, validateAdmin('DEPOSIT', 'R'), userDepositServices.adminList) // Get a list of admin deposits
router.get('/admin/deposit/counts/v1', checkToken, validateAdmin('DEPOSIT', 'R'), userDepositServices.getCounts) // Get counts related to admin deposits
router.get('/admin/deposit/first-deposit-report/v1', checkToken, validateAdmin('DEPOSIT', 'R'), userDepositServices.firstDepositReport) // Generate a report on the first deposit

// // Admin route to list payment gateways
router.get('/admin/deposit/list-payment-gateways/v1', checkToken, validateAdmin('DEPOSIT', 'R'), cacheRoute(60), listPaymentGateways) // Get a list of payment gateways

// // User routes for deposit
router.get('/user/deposit/pending/v1', isUserAuthenticated, userDepositServices.userPendingDeposit) // Get pending user deposits
router.get('/user/deposit-status/:id/v1', validators.userDepositStatus, isUserAuthenticated, userDepositServices.checkUserDepositStatus.bind(userDepositServices)) // Check status of a user deposit

module.exports = router
