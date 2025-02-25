// @ts-check
const { DataTypes } = require('sequelize')
const { sequelize, Sequelize } = require('../../database/sequelize')
const { tdsStatus, userType, eCategoryType } = require('../../data')

class UserTds extends Sequelize.Model { }

UserTds.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
  iUserId: { type: DataTypes.STRING(24), allowNull: false },
  nPercentage: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  nOriginalAmount: { type: DataTypes.FLOAT(9, 2), allowNull: false }, // original amount
  nAmount: { type: DataTypes.FLOAT(9, 2), defaultValue: 0 }, // TDS amount
  nActualAmount: { type: DataTypes.FLOAT(9, 2), allowNull: false }, // actual amount (nOriginalAmount - nAmount)
  nEntryFee: { type: DataTypes.FLOAT(9, 2), defaultValue: 0 }, // Entry fee of contest
  nWithdrawAmount: { type: DataTypes.FLOAT(9, 2), defaultValue: 0 }, // Requested amount of Withdraw
  iPassbookId: { type: DataTypes.STRING(24), allowNull: false },
  iTransactionId: { type: DataTypes.STRING(24) },
  eStatus: { type: DataTypes.ENUM(tdsStatus), defaultValue: 'P' },
  eUserType: { type: DataTypes.ENUM(userType?.value), defaultValue: 'U' },
  iEventId: { type: DataTypes.STRING(24) },
  eCategory: { type: DataTypes.ENUM(eCategoryType?.value), defaultValue: eCategoryType?.map?.CRICKET }
}, {
  sequelize,
  createdAt: 'dCreatedAt',
  updatedAt: 'dUpdatedAt',
  tableName: 'usertds',
  indexes: [
    {
      fields: ['eStatus', 'eUserType'],
      name: 'idx_usertds_status_usertype'
    },
    {
      fields: ['iUserId', 'eStatus', 'eUserType', 'iEventId', 'dCreatedAt'],
      name: 'idx_usertds_user_status_usertype_event_createdat'
    }
  ]
})

module.exports = UserTds
