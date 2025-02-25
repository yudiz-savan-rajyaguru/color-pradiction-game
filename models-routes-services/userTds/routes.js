// @ts-check
const router = require('express').Router()
const { validateAdmin, checkToken } = require('../../middlewares/middleware')
const tdsServises = require('./services')
const validators = require('./validators')

router.get('/admin/tds/list/v1', validators.limitValidator, checkToken, validateAdmin('TDS', 'R'), tdsServises.adminList)
router.put('/admin/tds/:id/v1', validators.adminUpdateTdsValidator, checkToken, validateAdmin('TDS', 'W'), tdsServises.update)
router.get('/admin/tds/counts/v1', checkToken, validateAdmin('TDS', 'R'), tdsServises.getCounts)

module.exports = router
