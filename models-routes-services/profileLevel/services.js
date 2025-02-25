// @ts-check
const ProfileLevelModel = require('../profileLevel/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { removenull, catchError, pick, getIp, ObjectId } = require('../../helper/utilities.services')
const enums = require('../../data')
const { createAdminLog } = require('../admin/adminLogs/handler')

class ProfileLevel {
  async list(req, res) {
    try {
      const { start = 0, limit = 50, order = 'asc', search } = req.query

      // Determine sorting order based on 'asc' or 'desc'
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { nLevel: orderBy }

      // Construct query object based on search parameter
      let query = {}
      if (search) {
        query = { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
      }
      // Add status criteria to the query
      query = { ...query }
      if (req?.query?.eStatus) query = { ...query, eStatus: req.query.eStatus }
      // Fetch profile levels with specified criteria
      const [list, total] = await Promise.all([
        ProfileLevelModel.find(query, { __v: 0, dUpdatedAt: 0 }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        ProfileLevelModel.countDocuments({ ...query })
      ])

      // Prepare response data with total count and paginated results
      const data = [{ total, results: list }]

      // Send the response with profile level data
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cProfileLevels), data })
    } catch (error) {
    // Handle errors and send an error response
      return catchError('profileLevel.list', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { sName } = req.body

      // Pick specific fields, remove null values
      req.body = pick(req.body, ['sName', 'oCriteria', 'sDescription', 'eStatus', 'eType', 'oRules', 'sHexCode', 'sImage'])
      removenull(req.body)
      // Check if the updated profile level name already exists
      const [profileLevelExist, currentProfileLevel] = await Promise.all([
        ProfileLevelModel.findOne({ sName, _id: { $ne: req.params.id } }).lean(),
        ProfileLevelModel.findOne({ _id: req.params.id }).lean()
      ])
      // If the current profile level does not exist, return an error response
      if (!currentProfileLevel) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cProfileLevelName) })
      }

      // If the updated name already exists, return a resource exists response
      if (profileLevelExist && profileLevelExist.sName === sName) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cProfileLevelName) })

      // validate the criteria

      // Update the profile level and fetch the updated data
      const data = await ProfileLevelModel.findOneAndUpdate({ _id: ObjectId(req.params.id) }, { ...req.body }, { new: false, runValidators: true }).lean()

      // If no data is found after update, return a not found response
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cProfileLevel) })

      // Log the record for future purposes
      const { _id: iAdminId } = req.admin
      const oNewFields = { ...req.body }
      const logData = { oOldFields: { ...data }, oNewFields, iAdminId: ObjectId(iAdminId), sIP: getIp(req), eKey: 'PL', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)

      // Return a success response with the updated data
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cProfileLevel), data: oNewFields })
    } catch (error) {
    // Handle errors and return an error response
      return catchError('ProfileLevel.update', error, req, res)
    }
  }

  async add(req, res) {
    try {
      const { sName, sDescription, eType, oCriteria } = req.body
      req.body = pick(req.body, ['sName', 'sDescription', 'eType', 'oCriteria', 'oRules', 'sHexCode', 'sImage'])
      removenull(req.body)

      const [profileLevel, totalProfileCount] = await Promise.all([
        ProfileLevelModel.findOne({ sName }, { sName: 1 }).lean(),
        ProfileLevelModel.countDocuments({}).lean()
      ])

      // profile level name already exist
      if (profileLevel) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cProfileLevelName) })

      if (totalProfileCount >= 1) {
        // validate the criteria
        req.body.oCriteria = oCriteria
      }
      // Log the record for future purpose
      const { _id: iAdminId } = req.admin
      await ProfileLevelModel.create({ sName, nLevel: totalProfileCount + 1, oCriteria, sDescription, iCreatedBy: iAdminId, eType, ...req.body })

      const oNewFields = { ...req.body }
      const logData = { oOldFields: {}, oNewFields, iAdminId: ObjectId(iAdminId), sIP: getIp(req), eKey: 'PL', sLatitude: req.admin?.sLatitude, sLongitude: req.admin?.sLongitude }

      await createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cProfileLevel) })
    } catch (error) {
      return catchError('ProfileLevel.add', error, req, res)
    }
  }

  async profileLevelCriteria(req, res) {
    try {
      // Destructuring query parameters with default values
      const { start = 0, limit = 10, order } = req.query

      // Determine sorting order based on 'asc' or 'desc'
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { nLevel: orderBy }

      // Fetch all profile level criteria with specified criteria
      const allProfileLevelCriteria = await ProfileLevelModel.find({ eStatus: enums?.eStatus?.map.ACTIVE }, { __v: 0, dCreatedAt: 0, dUpdatedAt: 0, eStatus: 0 }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      // Send the response with profile level criteria data
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cProfileLevelCriteria), data: allProfileLevelCriteria })
    } catch (error) {
      // Handle errors and send an error response
      return catchError('ProfileLevel.profileLevelCriteria', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params
      const oProfileLevel = await ProfileLevelModel.findOne({ _id: id }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cProfileLevelCriteria), data: oProfileLevel })
    } catch (error) {
      // Handle errors and send an error response
      return catchError('ProfileLevel.profileLevelCriteria', error, req, res)
    }
  }

  async getProfileLevelInfo(req, res) {
    try {
      const { id } = req.params
      const oProfileLevel = await ProfileLevelModel.findOne({ _id: id, eStatus: enums?.eStatus?.map.ACTIVE }, { __v: 0, dCreatedAt: 0, dUpdatedAt: 0, eStatus: 0 }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cProfileLevelCriteria), data: oProfileLevel })
    } catch (error) {
      // Handle errors and send an error response
      return catchError('ProfileLevel.profileLevelCriteria', error, req, res)
    }
  }
}

module.exports = new ProfileLevel()
