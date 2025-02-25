const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../../database/mongoose')
const { bankStatus } = require('../../../data')
const UserModel = require('../../user/model')

const oBankDetails = {
  sBankName: { type: String, trim: true },
  sBranchName: { type: String, trim: true },
  sAccountHolderName: { type: String, trim: true },
  sAccountNo: { type: String, trim: true },
  sIFSC: { type: String, trim: true },
  eStatus: { type: String, enum: bankStatus }, // P = Pending, A = Accepted, R = Rejected
  sRejectReason: { type: String },
  bIsBankApproved: { type: Boolean },
  sExternalId: { type: String }
}

const BankDetails = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  ...oBankDetails,
  oOldDetails: oBankDetails
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

BankDetails.index({ eStatus: 1, iUserId: 1 })

const BankDetailHistoryModel = UsersDBConnect.model('bankdetailshistory', BankDetails)

BankDetailHistoryModel.syncIndexes().then(() => {
  console.log('Bank Detail Model Indexes Synced')
}).catch((err) => {
  console.log('Bank Detail Model Indexes Sync Error', err)
})

module.exports = BankDetailHistoryModel
