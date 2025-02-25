const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../../middlewares/middleware')

const services = require('./services')
const validators = require('./validators')

// router.get('/admin/match/logs/:id/v1', validators.adminLogsMatch, checkToken, validateAdmin('MATCH', 'R'), services.getAdminMatchLogs) // Match logs route
router.get('/admin/league/logs/:id/v1', validators.adminLogsLeague, checkToken, validateAdmin('LEAGUE', 'R'), services.getAdminLeagueLogs) // League logs route
router.get('/admin/sub-admin-logs/v1', validators.AdminLogsV2, checkToken, validateAdmin('SUBADMIN', 'R'), services.AdminLogsV2) // Sub-admin logs route
router.get('/admin/sub-admin-logs/:id/v1', checkToken, validateAdmin('SUBADMIN', 'R'), services.getAdminLog) // Specific sub-admin log route

module.exports = router
