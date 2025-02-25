const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../database/mongoose')
const { segmentationType, status, kycStatus, transactionType, paymentOptionsKey, passbookStatus, units, userGender, timeRange } = require('../../data')
const AdminsModel = require('../admin/model')

const oSegment = {
  eType: { type: String, enum: segmentationType, required: true },
  eKycStatus: { type: String, enum: kycStatus },
  eAdhaarStatus: { type: String, enum: kycStatus },
  ePanStatus: { type: String, enum: kycStatus },
  dDateFrom: { type: Date },
  dDateTo: { type: Date },
  eTransactionType: { type: String, enum: transactionType.value },
  eTimeRange: { type: String, enum: timeRange },
  nAmountFrom: { type: Number },
  nAmountTo: { type: Number },
  nAmount: { type: Number },
  eAmount: { type: String },
  ePaymentGateway: { type: String, enum: paymentOptionsKey },
  eTransactionStatus: { type: String, enum: passbookStatus },
  nActionNo: { type: Number },
  nMinAge: { type: Number },
  nMaxAge: { type: Number },
  eGender: { type: String, enum: userGender },
  eStatus: { type: String, enum: status, default: 'Y' }
}
const Segments = new Schema({
  sName: { type: String, required: true },
  bAutomated: { type: Boolean, default: false, required: true },
  iAdminId: { type: mongoose.Types.ObjectId, ref: AdminsModel },
  aSegment: [oSegment],
  eStatus: { type: String, enum: status, default: 'Y' },
  nUsers: { type: Number, default: 0 },
  oFrequency: {
    nValue: {
      type: Number
    },
    nUnit: {
      type: String,
      enum: units
    }

  }, // in days
  dLastCalculated: { type: Date },
  sReportUrl: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = AdminsDBConnect.model('segments', Segments)
