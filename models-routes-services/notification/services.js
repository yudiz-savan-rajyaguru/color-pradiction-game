// @ts-check
const NotificationsModel = require('../notification/model')
const NotificationTypesModel = require('../notification/notificationtypes.model')
const PushNotificationModel = require('../notification/pushNotification.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { removenull, catchError, pick, getPaginationValues2, ObjectId, mongify } = require('../../helper/utilities.services')
const { redisClient } = require('../../helper/redis')
const { ALLOWDISKUSE } = require('../../config/config')
const { findAdmins } = require('../admin/subAdmin/services')
const UsersModel = require('../user/model')
const { sendNotification, referCodeBonusNotify, registerBonusNotify, registerReferNotify, notificationScheduler, bonusCreditNotify, withdrawRejectNotify } = require('../queue/notificationQueue')
const { findSettings, updateSetting } = require('../setting/services')
const { subscribeUser } = require('../../helper/firebase.services')
const { getPushTokens } = require('../user/auth/common')

class Notifications {
  /**
 * Send a notification to a single user.
 * @param {*} req - The request object containing notification details.
 * @param {*} res - The response object.
 * @returns {Object} - The notification data.
 */
  async add(req, res) {
    try {
      // Pick relevant properties from the request body
      req.body = pick(req.body, ['iUserId', 'sTitle', 'sMessage', 'iType', 'aSegmentIds', 'sPushType'])
      // Remove nullish, not defined, or blank properties from the request body
      removenull(req.body)
      // Destructure properties from the sanitized request body
      const { iUserId, sTitle, sMessage, iType, sPushType } = req.body
      // Get the admin's ID from the request object
      const iAdminId = req.admin._id

      // Find the user's push tokens based on their ID
      const users = await UsersModel.findOne({ _id: iUserId }, { _id: 0, aPushTokens: 1 })
      // If the user doesn't exist, return a not found response
      if (!users) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cuserId) })

      // Check if the specified notification type exists
      const ntExist = await NotificationTypesModel.findOne({ _id: iType }).lean()
      // If the notification type doesn't exist, return a not found response
      if (!ntExist) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cnotificationType) })

      // Create a new notification with the provided details and the admin's ID
      const data = await NotificationsModel.create({ ...req.body, iAdminId })
      // Prepare parameters for sending push notifications
      const aPushNotificationParams = [users.aPushTokens, sTitle, sMessage, sPushType]
      // If the notification type is promotional, add 'promotions' to the parameters
      if (ntExist.sHeading === 'Promotional') aPushNotificationParams.push('promotions')
      // If the user has push tokens, send the notification
      if (users?.aPushTokens?.length) {
        await sendNotification(...aPushNotificationParams)
      }

      // Return a success response with the created notification data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.add', error, req, res)
    }
  }

  /**
 * Add an expiry time to a notification and store it in the database.
 * @param {*} req - The request object containing notification details.
 * @param {*} res - The response object.
 * @returns {Object} - The notification data.
 */
  async addTimedNotification(req, res) {
    try {
      // Extract the expiry time from the request body
      const { dExpTime } = req.body

      // Pick relevant properties from the request body
      req.body = pick(req.body, ['sTitle', 'sMessage', 'iType', 'dExpTime', 'aSegmentIds', 'eRedirection', 'iMatchId', 'eCategory', 'bRedirect'])
      // Remove nullish, not defined, or blank properties from the request body
      removenull(req.body)
      // Get the admin's ID from the request object
      const iAdminId = req.admin._id

      // Convert the expiry time to a Date object
      const dTime = new Date(dExpTime)
      // If the expiry time is in the past, return a bad request response
      if (dTime < new Date()) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].schedule_date_err })

      // Create a new timed notification with the provided details and the admin's ID
      const data = await NotificationsModel.create({ ...req.body, aReadIds: [], iAdminId, bForStatistics: true })

      // Return a success response with the created notification data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.addTimedNotification', error, req, res)
    }
  }

  /**
 * Get the count of unread notifications for a user.
 * @param {*} req - The request object containing user details.
 * @param {*} res - The response object.
 * @returns {Object} - The count of unread notifications.
 */
  async unreadCount(req, res) {
    try {
      // Perform an aggregation query to count unread notification

      // const segments = await getSegments({ eStatus: 'Y' }, { _id: 1, sName: 1 })
      // const userSegments = segments.length ? await getUserSegments({ iSegmentId: { $in: segments.map(s => ObjectId(s._id)) }, iUserId: req.user._id, eStatus: 'Y' }, { iSegmentId: 1, iUserId: 1, eStatus: 'Y' }) : []

      const count = await NotificationsModel.aggregate([
        {
          $match: {
            $or: [
              { iUserId: req.user._id },
              {
                $and: [
                  { dExpTime: { $gte: new Date() } }
                ]
              }
            ]
          }
        },
        {
          $project: {
            status: {
              $cond: [
                '$dExpTime',
                { $cond: [{ $in: [req.user._id, '$aReadIds'] }, 1, 0] },
                '$eStatus'
              ]
            }
          }
        },
        {
          $match: {
            status: 0
          }
        }
      ]).allowDiskUse(ALLOWDISKUSE).exec()

      // Return the count of unread notifications in the response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cunreadNotificationCount), data: { nUnreadCount: count.length } })
    } catch (error) {
      // If an error occurs, log it and return an error response
      catchError('Notifications.unreadCount', error, req, res)
    }
  }

  /**
 * Update and get notifications based on filters.
 * @param {*} req - The request object containing the filters.
 * @param {*} res - The response object.
 * @returns {Object} - List of selected notifications.
 */
  async list(req, res) {
    try {
      let { limit, start, aFilters } = req.query
      limit = parseInt(limit) || 20
      start = parseInt(start) || 0

      // Build the filter and match queries based on the request filters
      const filterQuery = { $or: [] }
      let matchQuery = {
        $or: [
          { iUserId: req.user._id },
          { dExpTime: { $gte: new Date() } }
        ]
      }

      if (aFilters && aFilters.length) {
        aFilters.forEach(filter => filterQuery.$or.push({ iType: ObjectId(filter) }))
        matchQuery = { ...matchQuery, $and: [{ ...filterQuery }] }
      }

      // Aggregate the notifications based on the constructed match query
      const [notifications, nCount] = await Promise.all([
        NotificationsModel.aggregate([
          {
            $match: {
              ...matchQuery
            }
          },
          {
            $project: {
              _id: 1,
              eStatus: {
                $cond: [
                  '$dExpTime',
                  { $cond: [{ $in: [req.user._id, '$aReadIds'] }, 1, 0] },
                  '$eStatus'
                ]
              },
              sTitle: 1,
              sMessage: 1,
              dExpTime: 1,
              dCreatedAt: 1,
              iUserId: 1,
              iEventId: 1,
              sPushType: 1,
              eRedirection: 1,
              bRedirect: 1
            }
          },
          { $sort: { dCreatedAt: -1 } },
          { $skip: start },
          { $limit: limit }
        ]).allowDiskUse(ALLOWDISKUSE).exec(),
        NotificationsModel.aggregate([
          {
            $match: {
              ...matchQuery
            }
          },
          { $count: 'nCount' }
        ]).allowDiskUse(ALLOWDISKUSE).exec()
      ])
      // Update the status and readIds of notifications based on conditions
      const updateIds = []
      const timeIds = []
      notifications.forEach(notification => {
        if (notification.dExpTime && !notification.eStatus) {
          timeIds.push(notification._id)
        } else if (!notification.eStatus) {
          updateIds.push(notification._id)
        }
      })
      if (updateIds.length) await NotificationsModel.updateMany({ _id: { $in: updateIds } }, { $set: { eStatus: 1 } })
      if (timeIds.length) await NotificationsModel.updateMany({ _id: { $in: timeIds } }, { $addToSet: { aReadIds: req.user._id } })

      // Return the list of notifications in the response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaitons), nCount: nCount[0]?.nCount || 0, data: notifications })
    } catch (error) {
      // If an error occurs, log it and return an error response
      catchError('notificationController.list', error, req, res)
    }
  }

  /**
 * Get all active notification types.
 * @param {*} req - The request object.
 * @param {*} res - The response object.
 * @returns {Object} - List of selected notification types.
 */
  async listTypes(req, res) {
    try {
      // Retrieve all active notification types from the database
      const data = await NotificationTypesModel.find({ eStatus: 'Y' }).lean()

      // Return the list of notification types in the response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificationTypes), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.listTypes', error, req, res)
    }
  }

  /**
 * Send topic-wise push notification.
 * @param {*} req - The request object with 'sTitle', 'sMessage', 'sTopic', 'dExpTime' properties.
 * @param {*} res - The response object to send the notification data.
 * @returns {Object} - Notification data.
 */
  async pushNotification(req, res) {
    try {
      // Pick and remove nullish properties from the request body
      req.body = pick(req.body, ['sTitle', 'sMessage', 'sTopic', 'dExpTime'])
      removenull(req.body)

      // Destructure the properties from the request body
      const { sTitle, sMessage, sTopic, dExpTime } = req.body

      // Validate the scheduled time
      const dTime = new Date(dExpTime)
      if (dTime < new Date()) {
        return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].schedule_date_err })
      }

      // Create a new push notification entry in the database
      const data = await PushNotificationModel.create({ sTitle, iAdminId: req.admin._id, sDescription: sMessage, dScheduleTime: dTime, ePlatform: sTopic })

      // Schedule the notification in Redis based on its scheduled time
      await redisClient.zadd('scheduler', Number(+dTime), JSON.stringify({ _id: data._id.toString(), sTopic, sTitle, sMessage, queueName: 'NOTIFY' }))
      // Return the notification data in the response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].schedule_success.replace('##', messages[req.userLanguage].cpushNotification), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.pushNotification', error, req, res)
    }
  }

  /**
 * Update topic-wise push notification.
 * @param {*} id - The ID of the notification to update.
 * @param {*} req - The request object with 'sTitle', 'sMessage', 'sTopic', 'dExpTime' properties.
 * @param {*} res - The response object to send the updated notification data.
 * @returns {Object} - Updated notification data.
 */
  async updatePushNotification(req, res) {
    try {
      // Pick and remove nullish properties from the request body
      req.body = pick(req.body, ['sTitle', 'sMessage', 'sTopic', 'dExpTime'])
      removenull(req.body)

      // Destructure the properties from the request body
      const { sTitle, sMessage, sTopic, dExpTime } = req.body

      // Validate the scheduled time
      const dTime = new Date(dExpTime)
      if (dTime < new Date()) {
        return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].schedule_date_err })
      }

      // Find the existing notification data by ID
      const data = await PushNotificationModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      if (!data) {
        return res.status(status.NotFound).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpushNotification) })
      }

      // Remove the existing notification from the Redis scheduler
      await redisClient.zrem('scheduler', JSON.stringify({ _id: req.params.id, sTopic: data?.ePlatform, sTitle: data?.sTitle, sMessage: data?.sDescription, queueName: 'NOTIFY' }))

      // Add the updated notification to the Redis scheduler
      await redisClient.zadd('scheduler', Number(+dTime), JSON.stringify({ _id: req.params.id.toString(), sTopic, sTitle, sMessage, queueName: 'NOTIFY' }))

      // Update the notification in the database
      const updateData = await PushNotificationModel.findOneAndUpdate({ _id: ObjectId(req.params.id) }, { sTitle, iAdminId: req.admin._id, sDescription: sMessage, dScheduleTime: dTime, ePlatform: sTopic }, { new: true }).lean()

      // Return the updated notification data in the response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpushNotification), data: updateData })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.updatePushNotification', error, req, res)
    }
  }

  /**
 * Delete topic-wise push notification.
 * @param {*} id - The ID of the notification to delete.
 * @body {*} req - The request object with 'sTitle', 'sMessage', 'sTopic' properties.
 * @param {*} res - The response object to send the deleted notification data.
 * @returns {Object} - Deleted notification data.
 */
  async deletePushNotification(req, res) {
    try {
      // Pick and remove nullish properties from the request body
      req.body = pick(req.body, ['sTitle', 'sMessage', 'sTopic'])
      removenull(req.body)

      // Destructure the properties from the request body
      const { sTitle, sMessage, sTopic } = req.body

      // Remove the notification from the Redis scheduler and update its status in the database
      await Promise.all([
        redisClient.zrem('scheduler', JSON.stringify({ _id: req.params.id.toString(), sTopic, sTitle, sMessage, queueName: 'NOTIFY' })),
        PushNotificationModel.updateOne({ _id: ObjectId(req.params.id) }, { eStatus: 0 })
      ])

      // Return a success response with the deleted notification data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cpushNotification) })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.deletePushNotification', error, req, res)
    }
  }

  /**
 * List of push notifications.
 * @param {*} id - The ID of the notification.
 * @body {*} req - The request body with 'start', 'limit', 'search', and 'sorting' properties.
 * @param {*} res - The response object to send the notification data.
 * @returns {Object} - Notification data.
 */
  async pushNotificationList(req, res) {
    try {
      // Destructure query parameters
      const { dateFrom, dateTo, platform } = req.query
      const { start, limit, search, sorting } = getPaginationValues2(req.query)

      // Construct the query based on search filters
      let query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}
      query = dateFrom && dateTo ? { ...query, dScheduleTime: { $gte: (dateFrom), $lte: (dateTo) } } : query
      query = platform ? { ...query, ePlatform: platform } : query
      query = { ...query, eStatus: 1 }

      // Fetch the notifications based on the query
      const [queryData, total] = await Promise.all([
        PushNotificationModel.find(query, {
          sTitle: 1,
          sDescription: 1,
          ePlatform: 1,
          iAdminId: 1,
          dScheduleTime: 1,
          dCreatedAt: 1,
          eStatus: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        PushNotificationModel.countDocuments(query)
      ])

      // Process the query results
      let results = queryData && Array.isArray(queryData) ? queryData : []
      const totalCount = total || 0

      // Fetch admin details for the notifications
      const aAdminIds = results.map(p => p.iAdminId)
      const aAdmin = await findAdmins({ _id: { $in: aAdminIds } }, { sName: 1, sUsername: 1, eType: 1 })

      // Map admin details to the notifications
      results = results.map(p => {
        const oAdmin = aAdmin.find(a => a._id.toString() === p.iAdminId.toString())
        return { ...p, oAdmin, iAdminId: undefined }
      })

      // Prepare the response data
      const data = [{ results, total: totalCount }]

      // Return the response with the notification data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpushNotification), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.pushNotificationList', error, req, res)
    }
  }

  /**
 * Get a single push notification by ID.
 * @param {*} id - The ID of the notification.
 * @param {*} res - The response object to send the notification data.
 * @returns {Object} - Notification data.
 */
  async getSinglePushNotification(req, res) {
    try {
      // Find the push notification by ID and status
      const oData = await PushNotificationModel.findOne({ _id: ObjectId(req.params.id), eStatus: 1 }).lean()

      // If the notification doesn't exist, return a 400 Bad Request response
      if (!oData) {
        return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpushNotification) })
      }

      // Return the notification data in a 200 OK response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpushNotification), data: oData })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.getSinglePushNotification', error, req, res)
    }
  }

  /**
 * Get a list of notifications filtered by various criteria.
 * @param {*} req - The request object containing filter parameters.
 * @param {*} res - The response object to send the notification list.
 * @returns {Object} - The list of filtered notifications.
 */
  async listNotification(req, res) {
    try {
      // Extract query parameters from the request
      const { iType, dateFrom, dateTo } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      // Construct the query based on the filters
      const iTypeFilter = iType ? { iType } : {}
      const datefilter = dateFrom && dateTo ? { $and: [{ dCreatedAt: { $gte: (dateFrom) } }, { dCreatedAt: { $lte: (dateTo) } }] } : {}

      const searchFilter = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}
      const query = { ...iTypeFilter, ...datefilter, ...searchFilter, iUserId: { $exists: false } }

      // Retrieve the list of notifications based on the constructed query
      let [results, total] = await Promise.all([
        NotificationsModel.find(query, {
          iUserId: 1,
          sTitle: 1,
          sMessage: 1,
          eStatus: 1,
          iType: 1,
          dExpTime: 1,
          aReadIds: 1,
          dCreatedAt: 1,
          iAdminId: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        NotificationsModel.countDocuments({ ...query })
      ])

      // Retrieve admin details for notifications with associated admins
      const aAdminIds = results.map(p => p.iAdminId)
      const aAdmins = await findAdmins({ _id: { $in: aAdminIds } }, { sName: 1, sUsername: 1, eType: 1 })

      // Replace admin IDs with admin details in the results
      results = results.map(p => {
        if (p.iAdminId) {
          const oAdmin = aAdmins.find(a => a._id.toString() === p.iAdminId.toString())
          return { ...p, oAdmin, iAdminId: undefined }
        }
        return p
      })

      // Prepare the response data with total count and paginated results
      const data = [{ total, results }]

      // Return the response with the notification list
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaitons), data })
    } catch (error) {
      // If an error occurs, log it and return an error response
      return catchError('Notifications.adminNotificationList', error, req, res)
    }
  }

  /**
   * Update a notification using its ID.
   * @param {*} id - The ID of the notification to update.
   * @body {*} req - The request body containing the updated notification fields.
   * @param {*} res - The response object to send the updated notification data.
   * @returns {Object} - The updated notification data.
   */
  async updateNotification(req, res) {
    try {
      // Extract and pick relevant fields from the request body
      req.body = pick(req.body, ['sTitle', 'sMessage', 'aReadIds', 'iType', 'eStatus', 'dExpTime', 'eRedirection', 'eCategory', 'bRedirect'])

      // Update the notification in the database and retrieve the updated data
      const data = await NotificationsModel.findOneAndUpdate({ _id: mongify(req.params.id) }, { ...req.body, bForStatistics: true }, { new: true, runValidators: true })

      // If the notification doesn't exist, return a not found response
      if (!data) {
        return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })
      }

      // Return a success response with the updated notification data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      // If an error occurs during the update process, log it and return an error response
      return catchError('Notifications.adminUpdateNotification', error, req, res)
    }
  }

  async deleteNotification(req, res) {
    try {
      // Find and delete the notification from the database
      const data = await NotificationsModel.findOneAndDelete({ _id: req.params.id })

      // If the notification doesn't exist, return a not found response
      if (!data) {
        return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })
      }

      // Return a success response with the result of the deletion
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cnotificaiton) })
    } catch (error) {
      // If an error occurs during the deletion process, log it and return an error response
      return catchError('Notifications.adminDeleteNotification', error, req, res)
    }
  }

  async get(req, res) {
    try {
      // Retrieve the notification data from the database using its ID
      const data = await NotificationsModel.findOne({ _id: req.params.id }, ['sTitle', 'sMessage', 'eStatus', 'iType', 'dExpTime', 'dCreatedAt', 'eCategory', 'iTransactionId', 'eRedirection', 'bRedirect'])

      // If the notification doesn't exist, return a not found response
      if (!data) {
        return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })
      }

      // Return a success response with the retrieved notification data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      // If an error occurs during the retrieval process, log it and return an error response
      return catchError('Notifications.get', error, req, res)
    }
  }

  /**
   * @returns list of automated in app notifications
   */
  async automatedList(req, res) {
    try {
      const data = await findSettings({ eType: 'NOTIFICATION' }, { sTitle: 1, sDescription: 1, sKey: 1, eStatus: 1, dUpdatedAt: 1, dCreatedAt: 1 })
      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.automatedList', error, req, res)
    }
  }

  async getAutomatedNotification(req, res) {
    try {
      // Find and retrieve the automated in-app notification details by its ID
      const data = await findSettings({ _id: req.params.id }, { sTitle: 1, sDescription: 1, sKey: 1, eStatus: 1, dUpdatedAt: 1, dCreatedAt: 1 })

      // If no data is found, return a not found response
      if (!data.length) {
        return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })
      }

      // Return a success response with the retrieved automated in-app notification details
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaiton), data: data[0] })
    } catch (error) {
      // If an error occurs during the retrieval process, log it and return an error response
      return catchError('Notifications.getAutomatedNotification', error, req, res)
    }
  }

  async updateAutomatedNotification(req, res) {
    try {
      // Extract the fields to update from the request body
      req.body = pick(req.body, ['sTitle', 'sDescription', 'sKey', 'eStatus'])

      // Update the automated notification using its ID and the extracted fields
      const data = await updateSetting({ _id: req.params.id }, { ...req.body })

      // If no data is found for the given ID, return a not found response
      if (!data) {
        return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })
      }

      // Return a success response with the updated notification data
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      // If an error occurs during the update process, log it and return an error response
      return catchError('Notifications.updateAutomatedNotification', error, req, res)
    }
  }

  async addPushToken(req, res) {
    try {
      req.body = pick(req.body, ['sPushToken'])
      const { sPushToken } = req.body
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      // Find the user by ID
      const user = await UsersModel.findById(req.user._id)
      if (!user) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].user) })
      if (sPushToken) {
        // Custom function to handle push tokens (add, update, etc.)
        await Promise.all([
          getPushTokens(user, sPushToken),
          subscribeUser(sPushToken, ePlatform),
          UsersModel.updateOne({ _id: user._id }, { $addToSet: { aPushTokens: sPushToken } })
        ])
      }
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].pushToken) })
    } catch (error) {
      console.error('Error adding push token:', error)
      return { success: false, message: 'Internal Server Error.' }
    }
  }
}

setTimeout(() => {
  referCodeBonusNotify()
  registerBonusNotify()
  registerReferNotify()
  withdrawRejectNotify()
  notificationScheduler()
  bonusCreditNotify()
}, 2000)

module.exports = new Notifications()
