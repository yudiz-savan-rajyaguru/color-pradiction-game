const { query, body, param } = require('express-validator')

const { status } = require('../../../data')
const { PAGINATION_LIMIT } = require('../../../config/common')

const states = [
  query('eStatus').optional().toUpperCase().isIn(status)
]
const reminder = [
  body('id').isMongoId().not().isEmpty()
]
const cities = [
  query('nStateId').not().isEmpty()
]

const limitValidator = [
  query('limit').optional().custom(value => {
    const intValue = parseInt(value)
    if (intValue > PAGINATION_LIMIT || intValue < 0) {
      throw new Error('Invalid limit value')
    }
    return true
  })
]

const adminRecommendation = [
  query('nLimit').optional().isInt({ max: PAGINATION_LIMIT })
]

const validateId = [
  param('id').isMongoId().not().isEmpty()
]

module.exports = { states, cities, reminder, limitValidator, adminRecommendation, validateId }
