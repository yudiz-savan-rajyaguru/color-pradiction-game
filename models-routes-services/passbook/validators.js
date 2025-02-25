const { query, body } = require('express-validator')
const { transactionType, passbookType, passbookStatus, eTab } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/config')

const add = [
  query('eTransactionType').isIn(transactionType.value).optional(),
  query('eType').isIn(passbookType.value).optional(),
  query('eStatus').isIn(passbookStatus).optional(),
  query('eTabs').isIn(eTab.value)
]

const list = [
  query('eTransactionType').isIn(transactionType.value).optional(),
  query('eType').isIn(passbookType.value).optional(),
  query('eStatus').isIn(passbookStatus).optional(),
  query('eTabs').isIn(eTab.value),
  query('limit').optional().custom(value => {
    const intValue = parseInt(value)
    if (intValue > PAGINATION_LIMIT || intValue < 0) {
      throw new Error('Invalid limit value')
    }
    return true
  })
]

const limitValidator = [
  query('limit').optional().isInt()
]

const reportValidator = [
  body('aTransactionType.*').optional().isIn(transactionType.value),
  body('aType.*').optional().isIn(passbookType.value),
  body('aStatus.*').optional().isIn(passbookStatus),
  body('aCategoryId.*').optional().isMongoId(),
  body('aSubCategoryId.*').optional().isMongoId(),
  body('aEventId.*').optional().isMongoId(),
  body('sReportName').trim().not().isEmpty()
]

module.exports = {
  add,
  limitValidator,
  list,
  reportValidator
}
