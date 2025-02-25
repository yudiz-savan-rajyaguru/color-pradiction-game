const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../../middlewares/middleware')

const permissionServices = require('./services')
const validators = require('./validators')

router.post('/admin/permission/v1', validators.permissionAdd, checkToken, validateAdmin('PERMISSION', 'W'), permissionServices.add) // Add a new permission

router.get('/admin/permission/v1', checkToken, validateAdmin('PERMISSION', 'R'), permissionServices.list) // List all permissions

router.get('/admin/permission/list/v1', checkToken, validateAdmin('PERMISSION', 'R'), permissionServices.adminList) // List all permissions for admin

router.get('/admin/permission/:id/v1', checkToken, validateAdmin('PERMISSION', 'R'), permissionServices.get) // Get a specific permission by id

router.put('/admin/permission/:id/v1', validators.permissionUpdate, checkToken, validateAdmin('PERMISSION', 'W'), permissionServices.update) // Update a specific permission by id

router.delete('/admin/permission/v1', validators.permissionDelete, checkToken, validateAdmin('PERMISSION', 'W'), permissionServices.deletePermission) // Delete a specific permission by key

module.exports = router
