
const { DataTypes, literal } = require('sequelize')
const { sequelize, Sequelize } = require('../../database/sequelize')
const UserBalanceModel = require('../userbalance/model')

const { transactionType, passbookType, userType, passbookStatus } = require('../../data')

class Passbook extends Sequelize.Model { }

Passbook.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
  iUserId: { type: DataTypes.STRING(24), allowNull: false },
  nAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nBonus: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nCash: { type: DataTypes.FLOAT(12, 2), allowNull: false, defaultValue: 0 },
  nOldWinningBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nOldDepositBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nOldTotalBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nNewWinningBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nNewDepositBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nNewTotalBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nOldBonus: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nNewBonus: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  eTransactionType: { type: DataTypes.ENUM(transactionType.value), defaultValue: 'Deposit' }, // ['Bonus', 'Refer-Bonus', 'Deposit', 'Withdraw', 'Win', 'Play', 'Bonus-Expire', 'Play-Return', 'Win-Return', 'Opening', 'Creator-Bonus', 'TDS', 'Withdraw-Return', 'Cashback-Contest', 'Cashback-Return', 'Creator-Bonus-Return', 'XP-Point']
  dBonusExpiryDate: { type: DataTypes.DATE },
  bIsBonusExpired: { type: DataTypes.BOOLEAN, defaultValue: false },
  bCreatorBonusReturn: { type: DataTypes.BOOLEAN, defaultValue: false }, // we'll check this flag after win return process we again win distribution time
  bWinReturn: { type: DataTypes.BOOLEAN, defaultValue: false }, // we'll check this flag after win return process we again win distribution time
  iPreviousId: { type: DataTypes.INTEGER },
  iCategoryId: { type: DataTypes.STRING },
  iSubCategoryId: { type: DataTypes.STRING },
  sPromocode: { type: DataTypes.STRING },
  iTransactionId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, unique: true }, // allowNull: false },
  iUserDepositId: { type: DataTypes.INTEGER(11) },
  iWithdrawId: { type: DataTypes.INTEGER(11) },
  nWithdrawFee: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  sRemarks: { type: DataTypes.TEXT },
  sCommonRule: { type: DataTypes.STRING },
  eUserType: { type: DataTypes.ENUM(userType.value), defaultValue: 'U' },
  eStatus: { type: DataTypes.ENUM(passbookStatus), defaultValue: 'CMP' },
  eType: { type: DataTypes.ENUM(passbookType.value), defaultValue: 'Dr' }, // Dr, Cr
  nXPPoints: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  dActivityDate: { type: DataTypes.DATE },
  dProcessedDate: { type: DataTypes.DATE },
  nActualAmount: { type: DataTypes.FLOAT(12, 2) },
  nBuyCommission: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nSellCommission: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  iUserLevelId: { type: DataTypes.STRING(24) },
  nUserLevelPercent: { type: DataTypes.INTEGER(11), defaultValue: 0 },
  iEventId: { type: DataTypes.STRING(24) },
  iOrderId: { type: DataTypes.UUID },
  nApplicableTax: { type: DataTypes.FLOAT(12, 2), allowNull: false, defaultValue: 0 },
  nTaxPercentage: { type: DataTypes.FLOAT(12, 2) }
}, {
  sequelize,
  createdAt: 'dCreatedAt',
  updatedAt: 'dUpdatedAt',
  tableName: 'passbooks',
  indexes: [
    {
      fields: ['iUserId', 'eUserType', 'eTransactionType', 'eType'],
      name: 'idx_passbooks_user_usertype_transaction_type'
    },
    {
      fields: ['iUserId'],
      name: 'idx_passbooks_user'
    },
    {
      fields: ['iUserId', 'iOrderId', 'eTransactionType', 'iEventId', 'dCreatedAt', 'eType'],
      name: 'idx_passbooks_user_order_transaction_event'
    }
  ]
})
// imp: indexes are not synced with the database

Passbook.beforeCreate(async (passbook, options) => {
  const { iUserId } = passbook
  const { transaction, lock } = options

  const oldPBook = await Passbook.findOne({ where: { iUserId }, order: [['id', 'DESC']], attributes: ['id'], transaction, lock }) // imp: add projection here
  if (oldPBook) {
    passbook.iPreviousId = oldPBook.id
    const newBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction, lock })

    // ? To avoid decimal differences between (nCurrentWinningBalance + nCurrentDepositBalance) and nCurrentTotalBalance
    const amountMisMatch = (newBalance.nCurrentWinningBalance + newBalance.nCurrentDepositBalance) - newBalance.nCurrentTotalBalance
    let nCurrentTotalBalance = newBalance.nCurrentTotalBalance
    if (amountMisMatch > 0 && amountMisMatch <= 0.20) {
      nCurrentTotalBalance = newBalance.nCurrentWinningBalance + newBalance.nCurrentDepositBalance

      await UserBalanceModel.update({
        nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${amountMisMatch}`)
      }, { where: { iUserId }, transaction, lock })
    }

    passbook.nNewWinningBalance = newBalance.nCurrentWinningBalance
    passbook.nNewDepositBalance = newBalance.nCurrentDepositBalance
    passbook.nNewTotalBalance = nCurrentTotalBalance
    passbook.nNewBonus = newBalance.nCurrentBonus
    passbook.dActivityDate = new Date()
  }
})
module.exports = Passbook
