const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const { userStatus, platform, utmSource, eUserType } = require('../../data')

const UserModel = require('./model')

const DeletedUser = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, unique: true },
  sName: { type: String, trim: true },
  sUsername: { type: String, trim: true, required: true },
  sEmail: { type: String, trim: true },
  bIsEmailVerified: { type: Boolean, default: false },
  sMobNum: { type: String, trim: true, required: true },
  bIsMobVerified: { type: Boolean, default: false },
  sProPic: { type: String, trim: true },
  eType: { type: String, enum: eUserType, default: 'U' }, // U = USER B = BOT
  eStatus: { type: String, enum: userStatus, default: 'D' },
  dDeletedAt: { type: Date },
  oUtm: {
    sUtmSource: { type: String, enum: utmSource },
    sUtmMedium: { type: String },
    sUtmCampaign: { type: String },
    sUtmContent: { type: String },
    sUtmTerm: { type: String }
  },
  sReason: { type: String },
  ePlatform: { type: String, enum: platform, required: true, default: 'O' } // A = Android, I = iOS, W = Web, O = Other, AD = Admin
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

DeletedUser.index({ sUsername: 1 }, { unique: true })
DeletedUser.index({ sEmail: 1 })
DeletedUser.index({ sMobNum: 1 }, { unique: true })
DeletedUser.index({ dCreatedAt: 1 })

// user.sEmail.toLowerCase()
DeletedUser.statics.filterData = function (user) {
  user.__v = undefined
  return user
}
DeletedUser.virtual('oDeletedUser', {
  ref: UserModel,
  localField: 'iUserId',
  foreignField: '_id',
  justOne: true
})

const DeletedAccountsModel = UsersDBConnect.model('deletedusers', DeletedUser)

module.exports = DeletedAccountsModel
