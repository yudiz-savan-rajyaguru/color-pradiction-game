const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { eThreadStatus } = require('../../data')
const { UsersDBConnect } = require('../../database/mongoose')

const UserModel = require('../user/model')
const AdminModel = require('../admin/model')

const Threads = new mongoose.Schema({
  iUserId: { // ID of the user who initiated the support ticket
    type: ObjectId,
    ref: UserModel,
    required: true
  },
  iAdminId: { // ID of the admin assigned or pick this thread
    type: ObjectId,
    ref: AdminModel,
    default: null
  },
  eThreadStatus: { // Status of the thread: Active, Closed
    type: String,
    enum: eThreadStatus,
    default: 'A'
  },
  bIsRead: {
    type: Boolean,
    default: false
  },
  dLastMsgAt: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Threads.index({ iUserId: 1 })

Threads.virtual('oUser', {
  ref: UserModel,
  localField: 'iUserId',
  foreignField: '_id',
  justOne: true
})

const ThreadsModel = UsersDBConnect.model('Thread', Threads)

module.exports = ThreadsModel
