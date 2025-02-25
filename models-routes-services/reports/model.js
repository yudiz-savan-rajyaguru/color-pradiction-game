const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const { paymentGetaways, withdrawPaymentGetaways, platform, userType, aTaxTransactions, eCategoryType } = require('../../data')

const durationWiseStats = {
  nTotal: { type: Number, default: 0 },
  nToday: { type: Number, default: 0 },
  nYesterday: { type: Number, default: 0 },
  nLastWeek: { type: Number, default: 0 },
  nLastMonth: { type: Number, default: 0 },
  nLastYear: { type: Number, default: 0 },
  dUpdatedAt: { type: Date }
}
const sportsWiseStats = [{
  eCategory: { type: String, enum: eCategoryType.value, default: 'C' },
  ...durationWiseStats
}]

const sportsWiseDetailsStats = [{
  eCategory: { type: String, enum: eCategoryType.value, default: 'C' },
  nTotalCash: { type: Number, default: 0 },
  nTotalBonus: { type: Number, default: 0 },
  nTodayCash: { type: Number, default: 0 },
  nTodayBonus: { type: Number, default: 0 },
  nYesterCash: { type: Number, default: 0 },
  nYesterBonus: { type: Number, default: 0 },
  nWeekCash: { type: Number, default: 0 },
  nWeekBonus: { type: Number, default: 0 },
  nMonthCash: { type: Number, default: 0 },
  nMonthBonus: { type: Number, default: 0 },
  nYearCash: { type: Number, default: 0 },
  nYearBonus: { type: Number, default: 0 },
  dUpdatedAt: { type: Date }
}]

const GeneralizeReports = new Schema({
  oTotalUser: {
    nTotalUsers: { type: Number, default: 0 },
    // nTotalEmailVerifiedUsers: { type: Number, default: 0 },
    nTotalPhoneVerifiedUsers: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oRegisterUser: {
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    aPlatformWiseUser: [{
      eTitle: { type: String, enum: platform, default: 'O' },
      nValue: { type: Number, default: 0 }
    }],
    dUpdatedAt: { type: Date }
  },
  oLoginUser: {
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oDroppedRegistrations: {
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oDeposit: {
    nTotalWinnings: { type: Number, default: 0 },
    nTotalDeposits: { type: Number, default: 0 },
    nTotalPendingDeposits: { type: Number, default: 0 },
    nTotalSuccessDeposits: { type: Number, default: 0 },
    nTotalCancelledDeposits: { type: Number, default: 0 },
    nTotalRejectedDeposits: { type: Number, default: 0 },
    aDeposits: [{
      eTitle: { type: String, enum: paymentGetaways, default: 'RAZORPAY' },
      nValue: { type: Number, default: 0 },
      nPlatformFee: { type: Number, default: 0 },
      nActualAmount: { type: Number, default: 0 },
      nApplicableTax: { type: Number, default: 0 }
    }],
    nActualDepositAmount: { type: Number, default: 0 },
    nTotalPlatformFee: { type: Number, default: 0 },
    nTotalApplicableTax: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oWithdraw: {
    aSuccessWithdrawals: [{
      eTitle: { type: String, enum: withdrawPaymentGetaways, default: 'ADMIN' },
      nValue: { type: Number, default: 0 },
      nPlatformFee: { type: Number, default: 0 },
      nActualAmount: { type: Number, default: 0 },
      nApplicableTax: { type: Number, default: 0 }
    }],
    aPendingWithdrawals: [{
      eTitle: { type: String, enum: withdrawPaymentGetaways, default: 'ADMIN' },
      nValue: { type: Number, default: 0 },
      nPlatformFee: { type: Number, default: 0 },
      nActualAmount: { type: Number, default: 0 },
      nApplicableTax: { type: Number, default: 0 }
    }],
    nInstantWithdrawals: { type: Number, default: 0 },
    nTotalWithdrawals: { type: Number, default: 0 },
    nActualWithdrawAmount: { type: Number, default: 0 },
    nTotalPlatformFee: { type: Number, default: 0 },
    nTotalApplicableTax: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oTds: {
    nTotalTds: { type: Number, default: 0 },
    nTotalActiveTds: { type: Number, default: 0 },
    nTotalPendingTds: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  // aTeams: sportsWiseStats,
  aParticipants: sportsWiseStats,
  aWins: sportsWiseDetailsStats,
  aWinReturn: sportsWiseDetailsStats,
  // aPrivateLeague: [{
  //   eCategory: { type: String, enum: eCategoryType.value, default: 'C' },
  //   oCreated: durationWiseStats,
  //   oCancelled: durationWiseStats,
  //   oCompleted: durationWiseStats
  // }],
  oBonusExpire: durationWiseStats,
  oUserBonus: durationWiseStats,
  aPlayReturn: sportsWiseDetailsStats,
  aPlayed: sportsWiseDetailsStats,
  // aCashback: sportsWiseDetailsStats,
  // aCashbackReturn: sportsWiseDetailsStats,
  // oStreakReward: durationWiseStats,
  // oUserStreakDetails: {
  //   aDayWise: [{
  //     nDay: { type: Number },
  //     count: { type: Number }
  //   }],
  //   avgStreak: { type: Number, default: 0 },
  //   maxStreak: { type: Number, default: 0 }
  // },
  aCreatorBonus: [{
    eCategory: { type: String, enum: eCategoryType.value, default: 'C' },
    ...durationWiseStats
  }],
  aCreatorBonusReturn: [{
    eCategory: { type: String, enum: eCategoryType.value, default: 'C' },
    ...durationWiseStats
  }],
  aAppDownload: [{
    ePlatform: { type: String },
    ...durationWiseStats
  }],
  oApplicableTax: {
    aCategoryTax: [{
      eTransactionType: { type: String, enum: aTaxTransactions },
      ...durationWiseStats
    }],
    aContestJoinTax: [{
      eCategory: { type: String, enum: eCategoryType.value, default: 'C' },
      ...durationWiseStats
    }]
  },
  oInactivityCharge: {
    nTotalInActivityCharge: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  eType: { type: String, enum: userType.value, default: 'U' } // U = USER B = BOT
  // sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = GamesDBConnect.model('generalizereports', GeneralizeReports)
