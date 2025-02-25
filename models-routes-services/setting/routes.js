const router = require('express').Router()
const settingServices = require('./services')
const validators = require('./validators')
const { validateAdmin, isUserAuthenticated, validate, checkToken } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.post('/admin/setting/v1', validators.adminAddSetting, checkToken, validateAdmin('SETTING', 'W'), settingServices.add)
router.get('/admin/setting/list/v1', validators.list, checkToken, validateAdmin('SETTING', 'R'), settingServices.list)

// this api will be called from admin side, it will fetch the rules as per requirement
// for example: location enabled rule. if location is enabled in the rules then from the frontend location details will be required.
router.get('/admin/setting/default/v1', settingServices.defaultAdminPanelConfig)

router.get('/admin/setting/:id/v1', validators.validateId, checkToken, validateAdmin('SETTING', 'R'), settingServices.get)
router.put('/admin/setting/:id/v1', validators.adminUpdateSetting, checkToken, validateAdmin('SETTING', 'W'), settingServices.update)

router.get('/user/setting/fix-deposit/v1', cacheRoute(60), settingServices.getFixDepositSetting)

router.get('/user/setting/default/v1', cacheRoute(60), settingServices.getDefaultSetting)
// router.get('/user/setting/:type/v1', cacheRoute(60), settingServices.getDepositWithdrawSettingByType)
router.get('/user/setting/:type/v1', cacheRoute(60), settingServices.getDepositWithdrawSettingByTypeV2)

router.get('/admin/currency/v1', checkToken, validateAdmin('SETTING', 'R'), settingServices.getCurrency)
router.post('/admin/currency/v1', validators.adminUpdateCurrency, checkToken, validateAdmin('SETTING', 'W'), settingServices.updateCurrency)

router.get('/user/currency/v1', cacheRoute(60, 'test'), settingServices.getCurrency)
router.get('/admin/side-background/:key/v1', checkToken, validateAdmin('SETTING', 'R'), settingServices.getSideBackground)
router.post('/admin/side-background/v1', validators.adminUpdateSiteBackground, checkToken, validateAdmin('SETTING', 'W'), settingServices.updateSideBackground)
router.post('/admin/side-background/pre-signed-url/v1', validators.getSignedUrl, checkToken, validateAdmin('SETTING', 'W'), settingServices.getSignedUrl)
router.get('/admin/setting-validation/:key/v1', checkToken, validateAdmin('SETTING', 'R'), settingServices.getSettingByKeyAdmin)

router.get('/user/side-background/v1', cacheRoute(60), settingServices.getUserSideBackground)
router.get('/user/server-time/v1', settingServices.getServerTime)
router.get('/user/deduct-money-flag/v1', settingServices.getDeductMoneyFlag)

router.get('/user/tax-calculate/v1', validators.taxCalculate, validate, isUserAuthenticated, settingServices.taxCalculate)

module.exports = router
