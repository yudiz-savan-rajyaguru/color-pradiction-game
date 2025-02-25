// @ts-check
/* eslint-disable no-unused-vars */
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const UsersModel = require('../model')
const { genDynamicLinkV2, subscribeUserToTopicNotification } = require('../../../helper/firebase.services')
const { messages, status: jsonStatus } = require('../../../helper/api.responses')
const { checkAlphanumeric, validateUsername, handleCatchError, randomStr, encryptKey, ObjectId, fieldsToDecrypt, getUserType, generateUsername } = require('../../../helper/utilities.services')
const { queuePush } = require('../../../helper/redis')
const config = require('../../../config/config')
const { subscribeUser, unsubscribeUsers } = require('../../../helper/firebase.services')
const { UsersDBConnect } = require('../../../database/mongoose')
const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)
const { createUserPreferences } = require('../../userPreferences/common')
const common = require('../../../config/common')
const UserConcentsModel = require('../userConcent.model')
const { generateOTP } = require('../../../helper/sms.services')
const DeletedAccountsModel = require('../deletedaccounts.model')
const { RECURSION_LIMIT } = require('../../../config/common')
const { findSettingV2 } = require('../../setting/services')
const { openAccount, revertOpenedAccount } = require('../../userbalance/services')
const { userReferBonus } = require('../../userbalance/common')
const { findRule } = require('../../commonRules/services')
const KYCModel = require('../../kyc/model')
const oUserProfileLevelServices = require('../userProfileLevel/services')
const { processAuthLogs, processInactiveUsers } = require('../../queue/adminQueue')
const { sendSms } = require('../../queue/smsQueue')
const enums = require('../../../data')
const { fn, col } = require('sequelize')
const StatisticModel = require('../statistics/model')
const PassbookModel = require('../../passbook/model')

// Function to check if a user already exists
const checkUserExist = async (body, userLanguage = 'English') => {
  try {
    // Destructuring properties from the request body
    const { sUsername, sCountryCode = '+91' } = body
    let { sMobNum } = body

    // Validate username is alphanumeric
    if (!checkAlphanumeric(sUsername)) return { isSuccess: false, status: jsonStatus.BadRequest, message: messages.English.must_alpha_num }

    // Validate username format
    if (!validateUsername(sUsername)) return { isSuccess: false, status: jsonStatus.BadRequest, message: messages.English.invalid.replace('##', messages.English.username) }

    // Validate mobile number length
    if (sMobNum?.length !== 10) return { isSuccess: false, status: jsonStatus.BadRequest, message: messages.English.invalid.replace('##', messages.English.mobileNumber) }

    // Encrypt email and mobile number for secure storage
    if (sMobNum) sMobNum = encryptKey(sMobNum)

    // Check if user already exists in the database
    const userExist = await UsersModel.findOne({ $or: [{ sMobNum, sCountryCode }, { sUsername }, { sUsername: sUsername.toLowerCase() }] }, null, { readPreference: 'primary' }).lean()

    // Handle scenarios for existing users
    if (userExist && userExist?.eType === 'B') return { isSuccess: false, status: jsonStatus.NotFound, message: messages.English.user_blocked }
    // if (userExist && userExist?.sUsername.toLowerCase() === sUsername.toLowerCase()) return { isSuccess: false, status: jsonStatus.ResourceExist, message: messages.English.already_exist.replace('##', messages.English.username) }
    if (userExist && userExist?.sMobNum === sMobNum) return { isSuccess: false, status: jsonStatus.ResourceExist, message: messages.English.already_exist.replace('##', messages.English.mobileNumber) }

    // Return success if user doesn't exist
    return { isSuccess: true, status: jsonStatus.OK, message: messages.English.successfully.replace('##', messages.English.checkUser) }
  } catch (error) {
    // Handle and log errors
    handleCatchError(error)
    return { isSuccess: false, status: jsonStatus.InternalServerError, message: messages.English.err_user_check }
  }
}

const processRegisterAndReferBonus = async (body, userLanguage = 'English', ip, userConcents = []) => {
  const { sDeviceId, sPushToken, sCountryCode = '+91' } = body
  let { sUsername, sReferCode } = body
  sUsername = sUsername.toLowerCase()
  body.sUsername = sUsername.toLowerCase()
  sReferCode = sReferCode?.toUpperCase()
  let bAfterTransaction = false
  let { sMobNum, sEmail } = body
  const unEncryptedMobileNumber = sMobNum
  sMobNum = encryptKey(sMobNum)
  if (body?.sEmail) sEmail = encryptKey(sEmail)
  let referredBy
  if (sReferCode) {
    referredBy = await UsersModel.findOne({ sReferCode }).lean()
    if (!referredBy) {
      return { isSuccess: false, status: jsonStatus.BadRequest, message: messages.English.invalid.replace('##', messages.English.cReferralCode) }
    }
  }

  const transactionOptions = {
    readPreference: 'primary',
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' }
  }
  const checkDeletedUser = await UsersModel.findOne({ eStatus: 'D', eType: 'U', sMobNum, sCountryCode }).lean()
  if (checkDeletedUser) body.bEligibleForBenifits = false
  const session = await UsersDBConnect?.startSession()
  session?.startTransaction(transactionOptions)
  let iUserId, eUserType, newUser, authToken, refreshToken
  try {
    // const sProtectedPassword = bcrypt.hashSync(body.sPassword ?? '', salt)
    const aDeviceToken = sDeviceId ? [sDeviceId] : []

    const sNewReferCode = await genReferCodeV2()
    const sNewReferLink = await genDynamicLinkV2(enums?.eLinkType?.map?.REFER, sNewReferCode)

    const oUser = {
      ...body,
      sMobNum,
      sEmail,
      sReferCode: sNewReferCode,
      aDeviceToken,
      sReferLink: sNewReferLink
    }

    let user = await UsersModel.create(
      [
        oUser
      ],
      { session }
    )

    if (Array.isArray(user)) {
      user = user[0]
    }
    await KYCModel.create([{ iUserId: user?._id }])
    const Authorization = jwt.sign(
      { _id: user?._id?.toHexString(), eType: getUserType(user?.eType) },
      config.JWT_SECRET_USER,
      { expiresIn: config.JWT_VALIDITY }
    )
    const sRefreshToken = jwt.sign({ _id: (user?._id)?.toHexString(), eType: getUserType(user?.eType) }, config.REFRESH_TOKEN_SECRET, { expiresIn: config.REFRESH_TOKEN_VALIDITY })
    iUserId = user?._id
    eUserType = user?.eType

    const account = await openAccount({
      iUserId: user?._id.toString(),
      sUsername,
      eType: user?.eType
    })

    if (account.isSuccess === false) {
      throw new Error(
        messages.English.went_wrong_with.replace(
          '##',
          messages.English.cpassbook
        )
      )
    }

    let registerBonus
    let deletedUser = false
    const deletedUserShouldNotGetBonus = await findSettingV2({ sKey: 'DELETED_USER_SHOULD_NOT_GET_BONUS' })
    if (deletedUserShouldNotGetBonus?.eStatus === 'Y') {
      deletedUser = await DeletedAccountsModel.findOne({ sMobNum: unEncryptedMobileNumber, sCountryCode }, { sMobNum: 1 }).lean()
    }
    if (referredBy && !deletedUser) {
      user.iReferredBy = referredBy?._id
      const [registerReferBonus, referCodeBonus] = await Promise.all([
        findRule('RR'),
        findRule('RCB')
      ])

      // We'll give refer reward from whom refer code through new user registered
      if (registerReferBonus) {
        const { sRewardOn = '' } = registerReferBonus
        if (sRewardOn === 'REGISTER') {
          const refer = await userReferBonus({
            iUserId: referredBy._id,
            rule: registerReferBonus,
            sReferCode: referredBy.sReferCode,
            sUserName: referredBy.sUsername,
            eType: referredBy.eType,
            iReferById: user._id
          })

          if (refer.isSuccess === false) throw new Error(messages.English.went_wrong_with.replace('##', messages.English.bonus))
          // add nTotalReferBonus into the statistics
          const totalReferBonus = await PassbookModel.findOne({
            attributes: [
              [fn('SUM', col('nBonus')), 'nTotalReferBonus']
            ],
            where: {
              iUserId: referredBy._id.toString(),
              eTransactionType: 'Refer-Bonus'
            },
            raw: true
          })
          const referBonusTotal = totalReferBonus && totalReferBonus?.nTotalReferBonus ? totalReferBonus?.nTotalReferBonus : 0
          if (referBonusTotal) await StatisticModel.updateOne({ iUserId: referredBy._id }, { nTotalReferBonus: referBonusTotal })
          // add notifications for bonus
          const aNotifications = []
          aNotifications.push(queuePush('pushNotification:registerReferBonus', {
            _id: referredBy._id,
            referedTo: user?.sUsername
          }))
          if (registerReferBonus.eType === 'B') aNotifications.push(queuePush('pushNotification:bonusCredit', { sUserId: referredBy._id?.toString(), nAmount: registerReferBonus.nAmount, dCreatedAt: new Date() }))
          await Promise.all(aNotifications)
          user.eReferStatus = 'S'
        }
        user.sReferrerRewardsOn = sRewardOn
        user.nReferrerAmount = registerReferBonus.nAmount || 0
      }
      // We'll give refer code bonus to new user because they participate in referral code program
      if (referCodeBonus) {
        const refer = await userReferBonus({
          iUserId: user._id,
          rule: referCodeBonus,
          sReferCode: referredBy.sReferCode,
          sUserName: user.sUsername,
          eType: user.eType,
          iReferById: referredBy._id
        })
        // const refer = await userBalanceServices.referAddBonus({ iUserId: user._id, rule: referCodeBonus, sReferCode: referredBy.sReferCode, sUserName: user.sUsername, eType: user.eType })

        if (refer.isSuccess === false) {
          throw new Error(
            messages.English.went_wrong_with.replace(
              '##',
              messages.English.bonus
            )
          )
        }
        // add notification for bonus
        const aNotifications = []
        setTimeout(() => {
          aNotifications.push(queuePush('pushNotification:referCodeBonus', {
            _id: user?._id,
            referredBy: referredBy?.sUsername
          }))
        }, 60000) // Add Push Notification after 1 minute as new users of Android and iOS are not getting notifications
        user.nReferAmount = referCodeBonus.nAmount || 0
        if (referCodeBonus.eType === 'B') {
          setTimeout(() => {
            aNotifications.push(queuePush('pushNotification:bonusCredit', { sUserId: user._id?.toString(), nAmount: referCodeBonus.nAmount, dCreatedAt: new Date() }))
          }, 60000) // Add Push Notification after 1 minute as new users of Android and iOS are not getting notifications
        }
        await Promise.all(aNotifications)
      }
      // } else if (affiliateBy && !deletedUser) {
      //   user.iAffiliateBy = iAffiliateId
      //   const aAffiliateEvents = affiliateBy.oEventData?.aEvents
      //   const oRegisterEvent = aAffiliateEvents.find(event => event.sName === 'REGISTER')
      //   if (oRegisterEvent.nValue) {
      //     await affiliateEventBonus({
      //       iUserId: user._id.toString(),
      //       sUsername: user.sUsername,
      //       iAffiliateId,
      //       oEvent: oRegisterEvent
      //     })
      //   }
    } else {
      // We'll give register bonus to all new user who don't register with refer code.
      if (!deletedUser) {
        registerBonus = await findRule('RB')
        const refer = await userReferBonus({
          iUserId: user._id.toString(),
          rule: registerBonus,
          sReferCode: user.sReferCode,
          sUserName: user.sUsername,
          eType: user.eType
        })
        if (refer.isSuccess === false) {
          throw new Error(
            messages.English.went_wrong_with.replace(
              '##',
              messages.English.bonus
            )
          )
        }
        // add notification for bonus
        const aNotifications = []
        setTimeout(() => {
          aNotifications.push(queuePush('pushNotification:registerBonus', { _id: user._id }))
        }, 60000)

        if (registerBonus?.eType === 'B') {
          setTimeout(() => {
            aNotifications.push(queuePush('pushNotification:bonusCredit', { sUserId: user._id?.toString(), nAmount: registerBonus.nAmount, dCreatedAt: new Date() }))
          }, 40000)
        }
        // Add Push Notification
        await Promise.all(aNotifications)
      }
    }
    newUser = user
    authToken = Authorization
    refreshToken = sRefreshToken
    await session?.commitTransaction()
    await oUserProfileLevelServices.updateUserProfileLevel({ iUserId: user._id?.toString(), nXP: 0 })
    bAfterTransaction = true
    await UsersModel.updateOne(
      { _id: ObjectId(user?._id) },
      {
        sReferrerRewardsOn: user?.sReferrerRewardsOn,
        iReferredBy: user?.iReferredBy,
        nReferAmount: user?.nReferAmount,
        nReferrerAmount: user?.nReferrerAmount,
        eReferStatus: user?.eReferStatus || 'P',
        dLoginAt: new Date()
        // iAffiliateBy: user?.iAffiliateBy
      }
    )

    await createUserPreferences(user?._id)
    if (sPushToken) {
      await getPushTokens(user, sPushToken)
      await Promise.all([
        subscribeUserToTopicNotification(sPushToken, body.ePlatform),
        subscribeUser(sPushToken, body.ePlatform),
        UsersModel.updateOne({ _id: user?._id }, { aPushTokens: user?.aPushTokens })
      ])
    }

    await queuePush('AuthLogs', {
      iUserId: user?._id,
      ePlatform: body.ePlatform,
      eType: 'R',
      sDeviceToken: sDeviceId,
      sIpAddress: ip
    })
    if (userConcents?.length) {
      for (const userConcent of userConcents) {
        userConcent.iUserId = user?._id
      }
      await UserConcentsModel.insertMany(userConcents)
    }
    UsersModel.filterDataForUser(user)
    const aField = ['sEmail', 'sMobNum', 'sAddress', 'dDob']

    user = fieldsToDecrypt(aField, user)
    return { isSuccess: true, status: jsonStatus.OK, message: messages.English.reg_success, data: { user, Authorization }, sRefreshToken }
  } catch (error) {
    if (iUserId && eUserType) {
      // await userBalanceServices.revertOpenedAccount({
      //   iUserId,
      //   eType: eUserType
      // })
      await revertOpenedAccount({
        iUserId,
        eType: eUserType
      })
    }
    if (!bAfterTransaction) session.abortTransaction()
    else return { isSuccess: true, status: jsonStatus.OK, message: messages.English.reg_success, data: { user: newUser, Authorization: authToken }, sRefreshToken: refreshToken }
    handleCatchError(error)
    if (error.code === 112) return { isSuccess: false, status: jsonStatus.InternalServerError, message: messages.English.register_err }
    return { isSuccess: false, status: jsonStatus.InternalServerError, message: messages.English.error }
  } finally {
    session.endSession()
  }
}

// Function to generate a unique referral code
const genReferCodeV2 = async (sName, recursionCounter = 0) => {
  try {
    // Set the initial length of the referral code
    let nCodeLen = common.REFERRAL_CODE_LENGTH

    // Increase code length if recursion limit is reached
    if (recursionCounter >= RECURSION_LIMIT) {
      nCodeLen = nCodeLen + 1
      recursionCounter = 0
    }

    // Generate a random referral code
    const sReferCode = randomStr(nCodeLen, 'referral')

    // Check if the generated code already exists in the database
    const codeExist = await UsersModel.countDocuments({ $or: [{ sReferCode }, { sReferCode: sReferCode.toUpperCase() }] })

    // If the code is unique and has the correct length, return the code
    if (!codeExist && sReferCode.toString().length === nCodeLen) return sReferCode.toUpperCase()
    else {
      // If not unique or not the correct length, recursively generate a new code
      return genReferCodeV2(sName, ++recursionCounter)
    }
  } catch (error) {
    // Handle errors and log them
    handleCatchError(error)
    return new Error(error)
  }
}

// In this function if new token is not present in array its subscribed to topic, if hard limit is reached token is unsubscribed
async function getPushTokens(oUser, sPushToken) {
  try {
    // User can login in LOGIN_HARD_LIMIT time.
    if (oUser?.aPushTokens?.length < config.LOGIN_HARD_LIMIT || config.LOGIN_HARD_LIMIT === 0) {
      checkTokens(sPushToken, oUser?.aPushTokens || [])
    } else {
      const sRemovedToken = oUser.aPushTokens.splice(0, 1)
      if (sRemovedToken) await unsubscribeUsers(sRemovedToken)
      checkTokens(sPushToken, oUser?.aPushTokens)
    }
  } catch (err) {
    handleCatchError(err)
  }
}
// this function checks whether the given token is present in user token array
function checkTokens(sPushToken, aPushTokens = []) {
  if (aPushTokens.length) {
    if (!aPushTokens.includes(sPushToken)) {
      aPushTokens.push(sPushToken)
    }
  } else {
    aPushTokens.push(sPushToken)
  }
}

// To get new generated username
const getUniqueUserName = async (sName) => {
  try {
    let sUsername = sName.replace(/\s/g, '').toLowerCase()
    if (sUsername.length > 15) sUsername = sUsername.slice(0, -(sUsername.length - 15))
    if (sUsername.length < 5) {
      const randomNumber = generateOTP(5 - sUsername.length)
      sUsername = sUsername.concat(randomNumber)
    }
    const verified = await checkUserName(sUsername)
    if (verified instanceof Error) return new Error('Username verification failed!')
    return verified
  } catch (error) {
    return new Error(error)
  }
}

// To verify if username already exist then increment counter
const checkUserName = async (sUsername) => {
  try {
    const exists = await UsersModel.findOne({ sUsername }, { sUsername: 1 }).lean()
    if (exists) {
      let nDigit = exists.sUsername.match(/\d+/g) ? exists.sUsername.match(/\d+/g)[0] : 0
      nDigit = Number(nDigit) || 0
      sUsername = exists.sUsername.match(/[a-zA-Z]+/g)[0].concat(nDigit + 1)
      return await checkUserName(sUsername)
    } else {
      return sUsername
    }
  } catch (error) {
    return new Error(error)
  }
}

// function getVerifyProfile(profile) {
//   return new Promise((resolve, reject) => {
//     (() => {
//       try {
//         verifier.verifyProfile(profile, function (err, res) {
//           if (err) {
//             reject(err)
//           } else {
//             resolve(res)
//           }
//         })
//       } catch (error) {
//         reject(error)
//       }
//     })()
//   })
// }

const genUniqueUsername = async () => {
  // Generate a new username with a random preffix
  const sUName = generateUsername()

  // Check if the username already exists in the database
  const isExist = await UsersModel.findOne({ sUsername: encryptKey(sUName) }).lean()

  // If the username does not exist, return it
  if (!isExist) return sUName

  // Otherwise, generate a new username recursively
  return genUniqueUsername()
}

module.exports = {
  checkUserExist,
  processRegisterAndReferBonus,
  genReferCodeV2,
  getPushTokens,
  // getVerifyProfile,
  checkUserName,
  genUniqueUsername
}

setTimeout(() => {
  processAuthLogs()
  processInactiveUsers()
  sendSms()
}, 2000)
