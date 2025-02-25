const mongoose = require('mongoose')

const { UsersDBConnect } = require('../../database/mongoose')
const { kycStatus, userStatus } = require('../../data')
const enums = require('../../data')
const UserModel = require('../user/model')
const AdminModel = require('../admin/model')

const Schema = mongoose.Schema

const Kyc = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, unique: true },
  oPan: {
    sNo: { type: String },
    eStatus: { type: String, enum: kycStatus, default: 'N' }, // P = Pending, A = Accepted, R = Rejected, N = Not uploaded
    eDocumentType: { type: String, enums: enums?.eDocumentType?.value, default: enums?.eDocumentType?.default },
    sImage: { type: String, trim: true },
    sName: { type: String },
    sRejectReason: { type: String },
    dCreatedAt: { type: Date, default: Date.now },
    dUpdatedAt: { type: Date },
    oVerifiedAt: {
      dActionedAt: { type: Date },
      iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel }, // ref: AdminModel
      sIP: { type: String }
    }
  },
  oAadhaar: {
    sNo: { type: String },
    sFrontImage: { type: String, trim: true },
    sBackImage: { type: String, trim: true },
    eDocumentType: { type: String, enums: enums?.eDocumentType?.value, default: enums?.eDocumentType?.default },
    eStatus: { type: String, enum: kycStatus, default: 'N' }, // P = Pending, A = Accepted, R = Rejected, N = Not uploaded
    sRejectReason: { type: String },
    sRefId: { type: String }, // use for cashfree aadhaar verification
    dUpdatedAt: { type: Date },
    dCreatedAt: { type: Date, default: Date.now },
    oVerifiedAt: {
      dActionedAt: { type: Date },
      iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel }, // ref: 'AdminModel'
      sIP: { type: String }
    }
  },
  eStatus: { type: String, enum: userStatus, default: 'Y' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
Kyc.index({ iUserId: 1, 'oAadhaar.eStatus': 1 })
Kyc.index({ iUserId: 1, 'oPan.eStatus': 1 })

const KYCModel = UsersDBConnect.model('kyc', Kyc)

KYCModel.syncIndexes().then(() => {
  console.log('KYC Model Indexes Synced')
}).catch((err) => {
  console.log('KYC Model Indexes Sync Error', err)
})
module.exports = KYCModel
