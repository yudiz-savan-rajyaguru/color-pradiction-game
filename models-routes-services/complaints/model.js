const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const AdminModel = require('../admin/model')
const UserModel = require('../user/model')

const Complaints = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel }, // User ID, referencing UserModel
  iModifiedBy: { type: Schema.Types.ObjectId, ref: AdminModel }, // Admin ID, referencing AdminModel
  sTitle: { type: String, trim: true }, // Complaint title, trimmed
  sDescription: { type: String }, // Complaint description
  eStatus: { type: String, enum: data.complaintsStatus, default: 'P' }, // Complaint status (Pending, In-Progress, Declined, Resolved), defaults to Pending
  eType: { type: String, enum: data.complaintType, default: 'F' }, // Complaint type, defaults to F
  sImage: { type: String }, // Complaint image
  sComment: { type: String, trim: true }, // Complaint comment, trimmed
  sExternalId: { type: String }, // External ID,
  sRefId: { type: String } // Reference ID
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } }) // Enable timestamps

Complaints.index({ iUserId: 1, eType: 1 }) // Create an index on the user ID and type fields
Complaints.index({ eStatus: 1 }) // Create an index on the status field

const ComplaintsModel = UsersDBConnect.model('complaints', Complaints) // Define the Complaints model
ComplaintsModel.syncIndexes().then(() => { // Sync the indexes
  console.log('Complaints Model Indexes Synced')
}).catch((err) => {
  console.log('Complaints Model Indexes Sync Error', err)
})
module.exports = UsersDBConnect.model('complaints', Complaints)
