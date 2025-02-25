const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, checkValidImageType } = require('../../helper/utilities.services')
const { queuePush } = require('../../helper/redis')
const { S3EMAILTEMPLATES } = require('../../config/config')
const bucket = require('../../helper/cloudStorage.services')

const EmailTemplateModel = require('./model')

class EmailTemplate {
  /**
   * post add email template
   * @param {*} req body : sSlug, sTitle, sSubject, sContent, eStatus, sDescription
   * @param {*} res status, message, data
   * @returns {*} data : newly created email template
   */
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sSlug', 'sTitle', 'sSubject', 'sContent', 'eStatus', 'sDescription'])
      removenull(req.body)

      let { sSlug } = req.body

      sSlug = sSlug.toLowerCase()

      const exist = await EmailTemplateModel.findOne({ sSlug })
      if (exist) return res.status(status.ResourceExist).json({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].emailTemplateSlug) })

      const data = await EmailTemplateModel.create({ ...req.body })
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].emailTemplate), data })
    } catch (error) {
      return catchError('EmailTemplate.add', error, req, res)
    }
  }

  /**
   * get  fetch all the email templates
   * @param {*} req  : ''
   * @param {*} res status, message, data
   * @returns {*} data : all the email templates
   */
  async list(req, res) {
    try {
      const { start = 0, limit = 10 } = req.query
      const emailTemplates = await EmailTemplateModel.find({}).skip(Number(start)).limit(Number(limit)).lean()
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].emailTemplates), data: emailTemplates })
    } catch (error) {
      return catchError('EmailTemplate.list', error, req, res)
    }
  }

  async listV1(req, res) {
    try {
      const { start = 0, limit = 10, isFullResponse } = req.query

      let data = []

      if ([true, 'true'].includes(isFullResponse)) {
        data = await EmailTemplateModel.find({}).lean()
      } else {
        data = await EmailTemplateModel.find({}).skip(Number(start)).limit(Number(limit)).lean()
      }
      const count = await EmailTemplateModel.countDocuments({})
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].emailTemplates), data: { data, count } })
    } catch (error) {
      return catchError('EmailTemplate.list', error, req, res)
    }
  }

  /**
   * get  fetch particular email template by slug
   * @param {*} req  : params sSlug
   * @param {*} res status, message, data
   * @returns {*} data : single email template
   */
  async adminGet(req, res) {
    try {
      const data = await EmailTemplateModel.findOne({ sSlug: req.params.sSlug }).lean()

      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].emailTemplate) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].emailTemplate), data })
    } catch (error) {
      return catchError('EmailTemplate.adminGet', error, req, res)
    }
  }

  /**
   * put  update email template
   * @param {*} req  : body sSlug, sTitle, sSubject, sContent, eStatus, sDescription , params id
   * @param {*} res status, message, data
   * @returns {*} data : updated email template
   */

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sSlug', 'sTitle', 'sSubject', 'sContent', 'eStatus', 'sDescription'])
      removenull(req.body)

      req.body.sSlug = req.body.sSlug.toLowerCase()
      const exist = await EmailTemplateModel.findOne({ sSlug: req.body.sSlug, _id: { $ne: req.params.id } })
      if (exist) return res.status(status.ResourceExist).json({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].emailTemplateSlug) })

      const data = await EmailTemplateModel.findByIdAndUpdate(req.params.id, { ...req.body, dUpdatedAt: Date.now() }, { new: true, runValidators: true })
      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].emailTemplate) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].emailTemplate), data })
    } catch (error) {
      return catchError('EmailTemplate.update', error, req, res)
    }
  }

  /**
   * delete  remove email template
   * @param {*} req  : params id
   * @param {*} res status, message, data
   * @returns {*} data : deleted email template
   */
  async remove(req, res) {
    try {
      const data = await EmailTemplateModel.findOneAndDelete({ _id: req.params.id }).lean()
      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].emailTemplate) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].emailTemplate), data })
    } catch (error) {
      return catchError('EmailTemplate.remove', error, req, res)
    }
  }

  async send(req, res) {
    try {
      const { sSlug, replaceData, to } = req.body
      await queuePush('SendMail', {
        sSlug,
        replaceData,
        to
      })
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].sent_success.replace('##', messages[req.userLanguage].email), data: {} })
    } catch (error) {
      return catchError('EmailTemplate.send', error, req, res)
    }
  }

  /**
   * post  remove email template
   * @param {*} req  : body sFileName, sContentType
   * @param {*} res status, message, data
   * @returns {*} data : signed url as per the file name and content type
   */
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: S3EMAILTEMPLATES })
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('EmailTemplate.getSignedUrl', error, req, res)
    }
  }
}

module.exports = new EmailTemplate()
