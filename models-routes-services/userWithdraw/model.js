const { DataTypes } = require('sequelize')

const { sequelize, Sequelize } = require('../../database/sequelize')
const { withdrawPaymentGetaways, payoutStatus, platform, eUserType } = require('../../data')

class UserWithdraw extends Sequelize.Model { }

UserWithdraw.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true }, // Unique identifier
  iUserId: { type: DataTypes.STRING(24), allowNull: false }, // User ID associated with the withdrawal
  ePaymentGateway: { type: DataTypes.ENUM(withdrawPaymentGetaways), defaultValue: 'BANK' }, // Payment gateway used
  ePaymentStatus: { type: DataTypes.ENUM(payoutStatus), defaultValue: 'P' }, // Payment status
  sInfo: { type: DataTypes.TEXT }, // Additional information
  nAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 }, // Withdrawal amount
  nParentId: { type: DataTypes.INTEGER, defaultValue: 0 }, // Parent ID for reference
  iWithdrawalDoneBy: { type: DataTypes.STRING(24) }, // User ID who processed the withdrawal
  dWithdrawalTime: { type: DataTypes.DATE }, // Withdrawal timestamp
  nWithdrawFee: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 }, // Withdrawal fee
  sIP: { type: DataTypes.STRING }, // IP address
  eUserType: { type: DataTypes.ENUM(eUserType), defaultValue: 'U' }, // User type
  ePlatform: { type: DataTypes.ENUM(platform), defaultValue: 'O' }, // Platform
  dProcessedDate: { type: DataTypes.DATE }, // Date when withdrawal is processed
  dReversedDate: { type: DataTypes.DATE }, // Date when withdrawal is reversed
  bReversed: { type: DataTypes.BOOLEAN, defaultValue: false }, // Reversed status, default: false
  sUPIId: { type: DataTypes.STRING }, // UPI ID
  iBankDetailId: { type: DataTypes.STRING(24) }, // Bank details ID
  // sReversedInfo: { type: DataTypes.TEXT }, // Reversed information
  iTransactionId: { type: DataTypes.STRING }, // Transaction ID
  nActualAmount: { type: DataTypes.FLOAT(12, 2) }, // Actual withdrawal amount
  nPlatformFee: { type: DataTypes.FLOAT(12, 2) }, // Platform fee
  nApplicableTax: { type: DataTypes.FLOAT(12, 2) }, // Applicable tax on withdrawal amount
  nTaxPercentage: { type: DataTypes.FLOAT(12, 2) } // Tax percentage
}, {
  sequelize,
  createdAt: 'dCreatedAt',
  updatedAt: 'dUpdatedAt',
  tableName: 'userwithdraws', // Table name
  indexes: [
    {
      fields: ['iUserId', 'dUpdatedAt', 'ePaymentStatus', 'ePaymentGateway'],
      name: 'idx_userwithdraws_user_paymentstatus_paymentgateway'
    }
  ]
})

module.exports = UserWithdraw
