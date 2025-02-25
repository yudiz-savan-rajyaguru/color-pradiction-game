// @ts-check
const { body, query, param } = require('express-validator')
const { PAGINATION_LIMIT } = require('../../config/common')
const enums = require('../../data')

const addProfileLevelValidator = [
  body('sName').not().isEmpty(),
  body('sImage').not().isEmpty().isString(),
  body('sDescription').optional().isString(),
  body('oCriteria').not().isEmpty(),
  body('oCriteria.nMinXP').not().isEmpty().isInt(),
  body('oRules').not().isEmpty(),
  body('oRules.nDailyWithdrawLimit').not().isEmpty().isInt(),
  body('oRules.nDailyWithdrawCount').not().isEmpty().isInt(),
  body('oRules.nCommission').not().isEmpty().isInt(),
  body('oRules.eCommissionFeeType').isIn(enums.eAmountType?.value),
  body('eStatus').optional().isIn(enums.eStatus.value)
]

const updateProfileLevelValidator = [
  param('id').not().isEmpty().isMongoId(),
  body('sName').not().isEmpty(),
  body('sImage').not().isEmpty().isString(),
  body('sDescription').optional().isString(),
  body('oCriteria').not().isEmpty(),
  body('oCriteria.nMinXP').not().isEmpty().isInt(),
  body('oRules').not().isEmpty(),
  body('oRules.nDailyWithdrawLimit').not().isEmpty().isInt(),
  body('oRules.nDailyWithdrawCount').not().isEmpty().isInt(),
  body('oRules.nCommission').not().isEmpty().isInt(),
  body('oRules.eCommissionFeeType').isIn(enums.eAmountType?.value),
  body('eStatus').optional().isIn(enums.eStatus.value)
]

const limitValidator = [
  param('id').isMongoId().optional(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const validateId = [
  param('id').isMongoId()
]

module.exports = {
  addProfileLevelValidator,
  updateProfileLevelValidator,
  limitValidator,
  validateId
}
