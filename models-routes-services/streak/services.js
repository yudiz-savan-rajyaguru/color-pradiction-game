// @ts-check
const { messages, status } = require('../../helper/api.responses')
const { catchError, pick, removenull, checkValidImageType } = require('../../helper/utilities.services')
const bucket = require('../../helper/cloudStorage.services')

const StreakModel = require('./model')
const { S3_STREAK_IMAGE_PATH } = require('../../config/defaultConfig')

class Streak {
  async add(req, res) {
    try {
      req.body = pick(req.body, ['eStatus', 'eType', 'nAmount', 'nDay', 'sTitle', 'sImage'])
      removenull(req.body)

      let { sTitle, nDay } = req.body
      sTitle = sTitle.toLowerCase()
      if (req.body.eType === 'E' && !req.body.sImage) { return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].imageRequiredForExtraType }) }

      const exist = await StreakModel.findOne({ $or: [{ sTitle }, { nDay }] }, { nDay: 1 }).lean()
      if (exist?.nDay === nDay) { return res.status(status.ResourceExist).jsonp({ status: status.ResourceExist, message: messages[req.userLanguage].streakAlreadyExistForThisDay }) }
      if (exist) { return res.status(status.ResourceExist).jsonp({ status: status.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].streakTitle) }) }

      const data = await StreakModel.create({ ...req.body })
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].streak), data })
    } catch (error) {
      return catchError('streak.add', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const { search, start = 0, limit = 10, eStatus } = req.query
      const query = { }
      if (eStatus) query.eStatus = eStatus
      if (search?.length) {
        query.sTitle = { $regex: new RegExp('^.*' + search + '.*', 'i') }
      }
      const streak = await StreakModel.find(query).skip(Number(start)).limit(Number(limit)).sort({ dCreatedAt: -1 }).lean()
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].streak), data: streak })
    } catch (error) {
      return catchError('streak.list', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const id = req.params.id
      const streak = await StreakModel.findOne({ _id: id }).lean()
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].streak), data: streak })
    } catch (error) {
      return catchError('streak.list', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['eStatus', 'eType', 'nAmount', 'nDay', 'sTitle'])
      removenull(req.body)
      req.body.sTitle = req.body.sTitle.toLowerCase()
      const exist = await StreakModel.findOne({ $or: [{ sTitle: req.body.sTitle, _id: { $ne: req.params.id } }, { nDay: req.body.nDay, _id: { $ne: req.params.id } }] }).lean()
      if (exist?.nDay === req.body.nDay) { return res.status(status.ResourceExist).jsonp({ status: status.ResourceExist, message: messages.streakAlreadyExistForThisDay }) }

      if (exist) { return res.status(status.ResourceExist).jsonp({ status: status.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].streakTitle) }) }

      const data = await StreakModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].streak) }) }
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].streak), data })
    } catch (error) {
      return catchError('streak.update', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const data = await StreakModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].streak) })

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].streak), data })
    } catch (error) {
      return catchError('streak.remove', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      // Pick specific fields from the request body
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      // Check if the file type is valid
      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) { return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) }) }

      // Generate a signed URL for the specified file
      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: S3_STREAK_IMAGE_PATH })

      // Return a success response with the generated signed URL
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      // Handle errors and return an error response
      catchError('streak.getSignedUrl', error, req, res)
    }
  }
}

module.exports = new Streak()
