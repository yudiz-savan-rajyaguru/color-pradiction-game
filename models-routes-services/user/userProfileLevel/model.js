const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { eStatus } = require('../../../data')
const { UsersDBConnect } = require('../../../database/mongoose')

const UserModel = require('../../user/model')
const ProfileLevelModel = require('../../profileLevel/model')

const UserProfileLevelSchema = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  iProfileLevelId: { type: Schema.Types.ObjectId, ref: ProfileLevelModel },
  sHexCode: { type: String, default: '' },
  nLevel: { type: Number, default: 1 },
  oCriteriaCmp: {
    nMinXP: { type: Boolean, required: true }
  },
  aLevelUpdateDetails: [{
    sType: { type: String },
    oCriteria: { type: Object },
    oFullFilledCriteria: { type: Object }
  }],
  eStatus: { type: String, enum: eStatus?.value, default: eStatus?.map?.ACTIVE }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

UserProfileLevelSchema.index({ iUserId: 1, nLevel: 1 })
UserProfileLevelSchema.virtual('oProfileLevel', {
  ref: ProfileLevelModel,
  localField: 'iProfileLevelId',
  foreignField: '_id',
  justOne: true
})
const UserProfileLevelModel = UsersDBConnect.model('userProfileLevel', UserProfileLevelSchema)

UserProfileLevelModel.syncIndexes().then(() => {
  console.log('User Profile Level Model Indexes Synced')
}).catch((err) => {
  console.log('User Profile Level Model Indexes Sync Error', err)
})

module.exports = UserProfileLevelModel
