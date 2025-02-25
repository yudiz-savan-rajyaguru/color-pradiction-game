/* eslint-disable no-unused-vars */
const bcrypt = require('bcryptjs')

const AdminModel = require('../model')
const RolesModel = require('../roles/model')
const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { removenull, catchError, pick, getIp, decryptValuePromise, encryptKeyPromise, searchRegExp, mongify, decryptValue } = require('../../../helper/utilities.services')
const adminLogServices = require('../adminLogs/services')

const { validateFields } = require('./common')

class SubAdmin {
  /**
   * Controller method to retrieve a single sub-admin entry with populated roles.
   * @param {*} req - Request parameter containing sub-admin id.
   * @param {*} res - Response parameter containing response status code and sub-admin details.
   * @returns {Object} - Single sub-admin entry.
   */
  async getV2(req, res) {
    try {
      // Find the sub-admin in the database by its id and type, and populate the 'aRole' field
      const data = await AdminModel.findOne({ _id: mongify(req.params.id), eType: 'SUB' }, { sName: 1, sUsername: 1, eStatus: 1, sEmail: 1, sMobNum: 1, aPermissions: 1, aRole: 1, dLoginAt: 1 }).populate('aRole', ['sName']).lean()
      // If no sub-admin is found, return a NotFound status with a message
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].subAdmin) })
      }

      // Decrypt the sub-admin's email and mobile number
      if (data.sEmail) data.sEmail = await decryptValuePromise(data.sEmail)
      if (data.sMobNum) data.sMobNum = await decryptValuePromise(data.sMobNum)
      // Return an OK status with the sub-admin's details
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      // If an error occurs, catch the error and return it
      return catchError('SubAdmin.getV2', error, req, res)
    }
  }

  /**
   * Controller method to get a list of sub-admins with optional search, sorting, and date filters.
   * @param {*} req - Express request object containing optional query parameters.
   * @param {*} res - Express response object to send the response.
   * @returns {Object} - Response with sub-admin details including total count and a list of sub-admins.
   */
  async listV2(req, res) {
    try {
      // Destructure query parameters from the request.
      const { start = 0, limit = 10, order, search, datefrom, dateto } = req.query
      const aRole = req?.query?.aRole ? JSON.parse(req?.query?.aRole) : []
      // Determine the sorting order based on the 'order' parameter.
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { dCreatedAt: orderBy }

      let query = {}
      // If a search term is provided, construct a regex-based search query for name, email, and mobile number.
      if (search) {
        query = {
          $or: [
            { sName: { $regex: searchRegExp(search) } },
            { sEmail: { $regex: searchRegExp(search) } },
            { sMobNum: { $regex: searchRegExp(search) } }
          ]
        }
      }
      // Apply date filters if both 'datefrom' and 'dateto' are provided.
      const dateFilter = datefrom && dateto ? { dCreatedAt: { $gte: datefrom, $lte: dateto } } : {}
      if (aRole?.length) {
        query.aRole = { $in: aRole }
      }

      query = { ...query, eType: 'SUB', ...dateFilter }

      // Retrieve a list of sub-admins and total count based on the constructed query.
      const [list, total] = await Promise.all([
        AdminModel.find(query, {
          sName: 1,
          sUsername: 1,
          sEmail: 1,
          sMobNum: 1,
          aPermissions: 1,
          aRole: 1,
          eStatus: 1,
          dCreatedAt: 1,
          dLoginAt: 1
        })
          .sort(sorting)
          .skip(Number(start))
          .limit(Number(limit))
          .lean(),
        AdminModel.countDocuments({ ...query })
      ])

      // Decrypt sensitive information in the list, such as email and mobile number.
      await Promise.all(list.map(async (data) => {
        if (data.sEmail) data.sEmail = await decryptValuePromise(data.sEmail)
        if (data.sMobNum) data.sMobNum = await decryptValuePromise(data.sMobNum)
      }))
      // Construct the response data object with total count and results.
      const data = [{ total, results: list }]
      // Respond with a success status, a message, and the response data.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('SubAdmin.listV2', error, req, res)
    }
  }

  async listV3(req, res) {
    try {
      // Destructure query parameters from the request.
      const { start = 0, limit = 10, order, search, datefrom, dateto, isFullResponse } = req.query
      const aRole = req?.query?.aRole ? JSON.parse(req?.query?.aRole) : []
      // Determine the sorting order based on the 'order' parameter.
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { dCreatedAt: orderBy }

      let query = {}
      // If a search term is provided, construct a regex-based search query for name, email, and mobile number.
      if (search) {
        query = {
          $or: [
            { sName: { $regex: searchRegExp(search) } },
            { sEmail: { $regex: searchRegExp(search) } },
            { sMobNum: { $regex: searchRegExp(search) } }
          ]
        }
      }
      // Apply date filters if both 'datefrom' and 'dateto' are provided.
      const dateFilter = datefrom && dateto ? { dCreatedAt: { $gte: datefrom, $lte: dateto } } : {}
      if (aRole?.length) {
        query.aRole = { $in: aRole }
      }

      query = { ...query, eType: 'SUB', ...dateFilter }
      const projection = {
        sName: 1,
        sUsername: 1,
        sEmail: 1,
        sMobNum: 1,
        aPermissions: 1,
        aRole: 1,
        eStatus: 1,
        dCreatedAt: 1,
        dLoginAt: 1
      }

      // Retrieve a list of sub-admins and total count based on the constructed query.
      const [list, total] = await Promise.all([
        [true, 'true'].includes(isFullResponse)
          ? AdminModel.find(query, projection)
            .sort(sorting)
            .lean()
          : AdminModel.find(query, projection)
            .sort(sorting)
            .skip(Number(start))
            .limit(Number(limit))
            .lean(),
        AdminModel.countDocuments({ ...query })
      ])

      // Decrypt sensitive information in the list, such as email and mobile number.
      await Promise.all(list.map(async (data) => {
        if (data.sEmail) data.sEmail = await decryptValuePromise(data.sEmail)
        if (data.sMobNum) data.sMobNum = await decryptValuePromise(data.sMobNum)
      }))
      // Construct the response data object with total count and results.
      const data = [{ total, results: list }]
      // Respond with a success status, a message, and the response data.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('SubAdmin.listV2', error, req, res)
    }
  }

  /**
   * Controller method to update Sub Admin details including assigning a new role, updating the role param name, etc.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Success or failure messages according to the validation mismatch or match.
   */
  async updateV4(req, res) {
    try {
      // Count the total number of roles with status 'Y'.
      const roleCount = await RolesModel.countDocuments({ eStatus: 'Y' })
      // Retrieve the existing Sub Admin details based on the provided ID.
      const subadmin = await AdminModel.findOne({ _id: mongify(req.params.id) })
      if (!subadmin) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].subAdmin) })

      // Destructure relevant properties from the request body.
      let { sUsername, sEmail, sMobNum, aRole, eStatus, sPassword } = req.body

      // Pick only specific properties from the request body and remove null or undefined values.
      req.body = pick(req.body, ['aRole', 'sName', 'sUsername', 'sEmail', 'sMobNum', 'sPassword', 'eStatus'])
      removenull(req.body)

      // Update eStatus in the request body if provided.
      if (eStatus) req.body.eStatus = eStatus

      // Hash the provided password if it is provided in the request.
      if (sPassword) req.body.sPassword = bcrypt.hashSync(sPassword, salt)

      // Validate various fields including roles, username, mobile number, and password.
      const { roles } = await validateFields(req, res, { aRole, roleCount, subadmin, sUsername, sMobNum, sPassword })

      // Retrieve the old fields of the Sub Admin before the update.
      const oOldFields = await AdminModel.findById({ _id: req.params.id }, { aRole: 1, eStatus: 1, sName: 1, sUsername: 1, sEmail: 1, sMobNum: 1, aPermissions: 1, _id: 0 }).lean()

      // Encrypt sensitive information such as email and mobile number before checking for existence.
      sEmail = await encryptKeyPromise(sEmail)
      sMobNum = await encryptKeyPromise(sMobNum)

      // Check if another admin with the same email, mobile number, or username already exists.
      const adminExist = await AdminModel.findOne({ $or: [{ sEmail }, { sMobNum }, { sUsername }], _id: { $ne: req.params.id } })
      if (adminExist) {
        let field = ''
        if (adminExist.sUsername === sUsername) field = messages[req.userLanguage].username
        else if (adminExist.sMobNum === sMobNum) field = messages[req.userLanguage].mobileNumber
        else if (adminExist.sEmail === sEmail) field = messages[req.userLanguage].mobileNumber

        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', field) })
      }

      // Update the Sub Admin details in the database.
      const data = await AdminModel.findOneAndUpdate({ _id: mongify(req.params.id), eType: 'SUB' }, { ...req.body, sEmail, sMobNum, aRole: roles, $set: { aJwtTokens: [], bLoggedOut: true } }, { new: true, runValidators: true }).lean()
      // If no data is found, return a not found status with an appropriate message.
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].subAdmin) })
      }

      // Log the record for future reference to know which admin has updated sub admin details.
      const { _id: iAdminId } = req.admin
      const oNewFields = { ...oOldFields, ...req.body, sEmail, sMobNum }
      const logData = { oOldFields, oNewFields, iAdminId: mongify(iAdminId), sIP: getIp(req), eKey: 'SUB', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await adminLogServices.adminLog(req, res, logData)

      // Filter unnecessary data from the response.
      AdminModel.filterData(data)

      // Decrypt sensitive information in the response, such as email and mobile number.
      if (data.sEmail) {
        data.sEmail = await decryptValuePromise(sEmail)
      }
      if (data.sMobNum) {
        data.sMobNum = await decryptValuePromise(sMobNum)
      }

      // Respond with a success status, a message, and the updated Sub Admin details.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('AdminAuth.updateV4', error, req, res)
    }
  }

  async updateV5(req, res) {
    try {
      const subadmin = await AdminModel.findOne({ _id: mongify(req.params.id) })
      if (!subadmin) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].subAdmin) })

      // Count the total number of roles with status 'Y'.
      const roleCount = await RolesModel.countDocuments({ eStatus: 'Y' })
      // Retrieve the existing Sub Admin details based on the provided ID.
      // Destructure relevant properties from the request body.
      let { sUsername, sEmail, sMobNum, aRole, eStatus, sPassword } = req.body

      // Pick only specific properties from the request body and remove null or undefined values.
      req.body = pick(req.body, ['aRole', 'sName', 'sUsername', 'sEmail', 'sMobNum', 'sPassword', 'eStatus'])
      removenull(req.body)

      // Update eStatus in the request body if provided.
      if (eStatus) req.body.eStatus = eStatus

      // Hash the provided password if it is provided in the request.
      if (sPassword) req.body.sPassword = bcrypt.hashSync(sPassword, salt)

      // Validate various fields including roles, username, mobile number, and password.
      const { roles } = await validateFields(req, res, { aRole, roleCount, subadmin, sUsername, sMobNum, sPassword })

      // Retrieve the old fields of the Sub Admin before the update.
      const oOldFields = await AdminModel.findById({ _id: req.params.id }, { aRole: 1, eStatus: 1, sName: 1, sUsername: 1, sEmail: 1, sMobNum: 1, aPermissions: 1, _id: 0 }).lean()

      // Encrypt sensitive information such as email and mobile number before checking for existence.
      sEmail = await encryptKeyPromise(sEmail)
      sMobNum = await encryptKeyPromise(sMobNum)

      // Check if another admin with the same email, mobile number, or username already exists.
      const adminExist = await AdminModel.findOne({ $or: [{ sEmail }, { sMobNum }, { sUsername }], _id: { $ne: req.params.id } })
      if (adminExist) {
        let field = ''
        if (adminExist.sUsername === sUsername) field = messages[req.userLanguage].username
        else if (adminExist.sMobNum === sMobNum) field = messages[req.userLanguage].mobileNumber
        else if (adminExist.sEmail === sEmail) field = messages[req.userLanguage].email

        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', field) })
      }

      // Update the Sub Admin details in the database.
      const data = await AdminModel.findOneAndUpdate({ _id: mongify(req.params.id), eType: 'SUB' }, { ...req.body, sEmail, sMobNum, aRole: roles, $set: { aJwtTokens: [], bLoggedOut: true } }, { new: true, runValidators: true }).lean()
      // If no data is found, return a not found status with an appropriate message.
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].subAdmin) })
      }

      // Log the record for future reference to know which admin has updated sub admin details.

      AdminModel.filterData(data)

      // Decrypt sensitive information in the response, such as email and mobile number.
      if (data.sEmail) {
        data.sEmail = await decryptValuePromise(sEmail)
      }
      if (data.sMobNum) {
        data.sMobNum = await decryptValuePromise(sMobNum)
      }

      // Respond with a success status, a message, and the updated Sub Admin details.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      console.log('updateV5', error)
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('AdminAuth.updateV4', error, req, res)
    }
  }

  /**
   * getting all admin id name and email
   * @param {*} req - Express request object
   * @param {*} res - Express response object
   * @returns Success or Failure messages according to the validation mismatch or match.
   */
  async getAdminIds(req, res) {
    try {
      // Find all admins in the database and return their id, name, and username
      const data = await AdminModel.find({ eStatus: { $ne: 'D' } }, { _id: 1, sName: 1, sUsername: 1, eStatus: 1 }).sort({ eStatus: -1 }).lean()
      // Return an OK status with the admins' details
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      // If an error occurs, catch the error and return it
      return catchError('SubAdmin.getAdminIds', error, req, res)
    }
  }

  async findAdmins(query, projection, sorting) {
    try {
      // Execute the MongoDB query directly using Mongoose
      const adminData = await AdminModel.find(query, projection).sort(sorting).lean()
      // Return the fetched admin data
      return adminData
    } catch (error) {
      // Throw the error if the query fails
      throw new Error(error)
    }
  }

  async findAdmin(query, projection, sorting) {
    try {
      // Find a single admin matching the query and projection, sorted as specified
      const adminData = await AdminModel.findOne(query, projection).sort(sorting).lean()

      // Decrypt email and mobile number fields if they exist
      if (adminData.sEmail) adminData.sEmail = await decryptValuePromise(adminData.sEmail)
      if (adminData.sMobNum) adminData.sMobNum = await decryptValuePromise(adminData.sMobNum)

      // Respond with the found admin data
      return adminData
    } catch (error) {
      // If an error occurs, invoke the callback with the error and log it
      throw new Error(error)
    }
  }
}

module.exports = new SubAdmin()
