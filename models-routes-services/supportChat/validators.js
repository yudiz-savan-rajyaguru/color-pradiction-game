const { body, query, param } = require('express-validator')
const { eThreadStatus } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const get = [
  param('id').isMongoId().not().isEmpty()
]

const validateUserMessageAdd = [
  body('sMessage').not().isEmpty()
]

const validateAdminMessageAdd = [
  body('sMessage').not().isEmpty(),
  body('iThreadId').isMongoId().not().isEmpty()
]

const validateUpdateThreadStatus = [
  param('id').isMongoId().not().isEmpty(),
  body('eThreadStatus').optional().not().isEmpty().toUpperCase().isIn(eThreadStatus),
  body('bIsRead').isBoolean().optional()
]

const listMessages = [
  query('iThreadId').isMongoId().not().isEmpty(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('isFullResponse').isBoolean().optional()
]

const list = [
  query('iThreadId').isMongoId().optional(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('isFullResponse').isBoolean().optional()
]

module.exports = {
  get,
  validateUserMessageAdd,
  validateAdminMessageAdd,
  validateUpdateThreadStatus,
  list,
  listMessages
}
