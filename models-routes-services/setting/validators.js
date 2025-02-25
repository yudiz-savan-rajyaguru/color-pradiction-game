const { body, query, param } = require('express-validator')
const { settingKeys, settingValueType, settingCategory } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminAddSetting = [
  body('sTitle').not().isEmpty(),
  body('sKey').not().isEmpty(),
  body('eValueType').optional().isIn(settingValueType),
  body('nMin').optional().isNumeric(),
  body('nMax').optional().isNumeric(),
  body('sValue').optional().isString(),
  body('eCategory').optional().isIn(settingCategory)
]

const adminUpdateSetting = [
  param('id').isMongoId().not().isEmpty(),
  body('sKey').not().isEmpty(),
  body('eValueType').optional().isIn(settingValueType),
  body('nMin').optional().isNumeric(),
  body('nMax').optional().isNumeric(),
  body('sValue').optional().isString(),
  body('eCategory').optional().isIn(settingCategory)
]

const adminUpdateCurrency = [
  body('sTitle').not().isEmpty(),
  body('sShortName').not().isEmpty(),
  body('sLogo').not().isEmpty()
]

const adminUpdateSiteBackground = [
  body('sImage').not().isEmpty(),
  body('sKey').not().isEmpty().toUpperCase().isIn(settingKeys)
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const list = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const taxCalculate = [
  query('sTransactionKey').not().isEmpty(),
  query('nAmount').not().isEmpty().isInt({ min: 1 })
]

const validateId = [
  param('id').isMongoId()
]

module.exports = {
  adminAddSetting,
  adminUpdateCurrency,
  adminUpdateSiteBackground,
  getSignedUrl,
  adminUpdateSetting,
  list,
  taxCalculate,
  validateId
}
