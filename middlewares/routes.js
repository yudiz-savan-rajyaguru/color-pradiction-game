const { status, jsonStatus, messages } = require('../helper/api.responses')
const { DISABLE_ADMIN_ROUTES } = require('../config/config')
const { checkAccess } = require('./middleware')

module.exports = (app) => {
  if (DISABLE_ADMIN_ROUTES) {
    app.all('/api/admin/*', (req, res) => { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound }) })
  }

  app.use('/api', (req, res, next) => {
    if (req.path.includes('/admin/')) {
      return checkAccess(req, res, next)
    }
    return next()
  })

  app.use(require('../models-routes-services/customDeepLink/routes'))
  app.use('/.well-known', require('../models-routes-services/customDeepLink/routes'))

  app.use('/api/link', [
    require('../models-routes-services/customDeepLink/routes')
  ])

  // Admin Module Routess
  // app.use('/api/administrator', [
  //   require('../models-routes-services/admin/auth/routes'), // Admin auth routes
  //   require('../models-routes-services/admin/permissions/routes'), // Admin permissions routes
  //   require('../models-routes-services/admin/subAdmin/routes'), // Sub admin routes
  //   require('../models-routes-services/admin/roles/routes'), // Admin roles routes
  //   require('../models-routes-services/admin/adminLogs/routes'), // Admin logs routes
  //   require('../models-routes-services/commonRules/routes'), // Common rules routes
  //   require('../models-routes-services/admin/columnPreference/routes') // Column preference routes
  // ])

  // app.use('/api/statics', [
  //   require('../models-routes-services/version/routes'), // Version routes
  //   require('../models-routes-services/cms/routes'), // CMS routes
  //   require('../models-routes-services/maintenance/routes'), // Maintenance routes
  //   require('../models-routes-services/emailTemplates/routes'), // Email template routes`
  //   require('../models-routes-services/banner/routes'), // Banner routes
  //   require('../models-routes-services/banner/statistics/routes'),
  //   require('../models-routes-services/user/statistics/routes')
  // ])

  // app.use('/api/notification', [
  //   require('../models-routes-services/notification/routes'), // Notification routes
  //   require('../models-routes-services/notification/statistics/routes') // Notification statistics routes
  // ])

  // app.use('/api/auth', [
  //   require('../models-routes-services/user/auth/routes'),
  //   require('../models-routes-services/user/otpVerifications/routes'),
  //   require('../models-routes-services/user/profile/routes')
  // ])

  app.use('/api/common', [
    require('../models-routes-services/common/routes')
  ])

  // app.use('/api/ot', [
  //   require('../models-routes-services/match/routes'),
  //   require('../models-routes-services/user/digio/routes'),
  //   require('../models-routes-services/event/routes'),
  //   require('../models-routes-services/userDeposit/routes'),
  //   require('../models-routes-services/orders/routes'),
  //   require('../models-routes-services/orderexecution/routes'),
  //   require('../models-routes-services/kyc/routes'),
  //   require('../models-routes-services/profileLevel/routes'),
  //   require('../models-routes-services/user/userProfileLevel/routes'),
  //   require('../models-routes-services/passbook/routes'),
  //   require('../models-routes-services/setting/routes'),
  //   require('../models-routes-services/userPreferences/routes'),
  //   require('../models-routes-services/notification/routes'),
  //   require('../models-routes-services/notification/statistics/routes'),
  //   require('../models-routes-services/bankDetails/routes'),
  //   require('../models-routes-services/supportChat/routes'),
  //   require('../models-routes-services/portfolio/routes'),
  //   require('../models-routes-services/userWithdraw/routes'),
  //   require('../models-routes-services/orders/admin/routes'),
  //   require('../models-routes-services/userTds/routes'),
  //   require('../models-routes-services/payoutOptions/routes'),
  //   require('../models-routes-services/userbalance/routes'),
  //   require('../models-routes-services/reports/routes'),
  //   require('../models-routes-services/payment/routes'),
  //   require('../models-routes-services/appDownload/routes'),
  //   require('../models-routes-services/paymentOptions/routes'),
  //   require('../models-routes-services/apiLog/routes'),
  //   require('../models-routes-services/dashboard/routes'),
  //   require('../models-routes-services/streak/routes'),
  //   require('../models-routes-services/banks/routes'),
  //   require('../models-routes-services/cron/routes'),
  //   require('../models-routes-services/event/youtube/routes'),
  //   require('../models-routes-services/networkAccess/routes'),
  //   require('../models-routes-services/complaints/routes'),
  //   require('../models-routes-services/promocode/routes'),
  //   require('../models-routes-services/promocode/statistics/routes'),
  //   require('../models-routes-services/newsLetter/routes'),
  //   require('../models-routes-services/newsLetter/rssfeed/routes'),
  //   require('../models-routes-services/segmentations/routes'),
  //   require('../models-routes-services/usersegments/routes'),
  //   require('../models-routes-services/event/automationTemplate/routes'),
  //   require('../models-routes-services/event/rule/routes'),
  //   require('../models-routes-services/leaderboard/routes')
  // ])

  app.get('/health-check', (req, res) => {
    const sDate = new Date().toJSON()
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, sDate })
  })

  app.get('*', (req, res) => {
    return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', 'route') })
  })
}
