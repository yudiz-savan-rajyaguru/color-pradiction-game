const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const durationSchema = new Schema({
  nToday: { type: Number, default: 0 },
  nWeek: { type: Number, default: 0 },
  nMonth: { type: Number, default: 0 }
})
const oEventsData = {
  oLiveEvents: {
    nToday: { type: Number, default: 0 },
    nWeek: { type: Number, default: 0 },
    nMonth: { type: Number, default: 0 }
  },
  eCategory: { type: String, enum: data.eCategoryType?.value },
  iCategoryId: { type: Schema.Types.ObjectId }
}
const AdminDashboard = new Schema({
  oUser: {
    nActive: { type: Number, default: 0 },
    nInActive: { type: Number, default: 0 },
    nTotal: { type: Number, default: 0 },
    nFreeLeague: { type: Number, default: 0 },
    nDroppedRegistrations: { type: Number, default: 0 }
  },
  oTransaction: durationSchema,
  oAdminCommission: durationSchema,
  oAdminPlatformFees: durationSchema,
  oLoss: durationSchema,
  oPlayReturn: durationSchema,
  oBotWinners: durationSchema,
  oRealWinners: durationSchema,
  oDeposit: durationSchema,
  oWithdraw: durationSchema,
  oWinning: durationSchema,
  oEarning: {
    aMonth: [{
      nCash: { type: Number },
      createdAt: { type: Date }
    }],
    aWeek: [{
      nCash: { type: Number },
      createdAt: { type: Date }
    }],
    aToday: [{
      nCash: { type: Number },
      createdAt: { type: Date }
    }]
  },
  aEventData: [oEventsData]
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = StatisticsDBConnect.model('dashboards', AdminDashboard)
