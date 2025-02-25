const router = require('express').Router()

const { isCronAuthenticated } = require('../../middlewares/middleware')

const cronServices = require('./services')

// Last Pending Deposit Payment processing every 1 hour...
router.get('/admin/cron/process-payment/v1', isCronAuthenticated, cronServices.processDepositPayment)
router.post('/admin/cron/broadcast-notifications/v1', isCronAuthenticated, cronServices.broadcastNotifications)
router.put('/admin/cron/deposits/auto-cancel/v1', isCronAuthenticated, cronServices.addAutoCancelTimeFrame)
router.get('/admin/cron/newsletter/v1', isCronAuthenticated, cronServices.fetchNewsLetterFromFeed)
router.get('/admin/cron/update-automated-segments/v1', isCronAuthenticated, cronServices.updateUsersInAutomatedSegments)

// If User is not active then we can imply inactivity charges or we can make them in active
router.post('/admin/cron/process/inactive/users', isCronAuthenticated, cronServices.processInactiveUsers)
module.exports = router
