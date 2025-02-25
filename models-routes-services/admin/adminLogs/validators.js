const { param, query } = require('express-validator')

const { PAGINATION_LIMIT } = require('../../../config/common')

const adminLogsMatch = [
  param('id').isMongoId(), // Validate 'id' parameter as a valid MongoDB ObjectId
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }) // Validate optional 'limit' query parameter as an integer with a maximum value
]

const adminLogsLeague = [
  param('id').isMongoId(), // Validate 'id' parameter as a valid MongoDB ObjectId
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }) // Validate optional 'limit' query parameter as an integer with a maximum value
]

const AdminLogsV2 = [
  query('nLimit').optional().isInt({ max: PAGINATION_LIMIT }) // Validate optional 'nLimit' query parameter as an integer with a maximum value
]

module.exports = {
  adminLogsMatch,
  adminLogsLeague,
  AdminLogsV2
}
