const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')

const Maintenance = new Schema({
  bIsMaintenanceMode: { type: Boolean, default: false },
  sMessage: { type: String },
  sExternalId: { type: String },
  dStartTime: { type: Date, default: Date.now },
  dEndTime: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = StatisticsDBConnect.model('maintenances', Maintenance)
