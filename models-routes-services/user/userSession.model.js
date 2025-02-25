const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const UserModel = require('./model')

const UserSession = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  ePlatform: { type: String, enum: data.platform, required: true }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  sDeviceToken: { type: String },
  sLongitude: { type: String }, // not in used
  sLatitude: { type: String }, // not in used
  sPushToken: { type: String, trim: true }, // deprecate it when frontend team removes
  sToken: { type: String, trim: true },
  sVersion: { type: String }, // not in used
  sExternalId: { type: String },
  oDeviceInfo: {
    sBrand: { type: String, trim: true },
    sManufacturer: { type: String, trim: true },
    sDeviceName: { type: String, trim: true },
    sDisplay: { type: String, trim: true },
    sIP: { type: String, trim: true },
    sDeviceModel: { type: String, trim: true },
    sLocalizedModel: { type: String, trim: true },
    sOsName: { type: String, trim: true },
    sOsVersion: { type: String, trim: true },
    sProcessor: { type: String, trim: true },
    sRam: { type: String, trim: true },
    sAvailRam: { type: String, trim: true },
    sScreenResolution: { type: String, trim: true },
    sBatteryLevel: { type: String, trim: true },
    oBatteryState: { type: Object }
  }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

UserSession.index({ iUserId: 1 })

module.exports = AdminsDBConnect.model('usersessions', UserSession)
