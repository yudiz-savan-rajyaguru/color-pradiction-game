const router = require('express').Router()
const userAuthServices = require('./services')
const { validateAdmin, isUserAuthenticated, checkToken } = require('../../../middlewares/middleware')
const { cacheRoute } = require('../../../helper/redis')
const validators = require('./validators')

// ! * NOTE: Here, Due to security and other reasons we have renamed few words in route. such as system-user or bot-user is now replaced with agent. so please take care in future routes

router.get('/admin/statistics/:id/v1', validators.validateId, checkToken, validateAdmin('STATISTICS', 'R'), userAuthServices.get)

// router.get('/admin/agent/statistics/:id/v1', checkToken, validateAdmin('SYSTEM_USERS', 'R'), userAuthServices.get)

router.get('/user/profile-statistics/:id/v1', cacheRoute(60), isUserAuthenticated, userAuthServices.getProfileStatistics)

// Application manage userBased
// router.post('/user/applications/v1', validators.applications, isUserAuthenticated, userAuthServices.addApplication)

module.exports = router
