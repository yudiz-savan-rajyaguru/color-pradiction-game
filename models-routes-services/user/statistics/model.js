const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../../database/mongoose')
const UserModel = require('../model')
// const MatchModel = require('../../match/model')
// const SeasonModel = require('../../season/model')
const { eUserType } = require('../../../data')

const numberType = {
  type: Number, default: 0
}
const Statistic = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true, unique: true },
  eUserType: { type: String, enum: eUserType, default: 'U' }, // U = USER B = BOT
  nTotalWinReturn: numberType,
  nTotalPlayReturn: numberType,

  nTotalPlayedCash: numberType, // Total played cash
  nTotalPlayedBonus: numberType, // Total played bonus
  nTotalPlayReturnCash: numberType, // Total play-return cash
  nTotalPlayReturnBonus: numberType, // Total play-return bonus

  // nCashbackCash: numberType, // Total Cashback cash
  // nCashbackBonus: numberType, // Total Cashback bonus
  nTotalCashbackReturnCash: numberType, // Total Cashback Return amount
  nTotalCashbackReturnBonus: numberType, // Total Cashback Return amount

  nDeposits: numberType, // Total Deposit amount
  nBonus: numberType, // Total Bonus amount
  nWithdraw: numberType, // Total Withdraw amount
  nTotalWinnings: numberType, // Total Winning amount

  nActualDepositBalance: numberType, // Actual Deposit amount
  nActualWinningBalance: numberType, // Actual Winning amount
  nActualBonus: numberType, // Actual Bonus amount

  // aTotalMatch: [{
  //   iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  //   nPlayReturn: numberType,
  //   iSeasonId: { type: Schema.Types.ObjectId, ref: SeasonModel }
  // }],
  // aTotalSeason: [{ type: Schema.Types.ObjectId, ref: SeasonModel }],
  // nTotalPLeagueSpend: numberType, // !check
  nTotalSpend: numberType, // !check
  nReferrals: numberType,
  // nTotalJoinLeague: numberType,
  nTotalBonusExpired: numberType,
  nWinnings: numberType, // !check
  // nTotalWinnings: numberType, // !check
  nCash: numberType,
  nDepositCount: numberType,
  nWithdrawCount: numberType,
  nDiscountAmount: numberType,
  nDepositDiscount: numberType,
  nTeams: numberType,
  sExternalId: { tpe: String },
  nPlatformFee: numberType,
  nApplicableTax: numberType,
  nTotalReferBonus: numberType
  // aSports: [{ type: String }]
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

const StatisticModel = AdminsDBConnect.model('statistics', Statistic)

StatisticModel.syncIndexes().then(() => {
  console.log('Statistic Model Indexes Synced')
}).catch((err) => {
  console.log('Statistic Model Indexes Sync Error', err)
})

module.exports = StatisticModel
