const { query, body, param } = require('express-validator')
const { commonRule, ruleType, rewardOn, eAmountType } = require('../../data')

const adminAddCommonRules = [
  body('eRule').not().isEmpty().toUpperCase().isIn(commonRule),
  body('nAmount').not().isEmpty().isNumeric(),
  body('eType').not().isEmpty().toUpperCase().isIn(ruleType),
  body('sRewardOn').optional().toUpperCase().isIn(rewardOn),
  body('eAmountType').optional().toUpperCase().isIn(eAmountType.value),
  body('nExpireDays').custom((value, { req }) => {
    if (req.body.eRule === 'NUJD' && (value === undefined || value === null || value === 0)) {
      throw new Error('nExpireDays should not be empty or zero')
    }
    return true
  }),
  body('sKYCDoc').custom((value, { req }) => {
    if (req.body.eRule === 'KYCDOC') {
      throw new Error('sKYCDoc should not be empty for Specific KYC documnet Rule')
    }
    return true
  })
]

const adminUpdateCommonRules = [
  param('id').isMongoId(),
  body('eRule').not().isEmpty().toUpperCase().isIn(commonRule),
  body('nAmount').not().isEmpty().isNumeric(),
  body('eType').not().isEmpty().toUpperCase().isIn(ruleType),
  body('sRewardOn').optional().toUpperCase().isIn(rewardOn),
  body('eAmountType').optional().toUpperCase().isIn(eAmountType.value)
]

const getRuleByType = [
  query('eRule').isIn(commonRule)
]

const validateId = [
  param('id').isMongoId()
]

module.exports = {
  adminAddCommonRules,
  adminUpdateCommonRules,
  getRuleByType,
  validateId
}
