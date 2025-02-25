// @ts-check
const { fn, col, Op } = require('sequelize')
const UsersModel = require('../models-routes-services/user/model')
const { handleCatchError, dateDiffInDays } = require('../helper/utilities.services')
const UserDepositModel = require('../models-routes-services/userDeposit/model')
const UserWithdrawModel = require('../models-routes-services/userWithdraw/model')
const UserStreakModel = require('../models-routes-services/userStreak/model')
const OTPVerificationsModel = require('../models-routes-services/user/otpverifications.model')
const { redisClient } = require('../helper/redis')
const moment = require('moment')
const StreakModel = require('../models-routes-services/streak/model')
const { doStreakPayment } = require('../models-routes-services/userStreak/common')
const { UsersDBConnect } = require('../database/mongoose')
const UserModel = require('../models-routes-services/user/model')
const { withdrawPaymentGetaways } = require('../data')

async function getUserCount(condition) {
  return UsersModel.countDocuments(condition)
}

async function findTotalCashDeposit(query) {
  try {
    if (!query) {
      return { data: '' }
    }

    query = { ...query, attributes: [[fn('sum', col('nCash')), 'total']] }

    const data = await UserDepositModel.findAll(query)

    return data
  } catch (error) {
    handleCatchError(error)
  }
}

async function getDepositOfPG(query) {
  try {
    if (!query) {
      return { data: '' }
    }

    query = { ...query, attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nCash')), 'nValue']] }
    query.where = { ...query.where, ePaymentGateway: { [Op.ne]: '' } }

    const data = await UserDepositModel.findAll(query)
    if (data?.length === 0) {
      const oData = []
      withdrawPaymentGetaways?.forEach((sGateway) => {
        oData.push({
          eTitle: sGateway,
          nValue: 0
        })
      })
      return oData
    }
    return data
  } catch (error) {
    handleCatchError(error)
  }
}

async function getPlatformFeeDataDeposit(query) {
  try {
    if (!query) {
      return { data: '' }
    }

    // Include attributes for feeTotal and actualAmountTotal
    query = { ...query, attributes: [[fn('sum', col('nPlatformFee')), 'feeTotal'], [fn('sum', col('nActualAmount')), 'actualAmountTotal']] }
    query.where = { ...query.where }

    // Find the data based on the query
    const data = await UserDepositModel.findAll(query)

    // Send the data as a JSON string in the response
    return data
  } catch (error) {
    // Callback with error and handle it
    handleCatchError(error)
  }
}

async function getWithdrawOfPG(query) {
  try {
    if (!query) {
      return { data: '' }
    }

    // Specify the attributes for the query, including sum calculations
    query = { ...query, attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue'], ['ePaymentGateway', 'eTitle'], [fn('sum', col('nPlatformFee')), 'nPlatformFee'], ['ePaymentGateway', 'eTitle'], [fn('sum', col('nActualAmount')), 'nActualAmount']] }
    query.where = { ...query.where }

    // Perform the query on the UserWithdrawModel
    const data = await UserWithdrawModel.findAll(query)
    if (data?.length === 0) {
      const oData = []
      withdrawPaymentGetaways?.forEach((sGateway) => {
        oData.push({
          eTitle: sGateway,
          nValue: 0,
          nPlatformFee: 0,
          nActualAmount: 0
        })
      })
      return oData
    }
    return data
  } catch (error) {
    // Handle errors, invoke the callback with the error, and log the error
    handleCatchError(error)
  }
}
async function getPlatformFeeDataWithdraw(query) {
  try {
    if (!query) {
      return { data: '' }
    }

    // Specify the attributes for the query, including sum calculations
    query = { ...query, attributes: [[fn('sum', col('nPlatformFee')), 'feeTotal'], [fn('sum', col('nActualAmount')), 'actualAmountTotal']] }
    query.where = { ...query.where }

    // Perform the query on the UserWithdrawModel
    const data = await UserWithdrawModel.findAll(query)

    // Send the result as a JSON string in the response
    return data
  } catch (error) {
    // Handle errors, invoke the callback with the error, and log the error
    handleCatchError(error)
  }
}

async function droppedRegistrationCount(dateQuery) {
  try {
    const query = dateQuery ? {
      sAuth: 'R',
      bIsRegistered: false,
      dCreatedAt: dateQuery
    } : {
      sAuth: 'R',
      bIsRegistered: false
    }
    const [result] = await OTPVerificationsModel.aggregate([
      {
        $match: query
      }, {
        $group: {
          _id: '$sLogin'
        }
      }, {
        $count: 'finalCount'
      }
    ])

    return result
  } catch (error) {
    throw new Error(error)
  }
}
function getDatesObj() {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const weekStart = new Date(new Date().setDate(today.getDate() - today.getDay()))
  const weekEnd = new Date(new Date().setDate(weekStart.getDate() + 6))

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const yearStart = new Date(today.getFullYear(), 0, 1)
  const yearEnd = new Date(today.getFullYear(), 11, 31)

  const dates = {
    toDay: {
      $gte: new Date(today.setHours(0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59))
    },
    yesterDay: {
      $gte: new Date(yesterday.setHours(0, 0, 0)),
      $lt: new Date(yesterday.setHours(23, 59, 59))
    },
    week: {
      $gte: new Date(weekStart.setHours(0, 0, 0)),
      $lt: new Date(weekEnd.setHours(23, 59, 59))
    },
    month: {
      $gte: new Date(monthStart.setHours(0, 0, 0)),
      $lt: new Date(monthEnd.setHours(23, 59, 59))
    },
    year: {
      $gte: new Date(yearStart.setHours(0, 0, 0)),
      $lt: new Date(yearEnd.setHours(23, 59, 59))
    }
  }

  return dates
}
async function getDateRangeQuery(aDate) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        if (aDate === 'total') resolve({ isError: false, query: { dStartDate: { $lte: new Date() } } })
        if (aDate.length !== 2) resolve({ isError: true, query: {} })
        resolve({ isError: false, query: { dStartDate: { $gte: new Date(aDate[0]), $lte: new Date(aDate[1]) } } })
      } catch (error) {
        resolve({ isError: true, query: {} })
      }
    })()
  })
}

async function getDepositOfDateRange(query, dateRange) {
  try {
    if (!query) {
      return { data: '' }
    }
    // Parse the date range from the request
    dateRange = dateRange || { dStartDate: new Date(), dEndDate: new Date() }
    const { dStartDate, dEndDate } = dateRange

    // Include the sum of nCash as 'total' in the attributes
    query = { ...query, attributes: [[fn('sum', col('nCash')), 'total']] }
    query.where = { ...query.where, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }

    // Find the total cash deposit based on the query and date range
    const data = await UserDepositModel.findAll(query)

    return data
  } catch (error) {
    // Callback with error and handle it
    handleCatchError(error)
  }
}

async function getDepositOfPgInDateRange(query, dateRange) {
  try {
    if (!query) {
      return { data: '' }
    }

    // Parse the date range from the request
    dateRange = dateRange || { dStartDate: new Date(), dEndDate: new Date() }
    const { dStartDate, dEndDate } = dateRange

    // Include attributes for eTitle, nValue, nPlatformFee, and nActualAmount
    query = { ...query, attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nCash')), 'nValue'], ['ePaymentGateway', 'eTitle'], [fn('sum', col('nPlatformFee')), 'nPlatformFee'], ['ePaymentGateway', 'eTitle'], [fn('sum', col('nActualAmount')), 'nActualAmount']] }
    query.where = { ...query.where, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }
    // Find the data based on the query and date range
    const data = await UserDepositModel.findAll(query)

    return data
  } catch (error) {
    // Callback with error and handle it
    handleCatchError(error)
  }
}
async function getPlatformFeeDataDepositDateRange(query, dateRange) {
  try {
    if (!query) {
      return { data: '' }
    }
    // Parse the date range from the request
    dateRange = dateRange || { dStartDate: new Date(), dEndDate: new Date() }
    const { dStartDate, dEndDate } = dateRange

    // Include attributes for feeTotal and actualAmountTotal
    query = { ...query, attributes: [[fn('sum', col('nPlatformFee')), 'feeTotal'], [fn('sum', col('nActualAmount')), 'actualAmountTotal']] }
    query.where = { ...query.where, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }

    // Find the data based on the query and date range
    const data = await UserDepositModel.findAll(query)

    return data
  } catch (error) {
    // Callback with error and handle it
    handleCatchError(error)
  }
}
async function getPlatformFeeDataWithdrawDateRange(query, dateRange) {
  try {
    if (!query) {
      return { data: '' }
    }
    dateRange = dateRange || { dStartDate: new Date(), dEndDate: new Date() }
    const { dStartDate, dEndDate } = dateRange

    // Specify the attributes for the query, including sum calculations and date range
    query = { ...query, attributes: [[fn('sum', col('nPlatformFee')), 'feeTotal'], [fn('sum', col('nActualAmount')), 'actualAmountTotal']] }
    query.where = { ...query.where, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }

    // Perform the query on the UserWithdrawModel
    const data = await UserWithdrawModel.findAll(query)

    // Send the result as a JSON string in the response
    return data
  } catch (error) {
    // Handle errors, invoke the callback with the error, and log the error
    handleCatchError(error)
  }
}
async function getDateRangeWithdrawOfPG(query, dateRange) {
  try {
    if (!query) {
      return { data: '' }
    }
    dateRange = dateRange || { dStartDate: new Date(), dEndDate: new Date() }
    const { dStartDate, dEndDate } = dateRange

    // Specify the attributes for the query, including sum calculations and date range
    query = { ...query, attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue'], ['ePaymentGateway', 'eTitle'], [fn('sum', col('nPlatformFee')), 'nPlatformFee'], ['ePaymentGateway', 'eTitle'], [fn('sum', col('nActualAmount')), 'nActualAmount']] }
    query.where = { ...query.where, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }

    // Perform the query on the UserWithdrawModel
    const data = await UserWithdrawModel.findAll(query)

    return data
  } catch (error) {
    // Handle errors, invoke the callback with the error, and log the error
    handleCatchError(error)
  }
}

async function setDayEndExpiry(key) {
  const d = new Date(moment(new Date()).format())
  const h = d.getHours()
  const m = d.getMinutes()
  const s = d.getSeconds()
  const secondsUntilEndOfDate = (24 * 60 * 60) - (h * 60 * 60) - (m * 60) - s
  await redisClient.set(key, true, 'EX', secondsUntilEndOfDate)
  return true
}

async function streakUpdateWithTransaction(streakPayload) {
  let { maxStreakDay, userId, type, userLoginStreak, streakDay, userLanguage } = streakPayload
  let session
  try {
    const transactionOptions = {
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' }
    }
    const streakObj = { iUserId: userId, nDay: 1 }
    if (maxStreakDay.nDay === streakDay) {
      type = 'STREAK-RESET'
      streakObj.aMaximumStreakReset = [{ nDay: streakDay, dResetDate: Date.now() }]
      streakObj.nDay = 0
    }

    let updateUserStreakObj = {}
    let updateUserObj = {}
    switch (type) {
      case 'STREAK-BREAK':
        updateUserStreakObj = { $set: { nDay: 0 } }
        updateUserObj = { $set: { nStreakDay: 0 } }
        break

      case 'STREAK-CONTINUE':
        updateUserStreakObj = { $inc: { nDay: 1 } }
        updateUserObj = { $inc: { nStreakDay: 1 } }
        break

      case 'STREAK-RESET':
        updateUserStreakObj = { $push: { aMaximumStreakReset: { nDay: streakDay, dResetDate: Date.now() } }, $set: { nDay: 0 } }
        updateUserObj = { $set: { nStreakDay: 0 } }
        break

      default:
        updateUserStreakObj = streakObj
        updateUserObj = { $set: { nStreakDay: streakObj.nDay } }
        break
    }
    session = await UsersDBConnect.startSession()
    session.startTransaction(transactionOptions)
    await UserModel.updateOne({ _id: userId }, updateUserObj, { session })
    if (userLoginStreak?._id) {
      await UserStreakModel.updateOne({ _id: userLoginStreak._id }, updateUserStreakObj, { session })
    } else {
      await UserStreakModel.create([updateUserStreakObj], { session })
    }

    const streakReward = await StreakModel.findOne({ nDay: streakDay, eStatus: 'Y' }, { dCreatedAt: 0, dUpdatedAt: 0, __v: 0 }).lean()
    if (streakReward && type !== 'STREAK-BREAK') {
      let nBonus = 0
      let nCash = 0
      let sInfo = ''
      const transactionType = streakReward?.eType
      switch (transactionType) {
        case 'B':
          nBonus = Number(streakReward?.nAmount)
          break
        case 'C':
          nCash = Number(streakReward?.nAmount)
          break
        default:
          sInfo = streakReward?.sInfo || ''
          break
      }

      const nAmount = nBonus + nCash
      const res = await doStreakPayment({ eUserType: 'U', iUserId: userId, nAmount, nCash, nBonus, transactionType, userLanguage, streakDay, sInfo })
      if (res?.type === 'ERROR') {
        throw Error(res)
      }
      return { reward: res, amount: nAmount }
    }
    await session.commitTransaction()
    return { reward: { type: 'NONE' } }
  } catch (error) {
    if (session) await session.abortTransaction()
    throw error
  } finally {
    if (session) await session.endSession()
  }
}

async function processLoginStreak(userInfo) {
  const { _id: userId, userLanguage } = userInfo
  try {
    // we need to change this hrs and min as per the region
    // currently we are setting as per india region
    const currentDate = new Date().toISOString()
    const [userLoginStreak, keyExist] = await Promise.all([
      UserStreakModel.findOne({ iUserId: userId }).lean(),
      redisClient.get(`ls:exp:${userId}`)
    ])
    // if key exist that means we have updated a counter for that user
    if (keyExist) return { streakStatus: 'ALREADY-PROCESSED', type: 'SUCCESS', amount: 0 }
    const maxStreakDay = await StreakModel.findOne({ eStatus: 'Y' }).sort({ nDay: -1 }).lean()
    if (userLoginStreak) {
      const streakDay = userLoginStreak.nDay + 1
      const lastUpdatedStreakDate = new Date(userLoginStreak?.dUpdatedAt)

      // set day end expiry date for this key
      await setDayEndExpiry(`ls:exp:${userId}`)

      const dateDiff = dateDiffInDays(currentDate, lastUpdatedStreakDate)
      if (dateDiff.differenceInDays > 1) {
        const streakRwd = await streakUpdateWithTransaction({ type: 'STREAK-BREAK', streakDay, userLanguage, maxStreakDay, userId, userLoginStreak })
        return { streakStatus: 'STREAK-BREAK', type: streakRwd?.reward?.type, amount: streakRwd?.amount }
      } else if (currentDate !== dateDiff.eD && dateDiff.differenceInDays === 1) {
        const streakRwd = await streakUpdateWithTransaction({ type: 'STREAK-CONTINUE', maxStreakDay, streakDay, userLanguage, userId, userLoginStreak })
        return { streakStatus: 'STREAK-CONTINUE', type: streakRwd?.reward.type, amount: streakRwd?.amount }
      } else {
        return { streakStatus: 'STREAK-AlREADY-PROCESSED', type: 'SUCCESS', amount: 0 }
      }
    } else {
      const streakRwd = await streakUpdateWithTransaction({ type: 'STREAK-START', streakDay: 1, userLanguage, maxStreakDay, userId, userLoginStreak })
      await setDayEndExpiry(`ls:exp:${userId}`)
      return { streakStatus: 'STREAK-START', type: streakRwd?.reward.type, amount: streakRwd?.amount }
    }
  } catch (error) {
    await redisClient.del(`ls:exp:${userId}`)
    throw error
  }
}

module.exports = {
  getUserCount,
  findTotalCashDeposit,
  getDepositOfPG,
  getPlatformFeeDataDeposit,
  getWithdrawOfPG,
  getPlatformFeeDataWithdraw,
  droppedRegistrationCount,
  getDatesObj,
  getDateRangeQuery,
  getDepositOfDateRange,
  getDepositOfPgInDateRange,
  getPlatformFeeDataDepositDateRange,
  getPlatformFeeDataWithdrawDateRange,
  getDateRangeWithdrawOfPG,
  processLoginStreak
}
