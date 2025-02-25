const fs = require('fs')

const { pick, catchError, readJSONFile, getPaginationValues, mongify } = require('../../helper/utilities.services')
const { messages, status } = require('../../helper/api.responses')

const NotificationMessagesModel = require('./notificationMessages.model')

class BroadcastNotification {
  /**
   * Add a new broadcast push notification message.
   * @body {*} req - The request body containing fields: 'sName', 'sHeading', 'sDescription.
   * @param {*} res - The response object to send the notification data.
   * @returns {Object} - Notification data.
   */
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sHeading', 'sDescription'])

      const data = await NotificationMessagesModel.create({ ...req.body, eGroup: 'BROADCAST', eKey: 'BROADCAST', eType: 'BROADCAST', bSent: false })

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cBroadcastNotification), data })
    } catch (error) {
      return catchError('BroadcastNotification.add', error, req, res)
    }
  }

  /**
   * Update broadcast push notification message.
   * @body {*} req - The request body containing fields: 'sName', 'sHeading', 'sDescription'.
   * @param {*} res - The response object to send the notification data.
   * @returns {Object} - Notification data.
   */
  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sHeading', 'sDescription', 'bEnableNotifications'])

      const data = await NotificationMessagesModel.findOneAndUpdate({ _id: req.params.id, eType: 'BROADCAST' }, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBroadcastNotification) })

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cBroadcastNotification), data })
    } catch (error) {
      return catchError('BroadcastNotification.update', error, req, res)
    }
  }

  async broadcastNotificationList(req, res) {
    try {
      const { start = 0, limit = 10, search } = getPaginationValues(req.query)

      const query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const [data, count] = await Promise.all([
        NotificationMessagesModel.find({ eType: 'BROADCAST', ...query }).sort({ dCreatedAt: 1 }).skip(start).limit(limit).lean(),
        NotificationMessagesModel.countDocuments({ eType: 'BROADCAST', ...query }).lean()
      ])
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cBroadcastNotification), data: { total: count, data } })
    } catch (error) {
      return catchError('BroadcastNotification.broadcastNotificationList', error, req, res)
    }
  }

  async getBroadcastNotification(req, res) {
    try {
      const data = await NotificationMessagesModel.findOne({ _id: req.params.id, eType: 'BROADCAST' }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBroadcastNotification) })

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cBroadcastNotification), data })
    } catch (error) {
      return catchError('BroadcastNotification.getBroadcastNotification', error, req, res)
    }
  }

  async deleteBroadcastNotifications(req, res) {
    try {
      const data = await NotificationMessagesModel.findOneAndDelete({ _id: req.params.id, eType: 'BROADCAST' }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBroadcastNotification) })

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cBroadcastNotification) })
    } catch (error) {
      return catchError('BroadcastNotification.deleteBroadcastNotifications', error, req, res)
    }
  }

  async deleteMultipleBroadcastNotifications(req, res) {
    try {
      const aId = (req?.body?.aId || []).map(e => mongify(e))
      if (aId.length) {
        await NotificationMessagesModel.deleteMany({ _id: { $in: aId }, eType: 'BROADCAST' }).lean()
      }
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cBroadcastNotification) })
    } catch (error) {
      return catchError('BroadcastNotification.deleteMultipleBroadcastNotifications', error, req, res)
    }
  }

  async deleteAllBroadcastNotifications(req, res) {
    try {
      await NotificationMessagesModel.deleteMany({ eType: 'BROADCAST' }).lean()
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cBroadcastNotification) })
    } catch (error) {
      return catchError('BroadcastNotification.deleteBroadcastNotifications', error, req, res)
    }
  }

  async importBroadcastNotifications(req, res) {
    let tempFilePath
    try {
      const buffer = req.files.file.data

      const tempDir = './temp'
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir)
      }
      tempFilePath = `${tempDir}/${new Date().getTime()}_${req.files.file.name}`
      fs.writeFileSync(tempFilePath, buffer)

      const records = await readJSONFile(tempFilePath)
      const newRecords = []

      for (const data of records) {
        if (data?.sName && data?.sHeading && data?.sDescription) {
          newRecords.push({
            sName: data.sName,
            sHeading: data.sHeading,
            sDescription: data.sDescription,
            eGroup: 'BROADCAST',
            eKey: 'BROADCAST',
            eType: 'BROADCAST',
            bSent: false
          })
        }
      }

      if (newRecords.length) {
        const bulkOperations = newRecords.map((record) => ({
          insertOne: { document: record }
        }))

        await NotificationMessagesModel.bulkWrite(bulkOperations)
      }

      return res.status(status.OK).jsonp({
        status: status.OK,
        message: messages[req.userLanguage].add_success.replace(
          '##',
          messages[req.userLanguage].cBroadcastNotification
        )
      })
    } catch (error) {
      console.log('error', error)
      return catchError(
        'BroadcastNotification.importBroadcastNotifications',
        error,
        req,
        res
      )
    } finally {
      if (tempFilePath) {
        fs.unlinkSync(tempFilePath)
      }
    }
  }
}

module.exports = new BroadcastNotification()
