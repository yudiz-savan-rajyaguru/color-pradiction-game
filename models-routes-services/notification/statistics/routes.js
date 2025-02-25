const router = require('express').Router()

const { validateAdmin, isUserAuthenticated, checkToken } = require('../../../middlewares/middleware')
const validators = require('./validators')
const NotificationStatisticServices = require('./services')

router.get('/admin/notification/stats/:id/v1', validators.validateId, checkToken, validateAdmin('PUSHNOTIFICATION', 'R'), NotificationStatisticServices.getV2)

router.post('/user/notification/log/:id/v1', validators.validateId, isUserAuthenticated, NotificationStatisticServices.log)

module.exports = router
