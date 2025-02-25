const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

const cmsServices = require('./services')
const validators = require('./validators')

// user get register policy
router.get('/user/cms/register-policy/v1', cacheRoute(60), cmsServices.registerPolicies)

// user get cms lists with pagination
router.get('/user/cms/list/v1', cacheRoute(60), cmsServices.userList)

// get specific cms
router.get('/user/cms/:sSlug/v1', cacheRoute(60), cmsServices.get)

// admin

// admin add cms
router.post('/admin/cms/add/v1', validators.adminAddCMS, checkToken, validateAdmin('CMS', 'W'), cmsServices.add)

// admin get all cms
router.get('/admin/cms/v1', checkToken, validateAdmin('CMS', 'R'), cmsServices.list)

// admin get specific cms by slug
router.get('/admin/cms/:sSlug/v1', checkToken, validateAdmin('CMS', 'R'), cmsServices.adminGet)

// update particular cms
router.put('/admin/cms/:id/v1', validators.adminUpdateCMS, checkToken, validateAdmin('CMS', 'W'), cmsServices.update)

// delete cms
router.delete('/admin/cms/:id/v1', validators.validateId, checkToken, validateAdmin('CMS', 'W'), cmsServices.remove)

// CSS routes
router.post('/admin/css/:eType/v1', checkToken, validateAdmin('CMS', 'W'), cmsServices.addCss)
router.get('/admin/css-list/v1', checkToken, validateAdmin('CMS', 'R'), cmsServices.listCss)
router.get('/admin/css/:eType/v1', checkToken, validateAdmin('CMS', 'R'), cmsServices.adminGetCss)
router.put('/admin/css/:eType/v1', checkToken, validateAdmin('CMS', 'W'), cmsServices.updateCss)

// User
router.get('/user/css/:eType/v1', cacheRoute(60), cmsServices.getCss)

module.exports = router
