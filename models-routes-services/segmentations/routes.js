const router = require('express').Router()
const { validateAdmin, checkToken, importFileValidation } = require('../../middlewares/middleware')
const validators = require('./validators')
const segmentController = require('./service')

// Admin routes
router.get('/admin/segmentation/list/v1', validators.list, checkToken, validateAdmin('SEGMENTS', 'R'), segmentController.list)
router.get('/admin/segmentation/v1', checkToken, validateAdmin('SEGMENTS', 'R'), segmentController.activeSegments)
router.get('/admin/segmentation/:id/v1', validators.idParam, checkToken, validateAdmin('SEGMENTS', 'R'), segmentController.get)
router.post('/admin/segmentation/v1', validators.add, importFileValidation, checkToken, validateAdmin('SEGMENTS', 'W'), segmentController.add)
router.put('/admin/segmentation/:id/v1', validators.update, importFileValidation, checkToken, validateAdmin('SEGMENTS', 'W'), segmentController.update)

router.get('/admin/segmentation-users/:id/v1', validators.idParam, checkToken, validateAdmin('SEGMENTS', 'R'), segmentController.getMatchingUsers)
router.post('/admin/segmentation-users/:id/v1', validators.addManualUsers, checkToken, validateAdmin('SEGMENTS', 'W'), segmentController.addManualUser)
router.delete('/admin/segmentation/:id/v1', validators.idParam, checkToken, validateAdmin('SEGMENTS', 'W'), segmentController.delete)

module.exports = router
