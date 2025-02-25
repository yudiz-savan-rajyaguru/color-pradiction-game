const router = require('express').Router()
const PromocodeStatisticServices = require('./services')
const { validateAdmin, checkToken } = require('../../../middlewares/middleware')
const { listPromocode } = require('../validators')

router.get('/admin/promocode/stats/:id/v1', listPromocode, checkToken, validateAdmin('PROMO', 'R'), PromocodeStatisticServices.getV2)

module.exports = router
