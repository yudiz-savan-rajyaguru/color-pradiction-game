const router = require('express').Router()
const dashboardServices = require('./services')
const { validateAdmin, checkToken } = require('../../middlewares/middleware')

router.get('/admin/dashboard/v1', checkToken, validateAdmin('DASHBOARD', 'R'), dashboardServices.fetchDashboard)
router.post('/admin/sync-dashboard/v1', dashboardServices.updateDashboardDetails)

router.get('/admin/currentBalance/v1', checkToken, validateAdmin('DASHBOARD', 'R'), dashboardServices.fetchCurrentBalance)
module.exports = router
