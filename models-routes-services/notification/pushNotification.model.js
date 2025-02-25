const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { NotificationsDBConnect } = require('../../database/mongoose')
const { notificationTopic, notificationStatus } = require('../../data')
const AdminModel = require('../admin/model')
const PushNotification = new Schema({
  sTitle: { type: String, require: true },
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  sDescription: { type: String, require: true },
  dScheduleTime: { type: Date, required: true },
  ePlatform: { type: String, enum: notificationTopic, default: 'ALL' },
  eStatus: { type: String, enum: notificationStatus, default: 1 }, // Notification Type
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PushNotification.virtual('oAdmin', {
  ref: AdminModel,
  localField: 'iAdminId',
  foreignField: '_id',
  justOne: true
})

PushNotification.index({ iAdminId: 1 })

module.exports = NotificationsDBConnect.model('pushNotifications', PushNotification)
