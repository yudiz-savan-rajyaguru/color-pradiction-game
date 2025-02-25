const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../database/mongoose')

const UserModel = require('./model')

const UserConcent = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  iPolicyId: { type: Schema.Types.ObjectId },
  sIp: { type: String, required: true },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now }
})
UserConcent.index({ iUserId: 1, iPolicyId: 1 }, { unique: true })

module.exports = AdminsDBConnect.model('userconcents', UserConcent)
