const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../database/mongoose')
const { notificationGroups } = require('../../data')

const PushNotificationTypes = new Schema({
  sName: { type: String },
  sGroup: { type: String, enum: notificationGroups, required: true },
  sKey: { type: String, unique: true, required: true },
  eStatus: { type: String, enum: ['Y', 'N'], default: 'Y' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PushNotificationTypes.index({ eStatus: 1 })
module.exports = AdminsDBConnect.model('pushnotificationtypes', PushNotificationTypes)
