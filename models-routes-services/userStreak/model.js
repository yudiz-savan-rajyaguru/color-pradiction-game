const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const UserStreak = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  nDay: { type: Number },
  aMaximumStreakReset: [{
    nDay: { type: Number },
    dResetDate: { type: Date }
  }]
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

UserStreak.index({ iUserId: 1 })

const UserStreakModel = UsersDBConnect.model('userstreak', UserStreak)

UserStreakModel.syncIndexes().then(() => {
  console.log('User streak Model Indexes Synced')
}).catch((err) => {
  console.log('User Model Indexes Sync Error', err)
})

module.exports = UserStreakModel
