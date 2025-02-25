const jwt = require('jsonwebtoken')

const UsersModel = require('../model')
const UserSessionModel = require('../userSession.model')
const { blackListToken, redisClient } = require('../../../helper/redis')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const {
  removenull, catchError, pick, randomStr, encryptKey, decryptValue, ObjectId, mongify
} = require('../../../helper/utilities.services')
const config = require('../../../config/config.js')
const bucket = require('../../../helper/cloudStorage.services')
const DeletedAccountsModel = require('../deletedaccounts.model')
const { S3_BUCKET_NAME } = require('../../../config/config.js')
const { genUniqueUsername } = require('./common')

const PassbookModel = require('../../passbook/model')
const DepositModel = require('../../userDeposit/model.js')
const WithdrawalModel = require('../../userWithdraw/model.js')
const UserBalanceModel = require('../../userbalance/model')
const StatisticsModel = require('../statistics/model')
const ProfileLevelModel = require('../../profileLevel/model.js')
const commonModel = require('../../common/model')
const KYCModel = require('../../kyc/model')

const SettingModel = require('../../setting/model.js')
const UserPreferenceModel = require('../../userPreferences/model.js')
const { processLoginStreak } = require('../../../middlewares/common.js')
const { findSettingV2 } = require('../../setting/services.js')
const { eventStatus } = require('../../../data.js')
const EventModel = require('../../event/model.js')
const EventParticipantModel = require('../../event-participant/model.js')

const isUserNameExist = async () => {
  const randomUser = await getRandomUser()
  const { sMobNum, sUsername } = randomUser
  const isUserExists = await UsersModel.countDocuments({ $or: [{ sMobNum, sCountryCode: '+91' }, { sUsername }], eStatus: { $ne: 'D' } })
  if (!isUserExists) {
    return randomUser
  } else {
    return isUserNameExist()
  }
}

const getRandomUser = async () => {
  const sUsername = await genUniqueUsername()
  return {
    sUsername,
    eType: 'B',
    sCountryCode: '+91',
    sMobNum: encryptKey('91' + parseInt((Math.random() * 9 + 1) * Math.pow(10, 7), 10)),
    ePlatform: 'O',
    bIsEmailVerified: true,
    bIsMobVerified: true,
    eStatus: 'Y'
  }
}

class UserAuth {
  async getRandomSystemUser(nCount = 10) {
    const aSystemUsers = []
    const aUser = await redisClient.srandmember('SystemUsers', nCount)
    aUser.forEach(e => aSystemUsers.push(JSON.parse(e)?._id))
    return aSystemUsers
  }

  async feedSystemUser(nUsers = 1) {
    try {
      const oUserCount = await UsersModel.countDocuments({ eType: 'B', eStatus: { $ne: 'D' } }).lean()
      if (oUserCount === 0) {
        let sUser = 0
        const aSystemUsers = []
        const oProfileLevels = await ProfileLevelModel.findOne({ nLevel: 1 }).lean()
        if (!oProfileLevels) return
        while (sUser < parseInt(nUsers)) {
          const randomUser = await isUserNameExist()
          const { sUsername } = randomUser
          const user = await UsersModel.create(randomUser)
          aSystemUsers.push(JSON.stringify(user))
          jwt.sign({ _id: (user._id).toHexString(), eType: user.eType }, config.JWT_SECRET_USER)
          await Promise.all([
            PassbookModel.create({
              iUserId: user._id.toString(),
              eUserType: 'B',
              eTransactionType: 'Opening',
              sRemarks: `${sUsername} Initial Account Opened`,
              dActivityDate: new Date(),
              iProfileLevelId: oProfileLevels?._id.toString()
            }),
            UserBalanceModel.create({ iUserId: user._id.toString(), eUserType: 'B' }),
            StatisticsModel.create([{ iUserId: user._id, eUserType: 'B' }])
          ])
          sUser++
        }
        await redisClient.sadd('SystemUsers', ...aSystemUsers)
        console.log('SYSTEM USER CREATED')
      }
    } catch (error) {
      console.log('ERROR IN FEEDING SYSTEM USER', error)
    }
  }

  async addBots(req, res) {
    try {
      const { nUsers = 20 } = (req?.body || {})
      let sUser = 0
      const aBotUsers = await UsersModel.find({ eType: 'B', eStatus: { $ne: 'D' } }).lean()
      if (aBotUsers?.length > 20) {
        await redisClient.sadd('SystemUsers', ...aBotUsers.map(user => JSON.stringify(user)))
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].reg_success })
      }
      const aSystemUsers = []
      const oProfileLevels = await ProfileLevelModel.findOne({ nLevel: 1 }).lean()
      if (!oProfileLevels) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cProfileLevel) })
      while (sUser < parseInt(nUsers)) {
        const randomUser = await isUserNameExist()
        const { sUsername } = randomUser
        const user = await UsersModel.create(randomUser)
        aSystemUsers.push(JSON.stringify(user))
        jwt.sign({ _id: (user._id).toHexString(), eType: user.eType }, config.JWT_SECRET_USER)
        await Promise.all([
          PassbookModel.create({
            iUserId: user._id.toString(),
            eUserType: 'B',
            eTransactionType: 'Opening',
            sRemarks: `${sUsername} Initial Account Opened`,
            dActivityDate: new Date(),
            iProfileLevelId: oProfileLevels?._id.toString()
          }),
          UserBalanceModel.create({ iUserId: user._id.toString(), eUserType: 'B' }),
          StatisticsModel.create([{ iUserId: user._id, eUserType: 'B' }])
        ])
        sUser++
      }
      await redisClient.sadd('SystemUsers', ...aSystemUsers)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].reg_success })
    } catch (error) {
      return catchError('UserAuth.addBots', error)
    }
  }

  async logout(req, res) {
    try {
      const sToken = req.header('Authorization')
      await UsersModel.updateOne({ _id: ObjectId(req.user._id) }, { $pull: { aPushTokens: { sToken } } })
      // await unsubscribeUsers(sToken)
      // blackListToken(sToken)
      // await redisClient.del(`at:${req.header('Authorization')}`)
      // cachegoose.clearCache(`at:${sToken}`)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].succ_logout })
    } catch (error) {
      return catchError('UserAuth.logout', error, req, res)
    }
  }

  /**
 *
 * @param {*} req
 * @param {*} res
 * This function removes all user related data from his contests and all and stores it actual data in a new
 * collection deleted users along with location information
 */
  async deleteAccountV2(req, res) {
    try {
      const sToken = req.header('Authorization')
      const { sReason, sLatitude, sLongitude } = req.body
      const user = await UsersModel.findOne({ _id: ObjectId(req.user._id) }).lean()
      if (!user) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].auth_failed })
      if (user.eStatus !== 'Y') { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].user_blocked }) }
      // validation for the if pending orders are there in live event or pending deposit and pending withdrawal
      const aEventIds = await EventModel.find({ eStatus: { $in: [eventStatus?.map?.STARTED, eventStatus?.map?.PENDING_OUTCOME] } }, { _id: 1 }).lean()
      const [nEventParticipantCnt, nPendingDepositCnt, nPendingWithdrawalCnt] = await Promise.all([
        await EventParticipantModel.countDocuments({ iUserId: user?._id.toString(), iEventId: { $in: aEventIds } }),
        await DepositModel.count({ where: { iUserId: user?._id.toString(), ePaymentStatus: 'P' } }),
        await WithdrawalModel.count({ where: { iUserId: user?._id.toString(), ePaymentStatus: 'P' } })
      ])
      if (nPendingDepositCnt > 0 || nPendingWithdrawalCnt > 0 || nEventParticipantCnt > 0) {
        const reasons = []
        if (nPendingDepositCnt > 0) {
          reasons.push(messages[req.userLanguage].pending_deposits.replace('##', nPendingDepositCnt))
        }
        if (nPendingWithdrawalCnt > 0) {
          reasons.push(messages[req.userLanguage].pending_withdrawals.replace('##', nPendingWithdrawalCnt))
        }
        if (nEventParticipantCnt > 0) {
          reasons.push(messages[req.userLanguage].active_events.replace('##', nEventParticipantCnt))
        }
        const detailedMessage = `${messages[req.userLanguage].delete_account_restricted} ${reasons.join(', ')}.`
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: detailedMessage })
      }
      const data = await SettingModel.findOne({ sKey: 'DELETE_ACCOUNT_CHECK_BALANCE', eStatus: 'Y' })
      if (data) {
        const userBalanceCheck = await UserBalanceModel.findOne({ where: { iUserId: req.user._id.toString() }, raw: true })
        if (userBalanceCheck) {
          if (((userBalanceCheck?.nCurrentDepositBalance || 0) > 0) || ((userBalanceCheck?.nCurrentWinningBalance || 0) > 0)) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].delete_account_balance_check })
        }
      }

      const nUserNameCount = await UsersModel.countDocuments({ sUsername: new RegExp('^.*' + user.sUsername + '.*', 'i') })
      const randomNumber = randomStr(3, 'private')
      const dDeletedAt = Date.now()
      const changeInfo = {
        $set: {
          eStatus: 'D',
          sProPic: '',
          sUsername: `${user.sUsername}_${String.fromCharCode(nUserNameCount + 64)}`,
          sMobNum: encryptKey(decryptValue(user.sMobNum) + `_${randomNumber} `),
          sEmail: encryptKey(decryptValue(user.sEmail) + `_${randomNumber} `),
          aPushTokens: [],
          dDeletedAt,
          sReason
        }
      }

      const deletedUser = {
        iUserId: req.user._id,
        sUsername: user.sUsername,
        sMobNum: decryptValue(user.sMobNum),
        sEmail: decryptValue(user.sEmail),
        dCreatedAt: user.dCreatedAt,
        dDeletedAt,
        bIsEmailVerified: user.bIsEmailVerified,
        bIsMobVerified: user.bIsMobVerified,
        eType: user.eType,
        eStatus: 'D',
        sReason,
        // bIsInternalAccount: user.bIsInternalAccount,
        ePlatform: user.ePlatform,
        oCoordinates: [{
          sLatitude,
          sLongitude
        }],
        sCountryCode: user?.sCountryCode
      }

      const sBucketName = S3_BUCKET_NAME
      const bucketParams = {
        Bucket: sBucketName,
        Key: user?.sProPic
      }
      if (user?.sProPic) {
        const data = await commonModel.findOne({ eType: 'A' }).lean()
        if (!data?.aProPic.includes(user.sProPic)) { await bucket.deleteObject(bucketParams) }
      }
      await UsersModel.updateOne({ _id: ObjectId(req.user._id) }, changeInfo)
      await DeletedAccountsModel.create(deletedUser)
      // PreferencesModel.updateOne({ iUserId: ObjectId(req.user._id) }, changePreferences)
      blackListToken(sToken)
      const iUserId = user?._id.toString()
      await KYCModel.updateOne({ iUserId: mongify(iUserId) }, { $set: { eStatus: 'D' } })
      await UserPreferenceModel.deleteOne({ iUserId: mongify(iUserId) })
      // cachegoose.clearCache(`at:${sToken}`)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].caccountdelete) })
    } catch (error) {
      return catchError('UserAuth.deleteAccountV2', error, req, res)
    }
  }

  async validateToken(req, res) {
    try {
      // Extract relevant fields from the request body
      req.body = pick(req.body, ['nLongitude', 'nLatitude', 'sPushToken', 'sDeviceToken', 'nVersion'])

      // Remove null values from the request body
      removenull(req.body)

      // Verify the JWT token from the request body
      const decoded = jwt.verify(req.body.sPushToken, config.JWT_SECRET_USER)

      // Check if the user exists based on the decoded user ID
      const user = await UsersModel.countDocuments({ _id: ObjectId(decoded._id) })

      // Determine the user's platform based on the request header
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      // Create a user session record in the database
      await UserSessionModel.create({ ...req.body, ePlatform, iUserId: req.user._id })

      // Return success response indicating if the user exists
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].action_success, data: { bExist: !!user } })
    } catch (error) {
      // Handle any errors and return an error response
      return catchError('UserAuth.validateToken', error, req, res)
    }
  }

  /**
 * This function is made to store user session and its device properties
 * This api will be called every time when app is open, so this will be a useful api to manage login streak
 */
  async storeSessionData(req, res) {
    try {
      // Extract relevant fields from the request body
      req.body = pick(req.body, ['sLongitude', 'sLatitude', 'sDeviceToken', 'sVersion', 'oDeviceInfo'])

      // Remove null values from the request body
      removenull(req.body)

      // Extract the JWT token from the request header
      const sToken = req.header('Authorization') // field name is changed from sPushToken to sToken as we are storing JWT token and not FCM token

      // Verify and decode the JWT token
      const decoded = jwt.verify(sToken, config.JWT_SECRET_USER)

      // Determine the user's platform based on the request header
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'
      // Create a user session record in the database
      await UserSessionModel.create({ ...req.body, ePlatform, iUserId: req.user._id, sToken })

      // Check if the user exists based on the decoded user ID
      const user = await UsersModel.countDocuments({ _id: ObjectId(decoded._id) })
      if (!user) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].auth_failed })

      // Find the LOGIN_STREAK setting
      const loginStreak = await findSettingV2({ sKey: 'LOGIN_STREAK' }, { eStatus: true })
      // If LOGIN_STREAK setting is enabled, process login streak
      if (loginStreak?.eStatus === 'Y') {
        const response = await processLoginStreak({ _id: req.user._id, userLanguage: req.userLanguage })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].processed_successfully?.replace('##', messages[req.userLanguage]?.streak), streak: response.streak, streakStatus: response.streakStatus })
      }

      // Return success response if LOGIN_STREAK setting is not enabled
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].csession), data: {} })
    } catch (error) {
      // Handle any errors and return an error response
      return catchError('UserAuth.storeSessionData', error, req, res)
    }
  }

  // this api will be called to check whether a refer code exists in db when user enters a refer code
  async checkReferCode(req, res) {
    let { sCode } = req.body
    sCode = sCode.toUpperCase()
    const user = await UsersModel.findOne({ sReferCode: sCode }, { sReferCode: 1 }, { readPreference: 'primary' }).lean()
    if (!user) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cReferralCode) })
    else return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].valid.replace('##', messages[req.userLanguage].cReferralCode) })
  }

  async findUsers(query = {}, projection = {}, sorting = {}, limit = 0) {
    // Encrypt mobile number in the query if present
    if (query?.sMobNum) {
      query.sMobNum = encryptKey(query.sMobNum)
    }

    // Convert user IDs in the query to ObjectId if present
    let aUserId = query?._id?.$in
    if (aUserId?.length > 0) {
      aUserId = query?._id?.$in.map((item) => ObjectId(item))
      query._id.$in = aUserId
    }

    // Modify the query to perform a case-insensitive search on name and username if a search parameter is provided
    if (query?.search) {
      query = {
        $or: [
          { sUsername: new RegExp('^.*' + query.search + '.*', 'i') }
        ]
      }
    }

    // Find user data based on the modified query, projection, sorting, and limit criteria
    const userData = await UsersModel.find(query, projection).sort(sorting).limit(limit).lean()
    return userData
  }

  async findUser(query = {}, projection = {}, sorting = {}, limit = 0) {
    const userData = await UsersModel.findOne(query, projection).sort(sorting).lean()
    return userData
  }

  async checkExistWithValidation(req, res) {
    try {
      // Destructure request body properties
      const { sType, sValue, sCountryCode = '+91' } = req.body
      let exist
      let existVal
      if (sType === 'M') {
        // Validate Indian mobile number
        // if (!await validateIndianMobile(sValue)) {
        //   return createResponse({ req, res, statusCode: status.BadRequest, messageKey: messages.invalid, replacementKey: messages.mobileNumber })
        // }
        exist = await UsersModel.findOne(
          { sMobNum: encryptKey(sValue), sCountryCode },
          { _id: 0, sMobNum: 1 },
          { readPreference: 'primary' }
        ).lean()
        existVal = messages[req.userLanguage].mobileNumber
      }
      if (exist) {
        if (exist.eType === 'B') {
          return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].user_blocked })
        }
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', existVal) })
      } else {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].not_exist.replace('##', existVal) })
      }
    } catch (error) {
      // Handle any errors and return an error response
      return catchError('UserAuth.checkExistWithValidation', error, req, res)
    }
  }

  async autoGenerateUsername(req, res) {
    try {
      const username = await genUniqueUsername(req.body.sName)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].username_generate_success, data: { sUsername: username } })
    } catch (error) {
      return catchError('UserAuth.autoGenerateUsername', error, req, res)
    }
  }
}

// eslint-disable-next-line no-unused-vars
const genReferCode = () => new Promise((resolve, reject) => {
  const sReferCode = randomStr(6, 'referral')

  UsersModel.findOne({ sReferCode }).then(codeExist => {
    if (!codeExist && sReferCode.toString().length === 6) {
      return resolve(sReferCode)
    } else {
      return genReferCode().then(resolve).catch(reject)
    }
  }).catch(error => {
    reject(error)
  })
})

const oUserAuthServices = new UserAuth()
setTimeout(() => {
  oUserAuthServices?.feedSystemUser()
}, 2000)

module.exports = oUserAuthServices
