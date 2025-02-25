const router = require('express').Router()

const { validateAdmin, isUserAuthenticated, checkToken } = require('../../middlewares/middleware')

const complaintServices = require('./services')
const validators = require('./validators')

// User Complaint Routes
router.post('/user/complaint/v1', validators.userAddComplaint, isUserAuthenticated, complaintServices.addComplaint) // Add a user complaint
router.post('/user/complaint/pre-signed-url/v1', validators.getSignedUrl, isUserAuthenticated, complaintServices.getSignedUrl) // Get pre-signed URL for user complaint
router.get('/user/complaint/list/v1', validators.list, isUserAuthenticated, complaintServices.list) // Get list of user complaints
router.get('/user/complaint/:id/v1', validators.validateId, isUserAuthenticated, complaintServices.get) // Get details of a specific user complaint
router.delete('/user/complaint/:id/v1', validators.validateId, isUserAuthenticated, complaintServices.removeComplaint) // Delete a user complaint

// Admin Complaint Routes
router.get('/admin/complaint/v1', validators.adminList, checkToken, validateAdmin('COMPLAINT', 'R'), complaintServices.adminListV1) // Get list of complaints for admin
router.get('/admin/complaint/:id/v1', validators.validateId, checkToken, validateAdmin('COMPLAINT', 'R'), complaintServices.adminGet) // Get details of a specific complaint for admin
router.put('/admin/complaint/:id/v1', validators.validateId, validators.adminUpdateStatus, checkToken, validateAdmin('COMPLAINT', 'W'), complaintServices.updateStatus) // Update a complaint for admin

module.exports = router
