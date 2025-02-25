const router = require('express').Router()

const { isUserAuthenticated, validateAdmin, checkToken } = require('../../middlewares/middleware')

const bankDetailsServices = require('./services')
const validators = require('./validators')

// admin
router.get('/admin/bank-details/:id/v1', validators.validateParams, checkToken, validateAdmin('BANKDETAILS', 'R'), bankDetailsServices.adminGetV2)
router.put('/admin/bank-details/:id/v1', validators.validateParams, checkToken, validateAdmin('BANKDETAILS', 'W'), bankDetailsServices.adminUpdateV2)
router.post('/admin/bank-details/:id/v1', validators.addBankDetailsV2, checkToken, validateAdmin('BANKDETAILS', 'W'), bankDetailsServices.adminAddV2)
router.get('/admin/bank-details-history/:id/v1', validators.validateParams, checkToken, validateAdmin('BANKDETAILS', 'R'), bankDetailsServices.adminGetBankDetailsHistory)

// user
router.post('/user/bank-details/v1', validators.addBankDetailsV2, isUserAuthenticated, bankDetailsServices.addV2)
router.put('/user/bank-details/v1', validators.updateBankDetailsV2, isUserAuthenticated, bankDetailsServices.updateV2)
router.get('/user/bank-details/v1', isUserAuthenticated, bankDetailsServices.getV2)

module.exports = router
