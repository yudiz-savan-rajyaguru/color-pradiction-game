const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../middlewares/middleware')

const versionServices = require('./services')
const validators = require('./validators')

// get versions
router.get('/user/version/v1', versionServices.userGet)

// get latest versions
router.get('/user/version/list/v1', versionServices.getAllCurrentVersions)

// admin version list pagination
router.get('/admin/version/list/v1', validators.limitValidator, checkToken, validateAdmin('VERSION', 'R'), versionServices.adminListV1)

// admin get particular version
router.get('/admin/version/:id/v1', validators.validateId, checkToken, validateAdmin('VERSION', 'R'), versionServices.get)

// admin add version
router.post('/admin/version/add/v1', validators.addVersionDetails, checkToken, validateAdmin('VERSION', 'W'), versionServices.add)

// admin update version
router.put('/admin/version/:id/v1', validators.validateId, checkToken, validateAdmin('VERSION', 'W'), versionServices.update)

// admin delete version
router.delete('/admin/version/:id/v1', validators.validateId, checkToken, validateAdmin('VERSION', 'W'), versionServices.remove)

module.exports = router
