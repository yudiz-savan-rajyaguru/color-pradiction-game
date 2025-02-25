const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../database/mongoose')
const { status, segmentationType, kycStatus, transactionType } = require('../../data')
const SegmentsModel = require('../segmentations/model')
const UserModel = require('../user/model')

const oSegmentDetails = {
  eType: { type: String, enum: segmentationType, required: true },
  eKycStatus: { type: String, enum: kycStatus },
  eAdhaarStatus: { type: String, enum: kycStatus },
  ePanStatus: { type: String, enum: kycStatus },
  eTransactionType: { type: String, enum: transactionType.value },
  nAmount: { type: Number }
}
const UserSegments = new Schema({
  iSegmentId: { type: mongoose.Types.ObjectId, ref: SegmentsModel, required: true },
  iUserId: { type: mongoose.Types.ObjectId, required: true, ref: UserModel },
  sName: { type: String },
  sUsername: { type: String },
  eStatus: { type: String, enum: status, default: 'Y' },
  aSegmentDetails: [oSegmentDetails]
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

UserSegments.index({ iSegmentId: 1, iUserId: 1 }, { unique: true })

UserSegments.virtual('oSegment', {
  ref: SegmentsModel,
  localField: 'iSegmentId',
  foreignField: '_id',
  justOne: true
})
module.exports = AdminsDBConnect.model('usersegments', UserSegments)
