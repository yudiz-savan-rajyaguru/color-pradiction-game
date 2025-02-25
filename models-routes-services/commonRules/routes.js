const router = require('express').Router()
const commonRuleServices = require('./services')
const validators = require('./validators')
const { validateAdmin, checkToken } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.post('/admin/rules/add/v1', validators.adminAddCommonRules, checkToken, validateAdmin('RULE', 'W'), commonRuleServices.add)

router.get('/admin/rules/v1', checkToken, validateAdmin('RULE', 'R'), commonRuleServices.listV1)

router.get('/admin/rules/list/v1', checkToken, validateAdmin('RULE', 'R'), commonRuleServices.ruleList)

router.get('/admin/rules/get-rule/v1', checkToken, validateAdmin('RULE', 'R'), commonRuleServices.getRuleByType)

router.get('/admin/rules/:id/v1', validators.validateId, checkToken, validateAdmin('RULE', 'R'), commonRuleServices.get)

router.put('/admin/rules/:id/v1', validators.adminUpdateCommonRules, checkToken, validateAdmin('RULE', 'W'), commonRuleServices.update)

router.delete('/admin/rules/:id/v1', validators.validateId, checkToken, validateAdmin('RULE', 'W'), commonRuleServices.remove)

router.get('/admin/rules/rewards/list/v1', checkToken, validateAdmin('RULE', 'R'), commonRuleServices.rewardsRuleList)

router.get('/user/rule/current-refer-rule/v1', cacheRoute(5 * 60), commonRuleServices.currentReferRule)
router.get('/user/rules/get-rule/v1', commonRuleServices.getRuleByType)

module.exports = router
