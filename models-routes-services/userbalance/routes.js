const router = require('express').Router()

const { validateAdmin } = require('../../middlewares/middleware')

const balanceServices = require('./services')

router.get('/admin/balance/:id/v1', validateAdmin('BALANCE', 'R'), balanceServices.adminGet)

module.exports = router
