const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

const MaintenanceServices = require('./services')
const validators = require('./validators')

// get all maintenance record
router.get('/admin/maintenance-mode/v1', checkToken, validateAdmin('MAINTENANCE', 'R'), MaintenanceServices.get)

// update maintenance record
router.put('/admin/maintenance-mode/v1', validators.adminUpdateMode, checkToken, validateAdmin('MAINTENANCE', 'W'), MaintenanceServices.update)

// single maintenance record
router.get('/user/maintenance-mode/v1', cacheRoute(10), MaintenanceServices.getMaintenance)

module.exports = router
