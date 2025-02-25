// @ts-check
const router = require('express').Router()
const utilityServices = require('./services')

router.get('/get-url/v1', utilityServices.getUrl)
router.get('/get-avatar/v1', utilityServices.getAvatar)
router.post('/get-presigned-url/v1', utilityServices.getSignedUrl)

router.get('/admin/enum/v1', utilityServices.getEnum)

module.exports = router
