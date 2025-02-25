const PromocodeStatisticModel = require('./statistics/model')
const CommonRuleModel = require('../commonRules/model')
const { Op } = require('sequelize')

const UserDepositModel = require('../userDeposit/model')
const db = require('../../database/sequelize')
const { handleCatchError } = require('../../helper/utilities.services')

const checkPromoUsage = async (promoCode, iUserId, dCreatedDate, commonRules) => {
  let promoDecrement = promoCode.nAmount

  if (!commonRules) {
    commonRules = await CommonRuleModel.find({ eStatus: 'Y', eRule: { $in: ['FLJ', 'NULJD'] } }).lean()
    if (!commonRules.length) return false

    for (const rule of commonRules) {
      if (rule.eRule === 'FLJ') {
        commonRules = rule
        break
      } else commonRules = rule
    }
  }

  const userCreationDate = new Date(dCreatedDate)
  const currentDate = new Date()
  const days = Math.ceil(Math.abs(currentDate - userCreationDate) / (1000 * 60 * 60 * 24))
  if (days > commonRules.nExpireDays) return false

  const promocodeStatistics = await PromocodeStatisticModel.countDocuments({ iUserId, iPromocodeId: promoCode._id })
  if (promocodeStatistics && commonRules.eRule === 'NULJD') {
    for (let i = 0; i <= promocodeStatistics; i++) {
      promoDecrement = promoDecrement - promoCode.nDecrementValue

      if (promoDecrement <= 0) {
        promoDecrement = 0
        break
      }
    }
    return promoDecrement
  }
  return promoCode.nAmount
}

async function countDepositPromo(query) {
  try {
    const { sPromocode, iUserId } = query

    return await db.sequelize.transaction(async (t) => {
      try {
        const [allCount, count] = await Promise.all([
          UserDepositModel.count({
            where: { sPromocode, ePaymentStatus: { [Op.in]: ['P', 'S'] } },
            col: 'id',
            transaction: t
          }),
          UserDepositModel.count({
            where: { sPromocode, iUserId, ePaymentStatus: { [Op.in]: ['P', 'S'] } },
            col: 'id',
            transaction: t
          })
        ])

        return { allCount, count }
      } catch (error) {
        handleCatchError(error)
        throw error
      }
    })
  } catch (error) {
    handleCatchError(error)
    throw new Error(error)
  }
}

module.exports = { checkPromoUsage, countDepositPromo }
