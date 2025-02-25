const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const AdminModel = require('./model')

// Define the Credential schema
const OTPVerifications = new Schema({
  sLogin: { type: String, trim: true, required: true }, // Login string, trimmed and required
  sCode: { type: Number, required: true }, // OTP code, required
  sType: { type: String, enum: data.otpType, required: true }, // OTP type (Email or Mobile), required
  sAuth: { type: String, enum: data.otpAuth, required: true }, // OTP auth (Register, ForgotPass, Verification, Login), required
  sDeviceToken: { type: String }, // Device token
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel }, // Admin ID, referencing AdminModel
  bIsVerify: { type: Boolean, default: false }, // Verification status, defaults to false
  dUpdatedAt: { type: Date, default: Date.now }, // Date of last update
  dCreatedAt: { type: Date, default: Date.now }, // Date of creation, defaults to current date
  sExternalId: { type: String }, // External ID,
  nFailedOTPAttemptCount: { type: Number, default: 0 }, // Failed Otp Attempts
  nThresholdCount: { type: Number, default: 0 },
  dNextTryDate: { type: Date, default: Date.now }
})
OTPVerifications.index({ sLogin: 1, sCode: 1, sType: 1 }) // Create an index on the login, code, and type fields

module.exports = AdminsDBConnect.model('otpverifications', OTPVerifications)
