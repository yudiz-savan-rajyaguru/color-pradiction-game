const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { NotificationsDBConnect } = require('../../../database/mongoose')
const data = require('../../../data')
const NotificationModel = require('../model')

const NotificationStatistic = new Schema({
  iNotificationId: { type: Schema.Types.ObjectId, ref: NotificationModel, required: true },
  iUserId: { type: Schema.Types.ObjectId, required: true }, // ref : UserModel
  eStatus: { type: String, enum: data.status, default: 'Y' }, // Y = Active, N = Inactive
  sExternalId: { type: String },
  ePlatform: { type: String, enum: data.platform, default: 'O' }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

NotificationStatistic.index({ iNotificationId: 1 })
NotificationStatistic.index({ eStatus: 1 })

module.exports = NotificationsDBConnect.model('NotificationStatistic', NotificationStatistic)
