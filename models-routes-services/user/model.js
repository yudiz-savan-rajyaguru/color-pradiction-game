// @ts-check
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const jwt = require('jsonwebtoken')

const { UsersDBConnect } = require('../../database/mongoose')
const config = require('../../config/config')
const { eUserType, userGender, userStatus, platform, referStatus, kycVerifiedStatus } = require('../../data')
const { decryptValue, fieldsToDecrypt } = require('../../helper/utilities.services')

const ProfileLevelModel = require('../profileLevel/model')
const CMSModel = require('../cms/model')
const User = new Schema({
  sName: { type: String, trim: true },
  sUsername: { type: String, trim: true, required: true, unique: true },
  sEmail: { type: String, trim: true },
  bIsEmailVerified: { type: Boolean, default: false },
  sMobNum: { type: String, trim: true, required: true },
  bIsMobVerified: { type: Boolean, default: false },
  sProPic: { type: String, trim: true },
  eType: { type: String, enum: eUserType, default: 'U' }, // U = USER B = BOT
  eGender: { type: String, enum: userGender },
  aPushTokens: { type: Array }, // we will store push tokens in string
  nXPPoints: { type: Number, default: 0 },
  iCityId: { type: Number }, // check
  iStateId: { type: Number }, // check
  iCountryId: { type: Number }, // check or not in used
  sState: { type: String },
  // dDob: { type: String },
  // sDobBonusIn: { type: String },
  sCity: { type: String },
  sAddress: { type: String },
  nPinCode: { type: Number },
  aDeviceToken: { type: Array },
  eStatus: { type: String, enum: userStatus, default: 'Y' },
  iReferredBy: { type: Schema.Types.ObjectId, ref: 'users' },
  sReferCode: { type: String },
  sReferLink: { type: String },
  dLoginAt: { type: Date },
  dDeletedAt: { type: Date },
  sVerificationToken: { type: String },
  // bIsInternalAccount: { type: Boolean, default: false },
  sExternalId: { type: String },
  sReason: { type: String },
  sReferrerRewardsOn: { type: String },
  nReferAmount: { type: Number },
  nReferrerAmount: { type: Number },
  eReferStatus: { type: String, enum: referStatus, default: 'P' },
  ePlatform: { type: String, enum: platform, required: true, default: 'O' }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  iPolicyId: { type: mongoose.Types.ObjectId, ref: CMSModel }, // ref: CMSModel
  nLogin: { type: Number, default: 0 }, // no of times user has logged in
  bEligibleForBenifits: { type: Boolean, default: true }, // boolean for registration benefits to new user, false if the user has deleted their account and created agin with their contact number
  iProfileLevelId: { type: mongoose.Types.ObjectId, ref: ProfileLevelModel },
  bIsEmailUnSubscribe: { type: Boolean, default: false },
  // iAffiliateBy: { type: mongoose.Types.ObjectId, ref: 'AffiliatesModel' },
  bIsUsernameChanged: { type: Boolean, default: false },
  idToken: { type: String },
  sCountryCode: { type: String, default: '+91' },
  eKYCStatus: { type: String, enum: kycVerifiedStatus, default: 'p' }, // p = Pending, s = Started, c = Completed
  sKYCRejectReason: { type: String },
  dKYCStartedAt: { type: Date }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

User.index({ sReferCode: 1 })
User.index({ eType: 1 })
User.index({ sMobNum: 1, sCountryCode: 1 }, { unique: true })
User.index({ dCreatedAt: 1 })

// user.sEmail.toLowerCase()
User.statics.filterDataForAdmin = function (user, allowDecrypt = false) {
  user.__v = undefined
  user.sVerificationToken = undefined
  user.aJwtTokens = undefined
  user.iReferredBy = undefined
  user.sPassword = undefined
  user.eType = undefined
  user.dUpdatedAt = undefined
  user.aDeviceToken = undefined
  user.oSocial = undefined
  user.aDeviceToken = undefined
  user.sReferrerRewardsOn = undefined
  user.iReferredBy = undefined
  user.nLogin = undefined
  user.sEmail = allowDecrypt ? decryptValue(user?.sEmail) : ''
  user.sMobNum = allowDecrypt ? decryptValue(user.sMobNum) : ''
  user = fieldsToDecrypt(['sAddress', 'dDob'], user)
  return user
}
User.statics.filterDataForUser = function (user) {
  user.__v = undefined
  user.sVerificationToken = undefined
  user.aJwtTokens = undefined
  user.iReferredBy = undefined
  user.sPassword = undefined
  user.eType = undefined
  user.dUpdatedAt = undefined
  user.aDeviceToken = undefined
  user.oSocial = undefined
  user.aDeviceToken = undefined
  user.aPushToken = undefined
  user.sReferrerRewardsOn = undefined
  user.iReferredBy = undefined
  // user.bIsInternalAccount = undefined
  user.dLoginAt = undefined
  user.eStatus = undefined
  user.dPasswordchangeAt = undefined
  user.nLogin = undefined
  user.aPushTokens = undefined
  user = fieldsToDecrypt(['sEmail', 'sMobNum', 'sAddress', 'dDob'], user)
  return user
}

User.statics.findByToken = function (token) {
  const User = this
  let decoded
  try {
    decoded = jwt.verify(token, config.JWT_SECRET_USER)
  } catch (e) {
    return Promise.reject(e)
  }
  const query = {
    _id: decoded._id,
    eStatus: 'Y'
  }
  return User.findOne(query)
  // .cache(config.CACHE_2, `at:${token}`)
}

User.statics.findByRefreshToken = function (token) {
  try {
    const User = this
    let decoded
    try {
      decoded = jwt.verify(token, config.REFRESH_TOKEN_SECRET)
    } catch (e) {
      return false
    }
    const query = {
      _id: decoded._id,
      eStatus: 'Y'
    }
    return User.findOne(query)
    // .cache(config.CACHE_2, `at:${token}`)
  } catch (err) {
    console.log('error cache', err)
  }
}

User.virtual('oProfileLevel', {
  ref: ProfileLevelModel,
  localField: 'iProfileLevelId',
  foreignField: '_id',
  justOne: true
})

const UserModel = UsersDBConnect.model('users', User)

UserModel.syncIndexes().then(() => {
  console.log('User Model Indexes Synced')
}).catch((err) => {
  console.log('User Model Indexes Sync Error', err)
})

module.exports = UserModel
