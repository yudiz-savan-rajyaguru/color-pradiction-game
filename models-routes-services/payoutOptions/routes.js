const router = require('express').Router()

const { cacheRoute } = require('../../helper/redis')
const { validateAdmin, isUserAuthenticated, validate } = require('../../middlewares/middleware')

const payoutOptionServices = require('./services')
const validators = require('./validators')

// user
router.get('/user/payout-option/list/v1', cacheRoute(60), payoutOptionServices.listV2) // Endpoint for listing payout options (user, version 2)
router.post('/user/payout-option/calculate-fee/:id/v1', validators.calculatePlatformFee, validate, isUserAuthenticated, payoutOptionServices.calculatePlatformFee) // Endpoint for calculating platform fee for a user's payout option

// admin
router.get('/admin/payout-option/list/v1', validators.limitValidator, validateAdmin('PAYOUT_OPTION', 'R'), payoutOptionServices.adminListV1) // Endpoint for listing payout options (admin)
router.get('/admin/payout-option/:id/v1', validators.validateId, validateAdmin('PAYOUT_OPTION', 'R'), payoutOptionServices.get) // Endpoint for retrieving details of a specific payout option (admin)
router.post('/admin/payout-option/add/v1', validators.adminAddPayoutOption, validateAdmin('PAYOUT_OPTION', 'W'), payoutOptionServices.add) // Endpoint for adding a new payout option (admin)
router.post('/admin/payout-option/pre-signed-url/v1', validators.adminGetPayoutOptionSignedUrl, validateAdmin('PAYOUT_OPTION', 'W'), payoutOptionServices.getSignedUrl) // Endpoint for obtaining a pre-signed URL (admin)
router.put('/admin/payout-option/:id/v1', validators.adminUpdatePayoutOption, validateAdmin('PAYOUT_OPTION', 'W'), payoutOptionServices.update) // Endpoint for updating details of a specific payout option (admin)

module.exports = router
