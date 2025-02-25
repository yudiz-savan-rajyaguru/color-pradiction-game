const { param, body, query } = require('express-validator')
const { status } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/defaultConfig')

const idParam = [
  param('id').isMongoId(),
  param('sid').optional().isMongoId(),
  query('limit').optional().isInt({ max: parseInt(PAGINATION_LIMIT) }),
  query('iUserId').optional().isMongoId()

]

const update = [
  ...idParam,
  body('eStatus').notEmpty().isIn(status)
]

const validateId = [
  param('id').isMongoId()
]

module.exports = {
  idParam,
  update,
  validateId
}
