const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const { notificationGroups, notificationMessageKeys } = require('../../data')
const UserModel = require('../user/model')
const UserPreference = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, unique: true },
  aNotificationPreference: [{
    sName: { type: String, require: true },
    sKey: { type: String, enum: notificationMessageKeys }, // references eKey from notificationMessages
    sGroup: { type: String, enum: notificationGroups }, // references eGroup from notificationMessages
    bEnabled: { type: Boolean, default: false }
  }]
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
UserPreference.index({ iUserId: 1, 'aNotificationPreference.sKey': 1 }, { unique: true })
UserPreference.index({ iUserId: 1, 'aNotificationPreference.sGroup': 1 })

module.exports = UsersDBConnect.model('userpreferences', UserPreference)
