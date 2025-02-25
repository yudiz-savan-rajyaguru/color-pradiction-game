const router = require('express').Router()
const { validateAdmin, checkToken, importFileValidation } = require('../../middlewares/middleware')
const validators = require('./validators')
const services = require('./service')

router.get('/admin/usersegmentation/:id/list/v1', validators.idParam, checkToken, validateAdmin('USER-SEGMENTS', 'R'), services.list)
router.get('/admin/usersegmentation/:id/v1', validators.idParam, checkToken, validateAdmin('USER-SEGMENTS', 'R'), services.get)
router.put('/admin/usersegmentation/:id/v1', validators.idParam, checkToken, validateAdmin('USER-SEGMENTS', 'W'), services.update)
router.delete('/admin/usersegmentation/:id/v1', validators.validateId, checkToken, validateAdmin('USER-SEGMENTS', 'W'), services.delete)
router.post('/admin/usersegmentation/import/:id/v1', validators.validateId, importFileValidation, checkToken, validateAdmin('USER-SEGMENTS', 'W'), services.importSegmentUsers)

module.exports = router
