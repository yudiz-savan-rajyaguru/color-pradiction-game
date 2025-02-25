const { body, query } = require('express-validator')
const { tdsStatus } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminUpdateTdsValidator = [
  body('eStatus').not().isEmpty().isIn(tdsStatus)
]

const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = {
  adminUpdateTdsValidator,
  limitValidator
}
