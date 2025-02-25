const { body, param } = require('express-validator')

const { status, streakAmountType } = require('../../data')

const adminAddStreak = [
  body('sTitle').not().isEmpty(),
  body('nAmount').not().isEmpty().isNumeric(),
  body('eType').not().isEmpty().toUpperCase().isIn(streakAmountType),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status),
  body('nDay').not().isEmpty().isNumeric()
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const deleteStreak = [
  param('id').isMongoId().not().isEmpty()
]

const validateId = [
  param('id').isMongoId().not().isEmpty()
]

module.exports = {
  adminAddStreak,
  getSignedUrl,
  deleteStreak,
  validateId
}
