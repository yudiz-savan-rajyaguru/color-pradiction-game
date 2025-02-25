// @ts-check
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const AdminModel = require('../admin/model')
const { userType, eOrderActionTypes } = require('../../data')

const TransactionLog = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  eActionType: { type: String, enum: eOrderActionTypes?.value },
  eUserType: { type: String, enum: userType?.value },
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel }, // ref: AdminModel
  oBody: { type: Object },
  oRes: { type: Object }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

const OrderLogModel = GamesDBConnect.model('orderlogs', TransactionLog)

module.exports = OrderLogModel
