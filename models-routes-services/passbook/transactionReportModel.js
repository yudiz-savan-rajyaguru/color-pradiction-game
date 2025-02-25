const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const EventModel = require('../event/model')
const AdminModel = require('../admin/model')
const CategoryModel = require('../category/model')
const SubCategoryModel = require('../sub-category/model')

const TransactionReport = new Schema({
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  oFilter: { type: Object },
  sReportUrl: { type: String, trim: true },
  nTotal: { type: Number },
  eStatus: { type: String, enum: data.matchLeagueReportStatus, default: 'P' },
  dDateFrom: { type: Date },
  dDateTo: { type: Date },
  sExternalId: { type: String },
  iEventId: { type: Schema.Types.ObjectId, ref: EventModel },
  iCategoryId: { type: Schema.Types.ObjectId, ref: CategoryModel },
  iSubCategoryId: { type: Schema.Types.ObjectId, ref: SubCategoryModel }

}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = GamesDBConnect.model('transactionReport', TransactionReport)
