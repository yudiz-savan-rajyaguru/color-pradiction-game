const RoleModel = require('../roles/model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { removenull, catchError, pick } = require('../../../helper/utilities.services')

const PermissionsModel = require('./model')

class Permission {
  /**
   * Add permission in database
   * @body {*} req 'sName', 'sKey', 'eStatus'
   * @param {*} res permission details with message
   * @returns message with Permission details
   */
  async add(req, res) {
    try {
      // Pick only the required fields from the request body
      req.body = pick(req.body, ['sName', 'sKey', 'eStatus', 'sModuleName'])
      // Remove null values from the request body
      removenull(req.body)
      // Extract the sKey from the request body
      const { sKey } = req.body
      // Check if a permission with the same sKey already exists, if a permission with the same sKey already exists, return a ResourceExist status with a message
      const permissionExist = await PermissionsModel.findOne({ sKey }).lean()
      if (permissionExist) return res.status(status.ResourceExist).json({ message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].permission) })

      // Create a new permission with the request body
      const data = await PermissionsModel.create({ ...req.body })

      // We'll update all roles with assigning new permissions of none(Not Read + Not Write) rights
      await RoleModel.updateMany({}, { $push: { aPermissions: { sKey, eType: 'N', sModuleName: req.body.sModuleName } } })

      // Return an OK status with a success message and the permission data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].permission), data })
    } catch (error) {
      // If an error occurs, catch the error and return it
      return catchError('Permission.add', error, req, res)
    }
  }

  /**
   * Controller method to retrieve all permissions from the database.
   * @param {*} res - Express response object to send the response.
   * @returns {Object} - Response with all permissions details and a message.
   */
  async adminList(req, res) {
    try {
      // Fetch all permissions from the database in a lean format (Plain JavaScript objects).
      const data = await PermissionsModel.find({}).lean()

      // Respond with a success status, a message, and the retrieved permissions data.
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].permission), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('Permission.adminList', error, req, res)
    }
  }

  /**
   * Controller method to retrieve all active permissions from the database.
   * @param {*} req - Express request object (not used in this method).
   * @param {*} res - Express response object to send the response.
   * @returns {Object} - Response with all active permissions details and a success message.
   */
  async list(req, res) {
    try {
      // Fetch all permissions with eStatus 'Y' (active) from the database in a lean format.
      const data = await PermissionsModel.find({ eStatus: 'Y' }).lean()

      // Respond with a success status, a message, and the retrieved active permissions data.
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].permissions), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('Permission.list', error, req, res)
    }
  }

  /**
   * Controller method to retrieve a single permission from the database by its ID.
   * @param {*} req - Express request object containing the permission ID.
   * @param {*} res - Express response object to send the response.
   * @returns {Object} - Response with a single permission detail and a success message, or a not found message if the permission doesn't exist.
 */
  async get(req, res) {
    try {
      // Fetch a single permission by its ID from the database.
      const data = await PermissionsModel.findById(req.params.id).lean()
      // If the permission doesn't exist, respond with a not found status and message.
      if (!data) return res.status(status.NotFound).json({ message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].permission) })

      // Respond with a success status, a message, and the retrieved permission data.
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].permission), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('Permission.list', error, req, res)
    }
  }

  /**
 * Controller method to update a single permission in the database by its ID.
 * @param {*} req - Express request object containing the permission ID and updated fields in the body.
 * @body {*} req 'sName', 'sKey', 'eStatus'
 * @param {*} res - Express response object to send the response.
 * @returns {Object} - Response with the updated permission detail and a success message, or a not found message if the permission doesn't exist.
 */
  async update(req, res) {
    try {
      // Pick only specific fields ('sName', 'sKey', 'eStatus') from the request body.
      req.body = pick(req.body, ['sName', 'sKey'])

      // query for key not exist except current id

      const checkPermissionExist = await PermissionsModel.findOne({
        sKey: req.body.sKey,
        _id: { $ne: req.params.id }
      })

      if (checkPermissionExist) {
        return res.status(status.ResourceExist).json({ message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].permission) })
      }

      // Update the permission by its ID with the provided fields, ensuring validation and returning the new document.
      const data = await PermissionsModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      // If the permission doesn't exist, respond with a not found status and message.
      if (!data) return res.status(status.NotFound).json({ message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].permission) })

      // Respond with a success status, a message, and the updated permission data.
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].permission), data })
    } catch (error) {
      // If an error occurs, log the error, and respond with an error status and message.
      return catchError('Permission.update', error, req, res)
    }
  }

  // Asynchronous function to delete a permission
  async deletePermission(req, res) {
    try {
      // Pick only 'sKey' and 'sModuleName' from the request body
      req.body = pick(req.body, ['sKey', 'sModuleName'])

      // Create a payload object with 'sKey' and 'sModuleName'
      const payload = { sKey: req.body.sKey, sModuleName: req.body.sModuleName }

      // Delete the permission from the PermissionsModel
      await PermissionsModel.deleteOne(payload)

      // Update all roles in the RoleModel, removing the deleted permission from 'aPermissions'
      await RoleModel.updateMany({}, { $pull: { aPermissions: payload } })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].permission) })
    } catch (error) {
      // If an error occurs, catch the error and return an error response
      return catchError('Permission.deletePermission', error, req, res)
    }
  }
}

module.exports = new Permission()
