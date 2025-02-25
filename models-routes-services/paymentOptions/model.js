const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

// Define the schema for the PaymentOption model
const PaymentOption = new Schema({
  sName: { type: String, required: true },
  nOrder: { type: Number }, // Order of the payment option
  sImage: { type: String, trim: true }, // Image URL for the payment option, trimmed
  eKey: { type: String, enum: data.paymentOptionsKey, default: 'RAZORPAY', unique: true },
  sOffer: { type: String }, // Offer details associated with the payment option
  bEnable: { type: Boolean, default: false },
  nPlatformFee: { type: Number, default: 0 }, // Platform fee for the payment option, default is 0
  bIsFeePercent: { type: Boolean, default: true },
  sExternalId: { type: String },
  nAutoCancelTimeFrame: { type: Number }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PaymentOption.index({ bEnable: 1 }) // Index on the bEnable field
PaymentOption.index({ eKey: 1, bEnable: 1 }) // Compound index on eKey and bEnable fields

const PaymentOptionModel = StatisticsDBConnect.model('paymentoptions', PaymentOption)

PaymentOptionModel.syncIndexes().then(() => {
  console.log('Payment Option Model Indexes Synced')
}).catch((err) => {
  console.log('Payment Option Model Indexes Sync Error', err)
})

module.exports = PaymentOptionModel
