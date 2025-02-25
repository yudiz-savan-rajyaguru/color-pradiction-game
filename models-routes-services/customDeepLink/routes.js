const router = require('express').Router()
const { validate } = require('../../middlewares/middleware')
const services = require('./services')
const validators = require('./validators')

router.get('/apple-app-site-association', services.iosFile)

router.get('/get-link-data', services.getLinkData)
router.get('/:code', validators.codeParam, validate, services.openDeepLink)

module.exports = router
