const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { NotificationsDBConnect } = require('../../database/mongoose')
const { notificationMessageKeys, notificationPlatform, notificationGroups, notificationMessageTypes } = require('../../data')

const NotificationMessages = new Schema({
  sName: { type: String, require: true },
  sHeading: { type: String, require: true },
  sDescription: { type: String, require: true },
  ePlatform: { type: String, enum: notificationPlatform, default: 'All' },
  eKey: { type: String, enum: notificationMessageKeys, default: 'PLAY_RETURN' },
  eGroup: { type: String, enum: notificationGroups },
  bEnableNotifications: { type: Boolean, default: true },
  sExternalId: { type: String },
  nPosition: { type: Number, default: 1 },
  sParameterDescription: { type: String },
  eType: { type: String, enum: notificationMessageTypes },
  bSent: { type: Boolean }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

NotificationMessages.index({ eKey: 1 })
NotificationMessages.index({ eType: 1, bSent: 1 })

const NotificationMessagesModel = NotificationsDBConnect.model('notificationmessages', NotificationMessages)

NotificationMessagesModel.syncIndexes().then(() => {
  console.log('NotificationMessagesModel Indexes Synced')
}).catch((err) => {
  console.log('NotificationMessagesModel Indexes Sync Error', err)
})

module.exports = NotificationMessagesModel
