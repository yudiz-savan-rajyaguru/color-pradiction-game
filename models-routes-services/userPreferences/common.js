const { unsubscribeTopicUser, subscribeTopicUser, unsubscribeUsers, subscribeUserToTopics } = require('../../helper/firebase.services')
const { handleCatchError, ObjectId } = require('../../helper/utilities.services')
const NotificationMessageModel = require('../notification/notificationMessages.model')

const NotificationPreferenceModel = require('./model')
const UserPreferenceModel = require('./model')

/**
 * Update user preferences for push notifications based on a key.
 * @param {string} sKey - The key for which the preferences are being updated.
 * @param {string} aPushToken - The push token associated with the user.
 * @param {boolean} bEnabled - The new enabled status for the key.
 * @param {string} iUserId - The ID of the user for whom the preferences are being updated.
 */
async function updateKeyPreferences(sKey, aPushToken, bEnabled, iUserId) {
  try {
    // Switch based on the provided key to handle different types of preferences
    switch (sKey) {
      case 'LINEUPS':
      case 'MATCH_START':
        // For LINEUPS and MATCH_START keys, subscribe or unsubscribe the user based on the enabled status
        if (bEnabled) {
          await subscribeTopicUser(aPushToken, sKey) // Subscribe the user to the topic
        } else {
          await unsubscribeTopicUser(aPushToken, sKey) // Unsubscribe the user from the topic
        }
        break
      case 'PROMOTIONS':
        // For PROMOTIONS key, subscribe or unsubscribe the user to/from general promotions
        if (bEnabled) {
          await subscribeUserToTopics(aPushToken) // Subscribe the user to general promotions
        } else {
          await unsubscribeUsers(aPushToken) // Unsubscribe the user from all promotions
        }
        break
      default:
      // Handle other keys if needed
    }

    // Update the user's notification preferences for the specific key
    await NotificationPreferenceModel.updateOne(
      { 'aNotificationPreference.sKey': sKey, iUserId: ObjectId(iUserId) },
      { 'aNotificationPreference.$.bEnabled': bEnabled }
    )
  } catch (error) {
    // Handle any errors that occur during the update process
    handleCatchError(error)
  }
}

/**
 * Update user preferences for a group of push notifications.
 * @param {string} sGroup - The group for which the preferences are being updated.
 * @param {string} aPushToken - The push token associated with the user.
 * @param {boolean} bEnabled - The new enabled status for the group.
 * @param {string} iUserId - The ID of the user for whom the preferences are being updated.
 */
async function updateGroupPreferences(sGroup, aPushToken, bEnabled, iUserId) {
  try {
    // Switch based on the provided group to handle different types of preferences
    switch (sGroup) {
      case 'MATCH':
        // For the MATCH group, subscribe or unsubscribe the user to/from LINEUPS and MATCH_START
        if (bEnabled) {
          await Promise.all([
            subscribeTopicUser(aPushToken, 'LINEUPS'), // Subscribe the user to LINEUPS
            subscribeTopicUser(aPushToken, 'MATCH_START') // Subscribe the user to MATCH_START
          ])
        } else {
          await Promise.all([
            unsubscribeTopicUser(aPushToken, 'LINEUPS'), // Unsubscribe the user from LINEUPS
            unsubscribeTopicUser(aPushToken, 'MATCH_START') // Unsubscribe the user from MATCH_START
          ])
        }
        break
      case 'PROMOTIONS':
        // For the PROMOTIONS group, subscribe or unsubscribe the user to/from general promotions
        if (bEnabled) {
          await subscribeUserToTopics(aPushToken) // Subscribe the user to general promotions
        } else {
          await unsubscribeUsers(aPushToken) // Unsubscribe the user from all promotions
        }
        break
      default:
      // Handle other groups if needed
    }

    // Define the condition to find the user's notification preferences for the specific group
    const condition = { iUserId: ObjectId(iUserId), 'aNotificationPreference.sGroup': sGroup }

    // Define the update operation to set the 'bEnabled' field for the matched preference
    const update = { $set: { 'aNotificationPreference.$[element].bEnabled': bEnabled } }

    // Define options for the update operation, including arrayFilters to specify which array elements to update
    const options = {
      arrayFilters: [{ 'element.sGroup': sGroup }], // Filter the array elements based on the group
      new: true // Return the updated document
    }

    // Use findOneAndUpdate to update the first document that matches the condition
    await NotificationPreferenceModel.updateOne(condition, update, options)
  } catch (error) {
    // Handle any errors that occur during the update process
    handleCatchError(error)
  }
}

async function createUserPrefIfNotExist(iUserId) {
  try {
    const aNotificationMessages = await NotificationMessageModel.find({}, { _id: 0, sName: 1, eGroup: 1, eKey: 1 }).lean()

    const aMessages = aNotificationMessages.map(({ eGroup, eKey, sName }) => ({ sName, sKey: eKey, sGroup: eGroup, bEnabled: true }))

    return await UserPreferenceModel.create({ iUserId, aNotificationPreference: aMessages })
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * Creates user preferences using the provided user ID.
 * @param {string} iUserId - The ID of the user for whom preferences are being created.
 * @returns {Promise<void>} - Resolves if preferences are created successfully, otherwise throws an error.
 */
async function createUserPreferences(iUserId) {
  try {
    // Retrieve notification messages from the NotificationMessageModel
    const aNotificationMessages = await NotificationMessageModel.find({}, { _id: 0, sName: 1, eGroup: 1, eKey: 1 }).lean()

    // Modify the notification messages to include the "bEnabled" property
    const aMessages = aNotificationMessages.map(({ eGroup, eKey, sName }) => ({
      sName,
      sKey: eKey,
      sGroup: eGroup,
      bEnabled: true
    }))

    // Create user preferences in the UserPreferenceModel with the modified notification messages
    await UserPreferenceModel.create({ iUserId, aNotificationPreference: aMessages })

    // Return success message or simply resolve the promise if no response is needed
  } catch (error) {
    // Log the error and rethrow it to be handled by the calling function
    handleCatchError(error)
    throw error
  }
}

module.exports = {
  createUserPrefIfNotExist,
  updateKeyPreferences,
  updateGroupPreferences,
  createUserPreferences
}
