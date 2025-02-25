const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, checkValidImageType } = require('../../helper/utilities.services')
const config = require('../../config/config')
const enums = require('../../data')
const commonModel = require('./model')
const bucket = require('../../helper/cloudStorage.services')

class Utility {
  getUrl(req, res) {
    try {
      let data
      if (req.query.type === 'kyc') {
        data = config.S3_BUCKET_KYC_URL
      } else {
        data = config.S3_BUCKET_URL
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].url), data })
    } catch (error) {
      catchError('Utility.getUrl', error, req, res)
    }
  }

  async getAvatar(req, res) {
    try {
      const data = await commonModel.findOne({ eType: 'A' }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].avatar) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].avatar), data })
    } catch (error) {
      catchError('Utility.getAvatar', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType', 'sFolderName'])
      const { sFileName, sContentType, sFolderName } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: sFolderName ? `${sFolderName}/` : '' })
      // const data = await s3.signedUrl(sFileName, sContentType, S3_USER_PROFILE_PATH)
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('Users.getSignedUrl', error, req, res)
    }
  }

  getEnum(req, res) {
    try {
      const data = {}
      data.eAdminLogType = enums.adminLogKeys1
      data.eMatchingPattern = enums?.matchingPattern?.displayMap
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].enum), data })
    } catch (error) {
      catchError('Utility.getEnum', error, req, res)
    }
  }
}

module.exports = new Utility()
