// @ts-check
const router = require('express').Router()
const { checkToken, validateAdmin } = require('../../../middlewares/middleware')
const oUserProfileLevelServices = require('./services')
const { ValidateSyncUserProfileById } = require('./validators')

// Admin
router.post('/admin/user-profile-level/sync-by-id/v1', checkToken, validateAdmin('OT_XP_RULE', 'W'), ValidateSyncUserProfileById, oUserProfileLevelServices?.syncUserProfileLevelById)
router.post('/admin/user-profile-level/sync/v1', checkToken, validateAdmin('OT_XP_RULE', 'W'), oUserProfileLevelServices?.syncProfileLevelForAllUsers)

module.exports = router
