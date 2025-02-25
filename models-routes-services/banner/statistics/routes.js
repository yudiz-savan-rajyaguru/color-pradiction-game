const router = require('express').Router()

const { validateAdmin, isUserAuthenticated, checkToken } = require('../../../middlewares/middleware')

const BannerStatisticServices = require('./services')

router.get('/admin/banner/stats/:id/v1', checkToken, validateAdmin('BANNER', 'R'), BannerStatisticServices.getV2)

router.post('/user/banner/log/:id/v1', isUserAuthenticated, BannerStatisticServices.log)

module.exports = router
