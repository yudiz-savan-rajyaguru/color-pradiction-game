const { body, param } = require('express-validator')

const { status } = require('../../data')

const adminAddCMS = [
  body('sTitle').not().isEmpty(),
  body('sSlug').not().isEmpty(),
  body('sContent').not().isEmpty(),
  body('nPriority').not().isEmpty().isInt(),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const adminUpdateCMS = [
  param('id').isMongoId(),
  body('sTitle').not().isEmpty(),
  body('sSlug').not().isEmpty(),
  body('sContent').not().isEmpty(),
  body('nPriority').not().isEmpty().isInt(),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const adminAddCSS = [
  body('sTitle').not().isEmpty(),
  body('sContent').not().isEmpty()
]

const validateId = [
  param('id').isMongoId()
]

module.exports = {
  adminAddCMS,
  adminUpdateCMS,
  adminAddCSS,
  validateId
}
