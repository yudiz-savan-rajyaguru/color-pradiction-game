const router = require('express').Router()

const { validateAdmin, decrypt, checkToken } = require('../../../middlewares/middleware')

const subAdminServices = require('./services')
const validators = require('./validators')

router.get('/admin/sub-admin/list/v1', validators.limitValidator, checkToken, validateAdmin('SUBADMIN', 'R'), subAdminServices.listV3) // GET request to list sub-admins with pagination

router.get('/admin/sub-admin/:id/v1', checkToken, validateAdmin('SUBADMIN', 'R'), subAdminServices.getV2) // GET request to get a specific sub-admin by id

router.put('/admin/sub-admin/:id/v1', checkToken, validators.updateSubAdminV3, validateAdmin('SUBADMIN', 'W'), decrypt, subAdminServices.updateV5.bind(subAdminServices)) // PUT request to update a specific sub-admin by id

router.get('/admin/sub-admin-ids/v1', checkToken, validateAdmin('SUBADMIN', 'R'), subAdminServices.getAdminIds) // GET request to get ids of all sub-admins

module.exports = router
