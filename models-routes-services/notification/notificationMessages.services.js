// @ts-check
const NotificationMessagesModel = require('../notification/notificationMessages.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick } = require('../../helper/utilities.services')
const { queuePush } = require('../../helper/redis')

class NotificationMessages {
/**
 * Update a push notification message by ID.
 * @param {*} id - The ID of the notification message.
 * @body {*} req - The request body containing fields to update: 'sHeading', 'sDescription', 'ePlatform', 'bEnableNotifications', 'eGroup'.
 * @param {*} res - The response object to send the notification data.
 * @returns {Object} - Notification data.
 */
  async updateNotificationMessage(req, res) {
    try {
      // Extract 'ePlatform' from request body
      const { ePlatform } = req.body

      // Pick only allowed fields from request body
      req.body = pick(req.body, ['sHeading', 'sDescription', 'ePlatform', 'bEnableNotifications', 'eGroup', 'sParameterDescription'])

      // Update the notification message by ID, convert 'ePlatform' to uppercase, and return the updated data
      const data = await NotificationMessagesModel.findOneAndUpdate(
        { _id: req.params.id },
        { ...req.body, ePlatform: ePlatform.charAt(0).toUpperCase() + ePlatform.substring(1).toLowerCase() },
        { new: true, runValidators: true }
      ).lean()

      // If the data doesn't exist, return a 404 Not Found response
      if (!data) {
        return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cnotificaiton) })
      }

      // Return the updated notification data in a 200 OK response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.updateNotificationMessage', error, req, res)
    }
  }

  /**
 * Add a new push notification message type.
 * @body {*} req - The request body containing fields: 'sName', 'eKey', 'eGroup', 'bEnableNotifications'.
 * @param {*} res - The response object to send the notification data.
 * @returns {Object} - Notification data.
 * Also, while adding a notification message, add it in seeders. This is used later in adding push notification preferences for users.
 */
  async addNotificationMessage(req, res) {
    try {
      // Pick only allowed fields from request body
      req.body = pick(req.body, ['sName', 'sHeading', 'sDescription', 'ePlatform', 'eKey', 'eGroup', 'bEnableNotifications'])

      // Create a new notification message with the provided data
      const data = await NotificationMessagesModel.create({ ...req.body })

      // Queue a background task to add the new key in all user preferences
      queuePush('userPreference:Add', { sName: req.body.sName, sKey: req.body.eKey, sGroup: req.body.eGroup })

      // Return a success response with the added notification data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cNotificationMessages), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.addNotificationMessage', error, req, res)
    }
  }

  /**
 * Get all notification message data.
 * @param {*} req - The request object (unused).
 * @param {*} res - The response object to send the notification message data.
 * @returns {Object} - All data from the NotificationMessages model.
 */
  async NotificationMessageList(req, res) {
    try {
      // Retrieve all data from the NotificationMessages model
      const data = await NotificationMessagesModel.find({}).lean()

      // Return a success response with the retrieved data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cNotificationMessages), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.NotificationMessageList', error, req, res)
    }
  }

  /**
 * Get details of a single notification message.
 * @param {*} req - The request object containing the notification message ID.
 * @param {*} res - The response object to send the notification message details.
 * @returns {Object} - The details of the requested notification message.
 */
  async NotificationMessageDetails(req, res) {
    try {
      // Find the notification message by ID
      const data = await NotificationMessagesModel.findOne({ _id: req.params.id }).lean()

      // If the notification message is not found, return a not found response
      if (!data) {
        return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cnotificaiton), data })
      }

      // Return a success response with the notification message details
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cNotificationMessages), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.NotificationMessageDetails', error, req, res)
    }
  }
}

module.exports = new NotificationMessages()
