/* eslint-disable no-console */
const mongoose = require('mongoose')

const { AdminsDBConnect } = require('../../../database/mongoose')
const Schema = mongoose.Schema

const locationSchema = new Schema({
  type: {
    type: String,
    enum: ['Point']
  },
  coordinates: {
    type: [Number]
  }
})

// Define Mongoose schema for AdminLogs
const Location = new Schema({
  sName: {
    type: String
  },
  oLocation: {
    type: locationSchema
  },
  sCountry: {
    type: String
  },
  sState: {
    type: String
  }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } }) // Enable timestamps

Location.index({ oLocation: '2dsphere' })

// Create AdminLogs model using the schema
const LocationModel = AdminsDBConnect.model('locations', Location)

// Sync indexes and log the result
LocationModel.syncIndexes().then(() => {
  console.log('Location Model Indexes Synced')
}).catch((err) => {
  console.log('Admin Logs Model Indexes Sync Error', err)
})

module.exports = LocationModel
