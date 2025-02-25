const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../../middlewares/middleware')

const customizationServices = require('./services')
const validators = require('./validators')

router.post('/admin/column/preference/v1', validators.addOrUpdate, checkToken, validateAdmin('CUSTOMIZATION', 'W'), customizationServices.add) // POST route for adding or updating admin column preference
router.get('/admin/column/preference/v1', checkToken, validateAdmin('CUSTOMIZATION', 'R'), customizationServices.get) // GET route for retrieving admin column preference

module.exports = router
