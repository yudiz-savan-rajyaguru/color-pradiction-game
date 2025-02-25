const { Op, fn, col } = require('sequelize')
const UserWithdrawModel = require('../model')

const oWithdrawControl = {}

oWithdrawControl.checkWithdrawLimit = async ({ period, iUserId }) => {
  let dateRange
  switch (period) {
    case 'Day':
      dateRange = {
        start: new Date().setHours(0, 0, 0, 0),
        end: new Date().setHours(23, 59, 59, 999)
      }
      break
    default:
      return {
        nWithdrawCount: 0,
        nWithdrawAmount: 0
      }
  }

  const result = await UserWithdrawModel.findAll({
    attributes: [
      [fn('COUNT', col('*')), 'nWithdrawCount'],
      [fn('COALESCE', fn('SUM', col('nAmount')), 0), 'nWithdrawAmount']
    ],
    where: {
      iUserId,
      dCreatedAt: {
        [Op.between]: [dateRange.start, dateRange.end]
      },
      ePaymentStatus: {
        [Op.in]: ['S', 'P']
      }
    },
    raw: true
  })
  if (result?.length >= 1) return result?.[0]
  return {
    nWithdrawCount: 0,
    nWithdrawAmount: 0
  }
}

module.exports = oWithdrawControl
