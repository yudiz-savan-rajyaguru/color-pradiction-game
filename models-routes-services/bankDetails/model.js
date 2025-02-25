const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const { bankStatus } = require('../../data')
const UserModel = require('../user/model')

const BankDetails = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, unique: true },
  sBankName: { type: String, required: true, trim: true },
  sBranchName: { type: String, required: true, trim: true },
  sAccountHolderName: { type: String, required: true, trim: true },
  sAccountNo: { type: String, required: true, trim: true, unique: true },
  sIFSC: { type: String, required: true, trim: true },
  eStatus: { type: String, enum: bankStatus, default: 'A' }, // P = Pending, A = Accepted, R = Rejected
  sRejectReason: { type: String },
  bIsBankApproved: { type: Boolean, default: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

BankDetails.index({ eStatus: 1, iUserId: 1 })

const BankDetailModel = UsersDBConnect.model('bankdetails', BankDetails)

BankDetailModel.syncIndexes().then(() => {
  console.log('Bank Detail Model Indexes Synced')
}).catch((err) => {
  console.log('Bank Detail Model Indexes Sync Error', err)
})

module.exports = BankDetailModel
