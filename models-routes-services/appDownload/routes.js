const router = require('express').Router()
const appDownloadServices = require('./services')
const validators = require('./validators')

router.post('/user/app-download/v1', validators.validateAppDownloadData, appDownloadServices.add)

module.exports = router
