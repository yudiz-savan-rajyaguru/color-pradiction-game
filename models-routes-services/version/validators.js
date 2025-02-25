const { body, query, param } = require('express-validator')

const { versionType } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const addVersionDetails = [
  body('sName').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(versionType),
  body('sVersion').not().isEmpty()
]

const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const validateId = [
  param('id').isMongoId().not().isEmpty()
]

module.exports = {
  addVersionDetails,
  limitValidator,
  validateId
}
