const { body, param } = require('express-validator')

const { status } = require('../../data')

const adminAddEmailTemplate = [
  body('sTitle').not().isEmpty(),
  body('sDescription').not().isEmpty(),
  body('sSlug').not().isEmpty(),
  body('sSubject').not().isEmpty(),
  body('sContent').not().isEmpty(),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const adminUpdateEmailTemplate = [
  param('id').isMongoId(),
  body('sTitle').not().isEmpty(),
  body('sDescription').not().isEmpty(),
  body('sSlug').not().isEmpty(),
  body('sSubject').not().isEmpty(),
  body('sContent').not().isEmpty(),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const sendEmail = [
  body('sSlug').not().isEmpty(),
  body('to').isEmail()
]

const adminGetPreSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const validateId = [
  param('id').isMongoId()
]

module.exports = {
  adminAddEmailTemplate,
  adminUpdateEmailTemplate,
  sendEmail,
  adminGetPreSignedUrl,
  validateId
}
