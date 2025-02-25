const { DataTypes } = require('sequelize')

const db = require('../../database/sequelize')
const { paymentGetaways, paymentStatus, platform, eUserType } = require('../../data')

class UserDeposit extends db.Sequelize.Model { }

// Define the UserDeposit model
UserDeposit.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
  iReferenceId: { type: DataTypes.UUIDV4, defaultValue: DataTypes.UUIDV4, unique: true }, // Unique identifier
  iUserId: { type: DataTypes.STRING(24), allowNull: false }, // User ID
  ePaymentGateway: { type: DataTypes.ENUM(paymentGetaways), defaultValue: 'ADMIN' }, // Payment gateway
  ePaymentStatus: { type: DataTypes.ENUM(paymentStatus), defaultValue: 'P' }, // Payment status
  sInfo: { type: DataTypes.TEXT }, // Additional information
  sPromocode: { type: DataTypes.STRING }, // Promocode
  iPromocodeId: { type: DataTypes.STRING }, // Promocode ID
  iTransactionId: { type: DataTypes.STRING }, // Transaction ID
  iOrderId: { type: DataTypes.STRING, defaultValue: DataTypes.UUIDV4 }, // Order ID with a default UUID
  nAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 }, // Amount
  nCash: { type: DataTypes.FLOAT(12, 2), allowNull: false, defaultValue: 0 }, // Cash amount
  nBonus: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 }, // Bonus amount
  eUserType: { type: DataTypes.ENUM(eUserType), defaultValue: 'U' }, // User type
  ePlatform: { type: DataTypes.ENUM(platform), defaultValue: 'O' }, // Platform (A = Android, I = iOS, W = Web, O = Other, AD = Admin)
  dProcessedDate: { type: DataTypes.DATE }, // Processed date
  nActualAmount: { type: DataTypes.FLOAT(12, 2) }, // Actual amount
  nPlatformFee: { type: DataTypes.FLOAT(12, 2) }, // Platform fee
  nApplicableTax: { type: DataTypes.FLOAT(12, 2) }, // Applicable tax on deposit amount
  nTaxPercentage: { type: DataTypes.FLOAT(12, 2) } // Tax percentage
}, {
  sequelize: db.sequelize, // Associated Sequelize instance
  createdAt: 'dCreatedAt', // Creation timestamp
  updatedAt: 'dUpdatedAt', // Update timestamp
  tableName: 'userdeposits', // Table name
  indexes: [
    {
      fields: ['iUserId', 'ePaymentStatus'], // Index fields (ePaymentStatus)
      name: 'idx_userdeposits_user_paymentstatus'
    },
    {
      fields: ['iUserId', 'iPromocodeId', 'ePaymentStatus'], // Index fields (ePaymentStatus, iPromocodeId)
      name: 'idx_userdeposits_user_promocode_paymentstatus'
    }
  ]
})

module.exports = UserDeposit
