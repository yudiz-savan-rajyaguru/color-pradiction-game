const router = require('express').Router()

const { validate, isUserAuthenticated, changeDeviceTokenField } = require('../../../middlewares/middleware')

const userAuthServices = require('./services')
const validators = require('./validators')
const registerAndLoginService = require('./registerAndLoginServices')

// router.post('/user/subscribe-push-token/v1', isUserAuthenticated, userAuthServices.subscribePushToken)
router.post('/user/seed-users/v1', userAuthServices.addBots)
router.post('/user/auth/check-exist/v1', validators.checkExist, validate, userAuthServices.checkExistWithValidation) // Native app used
router.put('/user/auth/logout/v1', isUserAuthenticated, userAuthServices.logout)
router.delete('/user/auth/delete-account/v1', validators.deleteUserV2, isUserAuthenticated, userAuthServices.deleteAccountV2) // with geolocation
router.post('/user/auth/register/v1', validators.registerV3, validate, changeDeviceTokenField, registerAndLoginService.registerV4) // strong password validation
router.post('/user/auth/check-refer-code/v1', validators.checkReferCode, validate, userAuthServices.checkReferCode)
router.get('/user/auto-generate-username/v1', userAuthServices.autoGenerateUsername)
router.post('/user/auth/session/v1', isUserAuthenticated, userAuthServices.storeSessionData)

module.exports = router
