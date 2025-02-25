const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { eMessgeUserType } = require('../../data')
const { UsersDBConnect } = require('../../database/mongoose')

const ThreadsModel = require('../supportChat/threads.model')
const AdminModel = require('../admin/model')
const UserModel = require('../user/model')
const Messages = new mongoose.Schema({
  iThreadId: { // Reference to the associated thread
    type: ObjectId,
    ref: ThreadsModel,
    required: true
  },
  iUserId: { // ID of the person sending the message (could be user or admin)
    type: ObjectId,
    refPath: UserModel,
    required: true
  },
  iAdminId: { // ID of the admin sending the message
    type: ObjectId,
    ref: AdminModel
  },
  eUserType: { // Indicates whether the sender is a User or Admin
    type: String,
    enum: eMessgeUserType
  },
  sMessage: {
    type: String,
    required: true
  },
  dSentAt: {
    type: Date,
    default: Date.now
  },
  bIsRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Messages.index({ iUserId: 1 })
Messages.index({ iThreadId: 1 })
Messages.virtual('oAdmin', {
  ref: AdminModel,
  localField: 'iAdminId',
  foreignField: '_id',
  justOne: true
})

const MessagesModel = UsersDBConnect.model('messages', Messages)

MessagesModel.syncIndexes().then(() => {
  console.log('messages Model Indexes Synced')
}).catch((err) => {
  console.log('messages Model Indexes Sync Error', err)
})

module.exports = MessagesModel
