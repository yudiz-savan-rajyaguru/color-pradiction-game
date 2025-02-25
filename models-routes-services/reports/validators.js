const { body, param, oneOf, query } = require('express-validator')
const { reportsKeys, userType, eCategoryType, appPlatform, aTaxTransactions, filterReportKeys } = require('../../data')

const checkReport = [
  body('eKey').not().isEmpty().isIn(reportsKeys),
  body('eType').not().isEmpty().toUpperCase().isIn(userType.value)
]
const validateReportData = [
  // body('eKey').not().isEmpty().isIn(sportsReportsKeys),
  body('eCategory').not().isEmpty().toUpperCase().isIn(eCategoryType.value),
  body('eType').not().isEmpty().toUpperCase().isIn(userType.value),
  param('id').isMongoId()
]
const validateAppReportData = [
  // body('eKey').not().isEmpty().isIn(sportsReportsKeys),
  param('id').isMongoId(),
  body('ePlatform').not().isEmpty().toUpperCase().isIn(appPlatform.value),
  body('eType').not().isEmpty().toUpperCase().isIn(userType.value)
]
const validateTaxReportData = [
  // body('eKey').not().isEmpty().isIn(sportsReportsKeys),
  oneOf([
    body('eCategory').not().isEmpty().toUpperCase().isIn(eCategoryType.value),
    body('eTransactionType').not().isEmpty().toUpperCase().isIn(aTaxTransactions)
  ]),
  body('eType').not().isEmpty().toUpperCase().isIn(userType.value),
  param('id').isMongoId()
]
const validateData = [
  query('eType').not().isEmpty().toUpperCase().isIn(userType.value),
  query('dStartDate').not().isEmpty(),
  query('dEndDate').not().isEmpty(),
  query('eKey').not().isEmpty().toUpperCase().isIn(filterReportKeys)
]

module.exports = {
  checkReport,
  validateReportData,
  validateAppReportData,
  validateTaxReportData,
  validateData
}
