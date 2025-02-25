const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../middlewares/middleware')

const emailTemplateServices = require('./services')
const validators = require('./validators')

// email-template add
router.post('/admin/email-template/add/v1', validators.adminAddEmailTemplate, checkToken, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.add)

// list all email-template
router.get('/admin/email-template/v1', checkToken, validateAdmin('EMAIL_TEMPLATES', 'R'), emailTemplateServices.listV1)

// get particular email-template by slug
router.get('/admin/email-template/:sSlug/v1', checkToken, validateAdmin('EMAIL_TEMPLATES', 'R'), emailTemplateServices.adminGet)

// put email-template
router.put('/admin/email-template/:id/v1', validators.adminUpdateEmailTemplate, checkToken, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.update)

// delete email-template
router.delete('/admin/email-template/:id/v1', validators.validateId, checkToken, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.remove)

// not in used
router.get('/admin/send-email/v1', validators.sendEmail, checkToken, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.send)

router.post('/admin/email-template/pre-signed-url/v1', validators.adminGetPreSignedUrl, checkToken, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.getSignedUrl)

module.exports = router
