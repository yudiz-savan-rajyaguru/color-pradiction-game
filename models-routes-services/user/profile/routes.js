/* eslint-disable no-unused-vars */
const router = require('express').Router()
const { body } = require('express-validator')

const { validateAdmin, isUserAuthenticated, isAdminAuthenticated, validate, checkToken } = require('../../../middlewares/middleware')
const { cacheRoute } = require('../../../helper/redis')

const userServices = require('./userServices')
const validators = require('./validators')
const adminServices = require('./adminServices')

// all APIs checking done ....
router.get('/admin/active-profile/v1', validators.limitValidator, checkToken, validateAdmin('USERS', 'R'), adminServices.activeList)
router.get('/admin/profile/v1', validators.limitValidator, checkToken, validateAdmin('USERS', 'R'), adminServices.listV2)
router.get('/admin/profile/counts/v1', checkToken, validateAdmin('USERS', 'R'), adminServices.getCounts)

// recommendation of 10 user list
router.get('/admin/user/recommendation/v1', validators.adminRecommendation, checkToken, validateAdmin('USERS', 'R'), adminServices.adminRecommendation)
router.get('/admin/deleted-users/v1', checkToken, validateAdmin('USERS', 'R'), adminServices.deletedUsers)
router.get('/admin/deleted-users/:id/v1', checkToken, validateAdmin('USERS', 'R'), adminServices.getSingleDeletedUser)
router.get('/admin/profile/:id/v1', validators.validateId, checkToken, validateAdmin('USERS', 'R'), adminServices.adminGet)
router.put('/admin/profile/:id/v1', validators.validateId, checkToken, validateAdmin('USERS', 'W'), adminServices.adminUpdate)
// router.get('/admin/city/v1', validators.limitValidator, checkToken, isAdminAuthenticated, adminServices.listCity)
// router.get('/admin/states/v1', checkToken, isAdminAuthenticated, cacheRoute(5 * 60), userServices.getState)

router.get('/admin/referred-list/:id/v1', validators.limitValidator, checkToken, validateAdmin('USERS', 'R'), adminServices.referredByUserList)

router.post('/admin/profile/pre-signed-url/v1', [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
], checkToken, validateAdmin('USERS', 'W'), userServices.getSignedUrl)
router.get('/admin/dropped-registrations/list/v1', checkToken, validateAdmin('USERS', 'R'), adminServices.fetchDroppedRegisteredV1)
router.post('/admin/update-kyc-status/v1', adminServices.updateKYCStatus)

// user
router.get('/user/profile/v1', isUserAuthenticated, userServices.getV2)
// router.get('/user/profile-statistics/v1', isUserAuthenticated, userServices.getStatistic)
router.put('/user/profile/v1', isUserAuthenticated, userServices.updateV2)
router.post('/user/kyc-failed/v1', isUserAuthenticated, userServices.changeKYCStatus)

router.post('/user/profile/pre-signed-url/v1', [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
], isUserAuthenticated, userServices.getSignedUrl)

// router.get('/user/profile/states/v1', validators.states, validate, cacheRoute(5 * 60), userServices.getState)
// router.get('/user/profile/cities/v1', validators.cities, validate, cacheRoute(5 * 60), userServices.userCitiesList)
router.get('/user/referred-list/v1', validators.limitValidator, isUserAuthenticated, userServices.userReferrals)
router.get('/user/delete-account-reason/v1', cacheRoute(5 * 60), userServices.listOfReason)
// router.post('/user/remind-refer-user/v1', validators.reminder, isUserAuthenticated, userServices.remindReferUser)

module.exports = router
