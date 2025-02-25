// @ts-check
const { literal, Op, Transaction } = require('sequelize')
const csv = require('fast-csv')
const moment = require('moment')
const config = require('../../config/config')
const { decryptValue, mongify, catchError, convertToDecimal, ObjectId, removenull, pick } = require('../../helper/utilities.services')
const { streamObject } = require('../../helper/s3config')
const UsersModel = require('../user/model')
const UserDepositModel = require('./model')
const UserBalanceModel = require('../userbalance/model')
const { status, jsonStatus, messages } = require('../../helper/api.responses')
const SettingModel = require('../setting/model')
const { paymentGetaways, withdrawPaymentGetaways } = require('../../data')
const db = require('../../database/sequelize')
const PassbookModel = require('../passbook/model')
const { APP_LANG } = require('../../config/common')
const StatisticsModel = require('../user/statistics/model')
const { queuePush } = require('../../helper/redis')
const EventModel = require('../event/model')
const { getCurrencySymbol, findSetting } = require('../setting/services')
const { getPlatformFeeDeposit } = require('../payment/common')
const { getTaxForTransaction } = require('../userbalance/common')
const CategoryModel = require('../category/model')
const SubCategoryModel = require('../sub-category/model')
const PromocodeModel = require('../promocode/model')

async function createDeposit(payload, user) {
  const iUserId = user._id.toString()
  const { eType: eUserType, bIsInternalAccount } = user
  // Pick relevant properties from payload and remove null values
  payload = pick(payload, ['ePaymentGateway', 'ePaymentStatus', 'sInfo', 'nAmount', 'sPromocode', 'ePlatform'])
  removenull(payload)

  const { nAmount, sPromocode = '', ePaymentGateway, ePlatform } = payload
  const { nPlatformFee, nActualAmount, symbol, nApplicableTax, nTaxPercentage } = await getPlatformFeeAndValidateDeposit({ nAmount, ePaymentGateway })

  // Validate and process promo code
  const { nCash, nBonus, promocodes, promocodeId } = await processPromoCode({ sPromocode, nAmount, symbol })
  const nDeposit = parseFloat(nCash) + parseFloat(nBonus)

  // Validate deposit amount against settings
  await validateDepositAmount({ nAmount, symbol })

  // Create deposit transaction
  const depositResult = await createDepositTransaction({
    iUserId,
    nAmount,
    nDeposit,
    nPlatformFee,
    nApplicableTax,
    nTaxPercentage,
    nActualAmount,
    nCash,
    nBonus,
    eUserType,
    ePaymentStatus: bIsInternalAccount ? 'S' : 'P',
    ePaymentGateway,
    sInfo: `Deposit from ${ePaymentGateway} of ${symbol}${nAmount}`,
    iPromocodeId: promocodeId,
    sPromocode: sPromocode.toUpperCase(),
    ePlatform,
    bIsInternalAccount,
    promocodeId,
    promocodes,
    symbol
  })

  return { data: depositResult?.data || {} }
}

async function createDepositTransaction(dataObj) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Extract data from the input object.
        const { iUserId, nAmount, nDeposit, nPlatformFee, nApplicableTax, nTaxPercentage, nActualAmount, nCash, nBonus, eUserType, symbol, promocodes, ePaymentGateway, promocodeId, ePlatform, sPromocode, bIsInternalAccount } = dataObj
        // Use sequelize transaction to ensure atomicity.
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          // Initialize payment status and old balance values.
          let paymentStatus = 'P'
          let nOldBonus = 0
          let nOldTotalBalance = 0
          let nOldDepositBalance = 0
          let nOldWinningBalance = 0
          try {
            // If internal account, set payment status to 'S' and fetch old balance.
            const balanceData = await checkInternalUser({ paymentStatus, t, eUserType, iUserId, bIsInternalAccount, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance })
            paymentStatus = balanceData.paymentStatus
            nOldBonus = balanceData.nOldBonus
            nOldTotalBalance = balanceData.nOldTotalBalance
            nOldDepositBalance = balanceData.nOldDepositBalance
            nOldWinningBalance = balanceData.nOldWinningBalance

            let userDeposit

            if (sPromocode) {
              // Check promo code usage limits.
              const [allCountResult, countResult] = await Promise.all([
                UserDepositModel.findAndCountAll({ where: { iPromocodeId: promocodeId, ePaymentStatus: { [Op.in]: ['P', 'S'] } }, transaction: t, lock: true }),
                UserDepositModel.findAndCountAll({ where: { iUserId, iPromocodeId: promocodeId, ePaymentStatus: { [Op.in]: ['P', 'S'] } }, transaction: t, lock: true })
              ])

              const allCount = (allCountResult?.count || 0)
              const count = (countResult?.count || 0)

              // Reject if promo code usage exceeds limits.
              const rejectInvalid = { status: status.BadRequest, message: messages.English.promo_usage_limit }
              if ((!promocodes.bMaxAllowForAllUser && (count >= promocodes.nMaxAllow)) || ((allCount >= promocodes.nMaxAllow) || (count >= promocodes.nPerUserUsage))) {
                return Promise.reject(rejectInvalid)
              }
              // Create a user deposit record with promo code.
              userDeposit = await UserDepositModel.create({ iUserId, nAmount: nDeposit, nPlatformFee, nApplicableTax, nTaxPercentage, nActualAmount, nCash, nBonus, eUserType, ePaymentStatus: paymentStatus, ePaymentGateway, sInfo: `Deposit from ${ePaymentGateway} of ${symbol}${nAmount}`, iPromocodeId: promocodeId, sPromocode: sPromocode.toUpperCase(), ePlatform }, { transaction: t, lock: true })
            } else {
              // Create a user deposit record without promo code.
              userDeposit = await UserDepositModel.create({
                iUserId,
                nAmount: nDeposit,
                nPlatformFee,
                nApplicableTax,
                nTaxPercentage,
                nActualAmount,
                nCash,
                nBonus,
                ePaymentStatus: paymentStatus,
                ePaymentGateway,
                sInfo: `Deposit from ${ePaymentGateway} of ${symbol}${nAmount}`,
                ePlatform
              }, { transaction: t })
            }
            return resolve({ data: userDeposit?.dataValues })
          } catch (error) {
            return reject(error)
          }
        })
      } catch (error) {
        return reject(error)
      }
    })()
  })
}

async function checkInternalUser({ paymentStatus, iUserId, bIsInternalAccount, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eUserType, t }) {
  try {
    if (bIsInternalAccount === true) {
      paymentStatus = 'S'
      const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
      // If old balance exists, extract values.
      if (oldBalance) {
        const { nCurrentBonus, nCurrentTotalBalance, nCurrentDepositBalance, nCurrentWinningBalance } = oldBalance
        nOldBonus = nCurrentBonus
        nOldTotalBalance = nCurrentTotalBalance
        nOldDepositBalance = nCurrentDepositBalance
        nOldWinningBalance = nCurrentWinningBalance
      } else {
        // If old balance does not exist, create a new record.
        await UserBalanceModel.create({ iUserId, eUserType }, { transaction: t })
      }
    }
    return { paymentStatus, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance }
  } catch (error) {
    return new Error(error)
  }
}

async function validateDepositAmount({ nAmount, symbol }) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Fetch deposit validation settings.
        const depositValidation = await findSetting('Deposit')
        // If no deposit validation settings found, reject with an error.
        if (!depositValidation) {
          const rejectSetting = { status: jsonStatus.NotFound, message: messages.English.not_exist.replace('##', messages.English.cvalidationSetting) }
          return reject(rejectSetting)
        }

        // Validate deposit amount against minimum limit.
        if (nAmount < depositValidation.nMin) {
          const rejectMinErr = { status: jsonStatus.BadRequest, message: messages.English.min_err.replace('##', messages.English.cDeposit).replace('#', `${depositValidation.nMin}`).replace('₹', symbol) }
          return reject(rejectMinErr)
        }
        // Validate deposit amount against maximum limit.
        if (nAmount > depositValidation.nMax) {
          const rejectMaxErr = { status: jsonStatus.BadRequest, message: messages.English.max_err.replace('##', messages.English.cDeposit).replace('#', `${depositValidation.nMax}`).replace('₹', symbol) }
          return reject(rejectMaxErr)
        }
        return resolve()
      } catch (error) {
        // Reject with the caught error.
        return reject(error)
      }
    })()
  })
}

async function processPromoCode({ sPromocode, nAmount, symbol }) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        if (!sPromocode) {
          return resolve({ nCash: parseFloat(nAmount), nBonus: 0, promocodes: null, promocodeId: null })
        }

        const rejectPromo = { status: status.BadRequest, message: messages.English.invalid_promo_err }
        const promocode = await PromocodeModel.findOne({ eStatus: 'Y', sCode: sPromocode.toUpperCase(), dStartTime: { $lt: new Date(Date.now()) }, dExpireTime: { $gt: new Date(Date.now()) } }, { nAmount: 1, bMaxAllowForAllUser: 1, dExpireTime: 1, bIsPercent: 1, nMaxAllow: 1, nPerUserUsage: 1, nBonusExpireDays: 1, nMaxAmount: 1, nMinAmount: 1, nMaxDiscount: 1 }).lean()

        // If no promo code found, reject with an error.
        if (!promocode) return reject(rejectPromo)

        // Validate promo code amount range.
        const rejectReason = { status: status.BadRequest, message: messages.English.promo_amount_err.replace('#', promocode.nMinAmount).replace('##', promocode.nMaxAmount).replace('₹', symbol) }
        if (nAmount && !(promocode.nMaxAmount >= convertToDecimal(nAmount, 2) && promocode.nMinAmount <= convertToDecimal(nAmount, 2))) return reject(rejectReason)

        // If promo code has expired, reject with an error.
        const { dExpireTime, nAmount: promoAmount, bIsPercent } = promocode
        if (dExpireTime && new Date(dExpireTime) < new Date(Date.now())) return reject(rejectPromo)

        const { nCash, nBonus } = calculatePromoAmount({ nAmount, promoAmount, bIsPercent, nMaxDiscount: promocode.nMaxDiscount })

        return resolve({ nCash: parseFloat(nCash), nBonus: nBonus, promocodes: promocode, promocodeId: promocode._id.toString() })
      } catch (error) {
        return reject(error)
      }
    })()
  })
}

/**
 * Calculates cash and bonus based on promo code details.
 * @param {Object} param - Parameters.
 * @returns {Object} - Cash and bonus values.
 */
function calculatePromoAmount({ nAmount, promoAmount, bIsPercent, nMaxDiscount }) {
  try {
    // Parse the deposit amount as cash.
    const nCash = parseFloat(nAmount)

    // Calculate bonus based on whether the promo amount is a percentage.
    const nBonus = bIsPercent ? Math.min(convertToDecimal(promoAmount * nAmount / 100), nMaxDiscount) : parseFloat(promoAmount)

    // Return cash and bonus values.
    return { nCash, nBonus }
  } catch (error) {
    // If an error occurs, return a new Error object.
    return new Error(error)
  }
}

async function getPlatformFeeAndValidateDeposit({ nAmount, ePaymentGateway }) {
  // Fetch currency symbol and platform fee details in parallel.
  const [symbol, { nPlatformFee, nActualAmount, bIsFailed, sMessage }, { nApplicableTax = 0, nTaxPercentage = 0 }] = await Promise.all([
    getCurrencySymbol(),
    getPlatformFeeDeposit({ nAmount, ePaymentGateway }),
    getTaxForTransaction({ nAmount, transactionKey: 'DEPOSIT_TAX' })
  ])
  // If platform fee retrieval failed, reject with an error.
  const rejectFee = { status: jsonStatus.UnprocessableEntity, message: sMessage }
  if (bIsFailed) throw rejectFee

  // Return platform fee, actual amount, and symbol.
  return { nPlatformFee, nActualAmount, symbol, nApplicableTax, nTaxPercentage }
}

async function addUserFields(passbook, users = [], allowDecrypt) {
  let data
  const oUser = {}
  const oMatch = {}
  const oCategory = {}
  const oSubCategory = {}

  data = users
  const matchIds = passbook.map((p) => ObjectId(p.iEventId))
  const aMatchIds = []
  const passbookIds = passbook.map((p) => ObjectId(p.iUserId))
  matchIds.forEach((id, i) => matchIds[i] && aMatchIds.push(id))
  const aCategoryIds = passbook.map((c) => ObjectId(c.iCategoryId))
  const aSubCategoryIds = passbook.map((c) => ObjectId(c.iSubCategoryId))
  const [usersData, matchesData, categoryData, subCategoryData] = await Promise.all([
    UsersModel.find({ _id: { $in: passbookIds } }, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean(),
    EventModel.find({ _id: { $in: aMatchIds } }, { sName: 1, dStartDate: 1 }).lean(),
    CategoryModel.find({ _id: { $in: aCategoryIds } }, { sName: 1 }).lean(),
    SubCategoryModel.find({ _id: { $in: aSubCategoryIds } }, { sName: 1 }).lean()
  ])

  data = Array.isArray(usersData) ? usersData : []
  if (data.length) data.forEach((usr, i) => { oUser[usr._id.toString()] = i })

  const matchData = Array.isArray(matchesData) ? matchesData : []
  if (matchData.length) matchesData.forEach((match, i) => { oMatch[match._id.toString()] = i })

  const categoryDataArr = Array.isArray(categoryData) ? categoryData : []
  if (categoryDataArr.length) categoryDataArr.forEach((category, i) => { oCategory[category._id.toString()] = i })

  const subCategoryDataArr = Array.isArray(subCategoryData) ? subCategoryData : []
  if (subCategoryDataArr.length) subCategoryDataArr.forEach((subCategory, i) => { oSubCategory[subCategory._id.toString()] = i })

  return passbook.map(p => {
    // const user = data.find(u => u._id.toString() === p.iUserId.toString())
    const user = (typeof oUser[p.iUserId.toString()] === 'number') ? { ...data[oUser[p.iUserId.toString()]] } : {}
    if (user) {
      if (allowDecrypt) {
        user.sEmail = decryptValue(user.sEmail)
        user.sMobNum = decryptValue(user.sMobNum)
      } else {
        user.sEmail = ''
        user.sMobNum = ''
      }
    }
    let sEventName = ''
    let dEventStartedDate = ''
    if (p.iEventId && matchData && matchData.length) {
      // const match = matchData.find(u => u._id.toString() === p.iEventId.toString())
      const match = (typeof oMatch[p.iEventId.toString()] === 'number') ? { ...matchData[oMatch[p.iEventId.toString()]] } : {}
      if (match && match.sName) sEventName = match.sName
      if (match && match.dStartDate) dEventStartedDate = match.dStartDate
    }

    // Retrieve category data
    let sCategoryName = ''
    if (p.iCategoryId && categoryDataArr && categoryDataArr.length) {
      const category = (typeof oCategory[p.iCategoryId.toString()] === 'number') ? { ...categoryDataArr[oCategory[p.iCategoryId.toString()]] } : {}
      if (category && category.sName) sCategoryName = category.sName
    }

    // Retrieve sub-category data
    let sSubCategoryName = ''
    if (p.iSubCategoryId && subCategoryDataArr && subCategoryDataArr.length) {
      const subCategory = (typeof oSubCategory[p.iSubCategoryId.toString()] === 'number') ? { ...subCategoryDataArr[oSubCategory[p.iSubCategoryId.toString()]] } : {}
      if (subCategory && subCategory.sName) sSubCategoryName = subCategory.sName
    }

    return { ...p, ...user, _id: undefined, sEventName, dEventStartedDate, sCategoryName, sSubCategoryName }
  })
}

function generateReport(data) {
  return new Promise((resolve, reject) => {
    try {
      const csvStream = csv.format({ headers: true, quoteHeaders: true })
      const sFileName = `users_firstdeposit_${moment().format('YYYY-MM-DD:h:mm:ss:a')}`
      streamObject(config.S3_BUCKET_NAME, config.S3FIRSTDEPOSITREPORT + `${sFileName}.csv`, 'text/csv', csvStream).then(() => {
        resolve(config.S3FIRSTDEPOSITREPORT + `${sFileName}.csv`)
      })
      const aFields = ['Deposit Id', 'User Name', 'Deposit Date', 'Processed Date', 'Amount', 'User Registration Date']
      const oData = { 'Deposit Id': 'id', 'User Name': 'sUsername', 'Deposit Date': 'dDepositDate', 'Processed Date': 'dProcessedDate', Amount: 'nAmount', 'User Registration Date': 'dCreatedAt' }
      for (const oUser of data) {
        const oUserRow = aFields.reduce((oRow, sField) => {
          oRow[sField] = oUser[oData[sField]]
          return oRow
        }, {})
        csvStream.write(oUserRow)
      }
      csvStream.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
   * It'll validate deposit rate limit
   * @param { String } iUserId
   * @param { String } lang
   * @returns { Object } status of success or error
   */
function validateDepositRateLimit(iUserId, lang) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        if (config.NODE_ENV !== 'production') {
          return resolve({ status: 'success' })
        }
        const depositRateLimit = await SettingModel.findOne({ sKey: 'UserDepositRateLimit' })
        const depositRateLimitTimeFrame = await SettingModel.findOne({ sKey: 'UserDepositRateLimitTimeFrame' })

        if (!depositRateLimit || !depositRateLimitTimeFrame) {
          return resolve({ status: 'success' })
        }

        const currentDate = new Date().toISOString()
        const fromDate = new Date(new Date().setMinutes(new Date().getMinutes() - parseInt(depositRateLimitTimeFrame.nMax))).toISOString()

        const count = await UserDepositModel.count({
          where: {
            iUserId,
            ePaymentStatus: 'P',
            dCreatedAt: {
              [Op.lte]: currentDate,
              [Op.gte]: fromDate
            }
          }
        })

        if (count >= parseInt(depositRateLimit?.nMax)) {
          const limitExceed = { status: jsonStatus.TooManyRequest, message: messages[lang].limit_reached.replace('##', messages[lang].depositRequest) }
          return reject(limitExceed)
        }
        resolve({ status: 'success' })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function updateBalance(payload, ePaymentGateway) {
  let { txStatus: ePaymentStatus, orderId, referenceId } = payload
  if (ePaymentStatus === 'PAID' || ePaymentStatus === 'TXN_SUCCESS') ePaymentStatus = 'SUCCESS'
  return await db.sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
  }, async (t) => {
    referenceId = referenceId?.toString() || ''
    const deposit = await UserDepositModel.findOne({
      where: {
        iOrderId: orderId
      },
      order: [['id', 'DESC']],
      raw: true,
      transaction: t,
      lock: true
    })
    if (deposit) {
      if (['S', 'R']?.includes(deposit?.ePaymentStatus)) return { alreadySuccess: true, status: jsonStatus.OK, message: messages.English.action_success.replace('##', messages.English.cDepositeHasBeenMade), ePaymentStatus: deposit.ePaymentStatus }
      let updateDepositResult
      if (['SUCCESS', 'PAID'].includes(ePaymentStatus)) {
        updateDepositResult = await updateDepositAndBalance({ deposit, ePaymentGateway, payload, orderId, referenceId, t })
        await assignReferralAndPromoOnDepositSuccess({ deposit, updateDepositResult, t })
        return { alreadySuccess: false, status: jsonStatus.OK, message: messages.English.action_success.replace('##', messages.English.cDepositeHasBeenMade), ePaymentStatus: 'S' }
      } else if (ePaymentStatus === 'FAILED' || ePaymentStatus === 'CANCELLED') {
        await UserDepositModel.update({ ePaymentStatus: 'C', sInfo: JSON.stringify(payload), iTransactionId: referenceId, iOrderId: payload.orderId, dProcessedDate: new Date() }, { where: { id: deposit?.id }, transaction: t })
        return { alreadySuccess: false, status: jsonStatus.OK, message: messages.English.action_failure.replace('##', messages.English.cDepositeHasBeenMade), ePaymentStatus: 'C' }
      }
      return { alreadySuccess: false, status: jsonStatus.OK, message: messages.English.action_success.replace('##', messages.English.cDepositeHasBeenMade), ePaymentStatus: 'P' }
    } else {
      return { alreadySuccess: false, status: jsonStatus.NotFound, message: messages.English.not_exist.replace('##', messages.English.cDeposit) }
    }
  })
}

/**
 * Update deposit status and user balance after successful payment
 * @param {Object} object - Deposit information and related data
 * @returns {Promise} - Promise resolving with the update deposit result
 */
async function updateDepositAndBalance({ deposit, ePaymentGateway, payload, orderId, referenceId, t }) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Extracting relevant information from the deposit object
        const { iUserId, nCash = 0, nBonus = 0, nAmount, eUserType, nActualAmount = 0, nPlatformFee = 0, nApplicableTax = 0, nTaxPercentage = 0 } = deposit

        // Calculating bonus expiry date
        // const dBonusExpiryDate = await calculateBonusExpiryDate(deposit)

        // Fetching the old balance for the user, If old balance does not exist, reject with an error
        const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
        if (!oldBalance) return resolve({ alreadySuccess: true, status: jsonStatus.NotFound, message: messages.English.not_exist.replace('##', messages.English.cBalance) })

        // Updating the deposit record in the database
        const updateDepositResult = await UserDepositModel.update({
          ePaymentStatus: 'S',
          ePaymentGateway,
          sInfo: JSON.stringify(payload),
          iTransactionId: referenceId,
          iOrderId: orderId,
          dProcessedDate: new Date()
        }, {
          where: { [Op.or]: [{ iOrderId: orderId }, { iReferenceId: orderId }] },
          transaction: t
        })

        // Destructuring old balance information
        const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance
        // Updating user balance with deposit information
        await UserBalanceModel.update({
          nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${nActualAmount}`),
          nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nActualAmount}`),
          nTotalDepositAmount: literal(`nTotalDepositAmount + ${nActualAmount}`),
          nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonus}`),
          nCurrentBonus: literal(`nCurrentBonus + ${nBonus}`),
          nTotalDepositCount: literal('nTotalDepositCount + 1')
        }, {
          where: { iUserId },
          transaction: t
        })
        // Creating a passbook entry for the deposit
        const sRemarks = messages[APP_LANG].deposit_success_of.replace('##', nAmount).replace('#', ePaymentGateway) + ', ' + messages[APP_LANG].platform_fee_debited.replace('##', messages[APP_LANG].cDeposit).replace('#', nPlatformFee).replace('###', nActualAmount)
        await PassbookModel.create({ iUserId, nAmount, nActualAmount, nPlatformFee, nApplicableTax, nTaxPercentage, nCash, nBonus, eUserType, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', iUserDepositId: deposit.id, eType: 'Cr', sRemarks, dActivityDate: new Date(), iTransactionId: referenceId, sPromocode: deposit.sPromocode, eStatus: 'CMP' }, { transaction: t })

        // Updating user statistics
        await StatisticsModel.updateOne({ iUserId: mongify(iUserId) }, { $inc: { nPlatformFee: convertToDecimal(nPlatformFee), nApplicableTax, nActualDepositBalance: convertToDecimal(nActualAmount), nActualBonus: convertToDecimal(nBonus), nDeposits: convertToDecimal(nActualAmount), nCash: convertToDecimal(nActualAmount), nBonus: convertToDecimal(nBonus), nDepositCount: 1 } }, { upsert: true })
        // Resolving with the update deposit result
        return resolve(updateDepositResult)
      } catch (error) {
        // Rejecting with an error if any exception occurs
        return reject(error)
      }
    })()
  })
}

/**
 * Assign referral and promo on deposit success
 * @param {Object} object - Deposit information and update result
 * @returns {Promise} - Promise resolving on successful execution
 */
async function assignReferralAndPromoOnDepositSuccess({ deposit, updateDepositResult, t }) {
  try {
    // Assigning referral on first deposit
    await assignReferralOnFirstDeposit({ iUserId: deposit.iUserId, deposit, updateDepositResult, t })
  } catch (error) {
    // Rejecting with an error if any exception occurs
    return Promise.reject(error)
  }
}

/**
 * Assign referral on user's first deposit
 * @param {Object} object - User and deposit information
 * @returns {Promise} - Promise resolving on successful execution
 */
async function assignReferralOnFirstDeposit({ iUserId, updateDepositResult, t }) {
  try {
    // Finding user information
    const user = await UsersModel.findOne({ _id: mongify(iUserId) })

    // Extracting referral-related information from the user
    const { sReferrerRewardsOn = '', iReferredBy = '' } = user

    // Counting successful deposits for the user
    let depositCount = await UserDepositModel.count({
      where: {
        iUserId,
        ePaymentStatus: 'S'
      },
      col: 'id',
      transaction: t
    })

    // Adding the latest deposit count from the update result
    depositCount += updateDepositResult[0]

    // Checking if referral rewards are applicable and user was referred
    if (iReferredBy && sReferrerRewardsOn && sReferrerRewardsOn === 'FIRST_DEPOSIT') {
      // If the deposit count is 1, triggering referral reward processing
      if (depositCount === 1) {
        await queuePush('processReferReward', { sReferral: 'DB', iUserId: user._id })
      }
    }
  } catch (error) {
    // Rejecting with an error if any exception occurs
    return Promise.reject(error)
  }
}

/**
 * Method for listing available payment gateways for deposits and withdrawals.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise representing the handling of the payment gateways listing.
 */
function listPaymentGateways(req, res) {
  try {
    // Constructing data object with deposit and withdrawal payment gateways
    const data = {
      aDepositPaymentGateways: paymentGetaways,
      aWithdrawPaymentGateways: withdrawPaymentGetaways
    }
    return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cPaymentGateway), data })
  } catch (error) {
    return catchError('UserPayment.listPaymentGateways', error, req, res)
  }
}

module.exports = {
  generateReport,
  addUserFields,
  validateDepositRateLimit,
  listPaymentGateways,
  updateBalance,
  createDeposit
}
