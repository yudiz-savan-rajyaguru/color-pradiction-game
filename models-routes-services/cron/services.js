const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, createResponse, ObjectId, handleCatchError } = require('../../helper/utilities.services')
const { getDataForProcessing, processPaymentByGateway, fetchTopicBaseNewsFormRss } = require('./common')
const NotificationMessagesModel = require('../notification/notificationMessages.model')
const { broadcastNotification } = require('../../helper/firebase.services')
const UserDepositModel = require('../userDeposit/model')
const PaymentOptionModel = require('../paymentOptions/model')
const SegmentModel = require('../segmentations/model')
const { processAutoSegment } = require('./common')
const { findUsers } = require('../user/auth/services')
const UserSegmentModel = require('../usersegments/model')
const SettingModel = require('../setting/model')
const UserModel = require('../user/model')
const { queuePush } = require('../../helper/redis')
class Cron {
  async processDepositPayment(req, res) {
    try {
      // Set the current time to 1 hour ago
      const dCurrentTime = new Date()
      dCurrentTime.setTime(dCurrentTime.getTime() - (60 * 60 * 1000))

      const data = await getDataForProcessing(dCurrentTime)
      if (data.length) {
        for (const deposit of data) {
          await processPaymentByGateway(deposit)
        }
      }

      return createResponse({ req, res, statusCode: status.OK, messageKey: messages.successfully, replacementKey: messages.processDepositPayment })
    } catch (error) {
      catchError('Cron.processDepositPayment', error, req, res)
    }
  }

  async broadcastNotifications(req, res) {
    try {
      // Fetch the next unsent notification
      let notification = await NotificationMessagesModel.findOneAndUpdate(
        { bSent: false, eType: 'BROADCAST', bEnableNotifications: true },
        { bSent: true },
        { new: true, runValidators: true }
      ).sort({ dCreatedAt: 1 }).lean()

      // If no unsent notifications are found, reset all and start over
      if (!notification) {
        await NotificationMessagesModel.updateMany({ eType: 'BROADCAST', bEnableNotifications: true }, { bSent: false })

        // Fetch the first notification after reset
        notification = await NotificationMessagesModel.findOneAndUpdate(
          { bSent: false, eType: 'BROADCAST', bEnableNotifications: true },
          { bSent: true },
          { new: true, runValidators: true }
        ).sort({ dCreatedAt: 1 }).lean()
      }

      if (notification) {
        await broadcastNotification(notification)
      }
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cBroadcasted) })
    } catch (err) {
      return catchError('Cron.broadcastNotifications', err, req, res)
    }
  }

  async addAutoCancelTimeFrame(req, res) {
    try {
      const pendingDeposits = await UserDepositModel.findAll({ where: { ePaymentStatus: 'P' }, raw: true })

      for (const deposit of pendingDeposits) {
        const paymentOption = await PaymentOptionModel.findOne({ eKey: deposit?.ePaymentGateway }).lean()
        const autoCancelTimeFrame = paymentOption?.nAutoCancelTimeFrame

        if (autoCancelTimeFrame > 0) {
          const cancelLimitTime = new Date(deposit.dCreatedAt)
          cancelLimitTime.setMinutes(cancelLimitTime.getMinutes() + autoCancelTimeFrame)
          const currentDate = new Date()
          if (currentDate > cancelLimitTime) {
            await UserDepositModel.update({ ePaymentStatus: 'C', dProcessedDate: currentDate, sRemarks: messages[req.userLanguage].auto_Cancel_due_to_inactivity }, { where: { id: deposit?.id } })
          }
        }
      }
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].expired_deposit_auto_cancel })
    } catch (error) {
      return catchError('Cron.addAutoCancelTimeFrame', error, req, res)
    }
  }

  async fetchNewsLetterFromFeed(req, res) {
    try {
      fetchTopicBaseNewsFormRss()
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cRssFeed) })
    } catch (error) {
      return catchError('Cron.fetchNewsLetterFromFeed', error, req, res)
    }
  }

  async updateUsersInAutomatedSegments(req, res) {
    try {
      const currentDate = new Date()
      const aBulkUserSegmentsUpdate = []
      const aBulkSegmentsUpdate = []

      const data = await SegmentModel.aggregate([
        {
          $match: {
            bAutomated: true,
            eStatus: 'Y',
            $expr: {
              $lte: [
                {
                  $add: [
                    '$dLastCalculated',
                    {
                      $multiply: [
                        '$oFrequency.nValue',
                        {
                          $switch: {
                            branches: [
                              { case: { $eq: ['$oFrequency.nUnit', 'minutes'] }, then: 60 * 1000 },
                              { case: { $eq: ['$oFrequency.nUnit', 'hours'] }, then: 60 * 60 * 1000 },
                              { case: { $eq: ['$oFrequency.nUnit', 'days'] }, then: 24 * 60 * 60 * 1000 },
                              {
                                case: { $eq: ['$oFrequency.nUnit', 'months'] },
                                then: {
                                  $let: {
                                    vars: {
                                      daysInMonth: {
                                        $dayOfMonth: {
                                          $dateFromParts: {
                                            year: { $year: currentDate },
                                            month: { $add: [{ $month: currentDate }, '$oFrequency.nValue'] },
                                            day: 1
                                          }
                                        }
                                      }
                                    },
                                    in: { $multiply: ['$$daysInMonth', 24 * 60 * 60 * 1000] }
                                  }
                                }
                              },
                              {
                                case: { $eq: ['$oFrequency.nUnit', 'years'] },
                                then: {
                                  $let: {
                                    vars: {
                                      daysInYear: {
                                        $cond: [
                                          {
                                            $or: [
                                              { $eq: [{ $mod: [{ $year: currentDate }, 4] }, 0] },
                                              { $eq: [{ $mod: [{ $year: currentDate }, 400] }, 0] }
                                            ]
                                          },
                                          366,
                                          365
                                        ]
                                      }
                                    },
                                    in: { $multiply: ['$$daysInYear', 24 * 60 * 60 * 1000] }
                                  }
                                }
                              }
                            ],
                            default: 0
                          }
                        }
                      ]
                    }
                  ]
                },
                currentDate
              ]
            }
          }
        }
      ])

      if (!data.length) { return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cUserSegments) }) }

      for (const oSegment of data) {
        const oSegmentData = await processAutoSegment(oSegment)
        const aUserId = oSegmentData.aUserId || []
        const oSegmentDetails = oSegmentData.tempo || {}

        if (aUserId.length) {
          const userData = await findUsers({ _id: { $in: aUserId } }, { sName: 1, sUsername: 1 })
          const userMap = userData.reduce((acc, user) => {
            acc[user._id.toString()] = { sName: user.sName, sUsername: user.sUsername }
            return acc
          }, {})

          for (const userId of aUserId) {
            const userDetail = userMap[userId.toString()] || {}
            const { sUsername, sName } = userDetail

            aBulkUserSegmentsUpdate.push({
              updateOne: {
                filter: { iSegmentId: ObjectId(oSegment._id), iUserId: userId, eStatus: 'Y' },
                update: {
                  $set: {
                    iSegmentId: ObjectId(oSegment._id),
                    iUserId: userId,
                    eStatus: 'Y',
                    sName,
                    sUsername,
                    aSegmentDetails: oSegmentDetails[userId]
                  }
                },
                upsert: true
              }
            })

            // Check if the array length exceeds 5000; if so, execute the bulk write
            if (aBulkUserSegmentsUpdate.length >= 5000) {
              await executeBulkWrite(UserSegmentModel, aBulkUserSegmentsUpdate)
              aBulkUserSegmentsUpdate.splice(0, 5000)
            }
          }

          aBulkUserSegmentsUpdate.push({
            updateMany: {
              filter: { iSegmentId: ObjectId(oSegment._id), iUserId: { $nin: aUserId }, eStatus: 'Y' },
              update: { $set: { eStatus: 'N' } }
            }
          })

          aBulkSegmentsUpdate.push({
            updateOne: {
              filter: { _id: ObjectId(oSegment._id), eStatus: 'Y' },
              update: { $set: { nUsers: aUserId.length, dLastCalculated: new Date() } }
            }
          })
        } else {
          aBulkUserSegmentsUpdate.push({
            updateMany: {
              filter: { iSegmentId: ObjectId(oSegment._id), eStatus: 'Y' },
              update: { $set: { eStatus: 'N' } }
            }
          })

          aBulkSegmentsUpdate.push({
            updateOne: {
              filter: { _id: ObjectId(oSegment._id), eStatus: 'Y' },
              update: { $set: { nUsers: 0, dLastCalculated: new Date() } }
            }
          })
        }
      }

      if (aBulkUserSegmentsUpdate.length) {
        await executeBulkWrite(UserSegmentModel, aBulkUserSegmentsUpdate)
      }

      if (aBulkSegmentsUpdate.length) {
        await executeBulkWrite(SegmentModel, aBulkSegmentsUpdate)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cUserSegments) })
    } catch (error) {
      return catchError('Cron.updateUsersInAutomatedSegments', error, req, res)
    }
  }

  async processInactiveUsers(req, res) {
    try {
      const oInActiveUserConfig = await SettingModel.findOne({ sKey: 'DEACTIVATE_USERS', eStatus: 'Y' }).lean()
      if (!oInActiveUserConfig) {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csetting)
        })
      }

      const { sValue, nMax } = oInActiveUserConfig
      const nDaysThreshold = parseInt(sValue) * 24 * 60 * 60 * 1000
      const aBulkUpdateUser = []

      const cursor = UserModel.find({ eType: 'U', eStatus: 'Y', dLoginAt: { $exists: true, $ne: null, $lte: new Date(Date.now() - nDaysThreshold) } })
        .sort({ _id: -1 })
        .cursor({ batchSize: 100 }) // Reduce batch size to limit memory usage

      // Event-driven approach with 'data' and 'end' events
      cursor.on('data', async (user) => {
        try {
          aBulkUpdateUser.push({
            updateOne: {
              filter: { _id: user._id },
              update: { $set: { eStatus: 'N' } }
            }
          })

          // If inactivity charge is set, queue the charge action
          if (nMax > 0) {
            queuePush('PROCESS_INACTIVITY_CHARGES', { iUserId: user._id, nPrice: nMax, sUserName: user.sUsername, eUserType: user.eType })
          }

          // Process in smaller batches to avoid memory issues
          if (aBulkUpdateUser.length >= 100) { // Reduce the threshold to 100
            await UserModel.bulkWrite(aBulkUpdateUser, { writeConcern: { w: 'majority' }, ordered: false })
            aBulkUpdateUser.splice(0, aBulkUpdateUser.length)
          }
        } catch (error) {
          handleCatchError(error)
        }
      })

      cursor.on('end', async () => {
        try {
          if (aBulkUpdateUser.length) {
            await UserModel.bulkWrite(aBulkUpdateUser, { writeConcern: { w: 'majority' }, ordered: false })
            aBulkUpdateUser.splice(0, aBulkUpdateUser.length)
          }
        } catch (error) {
          handleCatchError(error)
        }
      })

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].deactivate_users
      })
    } catch (error) {
      return catchError('Cron.processInactiveUsers', error)
    }
  }
}

// Function to split bulk operations into chunks
async function executeBulkWrite(model, bulkOperations, batchSize = 100000) {
  for (let i = 0; i < bulkOperations.length; i += batchSize) {
    const batch = bulkOperations.slice(i, i + batchSize)
    await model.bulkWrite(batch, { ordered: false })
  }
}

module.exports = new Cron()
