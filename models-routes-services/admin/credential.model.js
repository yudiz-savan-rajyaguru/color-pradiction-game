const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const { StatisticsDBConnect } = require('../../database/mongoose')
const { adminPay } = require('../../data')

const Schema = mongoose.Schema
const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)

// Define the Credential schema
const Credential = new Schema({
  eKey: { type: String, enum: adminPay, default: 'PAY', unique: true }, // Define eKey field
  sPassword: { type: String, trim: true, required: true }, // Define sPassword field
  sExternalId: { type: String } // Define sExternalId field
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } }) // Enable timestamps

const CredentialModel = StatisticsDBConnect.model('credentials', Credential)

// Before saving a Credential, hash the password if it has been modified
Credential.pre('save', function (next) {
  const admin = this

  if (admin.isModified('sPassword')) {
    admin.sPassword = bcrypt.hashSync(admin.sPassword, salt) // Hash the password
  }

  next()
})

CredentialModel.syncIndexes().then(() => {
  console.log('CredentialModel Indexes Synced')
}).catch((err) => {
  console.log('CredentialModel Indexes Sync Error', err)
})

module.exports = CredentialModel
