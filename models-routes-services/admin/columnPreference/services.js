const { messages, status } = require('../../../helper/api.responses')
const { removenull, catchError, pick } = require('../../../helper/utilities.services')
const { moduleName } = require('../../../data')

const ColumnPreferenceModel = require('./model')

class ColumnPreference {
  /**
 * Add or update column preference for a module
 * @param {*} req Request object containing 'sModuleName' and 'aColumnOrder'
 * @param {*} res Response object with added or updated module details
 * @returns Message with module details
 */
  async add(req, res) {
    try {
      // Pick only the necessary properties from the request body
      req.body = pick(req.body, ['sModuleName', 'aColumnOrder'])
      removenull(req.body) // Remove null or undefined values from the body

      // Destructure the properties from the request body
      const { sModuleName, aColumnOrder } = req.body
      const upperCaseModuleName = sModuleName.toUpperCase()

      // Validation part: Check if the module name is valid
      if (!moduleName.includes(upperCaseModuleName)) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].not_exist, replacementKey: messages[req.userLanguage].cModuleName })
      }

      // Set the condition for checking if the module already exists
      const condition = { sModuleName: upperCaseModuleName, iAdminId: req.admin._id }
      const moduleExist = await ColumnPreferenceModel.findOne(condition).lean()

      let columnPreference
      let messageKey = messages[req.userLanguage].add_success

      // Add or update the column preference based on whether it already exists
      if (moduleExist) {
        columnPreference = await ColumnPreferenceModel.findOneAndUpdate(condition, { $set: { sModuleName, aColumnOrder, iAdminId: req.admin._id } }, { new: true, runValidators: true }).lean()
        messageKey = messages[req.userLanguage].update_success
      } else {
        columnPreference = await ColumnPreferenceModel.create({ sModuleName, aColumnOrder, iAdminId: req.admin._id })
      }

      // Remove unnecessary fields from the response
      columnPreference.dUpdatedAt = undefined
      columnPreference.__v = undefined

      // Return a success response with the message and module details
      return res.status(status.OK).jsonp({ status: status.OK, message: messageKey.replace('##', messages[req.userLanguage].cColumnPreference), data: columnPreference })
    } catch (error) {
      // If an error occurs, catch the error and return an error response
      return catchError('column-preference.add', error, req, res)
    }
  }

  /**
 * Get admin column preference
 * @param {*} req Request object containing 'sModuleName'
 * @param {*} res Response object with requested module details
 * @returns Message with specific module details
 */
  async get(req, res) {
    try {
      // Pick only the necessary properties from the query parameters
      req.query = pick(req.query, ['sModuleName'])
      removenull(req.query) // Remove null or undefined values from the query
      // Destructure the sModuleName from the query
      const { sModuleName } = req.query
      // Convert module name to uppercase for consistency
      const upperCaseModuleName = sModuleName.toUpperCase()
      // Find the column preferences for the specified module and admin ID
      const columnPreference = await ColumnPreferenceModel.findOne({ sModuleName: upperCaseModuleName, iAdminId: req.admin._id }, { __v: 0, dUpdatedAt: 0 }).lean()
      // If no column preferences are found, return a NotFound response
      if (!columnPreference) {
        return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cModuleName) })
      }
      // Return the column preferences in a success response
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cColumnPreference), data: columnPreference })
    } catch (error) {
      // If an error occurs, catch the error and return an error response
      return catchError('column-preference.get', error, req, res)
    }
  }
}

module.exports = new ColumnPreference()
