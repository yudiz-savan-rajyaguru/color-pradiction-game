const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const UserModel = require('./model')

const OTPVerifications = new Schema({
  sLogin: { type: String, trim: true, required: true },
  sCode: { type: Number, required: true },
  sType: { type: String, enum: data.otpType, default: 'M' }, // E = Email | M = Mobile
  sAuth: { type: String, enum: data.otpAuth, required: true }, // R = Register | F = ForgotPass | V = Verification | L = Login
  sForgotPassToken: { type: String },
  sDeviceToken: { type: String },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  bIsVerify: { type: Boolean, default: false },
  bIsRegistered: { type: Boolean, default: false },
  dUpdatedAt: { type: Date, default: Date.now },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String },
  oMeta: {
    sLatitude: { type: String },
    sLongitude: { type: String },
    sCountry: { type: String },
    sState: { type: String },
    sCity: { type: String }
  },
  ePlatform: { type: String, enum: data.platform, required: true, default: 'O' }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  nFailedOTPAttemptCount: { type: Number, default: 0 },
  nThresholdCount: { type: Number, default: 0 },
  dNextTryDate: { type: Date, default: Date.now },
  sCountryCode: { type: String, default: '+91' }
})
OTPVerifications.index({ sLogin: 1, sCode: 1, sType: 1 })

module.exports = UsersDBConnect.model('userotpverifications', OTPVerifications)
