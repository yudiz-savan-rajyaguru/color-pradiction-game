const router = require('express').Router()

const { cacheRoute } = require('../../helper/redis')
const { validateAdmin, checkToken } = require('../../middlewares/middleware')

const bannerServices = require('./services')
const validators = require('./validators')

// user banner list as per particular place (ex. DEPOSIT)
router.get('/user/banner/list/:place/v1', cacheRoute(60), bannerServices.list)
router.get('/user/banner/:id/v1', bannerServices.get)

// admin banner list with pagination
router.get('/admin/banner/list/v1', validators.limitValidator, checkToken, validateAdmin('BANNER', 'R'), bannerServices.adminListV1)

// admin get specific banner
router.get('/admin/banner/:id/v1', checkToken, validateAdmin('BANNER', 'R'), bannerServices.get)

// admin add new banner
router.post('/admin/banner/add/v1', validators.adminAddBanner, checkToken, validateAdmin('BANNER', 'W'), bannerServices.add)

// admin get pre signed url for banner
router.post('/admin/banner/pre-signed-url/v1', validators.getSignedUrl, checkToken, validateAdmin('BANNER', 'W'), bannerServices.getSignedUrl)

// admin update particular banner
router.put('/admin/banner/:id/v1', validators.adminUpdateBanner, checkToken, validateAdmin('BANNER', 'W'), bannerServices.update)

// admin delete banner
router.delete('/admin/banner/:id/v1', checkToken, validateAdmin('BANNER', 'W'), bannerServices.remove)

module.exports = router
