// @ts-check
const admin = require('firebase-admin')
const FIREBASE_PRIVATE_KEY = require('../helper/third-party-cred/firebase-sdk.json')
const { CUSTOM_DEEP_LINK_ENABLED, DEEP_LINK_URL, FRONTEND_HOST_URL } = require('../config/defaultConfig')
const DeepLinksModel = require('../models-routes-services/customDeepLink/model')
const enums = require('../data')

admin.initializeApp({ credential: admin.credential.cert(FIREBASE_PRIVATE_KEY) })

const adminMessage = admin.messaging()

/**
 * Subscribes a user to push notifications based on their platform.
 *
 * @param {string} sPushToken - The user's push notification token.
 * @param {string} ePlatform - The user's platform ('A' for Android, 'I' for iOS, 'W' for Web).
 * @returns {Promise<void>} A Promise that resolves when the user is subscribed to the appropriate topic.
 */
const subscribeUser = async (sPushToken, ePlatform) => {
  // Subscribe the user to the 'All' topic
  await adminMessage.subscribeToTopic(sPushToken, 'All')

  // Subscribe the user to a platform-specific topic based on their platform
  if (ePlatform === 'A') {
    adminMessage.subscribeToTopic(sPushToken, 'Android')
  } else if (ePlatform === 'I') {
    adminMessage.subscribeToTopic(sPushToken, 'IOS')
  } else if (ePlatform === 'W') {
    adminMessage.subscribeToTopic(sPushToken, 'Web')
  }
}

/**
 * Subscribes a user to specific topic notifications based on their platform.
 *
 * @param {string} sPushToken - The user's push notification token.
 * @param {string} ePlatform - The user's platform ('A' for Android, 'I' for iOS, 'W' for Web).
 * @returns {Promise<void>} A Promise that resolves when the user is subscribed to the specified topics.
 */
const subscribeUserToTopicNotification = async (sPushToken, ePlatform) => {
  // Subscribe the user to the 'LINEUPS' topic
  await adminMessage.subscribeToTopic(sPushToken, 'LINEUPS') // Make sure it references the eKey field of notificationMessages

  // Subscribe the user to the 'MATCH_START' topic
  await adminMessage.subscribeToTopic(sPushToken, 'MATCH_START')
}

/**
 * Sends a push notification to a specific topic with the given title and body.
 *
 * @param {string} topic - The topic to which the notification is sent.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body/content of the notification.
 * @param {string} [sPushType='Home'] - The type of push notification (default is 'Home').
 * @param {string} [id=''] - The ID associated with the notification (optional).
 * @param {string} [matchCategory=''] - The category of the match (optional).
 * @returns {Promise<string>} A Promise that resolves with the message ID when the notification is sent successfully.
 */
const pushTopicNotification = (topic, title, body, sPushType = 'Home', id = '', matchCategory = '') => {
  // Prepare the message to be sent
  const message = {
    notification: {
      title,
      body
    },
    topic,
    android: {
      priority: 'high',
      notification: {
        priority: 'max',
        visibility: 'public',
        defaultSound: true,
        channelId: 'default',
        notification_priority: 'PRIORITY_MAX'
      }
    },
    data: {
      title,
      message: body,
      sPushType,
      isScheduled: 'true'
    }
  }

  // Add optional data fields to the message if provided
  if (id) message.data.iMatchId = id.toString()
  if (matchCategory) message.data.matchCategory = matchCategory

  // Send the notification and return the message ID
  return adminMessage.send(message)
}

/**
 * Sends a push notification to a specific device/token with the given title and body.
 *
 * @param {string} subscribedToken - The token of the device to which the notification is sent.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body/content of the notification.
 * @param {string} [sPushType='Home'] - The type of push notification (default is 'Home').
 * @param {string} [id=''] - The ID associated with the notification (optional).
 * @param {string} [matchCategory=''] - The category of the match (optional).
 * @param {string} [docType=''] - The type of document (optional).
 * @returns {Promise<string>} A Promise that resolves with the message ID when the notification is sent successfully.
 */
const pushNotification = (subscribedToken, title, body, sPushType = 'Home', id = '', matchCategory = '', docType = '') => {
  // Prepare the message to be sent
  const message = {
    token: subscribedToken,
    notification: {
      title,
      body
    },
    data: {
      title,
      body,
      sPushType
    },
    android: {
      priority: 'high',
      notification: {
        priority: 'max',
        visibility: 'public',
        defaultSound: true,
        channelId: 'default', // Make sure this channel is created in your Android app
        notification_priority: 'PRIORITY_MAX'
      }
    },
    webpush: {
      headers: {
        Urgency: 'high'
      },
      notification: {
        body,
        requireInteraction: 'true'
      }
    }
  }

  // Add optional data fields to the message if provided
  if (matchCategory) message.data.matchCategory = matchCategory
  if (id) message.data.iMatchId = id.toString()
  if (docType) message.data.docType = docType
  // Send the notification and return the message ID
  return adminMessage.send(message)
}

/**
 * Generates a dynamic link based on the provided parameters.
 *
 * @param {string} sType - The type of link ('share' for sharing, otherwise for contests).
 * @param {string} sCode - The code associated with the link.
 * @returns {Promise<string>} A Promise that resolves with the generated dynamic link.
 */
const genDynamicLinkV2 = async (sType, sCode) => {
  let link = ''
  if (CUSTOM_DEEP_LINK_ENABLED === '1') {
    switch (sType) {
      case enums?.eLinkType?.map?.REFER:
        {
          const sShareLink = `${DEEP_LINK_URL}?refercode=${sCode}`
          const sDeepLink = `${DEEP_LINK_URL}/${sCode}`
          const sWebLink = `${FRONTEND_HOST_URL}?type=deeplink&refercode=${sCode}`
          await DeepLinksModel.create({
            sLink: sShareLink,
            sDeepLink,
            sWebLink: sWebLink,
            sCode,
            eType: enums?.eLinkType?.map?.REFER
          })
          link = sDeepLink
        }
        break
      case enums?.eLinkType?.map?.EVENT_SHARE:
        {
          const sDeepLink = `${DEEP_LINK_URL}/${sCode}`
          const sShareLink = `${DEEP_LINK_URL}?eventid=${sCode}`
          const sWebLink = `${FRONTEND_HOST_URL}?type=deeplink&eventid=${sCode}`
          await DeepLinksModel.create({
            sLink: sShareLink,
            sDeepLink,
            iEventId: sCode,
            sWebLink: sWebLink,
            sCode,
            eType: enums?.eLinkType?.map?.EVENT_SHARE
          })
          link = sDeepLink
        }
        break
      default:
        console.log('Invalid sType')
        break
    }
  }
  return link
}

/**
 * Sends a notification to multiple devices using Firebase Cloud Messaging.
 *
 * @param {Array<string>} tokens - An array of device tokens to which the notification is sent.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body/content of the notification.
 * @param {string} [sPushType='HOME'] - The type of push notification (default is 'HOME').
 * @returns {Promise<boolean>} A Promise that resolves to true if the notification is sent successfully to at least one device.
 * @throws {Error} Throws an error if there's a problem sending the notification.
 */
const sendMultiCastNotification = async (tokens, title, body, sPushType = 'HOME') => {
  try {
    let isSuccess = false

    // Prepare the notification message
    const message = {
      notification: {
        title,
        body
      },
      data: {
        title,
        body,
        sPushType
      },
      tokens
    }

    // Add optional data fields to the message if provided
    // if (matchCategory) message.data.matchCategory = matchCategory
    // if (id) message.data.iMatchId = id
    // if (sLeagueId) message.data.sLeagueId = sLeagueId

    // Send the notification using Firebase Cloud Messaging
    const data = await adminMessage.sendEachForMulticast(message)

    // Check if the notification was successfully sent to at least one device
    if (data.successCount) {
      isSuccess = true
    }

    // Return true if the notification is sent successfully to at least one device
    return isSuccess
  } catch (error) {
    // Throw an error if there's a problem sending the notification
    throw Error(error)
  }
}

/**
 * Unsubscribes users with the specified push tokens from all notification topics.
 *
 * @param {string|string[]} sPushToken - The push token or an array of push tokens to unsubscribe.
 * @returns {Promise<void>} A Promise that resolves when the users are unsubscribed from all topics.
 * @throws {Error} Throws an error if there's a problem unsubscribing users.
 */
const unsubscribeUsers = async (sPushToken) => {
  try {
    // Ensure sPushToken is an array
    if (!Array.isArray(sPushToken)) {
      sPushToken = [sPushToken]
    }

    // If there are tokens to unsubscribe
    if (sPushToken.length > 0) {
      // Unsubscribe from all topics using Promise.all to await all operations
      await Promise.all([
        adminMessage.unsubscribeFromTopic(sPushToken, 'All'),
        adminMessage.unsubscribeFromTopic(sPushToken, 'Web'),
        adminMessage.unsubscribeFromTopic(sPushToken, 'IOS'),
        adminMessage.unsubscribeFromTopic(sPushToken, 'Android')
      ])
    }
  } catch (error) {
    // Throw an error if there's a problem unsubscribing users
    throw Error(error)
  }
}

/**
 * Subscribes a user with the specified push token to all notification topics.
 *
 * @param {string|string[]} sPushToken - The push token or an array of push tokens to subscribe.
 * @returns {Promise<void>} A Promise that resolves when the user is subscribed to all topics.
 * @throws {Error} Throws an error if there's a problem subscribing the user.
 */
const subscribeUserToTopics = async (sPushToken) => {
  try {
    // Ensure sPushToken is an array
    if (!Array.isArray(sPushToken)) {
      sPushToken = [sPushToken]
    }

    // If there are tokens to subscribe
    if (sPushToken.length > 0) {
      // Subscribe to all topics using Promise.all to await all operations
      await Promise.all([
        adminMessage.subscribeToTopic(sPushToken, 'All'),
        adminMessage.subscribeToTopic(sPushToken, 'Web'),
        adminMessage.subscribeToTopic(sPushToken, 'IOS'),
        adminMessage.subscribeToTopic(sPushToken, 'Android')
      ])
    }
  } catch (error) {
    // Throw an error if there's a problem subscribing the user
    throw Error(error)
  }
}

/**
 * Unsubscribes a user with the specified push token from a specific notification topic.
 *
 * @param {string|string[]} sPushToken - The push token or an array of push tokens to unsubscribe.
 * @param {string} sTopic - The topic from which the user is unsubscribed.
 * @returns {Promise<void>} A Promise that resolves when the user is unsubscribed from the topic.
 * @throws {Error} Throws an error if there's a problem unsubscribing the user from the topic.
 */
const unsubscribeTopicUser = async (sPushToken, sTopic) => {
  try {
    // Ensure sPushToken is an array
    if (!Array.isArray(sPushToken)) {
      sPushToken = [sPushToken]
    }

    // If there are tokens to unsubscribe
    if (sPushToken.length > 0) {
      // Unsubscribe from the specified topic using Firebase Cloud Messaging
      await adminMessage.unsubscribeFromTopic(sPushToken, sTopic)
    }
  } catch (error) {
    // Throw an error if there's a problem unsubscribing the user from the topic
    throw Error(error)
  }
}

/**
 * Subscribes a user with the specified push token to a specific notification topic.
 *
 * @param {string|string[]} sPushToken - The push token or an array of push tokens to subscribe.
 * @param {string} sTopic - The topic to which the user is subscribed.
 * @returns {Promise<void>} A Promise that resolves when the user is subscribed to the topic.
 * @throws {Error} Throws an error if there's a problem subscribing the user to the topic.
 */
const subscribeTopicUser = async (sPushToken, sTopic) => {
  try {
    // Ensure sPushToken is an array
    if (!Array.isArray(sPushToken)) {
      sPushToken = [sPushToken]
    }

    // If there are tokens to subscribe
    if (sPushToken.length > 0) {
      // Subscribe to the specified topic using Firebase Cloud Messaging
      await adminMessage.subscribeToTopic(sPushToken, sTopic)
    }
  } catch (error) {
    // Throw an error if there's a problem subscribing the user to the topic
    throw Error(error)
  }
}

const broadcastNotification = async (notification, topic = 'All') => {
  try {
    const { sHeading, sDescription } = notification
    const message = {
      notification: {
        title: sHeading,
        body: sDescription
      },
      topic,
      data: {
        title: sHeading,
        message: sDescription,
        isScheduled: 'true'
      }
    }
    return adminMessage.send(message)
  } catch (error) {
    throw new Error(error)
  }
}

module.exports = {
  subscribeUser,
  pushTopicNotification,
  pushNotification,
  genDynamicLinkV2,
  sendMultiCastNotification,
  unsubscribeUsers,
  unsubscribeTopicUser,
  subscribeTopicUser,
  subscribeUserToTopicNotification,
  subscribeUserToTopics,
  broadcastNotification
}
