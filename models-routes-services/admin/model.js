const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const { AdminsDBConnect } = require('../../database/mongoose')
const config = require('../../config/config')
const data = require('../../data')

const RoleModel = require('./roles/model')

const ObjectId = mongoose.Types.ObjectId
const Schema = mongoose.Schema

const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)

// Define the Admin schema
const Admin = new Schema({
  sName: { type: String, trim: true, required: true },
  sUsername: { type: String, trim: true, required: true, unique: true },
  sEmail: { type: String, trim: true, required: true, unique: true },
  sMobNum: { type: String, trim: true, required: true },
  sProPic: { type: String, trim: true }, // not in use
  eType: { type: String, enum: data.adminType, required: true },
  aPermissions: [{ // Deprecated field, not in used
    eKey: { type: String, enum: data.adminPermission },
    eType: { type: String, enum: data.adminPermissionType } // R = READ, W = WRITE, N = NONE
  }],
  iRoleId: { type: ObjectId, ref: RoleModel }, // deprecated, not in use
  aRole: [{ type: ObjectId, ref: RoleModel }],
  sPassword: { type: String, trim: true, required: true },
  eStatus: { type: String, enum: data.adminStatus, default: 'Y' },
  aJwtTokens: [{
    sToken: { type: String },
    sPushToken: { type: String, trim: true },
    sLatitude: { type: String },
    sLongitude: { type: String },
    dTimeStamp: { type: Date, default: Date.now }
  }],
  dLoginAt: { type: Date },
  dPasswordchangeAt: { type: Date },
  sVerificationToken: { type: String },
  sExternalId: { type: String },
  sDepositToken: { type: String },
  bLoggedOut: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

// Define indexes for Admin schema
Admin.index({ sEmail: 1, sUsername: 1 })
Admin.index({ eStatus: 1 })

// Middleware function before saving to handle modifications
Admin.pre('save', function (next) {
  const admin = this
  let i
  if (admin.isModified('sName')) {
    const sName = admin.sName
    const splitFullName = sName.toLowerCase().split(' ')
    // Capitalize each word in the name
    for (i = 0; i < splitFullName.length; i++) {
      splitFullName[i] = splitFullName[i].charAt(0).toUpperCase() + splitFullName[i].substring(1)
    }
    admin.sName = splitFullName.join(' ')
  }
  if (admin.isModified('sPassword')) {
    // Hash the password before saving
    admin.sPassword = bcrypt.hashSync(admin.sPassword, salt)
  }
  next()
})

// Static method to filter unnecessary(in response) data from Admin object
Admin.statics.filterData = function (admin) {
  admin.__v = undefined
  admin.sVerificationToken = undefined
  admin.aJwtTokens = undefined
  admin.sDepositToken = undefined
  admin.sPassword = undefined
  admin.dUpdatedAt = undefined
  return admin
}

// Static method to find an admin by a token
Admin.statics.findByToken = async function (token, tokenProvider = 'admin') {
  const admin = this
  let decoded

  try {
    decoded = jwt.verify(token, config.JWT_SECRET)
  } catch (e) {
    return Promise.reject(e)
  }

  // we have added or condition,as copy agent was not working.
  // that token will be verified from sDepositToken field
  const query = {
    $or: [{ 'aJwtTokens.sToken': token }, { sDepositToken: token }],
    eStatus: 'Y',
    bLoggedOut: false
  }

  query._id = decoded._id

  const adminObj = await admin.findOne(query)
  if (adminObj) {
    adminObj.sLatitude = decoded?.sLatitude
    adminObj.sLongitude = decoded?.sLongitude
  }
  return adminObj
}

// Static method to find an admin by a refresh token
Admin.statics.findByRefreshToken = async function (token) {
  const admin = this
  let decoded

  try {
    // Verify the token using JWT
    decoded = jwt.verify(token, config.REFRESH_TOKEN_SECRET)
  } catch (e) {
    return Promise.reject(e)
  }
  // Query to find the admin by ID, status, and logged-out status
  const query = {
    _id: decoded._id,
    eStatus: 'Y',
    bLoggedOut: false
  }

  const adminObj = await admin.findOne(query)
  if (adminObj) {
    adminObj.sLatitude = decoded?.sLatitude
    adminObj.sLongitude = decoded?.sLongitude
  }
  return adminObj
}

// Static method to find an admin by a deposit token
Admin.statics.findByDepositToken = async function (token, tokenProvider = 'admin') {
  const admin = this
  let decoded

  try {
    // Verify the token using JWT
    decoded = jwt.verify(token, config.REFRESH_TOKEN_SECRET)
  } catch (e) {
    return Promise.reject(e)
  }

  // Query to find the admin by ID, deposit token, and status
  const query = {
    sDepositToken: token,
    eStatus: 'Y'
  }

  query._id = decoded._id

  return admin.findOne(query)
}
// Create the Admin model from the schema
const AdminsModel = AdminsDBConnect.model('admins', Admin)

// Sync indexes for the Admin model
AdminsModel.syncIndexes().then(() => {
  console.log('Admin Model Indexes Synced')
}).catch((err) => {
  console.log('Admin Model Indexes Sync Error', err)
})

module.exports = AdminsModel
