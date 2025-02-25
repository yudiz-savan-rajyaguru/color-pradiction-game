const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../../middlewares/middleware')

const roleServices = require('./services')
const validators = require('./validators')

router.post('/admin/role/v1', validators.roleAdd, checkToken, validateAdmin('ADMIN_ROLE', 'W'), roleServices.add) // Add a new role

router.get('/admin/role/v1', checkToken, validateAdmin('ADMIN_ROLE', 'R'), roleServices.list) // List all roles

router.get('/admin/role/list/v1', validators.limitValidator, checkToken, validateAdmin('ADMIN_ROLE', 'R'), roleServices.adminListV1) // List all roles for admin with limit validation

router.get('/admin/role/:id/v1', checkToken, validateAdmin('ADMIN_ROLE', 'R'), roleServices.get) // Get a specific role by id

router.put('/admin/role/:id/v1', validators.roleUpdate, checkToken, validateAdmin('ADMIN_ROLE', 'W'), roleServices.update) // Update a specific role by id

router.delete('/admin/role/:id/v1', checkToken, validateAdmin('ADMIN_ROLE', 'W'), roleServices.delete) // Delete a specific role by id

module.exports = router
