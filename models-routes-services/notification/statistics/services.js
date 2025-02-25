// @ts-check
const NotificationModel = require('../model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, getPaginationValues, ObjectId } = require('../../../helper/utilities.services')
const NotificationStatisticModel = require('../statistics/model')
const { findUsers } = require('../../user/auth/services')
const { platform } = require('../../../data')

class NotificationStatistic {
  async getV2(req, res) {
    try {
      const { datefrom, dateto } = req.query

      const { iUserId } = req.query
      let { start, limit, sorting } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      const notification = await NotificationModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      if (!notification) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })

      let query = { iNotificationId: ObjectId(req.params.id) }
      query = iUserId ? { ...query, iUserId: ObjectId(iUserId) } : query

      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      if (req.query.ePlatform && platform.includes(req.query.ePlatform)) query = { ...query, ePlatform: req.query.ePlatform.toUpperCase() }

      const total = await NotificationStatisticModel.countDocuments(query)
      const notificationStats = await NotificationStatisticModel.find(query).sort(sorting).skip(start).limit(limit).lean()

      const aUserIds = notificationStats.map(notification => notification.iUserId)
      const aUserData = await findUsers({ _id: { $in: aUserIds } }, { _id: 1, sUsername: 1 }, {})

      const aNotificationData = notificationStats.map(aNotification => {
        const user = aUserData.find(u => u._id.toString() === aNotification.iUserId.toString())
        return { ...aNotification, oUser: user }
      })

      const nTotalNotificationClick = await NotificationStatisticModel.countDocuments({ iNotificationId: notification._id })

      const data = { total, data: aNotificationData, nTotalNotificationClick }
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cNotificationStatics), data })
    } catch (error) {
      return catchError('NotificationStatistic.getV2', error, req, res)
    }
  }

  async log(req, res) {
    try {
      const { _id: iUserId } = req.user

      const notification = await NotificationModel.findOne({ _id: ObjectId(req.params.id) }, { _id: 1 }).lean()
      if (!notification) {
        return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cNotificationLog), data: {} })
      } else {
        const data = await NotificationStatisticModel.create(
          {
            iUserId,
            iNotificationId: req.params.id,
            ePlatform: platform.includes(req.header('Platform')) ? req.header('Platform') : 'O'
          }
        )
        return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cNotificationLog), data })
      }
    } catch (error) {
      return catchError('NotificationStatistic.log', error, req, res)
    }
  }
}

module.exports = new NotificationStatistic()
