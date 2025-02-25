const { body, param, query } = require('express-validator')

const { status } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')
const addIpRange = [
  body('sName').not().isEmpty()
]

const ipIdValidate = [
  param('id').not().isEmpty().isMongoId()
]

const updateIpRange = [
  body('sName').not().isEmpty(),
  body('eStatus').not().isEmpty().isIn(status),
  param('id').not().isEmpty().isMongoId()
]

const listValidate = [
  query('iAdminId').optional().isMongoId(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = {
  addIpRange,
  ipIdValidate,
  updateIpRange,
  listValidate
}
