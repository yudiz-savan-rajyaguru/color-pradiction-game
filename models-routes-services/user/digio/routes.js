const router = require('express').Router()
const { isUserAuthenticated } = require('../../../middlewares/middleware')
const oDigioService = require('./service')

router.post('/user/digio/kyc/v1', isUserAuthenticated, oDigioService.startKYC)
router.all('/user/digio/webhook', oDigioService.webhook)

module.exports = router
