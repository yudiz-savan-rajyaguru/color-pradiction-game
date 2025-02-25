const router = require('express').Router()

const { isUserAuthenticated } = require('../../middlewares/middleware')

const validators = require('./validators')
const services = require('./services')

router.put('/user/userPreference/v1', validators.updateUserPreference, isUserAuthenticated, services.updateUserPreference)
router.get('/user/userPreference/v1', isUserAuthenticated, services.getUserPreference)

module.exports = router
