const router = require('express').Router()
const promocodeServices = require('./services')
const userPromocodeServices = require('./userPromocode.service')
const validators = require('./validators')
const { validateAdmin, isUserAuthenticated, checkToken } = require('../../middlewares/middleware')

router.post('/admin/promocode/v1', validators.addPromoCodeV2, checkToken, validateAdmin('PROMO', 'W'), promocodeServices.addV2)
router.post('/admin/promocode/v2', validators.addNPromoCodes, checkToken, validateAdmin('PROMO', 'W'), promocodeServices.addMultiplePromocodes)
router.put('/admin/promocode/:id/v1', validators.updatePromoCodeV2, checkToken, validateAdmin('PROMO', 'W'), promocodeServices.update)
router.get('/admin/promocode/list/v1', validators.listPromocode, checkToken, validateAdmin('PROMO', 'R'), promocodeServices.listV1)
router.get('/admin/promocode/:id/v1', checkToken, validateAdmin('PROMO', 'R'), promocodeServices.get)
router.delete('/admin/promocode/:id/v1', checkToken, validateAdmin('PROMO', 'W'), promocodeServices.remove)

// user
router.get('/user/promocode/list/v1', isUserAuthenticated, userPromocodeServices.userPromocodeListV2.bind(userPromocodeServices)) // new flow user specific
router.post('/user/promocode/check/v1', validators.checkPromocode, isUserAuthenticated, userPromocodeServices.checkPromocode)
router.get('/user/promocode/list/auto-apply/league/:id/v1', isUserAuthenticated, userPromocodeServices.newUserBenifits)

module.exports = router
