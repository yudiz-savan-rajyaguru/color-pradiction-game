// @ts-check
const router = require('express').Router()

const { validateAdmin, isUserAuthenticated, checkToken } = require('../../middlewares/middleware')

const profileLevelServices = require('./services')
const { limitValidator, addProfileLevelValidator, updateProfileLevelValidator, validateId } = require('./validators')

// Admin
router.get('/admin/profile-level/list/v1', limitValidator, checkToken, validateAdmin('PROFILE_LEVEL', 'R'), profileLevelServices.list)
router.get('/admin/profile-level/:id/v1', limitValidator, checkToken, validateAdmin('PROFILE_LEVEL', 'R'), profileLevelServices.get)
router.post('/admin/profile-level/v1', addProfileLevelValidator, checkToken, validateAdmin('PROFILE_LEVEL', 'W'), profileLevelServices.add)
router.put('/admin/profile-level/:id/v1', updateProfileLevelValidator, checkToken, validateAdmin('PROFILE_LEVEL', 'W'), profileLevelServices.update)

// User
router.get('/user/profile-level/criteria/v1', isUserAuthenticated, profileLevelServices.profileLevelCriteria)
router.get('/user/profile-level/:id/v1', validateId, isUserAuthenticated, profileLevelServices.getProfileLevelInfo)

module.exports = router
