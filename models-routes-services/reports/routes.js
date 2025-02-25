const router = require('express').Router()
const reportServices = require('./service')
const { validateAdmin, checkToken } = require('../../middlewares/middleware')
const validators = require('./validators')

router.get('/admin/reports/v1', checkToken, validateAdmin('REPORT', 'R'), reportServices.fetchReport)
router.put('/admin/user-reports/v1', validators.checkReport, checkToken, validateAdmin('REPORT', 'W'), reportServices.fetchUserReport)
router.put('/admin/participant-reports/:id/v1', validators.validateReportData, checkToken, validateAdmin('REPORT', 'W'), reportServices.fetchParticipantReport)
router.put('/admin/play-reports/:id/v1', validators.validateReportData, checkToken, validateAdmin('REPORT', 'W'), reportServices.playReport)
router.put('/admin/play-return-reports/:id/v1', validators.validateReportData, checkToken, validateAdmin('REPORT', 'W'), reportServices.playReturnReport)
router.put('/admin/wins-reports/:id/v1', validators.validateReportData, checkToken, validateAdmin('REPORT', 'W'), reportServices.fetchWinReport)
// tds
// router.put('/admin/creator-bonus/:id/v1', validators.validateReportData, checkToken, validateAdmin('REPORT', 'W'), reportServices.creatorBonusReport)
// router.put('/admin/creator-bonus-return/:id/v1', validators.validateReportData, checkToken, validateAdmin('REPORT', 'W'), reportServices.creatorBonusReturnReport)

router.put('/admin/app-download-reports/:id/v1', validators.validateAppReportData, checkToken, validateAdmin('REPORT', 'W'), reportServices.fetchAppDownloadReport)
router.put('/admin/tax-reports/:id/v1', validators.validateTaxReportData, checkToken, validateAdmin('REPORT', 'W'), reportServices.fetchTaxReport)
router.get('/admin/filter-reports/v1', validators.validateData, checkToken, validateAdmin('REPORT', 'R'), reportServices.fetchfilterReport)

router.put('/admin/subcategory-report/:id/v1', validators.validateReportData[2], checkToken, validateAdmin('REPORT', 'W'), reportServices.updateSubCategoryReport)
router.put('/admin/event-report/:id/v1', validators.validateReportData[2], checkToken, validateAdmin('REPORT', 'W'), reportServices.updateEventReport)

module.exports = router
