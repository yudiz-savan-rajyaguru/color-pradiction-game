const {
  removenull, catchError, pick
} = require('../../helper/utilities.services')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const NotificationMessageModel = require('../notification/notificationMessages.model')
const UsersModel = require('../user/model')

const { updateGroupPreferences, updateKeyPreferences, createUserPrefIfNotExist } = require('./common')
const NotificationPreferenceModel = require('./model')
// const { updateUser } = require('./grpc/clientServices')

class UserPreference {
  /**
   * Update user's notification preferences based on the provided key or group.
   * @param {*} req - The request object containing the user's ID and preference details.
   * @param {*} res - The response object used to send the HTTP response.
   */
  async updateUserPreference(req, res) {
    try {
      // Extract relevant fields from the request body and remove null/undefined values
      req.body = pick(req.body, ['sKey', 'bEnabled', 'sGroup'])
      removenull(req.body)
      const { sKey, bEnabled, sGroup } = req.body

      // Fetch the user's push tokens from the database
      const aUserTokens = await UsersModel.findOne({ _id: req.user._id }, { aPushTokens: 1, _id: 0 })
      const aPushToken = aUserTokens?.aPushTokens

      // Update the user's preference based on the provided key or group
      if (sKey) {
        await updateKeyPreferences(sKey, aPushToken, bEnabled, req.user._id)
      } else if (sGroup) {
        await updateGroupPreferences(sGroup, aPushToken, bEnabled, req.user._id)
      } else {
        // If neither key nor group is provided, return a BadRequest response
        return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].userPreference) })
      }

      // Return a success response if the preference update is successful
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].userPreference) })
    } catch (error) {
      // Catch and handle any errors that occur during the preference update process
      return catchError('userPreference.updateUserPreference', error, req, res)
    }
  }

  /**
 * Get user's notification preferences along with available notification messages.
 * @param {*} req - The request object containing the user's ID.
 * @param {*} res - The response object used to send the HTTP response.
 */
  async getUserPreference(req, res) {
    try {
      // Retrieve user's notification preferences and available notification messages
      let [userPreferences, notificationMessages] = await Promise.all([
        NotificationPreferenceModel.findOne({ iUserId: req.user._id }).lean(),
        NotificationMessageModel.find({}, { _id: 0, bEnableNotifications: 1, sHeading: 1, sDescription: 1, ePlatform: 1, eKey: 1, eGroup: 1, sName: 1, nPosition: 1 }).lean()
      ])

      // Map notification messages to key-value pairs for easier access
      notificationMessages = notificationMessages.reduce((acc, notificationMessage) => {
        acc[notificationMessage?.eKey] = notificationMessage?.bEnableNotifications
        return acc
      }, {})

      if (!userPreferences) userPreferences = await createUserPrefIfNotExist(req.user._id)
      // Filter user preferences based on available notification messages
      userPreferences = userPreferences.aNotificationPreference.filter(userPreference => notificationMessages[userPreference?.sKey])

      const aData = []
      let nPosition = 0

      // Organize user preferences into groups with enabled status and notifications
      for (const userPreference of userPreferences) {
        const oData = aData[aData.findIndex(oData => oData?.sGroup === userPreference.sGroup)]
        if (oData) {
          oData.aNotificatifications.push({ sKey: userPreference.sKey, sName: userPreference.sName, bEnabled: userPreference.bEnabled })
          oData.bEnabled = oData.bEnabled ? oData.bEnabled : userPreference.bEnabled
        } else aData.push({ sGroup: userPreference.sGroup, bEnabled: userPreference.bEnabled, nPosition: ++nPosition, aNotificatifications: [{ sKey: userPreference.sKey, sName: userPreference.sName, bEnabled: userPreference.bEnabled }] })
      }

      // Send the organized data as the response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].userPreference), data: aData })
    } catch (error) {
      // Catch and handle any errors that occur during the process
      return catchError('userPreference.getUserPreference', error, req, res)
    }
  }
}

module.exports = new UserPreference()
