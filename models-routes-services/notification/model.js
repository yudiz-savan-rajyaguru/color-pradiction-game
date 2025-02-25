const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { NotificationsDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const NotificationTypesModel = require('../notification/notificationtypes.model')
const AdminModel = require('../admin/model')
const UserModel = require('../user/model')
const Notifications = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  sTitle: { type: String },
  sMessage: { type: String },
  eStatus: { type: Number, enum: data.notificationStatus, default: 0 },
  iType: { type: Schema.Types.ObjectId, ref: NotificationTypesModel },
  dExpTime: { type: Date },
  aReadIds: { type: [Schema.Types.ObjectId], ref: UserModel, default: [] },
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel }, // removing required true from here as we are sending in app notifications
  iEventId: { type: Schema.Types.ObjectId },
  bInAppNotification: { type: Schema.Types.Boolean, default: false },
  sExternalId: { type: String },
  eCategory: { type: String, enum: data.eCategory, default: 'CRICKET' },
  iTransactionId: { type: String },
  eRedirection: { type: String, enum: data.redirection, default: 'HOME' },
  bRedirect: { type: Boolean, default: false },
  bForStatistics: { type: Boolean, default: false },
  sPushType: { type: String, default: 'default' }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Notifications.virtual('oAdmin', {
  ref: AdminModel,
  localField: 'iAdminId',
  foreignField: '_id',
  justOne: true
})

Notifications.index({ iUserId: 1, iType: 1, dExpTime: 1 })
const NotificationsModel = NotificationsDBConnect.model('notifications', Notifications)

NotificationsModel.syncIndexes().then(() => {
  console.log('Notifications Model Indexes Synced')
}).catch((err) => {
  console.log('Notifications Model Indexes Sync Error', err)
})

module.exports = NotificationsModel
