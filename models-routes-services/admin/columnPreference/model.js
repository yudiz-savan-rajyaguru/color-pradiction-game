const mongoose = require('mongoose')

const ObjectId = mongoose.Types.ObjectId
const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../../database/mongoose')
const AdminModel = require('../../admin/model')

// Schema for the columnPreference model
const columnPreference = new Schema({
  sModuleName: { type: String, required: true }, // Module name for which preferences are stored
  aColumnOrder: [{
    sColumnName: { type: String, required: true }, // Column name
    bShow: { type: Boolean, default: false, required: true } // Whether the column should be shown or not
  }],
  iAdminId: { type: ObjectId, ref: AdminModel, required: true } // Reference to the Admin model
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

// Create an index for efficient querying
columnPreference.index({ sModuleName: 1, iAdminId: 1 })

// Create the model from the schema
const columnPreferenceModel = AdminsDBConnect.model('columnPreferences', columnPreference)

// Sync indexes for the columnPreference model
columnPreferenceModel.syncIndexes().then(() => {
  console.log('columnPreference Model Indexes Synced')
}).catch((err) => {
  console.log('columnPreferenceModel Model Indexes Sync Error', err)
})

module.exports = columnPreferenceModel
