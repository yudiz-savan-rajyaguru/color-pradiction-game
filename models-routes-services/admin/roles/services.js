const PermissionsModel = require('../permissions/model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { removenull, catchError, pick, getPaginationValues, searchRegExp } = require('../../../helper/utilities.services')
const AdminsModel = require('../model')

const RolesModel = require('./model')

class Role {
  /**
   * Controller method to add roles to the database.
   * @param {*} req - Express request object containing role details in the body.
   * @body {*} req 'sName', 'aPermissions', 'eStatus'
   * @param {*} res - Express response object to send the response.
   * @returns {Object} - Response with role details and a success message, or an error message if validation fails.
   */
  async add(req, res) {
    try {
      // Pick only specific fields ('sName', 'aPermissions', 'eStatus') from the request body.
      req.body = pick(req.body, ['sName', 'aPermissions', 'eStatus'])
      // Remove null values from the request body.
      removenull(req.body)

      let { aPermissions, sName } = req.body
      sName = sName.trim()
      // Extract the sKey values from the provided permissions.
      const eKeyArray = aPermissions.map(({ sKey }) => sKey)

      if (!sName || sName === '' || sName === null) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].cRoleName) })
      }

      // Check if a role with the same name already exists (case-insensitive).0
      const isNameExist = await RolesModel.findOne({ sName: { $regex: `^${sName}$`, $options: 'i' } }, { _id: 1 }).lean()
      // If the role name already exists, respond with a resource exists status and message.
      if (isNameExist) {
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cRoleName) })
      }

      // Retrieve all active permissions from the PermissionsModel.
      const permissions = await PermissionsModel.find({ eStatus: 'Y' }, { sKey: 1, _id: 0 }).lean()
      // If no permissions exist, respond with a not found status and message.
      if (!permissions.length) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].permission) })
      }

      // Check that all permissions included in our database exist inside the given role permissions.

      const isValid = permissions.every(({ sKey }) => eKeyArray.includes(sKey))
      // If any permission is not valid, respond with a bad request status and message.
      if (!isValid) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].permissions) })
      }

      // Create the role in the RolesModel with the provided details.
      const data = await RolesModel.create({ ...req.body, sName })

      // Respond with a success status, a message, and the created role data.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].role), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('Role.add', error, req, res)
    }
  }

  /**
   * Controller method to retrieve all roles from the database with pagination and search.
   * @param {*} req - Express request object containing query parameters for pagination and search.
   * @param {*} res - Express response object to send the response.
   * @returns {Object} - Response with all roles details and a success message.
   */
  async adminList(req, res) {
    try {
      // Extract pagination values from the request query.
      let { start, limit, sorting, search } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      const query = {}
      // If search parameter is provided, add a regex condition for role names.
      if (search) query.sName = { $regex: searchRegExp(search) }

      // Use Promise.all to execute countDocuments and find queries concurrently.
      const [total, results] = await Promise.all([
        RolesModel.countDocuments(query),
        RolesModel.find(query).sort(sorting).skip(start).limit(limit).lean()
      ])
      // Respond with a success status, a message, and the total count and paginated results of roles.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].roles), data: { total, results } })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('Role.adminList', error, req, res)
    }
  }

  async adminListV1(req, res) {
    try {
      // Extract pagination values from the request query.
      let { start, limit, sorting, search } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      const query = {}
      // If search parameter is provided, add a regex condition for role names.
      if (search) query.sName = { $regex: searchRegExp(search) }

      // Use Promise.all to execute countDocuments and find queries concurrently.
      const [total, results] = await Promise.all([
        RolesModel.countDocuments(query),
        [true, 'true'].includes(req.query.isFullResponse) ? RolesModel.find(query).sort(sorting).lean() : RolesModel.find(query).sort(sorting).skip(start).limit(limit).lean()
      ])

      // Respond with a success status, a message, and the total count and paginated results of roles.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].roles), data: { total, results } })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('Role.adminList', error, req, res)
    }
  }

  /**
   * Getting all active roles from database
   * @param {*} res all active roles details with message
   * @returns message with all active roles details
   */
  async list(req, res) {
    try {
      // Find all roles in the database with a status of 'Y' (active)
      const data = await RolesModel.find({ eStatus: 'Y' }).lean()

      // Return an OK status with a success message and the data of all active roles
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].roles), data })
    } catch (error) {
      // If an error occurs, catch the error and return it
      return catchError('Role.list', error, req, res)
    }
  }

  /**
   * Get a single role from the database
   * @param {*} req role id
   * @param {*} res single role detail with message
   * @returns message with single role detail
   */
  async get(req, res) {
    try {
      // Find the role in the database by its id
      const data = await RolesModel.findById({ _id: req.params.id }).lean()
      // If no role is found, return a NotFound status with a message
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })
      }

      // Return an OK status with a success message and the role data
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].role, data })
    } catch (error) {
      // If an error occurs, catch the error and return it
      return catchError('Role.get', error, req, res)
    }
  }

  /**
   * Controller method to update a single role in the database by its ID.
   * @param {*} req - Express request object containing the role ID and updated fields in the body.
   * @param {*} res - Express response object to send the response.
   * @body {*} req 'sName', 'aPermissions', 'eStatus'
   * @returns {Object} - Response with the updated role detail and a success message, or a not found message if the role doesn't exist.
   */
  async update(req, res) {
    try {
      // Pick only specific fields ('sName', 'aPermissions', 'eStatus') from the request body.
      req.body = pick(req.body, ['sName', 'aPermissions', 'eStatus'])
      let { aPermissions, sName } = req.body
      sName = sName.trim()

      // Extract the sKey values from the provided permissions.
      const eKeyArray = aPermissions.map(({ sKey }) => sKey)

      // Check if a role with the same name already exists (case-insensitive and excluding the current role).
      const isNameExist = await RolesModel.findOne({ sName: { $regex: `^${sName}$`, $options: 'i' }, _id: { $ne: req.params.id } }, { _id: 1 }).lean()

      // If the role name already exists, respond with a resource exists status and message.
      if (isNameExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cRoleName) })

      // Retrieve all active permissions from the PermissionsModel.
      const permissions = await PermissionsModel.find({ eStatus: 'Y' }, { sKey: 1, _id: 0 }).lean()
      // If no permissions exist, respond with a not found status and message.
      if (!permissions.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      // Check that all permissions included in our database exist inside the given role permissions.
      const isValid = permissions.every(({ sKey }) => eKeyArray.includes(sKey))

      // If any permission is not valid, respond with a bad request status and message.
      if (!isValid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].roles) })

      // Update the role by its ID with the provided fields, ensuring validation and returning the new document.
      const data = await RolesModel.findByIdAndUpdate({ _id: req.params.id }, { ...req.body, sName }, { new: true, runValidators: true }).lean()
      // If the role doesn't exist, respond with a not found status and message.
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      // Respond with a success status, a message, and the updated role data.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].role), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('Role.update', error, req, res)
    }
  }

  /**
   * Delete a single role from the database
   * @param {*} req role id
   * @param {*} res delete message
   * @returns delete message
   */
  async delete(req, res) {
    try {
      // Find the role in the database by its id
      const role = await RolesModel.findById({ _id: req.params.id }, { _id: 1 }).lean()
      // If no role is found, return a NotFound status with a message
      if (!role) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      // Check if the role is assigned to any admin
      const bRoleExist = await AdminsModel.findOne({ aRole: role._id }, { _id: 1 }).lean()
      // If the role is assigned to an admin, return a NotFound status with a message
      if (bRoleExist) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].role) })

      // Delete the role from the database
      const data = await RolesModel.findByIdAndDelete({ _id: req.params.id }).lean()
      // If no role is found (i.e., the role was not deleted), return a NotFound status with a message
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      // Return an OK status with a success message
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].role), data })
    } catch (error) {
      // If an error occurs, catch the error and return it
      return catchError('Role.delete', error, req, res)
    }
  }
}

module.exports = new Role()
