const mongoose = require('mongoose')

const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { commonType } = require('../../data')

const Common = new Schema({
  aProPic: [{ type: String }],
  sUrl: { type: String },
  eType: { type: String, enum: commonType }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

const CommonModel = StatisticsDBConnect.model('common', Common)

module.exports = CommonModel
