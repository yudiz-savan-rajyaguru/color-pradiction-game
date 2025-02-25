/* eslint-disable no-unused-vars */
const jwt = require('jsonwebtoken')
const UsersModel = require('../model')
const OTPVerificationsModel = require('../otpverifications.model')
// const { getOTPExpiryStatus } = require('../../../helper/redis')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const {
  removenull, catchError, pick, validateEmail, getIp,
  checkCountryCode, getUserType, encryptKey, fieldsToDecrypt, mongify
} = require('../../../helper/utilities.services')
const { checkRateLimitOTP, getRateLimitStatus, queuePush } = require('../../../helper/redis')
const config = require('../../../config/config')
const { subscribeUser } = require('../../../helper/firebase.services')
const { generateOTP, verifyOTPFromProvider } = require('../../../helper/sms.services')

const { getPushTokens } = require('./common')
const { registerV4 } = require('./registerAndLoginServices')
const LocationModel = require('../../admin/adminLogs/location.model')
const { getOTPExpiryStatus } = require('../../../helper/redis')

class UserOtp {
  async sendOTP(req, res) {
    try {
      // Clean up request body
      req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sLatitude', 'sLongitude'])
      removenull(req.body)

      // Extract relevant variables from the request body
      let { sAuth } = req.body
      const { sLogin, sType, sLatitude = '', sLongitude = '' } = req.body
      let sUsername = ''
      let user

      // Check if authentication type is for Registration
      if (sAuth === 'R' || sAuth === 'L') {
        const isEmail = validateEmail(sLogin)
        const query = isEmail ? { sEmail: encryptKey(sLogin) } : { sMobNum: encryptKey(sLogin) }
        user = await UsersModel.findOne(query, null, { readPreference: 'primary' }).lean()

        // Block OTP for bot users
        if (user && user.eType === 'B') return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].user_blocked })

        // Handle registration and forgot password scenarios
        if (!user) sAuth = 'R'
        // if (user && sAuth === 'R') return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].user) })
        // if (!user && (sAuth === 'F' || sAuth === 'L')) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].user_forgot_err })
        sUsername = user ? user.sUsername : ''
      }

      // Check if authentication type is for Verification
      if (sAuth === 'V') {
        if (!req.header('Authorization')) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

        try {
          // Verify the JWT token using the secret key for user authentication
          user = await UsersModel.findByToken(req.header('Authorization'))
        } catch (err) {
          // Handle JWT verification failure
          return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
        }
        if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

        // // Internal user not able to change mobile no. or email id
        // if (user && user.bIsInternalAccount === true) {
        //   return createResponse({ req, res, statusCode: status.BadRequest, messageKey: messages.cant_change_mobile_email })
        // }

        const isEmail = validateEmail(sLogin)
        const query = isEmail ? { sEmail: encryptKey(sLogin) } : { sMobNum: encryptKey(sLogin) }
        query._id = { $ne: user._id }
        query.eType = { $ne: 'B' }

        const userExist = await UsersModel.findOne(query, null, { readPreference: 'primary' })

        if (userExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cuser) })
        sUsername = user.sUsername
      }

      // In production, only allow re-sending OTP after 30 seconds
      if (process.env.NODE_ENV === 'production') {
        const d = new Date()
        d.setSeconds(d.getSeconds() - 30)
        const exist = await OTPVerificationsModel.findOne({ ...req.body, sLogin: encryptKey(sLogin), dCreatedAt: { $gt: d } }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean()
        if (exist) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].err_resend_otp.replace('##', messages[req.userLanguage].nThirty) })
      }

      // check rate limit for otp sending from same ip at multiple time. we'll make sure not too many request from same ip will occurs.
      const [rateLimit, verifyRateLimit] = await Promise.all([
        checkRateLimitOTP(sLogin, sType, sAuth),
        getRateLimitStatus(sLogin, sType, `${sAuth}-V`) // check verify rate limit because if verification limit reached we can not send OTP
      ])

      const message = rateLimit === 'LIMIT_REACHED' ? messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotp) : messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotpVerification)
      if ((rateLimit === 'LIMIT_REACHED' || verifyRateLimit === 'LIMIT_REACHED') && (!config.TRIAL_USER_NUMBER.includes(sLogin?.toString()))) return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: message })

      // Generate OTP code
      let sCode = config.TEST_OTP

      // Check if environment is production or staging and if sLogin matches trial user number
      if (['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST') {
        sCode = config.TRIAL_USER_NUMBER.includes(sLogin) ? config.TEST_OTP : generateOTP(6)
      }
      // Include latitude and longitude in the meta data
      if (sLatitude && sLongitude) req.body.oMeta = { sLatitude, sLongitude }

      // Determine the platform
      let ePlatform = req.header('Platform')
      ePlatform = ['A', 'I', 'W'].includes(ePlatform) ? ePlatform : 'O'

      // Create OTP record in the database
      const oOtpCreate = await OTPVerificationsModel.create({ ...req.body, sLogin: encryptKey(sLogin), sCode, ePlatform, iUserId: sAuth === 'L' ? user?._id : undefined, sAuth })
      if (!oOtpCreate) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].err_otp_create })
      }

      // Send mail for forgot password OTP code
      if (sType === 'E') {
        await queuePush('SendMail', {
          sSlug: sAuth === 'F' ? 'forgot-password-email' : 'send-otp-email',
          replaceData: {
            email: sUsername,
            otp: sCode,
            from: config.SMTP_FROM
          },
          to: sLogin
        })
      }
      // Send SMS for mobile OTP
      if (sType === 'M' && ['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST' && !config.TRIAL_USER_NUMBER.includes(sLogin)) {
        await queuePush('sendSms', {
          sProvider: config.OTP_PROVIDER,
          oUser: {
            sPhone: sLogin,
            sOTP: sCode,
            iUserOtpId: oOtpCreate?._id
          }
        })
      }
      // Return success response
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].OTP_sent_succ, data: { _id: oOtpCreate?._id || '' } })
    } catch (error) {
      // Handle errors and return error response
      return catchError('UserAuthOTP.sendOTP', error, req, res)
    }
  }

  async sendOTPV2(req, res) {
    try {
      req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sLatitude', 'sLongitude'])
      removenull(req.body)
      // Extract relevant variables from the request body
      let { sAuth } = req.body
      const { sLogin, sType, sLatitude = '', sLongitude = '' } = req.body
      let sUsername = ''
      let user
      if (sAuth === 'R' || sAuth === 'L') {
        const isEmail = validateEmail(sLogin)
        const query = isEmail ? { sEmail: encryptKey(sLogin) } : { sMobNum: encryptKey(sLogin) }
        user = await UsersModel.findOne(query, null, { readPreference: 'primary' }).lean()

        // Block OTP for bot users
        if (user && user.eType === 'B') return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].user_blocked })

        // Handle registration and forgot password scenarios
        if (!user) sAuth = 'R'
        sUsername = user ? user.sUsername : ''
      }
      // Check if authentication type is for Verification
      if (sAuth === 'V') {
        if (!req.header('Authorization')) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

        try {
          user = await UsersModel.findByToken(req.header('Authorization'))
        } catch (err) {
          return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
        }
        if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

        const isEmail = validateEmail(sLogin)
        const query = isEmail ? { sEmail: encryptKey(sLogin) } : { sMobNum: encryptKey(sLogin) }
        query._id = { $ne: user._id }
        query.eType = { $ne: 'B' }

        const userExist = await UsersModel.findOne(query, null, { readPreference: 'primary' })

        if (userExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cuser) })
        sUsername = user?.sUsername
      }
      // In production, only allow re-sending OTP after 30 seconds
      if (process.env.NODE_ENV === 'production') {
        const d = new Date()
        d.setSeconds(d.getSeconds() - 30)
        const exist = await OTPVerificationsModel.findOne({ ...req.body, sLogin: encryptKey(sLogin), dCreatedAt: { $gt: d } }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean()
        if (exist) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].err_resend_otp.replace('##', messages[req.userLanguage].nThirty) })
      }
      // check rate limit for otp sending from same ip at multiple time. we'll make sure not too many request from same ip will occurs.
      const [rateLimit, verifyRateLimit] = await Promise.all([
        checkRateLimitOTP(sLogin, sType, sAuth),
        getRateLimitStatus(sLogin, sType, `${sAuth}-V`) // check verify rate limit because if verification limit reached we can not send OTP
      ])

      const message = rateLimit === 'LIMIT_REACHED' ? messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotp) : messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotpVerification)
      if (rateLimit === 'LIMIT_REACHED' || verifyRateLimit === 'LIMIT_REACHED') return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: message })

      let sCode = config.DEFAULT_OTP
      if (['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST') sCode = generateOTP(config.OTP_LENGTH)

      if (sLatitude && sLongitude) {
        const data = await LocationModel.findOne({
          oLocation: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [sLongitude || 0, sLatitude || 0]
              },
              $maxDistance: 10000
            }
          }
        }, {}, {}).lean()
        req.body.oMeta = { sLatitude, sLongitude, sCity: data?.sName, sState: data?.sState, sCountry: data?.sCountry }
      }

      // Determine the platform
      let ePlatform = req.header('Platform')
      ePlatform = ['A', 'I', 'W'].includes(ePlatform) ? ePlatform : 'O'

      // Create OTP record in the database
      await OTPVerificationsModel.create({ ...req.body, sLogin: encryptKey(sLogin), sCode, ePlatform, iUserId: sAuth === 'L' ? user?._id : undefined, sAuth })
      if (sType === 'M' && ['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST') {
        await queuePush('sendSms', {
          sProvider: config.OTP_PROVIDER,
          oUser: {
            sPhone: sLogin,
            sOTP: sCode
          }
        })
      }
      // Return success response
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].OTP_sent_succ })
    } catch (error) {
      console.log('error', error)
      return catchError('UserAuthOTP.sendOTPV2', error, req, res)
    }
  }

  async verifyOTPV2(req, res) {
    try {
      let { sAuth } = req.body

      const { sLogin, sType, sDeviceToken, sPushToken, iRequestId, sCode } = req.body

      // Pick relevant properties based on the authentication type
      if (sAuth === 'L') req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sAuthToken', 'sDeviceToken', 'idToken', 'sCountryCode', 'iRequestId', 'sCode'])
      else req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sAuthToken', 'idToken', 'sCountryCode', 'iRequestId', 'sCode'])
      req.body.sMobNum = sLogin

      // Remove null values from the request body
      removenull(req.body)

      // check rate limit for otp verify from same ip at multiple time. we'll make sure not too many request from same ip will occurs.
      // if (['production', 'staging'].includes(process.env.NODE_ENV)) {
      //   const rateLimit = await checkRateLimitOTP(sLogin, sType, `${sAuth}-V`)
      //   if (rateLimit === 'LIMIT_REACHED') return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotpVerification) })
      // }

      // const isEmail = validateEmail(sLogin)
      // const query = isEmail ? { sEmail: encryptKey(sLogin) } : { sMobNum: encryptKey(sLogin) }
      const query = { sMobNum: encryptKey(sLogin) }
      const user = await UsersModel.findOne(query, null, { readPreference: 'primary' }).lean()
      // Check if sDeviceToken is required for authentication type 'L'
      // if (user && sAuth === 'L' && !sDeviceToken) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].cdeviceToken) })
      if (!user && sAuth !== 'V') sAuth = 'R'
      if (sAuth === 'R') {
        if (config.TRIAL_USER_NUMBER.includes(sLogin)) {
          if (parseInt(sCode) !== config.TEST_OTP) {
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
          }
        } else if (['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST') {
          const oOtp = await OTPVerificationsModel.findOne({ _id: iRequestId, sLogin: encryptKey(sLogin) }).lean()
          if (!oOtp) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].invalid.replace('##', 'iRequestId') })
          const oUser = { sPhone: sLogin, sOTP: sCode, iRequestId: oOtp?.iOTPLessRequestId }
          const data = await verifyOTPFromProvider(config.OTP_PROVIDER, oUser)
          if (!data?.isSuccess) {
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
          }
        } else if (config.OTP_PROVIDER === 'TEST' && config.TEST_OTP !== parseInt(sCode)) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
        }
      }

      // Additional checks for authentication type 'V' (Verification)
      if (sAuth === 'V') {
        let user
        // Check user authorization
        if (!req.header('Authorization')) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

        // Find user by token
        try {
          user = await UsersModel.findByToken(req.header('Authorization'))
        } catch (err) {
          return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
        }

        // Check if user exists
        if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

        // Internal user not able to change mobile no. or email id
        // if (user.bIsInternalAccount === true) {
        //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].cant_change_mobile_email })
        // }

        // Check if the new email or mobile number already exists
        const isEmail = validateEmail(sLogin)
        const query = isEmail ? { sEmail: encryptKey(sLogin) } : { sMobNum: encryptKey(sLogin) }
        query._id = { $ne: user._id }
        query.eType = { $ne: 'B' }

        const userExist = await UsersModel.findOne(query, null, { readPreference: 'primary' }).lean()

        // Return error response if the new email or mobile number already exists
        if (userExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].user) })
        // Update user details based on the verification type
        if (sType === 'E') {
          await UsersModel.updateOne({ _id: mongify(user._id) }, { sEmail: encryptKey(sLogin), bIsEmailVerified: true })
        } else if (sType === 'M') {
          if (config.TRIAL_USER_NUMBER.includes(sLogin)) {
            if (parseInt(sCode) !== config.TEST_OTP) {
              return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
            }
          } else if (['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST') {
            const oOtp = await OTPVerificationsModel.findOne({ _id: iRequestId, sLogin: encryptKey(sLogin) }).lean()
            if (!oOtp) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].invalid.replace('##', 'iRequestId') })
            const oUser = { sPhone: sLogin, sOTP: sCode, iRequestId: oOtp?.iOTPLessRequestId }
            const data = await verifyOTPFromProvider(config.OTP_PROVIDER, oUser)
            if (!data?.isSuccess) {
              return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
            }
            await UsersModel.updateOne({ _id: mongify(user._id) }, { sMobNum: encryptKey(sLogin), bIsMobVerified: true })
          } else if (config.OTP_PROVIDER === 'TEST' && config.TEST_OTP !== parseInt(sCode)) {
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
          } else {
            await UsersModel.updateOne({ _id: mongify(user._id) }, { sMobNum: encryptKey(sLogin), bIsMobVerified: true })
          }
        }
      }

      // Determine the platform
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      // Additional actions for authentication type 'L' (Login)
      if (sAuth === 'L') {
        // Retrieve user details for login
        const userDetails = await UsersModel.findById(user._id, null, { readPreference: 'primary' }).lean()
        if (userDetails && userDetails.eStatus !== 'Y') {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].user_blocked })
        }
        // Generate JWT tokens
        const sToken = jwt.sign({ _id: userDetails._id.toHexString(), eType: getUserType(userDetails.eType) }, config.JWT_SECRET_USER, { expiresIn: config.JWT_VALIDITY })
        const sRefreshToken = jwt.sign({ _id: userDetails._id.toHexString(), eType: getUserType(userDetails.eType) }, config.REFRESH_TOKEN_SECRET, { expiresIn: config.REFRESH_TOKEN_VALIDITY })

        // If sPushToken is provided, update push tokens and subscribe user
        if (sPushToken) {
          await Promise.all([
            getPushTokens(userDetails, sPushToken),
            subscribeUser(sPushToken, ePlatform)
          ])
        }

        // Update user details with new push tokens, login count, and login timestamp
        await UsersModel.updateOne({ _id: mongify(userDetails._id) }, { aPushTokens: userDetails.aPushTokens, $inc: { nLogin: 1 }, dLoginAt: new Date(), $addToSet: { aDeviceToken: sDeviceToken } })

        // Queue AuthLogs and filter sensitive data for user
        const oLog = {
          iUserId: userDetails._id,
          ePlatform,
          eType: 'L',
          sIpAddress: getIp(req)
        }
        if (sDeviceToken) oLog.sDeviceToken = sDeviceToken
        await queuePush('AuthLogs', oLog)

        UsersModel.filterDataForUser(userDetails)
        if (config.TRIAL_USER_NUMBER.includes(sLogin)) {
          if (parseInt(sCode) !== config.TEST_OTP) {
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
          }
        } else if (['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST' && !config.TRIAL_USER_NUMBER.includes(sLogin)) {
          const oOtp = await OTPVerificationsModel.findOne({ _id: iRequestId, sLogin: encryptKey(sLogin) }).lean()
          if (!oOtp) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].invalid.replace('##', 'iRequestId') })
          const oUser = { sPhone: sLogin, sOTP: sCode, iRequestId: oOtp?.iOTPLessRequestId }
          const data = await verifyOTPFromProvider(config.OTP_PROVIDER, oUser)
          if (!data?.isSuccess) {
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
          }
          await UsersModel.updateOne({ _id: mongify(user._id) }, { sMobNum: encryptKey(sLogin), bIsMobVerified: true })
        } else if (config.OTP_PROVIDER === 'TEST' && config.TEST_OTP !== parseInt(sCode)) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
        }

        // Set JWT tokens in response headers and return success response
        res.header({ Authorization: sToken, RefreshToken: sRefreshToken })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].verification_success, data: userDetails, others: { Authorization: sToken, RefreshToken: sRefreshToken }, sAuth })
      }
      // Return success response for authentication type 'V' (Verification)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].verification_success, sAuth })
    } catch (error) {
      if (error.message === 'jwt expired') return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      return catchError('UserAuthOTP.verifyOTPV2', error, req, res)
    }
  }

  async verifyOTPV3(req, res) {
    try {
      let { sAuth, sCode } = req.body

      const { sLogin, sType, sDeviceToken, sPushToken } = req.body

      // Pick relevant properties based on the authentication type
      if (sAuth === 'L') req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sAuthToken', 'sDeviceToken', 'idToken', 'sCountryCode'])
      else req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sAuthToken', 'idToken', 'sCountryCode'])
      req.body.sMobNum = sLogin

      // Remove null values from the request body
      removenull(req.body)

      // Parse sCode to ensure it is a number
      sCode = parseInt(sCode)
      if (typeof sCode !== 'number') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
      const query = { sMobNum: encryptKey(sLogin) }
      const user = await UsersModel.findOne(query, null, { readPreference: 'primary' }).lean()
      if (!user && sAuth !== 'V') sAuth = 'R'

      let verificationQuery = { sLogin: encryptKey(sLogin), sCode, sAuth, sType, bIsVerify: false }
      if (['production', 'staging'].includes(process.env.NODE_ENV)) {
        // check rate limit for otp verify from same ip at multiple time. we'll make sure not too many request from same ip will occurs.
        const [rateLimit, expiredOTP] = await Promise.all([
          checkRateLimitOTP(sLogin, sType, `${sAuth}-V`),
          getOTPExpiryStatus(sLogin, sType, sAuth) // check verify rate limit because if verification limit reached we can not send OTP
        ])
        const message = rateLimit === 'LIMIT_REACHED' ? messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotp) : messages[req.userLanguage].err_otp_expired
        if (rateLimit === 'LIMIT_REACHED' || expiredOTP === 'EXPIRED') return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message })
        if (sType === 'M' && config.OTP_PROVIDER !== 'TEST') {
          // we will verify otp from third party provider
          // if (checkCountryCode(sLogin) || !validateIndianNumber(sLogin)) return createResponse({ req, res, statusCode: status.BadRequest, messageKey: messages.invalid, replacementKey: messages.mobileNumber })
          const verifyFromProvider = await verifyOTPFromProvider(
            config.OTP_PROVIDER,
            { sPhone: sLogin, sOTP: sCode }
          )
          if (!verifyFromProvider || !verifyFromProvider.isSuccess) {
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
          }
        }
        // otp lives for only 10 minutes
        const d = new Date()
        d.setMinutes(d.getMinutes() - 10)
        verificationQuery = { ...verificationQuery, dCreatedAt: { $gt: d } }
      }
      const exist = await OTPVerificationsModel.findOne(
        verificationQuery,
        null,
        { readPreference: 'primary' }
      )
        .sort({ dCreatedAt: -1 })
        .lean()
      if (!exist || exist.sCode !== sCode) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
      if (sAuth === 'V') {
        let user
        if (!req.header('Authorization')) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

        // Find user by token
        try {
          user = await UsersModel.findByToken(req.header('Authorization'))
        } catch (err) {
          return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
        }
        if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
        // Internal user not able to change mobile no. or email id
        if (user.bIsInternalAccount === true) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].cant_change_mobile_email })
        }
        const query = { sMobNum: encryptKey(sLogin) }
        query._id = { $ne: user._id }
        query.eType = { $ne: 'B' }
        const userExist = await UsersModel.findOne(query, null, { readPreference: 'primary' }).lean()
        if (userExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cuser) })
        if (sType === 'M') await UsersModel.updateOne({ _id: mongify(user._id) }, { sMobNum: encryptKey(sLogin), bIsMobVerified: true })
      }
      // Determine the platform
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      // Additional actions for authentication type 'L' (Login)
      if (sAuth === 'L') {
        // Retrieve user details for login
        const userDetails = await UsersModel.findById(user._id, null, { readPreference: 'primary' }).lean()
        if (userDetails && userDetails.eStatus !== 'Y') {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].user_blocked })
        }
        // Generate JWT tokens
        const sToken = jwt.sign({ _id: userDetails._id.toHexString(), eType: getUserType(userDetails.eType) }, config.JWT_SECRET_USER, { expiresIn: config.JWT_VALIDITY })
        const sRefreshToken = jwt.sign({ _id: userDetails._id.toHexString(), eType: getUserType(userDetails.eType) }, config.REFRESH_TOKEN_SECRET, { expiresIn: config.REFRESH_TOKEN_VALIDITY })

        // If sPushToken is provided, update push tokens and subscribe user
        if (sPushToken) {
          await Promise.all([
            getPushTokens(userDetails, sPushToken),
            subscribeUser(sPushToken, ePlatform)
          ])
        }

        // Update user details with new push tokens, login count, and login timestamp
        await UsersModel.updateOne({ _id: mongify(userDetails._id) }, { aPushTokens: userDetails.aPushTokens, $inc: { nLogin: 1 }, dLoginAt: new Date(), $addToSet: { aDeviceToken: sDeviceToken } })

        // Queue AuthLogs and filter sensitive data for user
        const oLog = {
          iUserId: userDetails._id,
          ePlatform,
          eType: 'L',
          sIpAddress: getIp(req)
        }
        if (sDeviceToken) oLog.sDeviceToken = sDeviceToken
        await queuePush('AuthLogs', oLog)

        UsersModel.filterDataForUser(userDetails)

        // Set JWT tokens in response headers and return success response
        res.header({ Authorization: sToken, RefreshToken: sRefreshToken })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].verification_success, data: userDetails, others: { Authorization: sToken, RefreshToken: sRefreshToken }, sAuth })
      }
      // Return success response for authentication type 'V' (Verification)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].verification_success, sAuth })
    } catch (error) {
      return catchError('UserAuthOTP.verifyOTPV3', error, req, res)
    }
  }

  async refreshToken(req, res) {
    try {
      // Retrieve the RefreshToken from the request headers
      const sRefreshToken = req.header('RefreshToken')
      // Check if RefreshToken is provided
      if (sRefreshToken) {
        // Find user credentials based on the RefreshToken
        const userCredentials = await UsersModel.findByRefreshToken(sRefreshToken)

        // Return unauthorized response if no user credentials found
        if (!userCredentials) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

        // Generate a new JWT token using user credentials
        const sToken = jwt.sign({ _id: (userCredentials._id).toHexString(), eType: getUserType(userCredentials.eType) }, config.JWT_SECRET_USER, { expiresIn: config.JWT_VALIDITY })

        // Set new JWT token in response headers and return success response
        res.header({ Authorization: sToken, RefreshToken: sRefreshToken })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].generate_success.replace('##', messages[req.userLanguage].cToken), others: { Authorization: sToken, RefreshToken: sRefreshToken } })
        // Alternatively, you can use the following commented code if using res.set and jsonp
        // return res.set({ Authorization: sToken, RefreshToken: sRefreshToken }).jsonp({ status: jsonStatus.OK, message: messages.generate_success.replace('##', messages.cToken), Authorization: sToken, RefreshToken: sRefreshToken })
      }
      return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].cRefreshToken) })
    } catch (err) {
      // Handle any errors and return an error response
      return catchError('UserAuthOTP.refreshToken', err, req, res)
    }
  }

  // async unSubscribeMail(req, res) {
  //   try {
  //     // const { payload } = req.query
  //     const { payload } = decodeURIComponent(req.query)

  //     const template = fs.readFileSync(config.EMAIL_TEMPLATE_PATH + 'unSubscribe.ejs', {
  //       encoding: 'utf-8' // Unicode Transformation Format (UTF).
  //     })

  //     if (!payload || payload === '') {
  //       const emailBody = ejs.render(template, { sText: 'Payload Require' })
  //       return res.send(emailBody)
  //     }
  //     const user = await UsersModel.findOne({ sEmail: payload, eStatus: 'Y' }, null, { readPreference: 'primary' }).lean()

  //     if (!user) {
  //       const emailBody = ejs.render(template, { sText: 'This user not register in application.' })
  //       return res.send(emailBody)
  //     }

  //     await UsersModel.updateOne({ _id: mongify(user._id) }, { bIsEmailUnSubscribe: true })

  //     // send response in html format with render html file
  //     const emailBody = ejs.render(template, { sText: 'You have successfully unsubscribed.' })
  //     return res.send(emailBody)
  //   } catch (err) {
  //     return catchError('UserAuthOTP.unSubscribeMail', err, req, res)
  //   }
  // }
}
module.exports = new UserOtp()
