const mongoose = require('mongoose')
const { AdminsDBConnect } = require('../../../database/mongoose')
const Schema = mongoose.Schema

const DigioWebhookSchema = new Schema({
  webhook: { type: Object }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

const DigioModel = AdminsDBConnect.model('digio_webhook', DigioWebhookSchema)

module.exports = DigioModel
