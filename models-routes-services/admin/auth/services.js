const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const AdminsModel = require('../../admin/model')
const OTPVerificationsModel = require('../otpverifications.model')
const adminServices = require('../adminLogs/services')
const AdminAuthLogsModel = require('../authlogs.model')
const RolesModel = require('../roles/model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { removenull, catchError, pick, checkAlphanumeric, getIp, validateMobile, generateOTP, encryptKeyPromise, decryptValuePromise, decryptIfExist, mongify, validatePassword, ObjectId } = require('../../../helper/utilities.services')
const config = require('../../../config/config.js')
const { checkRateLimit, queuePush } = require('../../../helper/redis')

const { checkLocationValidity, checkCodeValidity } = require('./common.js')
const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)

class AdminAuth {
  /**
   * Admin login using OTP or Password.
   * @param {*} req  Request body containing 'sLogin', 'sDeviceToken', 'sPassword', 'sPushToken'.
   * @param {*} res  Response with OTP send message or Login successful message with jwt token.
   * @returns OTP send message or Login admin with jwt token.
   */
  async loginV3(req, res) {
    try {
      // Check the authentication method for admin login (OTP or Password)
      if (config.ADMIN_LOGIN_AUTHENTICATION === 'otp') {
        // Process for OTP-based login
        req.body = pick(req.body, ['sLogin', 'sDeviceToken'])
        removenull(req.body)
        let { sLogin, sDeviceToken } = req.body
        const sType = validateMobile(sLogin) ? 'E' : 'M'
        sLogin = sLogin.toLowerCase().trim()
        sLogin = await encryptKeyPromise(sLogin)
        // Find admin by email or mobile number
        const admin = await AdminsModel.findOne({ $or: [{ sEmail: sLogin }, { sMobNum: sLogin }], eStatus: 'Y' }).populate({ path: 'aRole' })
        if (!admin) {
          return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].auth_failed })
        }
        // Check for recent OTP verification requests within the last 30 seconds
        if (process.env.NODE_ENV === 'production') {
          const d = new Date()
          d.setSeconds(d.getSeconds() - 30)
          const exist = await OTPVerificationsModel.findOne({ sLogin, sType, sAuth: 'L', dCreatedAt: { $gt: d } }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 })
          if (exist) {
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].err_resend_otp.replace('##', messages[req.userLanguage].nThirty) })
          }
        }
        // Generate OTP code (For testing purposes, a static code is used in non-production environments)
        let sCode = 8697
        if (['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST') sCode = generateOTP(4)
        // Send OTP verification based on email or mobile number
        if (sType === 'E') {
          const decEmail = await decryptValuePromise(admin.sEmail)
          await Promise.all([
            OTPVerificationsModel.create({ sLogin, sCode, sType, sAuth: 'L', sDeviceToken, iAdminId: admin._id }),
            queuePush('SendMail', {
              sSlug: 'send-otp-email',
              replaceData: {
                email: admin.sUsername,
                otp: sCode,
                from: config.SMTP_FROM
              },
              to: decEmail
            })
          ])
        } else if (sType === 'M' && ['production', 'staging'].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST') {
          const decLogin = await decryptValuePromise(sLogin)
          await Promise.all([
            OTPVerificationsModel.create({ sLogin, sCode, sType, sAuth: 'L', sDeviceToken, iAdminId: admin._id }),
            queuePush('sendSms', {
              sProvider: config.OTP_PROVIDER,
              oUser: {
                sPhone: decLogin,
                sOTP: sCode
              }
            })
          ])
        }
        // Respond with OTP sent message
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].OTP_sent_succ })
      } else {
        // Process for Password-based login
        req.body = pick(req.body, ['sLogin', 'sPassword', 'sPushToken', 'sDeviceToken', 'sLatitude', 'sLongitude'])
        removenull(req.body)
        const { sLatitude, sLongitude } = req.body
        let { sLogin, sPushToken, sPassword, sDeviceToken } = req.body
        // Check rate limit for password sending from the same IP at multiple times
        // Check if location details are valid
        const isLocationValid = await checkLocationValidity(sLatitude, sLongitude)
        if (isLocationValid) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].location_details_required })
        }
        const rateLimit = await checkRateLimit(20, `rlpassword:${sLogin}`, getIp(req))
        if (rateLimit === 'LIMIT_REACHED') return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cpassword) })

        // Normalize and encrypt login details
        sLogin = sLogin.toLowerCase().trim()
        sLogin = await encryptKeyPromise(sLogin)
        // Find admin by email or mobile number
        let admin = await AdminsModel.findOne({ $or: [{ sEmail: sLogin }, { sMobNum: sLogin }], eStatus: 'Y' })
        if (!admin) {
          return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].auth_failed })
        }
        // Compare hashed password
        if (!bcrypt.compareSync(sPassword, admin.sPassword)) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].auth_failed })
        }
        // Check rate limit again to prevent excessive login attempts
        if (rateLimit === 'LIMIT_REACHED') {
          return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cpassword) })
        }
        const sNewLatitude = sLatitude || ''
        const sNewLongitude = sLongitude || ''
        // Generate new JWT token and refresh token
        const sRefreshToken = jwt.sign({ _id: (admin._id), eType: admin.eType, sLatitude: admin?.sLatitude || sNewLatitude, sLongitude: admin?.sLongitude || sNewLongitude }, config.REFRESH_TOKEN_SECRET, { expiresIn: config.REFRESH_TOKEN_VALIDITY })
        const newToken = {
          sToken: jwt.sign({ _id: (admin._id).toHexString(), eType: admin.eType, sLatitude: admin?.sLatitude || sNewLatitude, sLongitude: admin?.sLongitude || sNewLongitude }, config.JWT_SECRET, { expiresIn: config.JWT_VALIDITY }),
          sIpAddress: getIp(req),
          sPushToken,
          sLatitude,
          sLongitude
        }
        // Manage JWT tokens and update login information
        if (admin.aJwtTokens.length < config.LOGIN_HARD_LIMIT_ADMIN || config.LOGIN_HARD_LIMIT_ADMIN === 0) {
          admin.aJwtTokens.push(newToken)
        } else {
          admin.aJwtTokens.splice(0, 1)
          admin.aJwtTokens.push(newToken)
        }
        admin.dLoginAt = new Date()
        admin.bLoggedOut = false
        await admin.save()
        admin = await AdminsModel.findOne({ $or: [{ sEmail: sLogin }, { sMobNum: sLogin }], eStatus: 'Y' }).populate({ path: 'aRole' }).lean()
        // Log successful login attempt
        const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'
        await AdminAuthLogsModel.create({ iAdminId: admin._id, ePlatform, eType: 'L', sDeviceToken, sIpAddress: getIp(req) })
        // Filter sensitive data and decrypt email/mobile number
        admin = AdminsModel.filterData(admin)
        if (admin.sEmail) admin.sEmail = await decryptValuePromise(admin.sEmail)
        if (admin.sMobNum) admin.sMobNum = await decryptValuePromise(admin.sMobNum)
        // Respond with successful login message and tokens

        return res.status(status.OK).set({ Authorization: newToken.sToken, RefreshToken: sRefreshToken }).jsonp({
          status: jsonStatus[200],
          message: messages[req.userLanguage].succ_login,
          data: admin,
          Authorization: newToken.sToken,
          RefreshToken: sRefreshToken
        })
      }
    } catch (error) {
      // Handle errors and return appropriate response
      return catchError('AdminAuth.loginV3', error, req, res)
    }
  }

  /**
   * Verifies OTP for admin login, incorporating location details.
   * @param {*} req  - Request object containing 'sLogin', 'sType', 'sAuth', 'sCode', 'sDeviceToken', 'sLatitude', 'sLongitude'.
   * @param {*} res  - Response object for verifying OTP with a successful message and JWT token.
   * @returns Response for verifying OTP with a successful message and JWT token.
   */
  async verifyOTPV2(req, res) {
    try {
      req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sCode', 'sDeviceToken', 'sLatitude', 'sLongitude'])
      let { sLogin, sType, sAuth, sCode, sDeviceToken, sPushToken, sLatitude, sLongitude } = req.body
      removenull(req.body)

      // Check if location details are valid
      const isLocationValid = await checkLocationValidity(sLatitude, sLongitude)
      if (isLocationValid) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].location_details_required })
      }

      sCode = parseInt(sCode)
      // Check if the provided OTP code is valid
      const isCodeValid = await checkCodeValidity(sCode)
      if (isCodeValid) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
      }
      // const envs = ['production', 'staging', 'dev']
      // const checkEnv = envs.includes(process.env.NODE_ENV)

      // Check rate limit for OTP verification from the same IP
      // if (checkEnv) {
      //   const rateLimit = await checkRateLimitOTP(sLogin, sType, `${sAuth}-V`)
      //   if (rateLimit === 'LIMIT_REACHED') return createResponse({ req, res, statusCode: status.TooManyRequest, messageKey: messages.limit_reached, replacementKey: messages.cotpVerification })
      // }

      // Encrypt login details for validation
      sLogin = await encryptKeyPromise(sLogin)

      // Check if OTP verification record exists and the provided code matches
      const exist = await OTPVerificationsModel.findOne({ sLogin, sType, sAuth, bIsVerify: false }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean()

      if (!exist) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })

      if (exist) {
        if (new Date(exist.dNextTryDate).getTime() > Date.now()) {
          return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotpVerification) })
        }
      }
      if (!exist || exist.sCode !== sCode) {
        let query = {}
        if (exist) {
          if (exist.nThresholdCount >= 5) {
            query = { $inc: { nFailedOTPAttemptCount: 1 }, nThresholdCount: 0, dNextTryDate: new Date(new Date().getTime() + (30 * 60 * 1000)) }
            await OTPVerificationsModel.updateOne(
              { _id: exist._id },
              query,
              { new: true, runValidators: true, readPreference: 'primary' }
            ).lean()
            return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotpVerification) })
          } else {
            query = { $inc: { nThresholdCount: 1, nFailedOTPAttemptCount: 1 } }
            await OTPVerificationsModel.updateOne(
              { _id: exist._id },
              query,
              { new: true, runValidators: true, readPreference: 'primary' }
            ).lean()
          }
        }
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].verify_otp_err })
      }

      const platforms = ['A', 'I', 'W']
      const platformHeader = req.header('Platform')
      const isPlatformIncluded = platforms.includes(platformHeader)
      const ePlatform = isPlatformIncluded ? platformHeader : 'O'

      // Update OTP verification record to mark it as verified
      const [, AdminDetails = {}] = await Promise.all([
        OTPVerificationsModel.findByIdAndUpdate(exist._id, { bIsVerify: true }, { runValidators: true, readPreference: 'primary' }).lean(),
        AdminsModel.findById(exist.iAdminId, null, { readPreference: 'primary' }).populate({ path: 'aRole' }).lean()
      ])

      const sNewLatitude = sLatitude || ''
      const sNewLongitude = sLongitude || ''

      // Generate new JWT token and refresh token
      const sRefreshToken = jwt.sign({ _id: (AdminDetails._id).toHexString(), eType: AdminDetails.eType, sLatitude: sNewLatitude, sLongitude: sNewLongitude }, config.REFRESH_TOKEN_SECRET, { expiresIn: config.REFRESH_TOKEN_VALIDITY })

      const newToken = {
        sToken: jwt.sign({ _id: (AdminDetails._id).toHexString(), eType: AdminDetails.eType, sLatitude: sNewLatitude, sLongitude: sNewLongitude }, config.JWT_SECRET, { expiresIn: config.JWT_VALIDITY }),
        sPushToken,
        sLatitude,
        sLongitude
      }
      // Update admin's JWT tokens
      const isLoginHardLimitAdmin = AdminDetails.aJwtTokens.length < config.LOGIN_HARD_LIMIT_ADMIN || config.LOGIN_HARD_LIMIT_ADMIN === 0
      if (isLoginHardLimitAdmin) {
        AdminDetails.aJwtTokens.push(newToken)
      } else {
        AdminDetails.aJwtTokens.splice(0, 1)
        AdminDetails.aJwtTokens.push(newToken)
      }

      // Update admin record with new tokens and login information
      await Promise.all([
        AdminsModel.updateOne({ _id: mongify(AdminDetails._id) }, { aJwtTokens: AdminDetails.aJwtTokens, dLoginAt: new Date(), bLoggedOut: false }),
        AdminAuthLogsModel.create({ iAdminId: AdminDetails._id, ePlatform, eType: exist.sAuth, sDeviceToken, sIpAddress: getIp(req) })
      ])

      // Filter sensitive data before sending the response
      AdminsModel.filterData(AdminDetails)
      await decryptIfExist(AdminDetails, ['sEmail', 'sMobNum'])

      // Return successful response with new JWT token and refresh tokens
      return res.status(status.OK).set({ Authorization: newToken.sToken, RefreshToken: sRefreshToken }).jsonp({ status: jsonStatus[200], message: messages[req.userLanguage].verification_success, data: AdminDetails, Authorization: newToken.sToken, RefreshToken: sRefreshToken })
    } catch (error) {
      return catchError('AdminAuth.verifyOTPV2', error, req, res)
    }
  }

  /**
 * Logout admin from the admin panel.
 * @param {*} req  - Request object containing admin id.
 * @param {*} res  - Response object for logout message.
 * @returns Response for logout message.
 */
  async logout(req, res) {
    try {
      // Remove auth token from the database at logout time
      await AdminsModel.updateOne({ _id: mongify(req.admin._id) }, { $pull: { aJwtTokens: { sToken: req.header('Authorization') } } })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].succ_logout })
    } catch (error) {
      return catchError('AdminAuth.logout', error, req, res)
    }
  }

  /**
 * Create a sub-admin for the super user.
 * @param {*} req  - Request object containing 'aRole', 'sName', 'sUsername', 'sEmail', 'sMobNum', 'sPassword', 'eStatus'.
 * @param {*} res  - Response object for the message 'admin create successfully'.
 * @returns Response for the message 'admin create successfully'.
 */
  async createSubAdminV4(req, res) {
    try {
      req.body = pick(req.body, ['aRole', 'sName', 'sUsername', 'sEmail', 'sMobNum', 'sPassword', 'eStatus'])

      let { sName, sUsername, sEmail, sMobNum, aRole, eStatus } = req.body

      sEmail = sEmail.toLowerCase().trim()

      // Only super admin has rights to create sub-admin
      if (req.admin.eType !== 'SUPER') return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].access_denied })

      // Check if the username is alphanumeric
      if (!checkAlphanumeric(sUsername)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, messageKey: messages[req.userLanguage].must_alpha_num })

      // Validate the mobile number
      if (validateMobile(sMobNum)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, messageKey: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].mobileNumber) })

      // Check if the role assigned to the sub-admin is active or not
      const roles = await RolesModel.find({ _id: { $in: aRole }, eStatus: 'Y' }, { _id: 1, aPermissions: 1, sName: 1 }).lean()
      if (!roles.length) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, messageKey: messages[req.userLanguage].do_not_exist.replace('##', messages[req.userLanguage].croles) })
      }

      sEmail = await encryptKeyPromise(sEmail)
      sMobNum = await encryptKeyPromise(sMobNum)

      // Check if the sub-admin already exists using the username, mobile number, or email
      const adminExist = await AdminsModel.findOne({ $or: [{ sEmail }, { sMobNum }, { sUsername }] }).lean()
      if (adminExist && adminExist.sUsername === sUsername) {
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, messageKey: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].username) })
      }
      if (adminExist && adminExist.sMobNum === sMobNum) {
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, messageKey: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].mobileNumber) })
      }
      if (adminExist && adminExist.sEmail === sEmail) {
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, messageKey: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].email) })
      }

      const newAdmin = new AdminsModel({ ...req.body, sEmail, sMobNum, aRole: roles, eType: 'SUB', ...req.project })
      await newAdmin.save()

      // Log the record for future purposes to know which super admin has created a sub-admin
      const { _id: iAdminId } = req.admin
      const oNewFields = { sName, sUsername, sEmail, sMobNum, aRole, eStatus }
      const logData = { oOldFields: {}, oNewFields, iAdminId: mongify(iAdminId), sIP: getIp(req), eKey: 'SUB', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await adminServices.adminLog(req, res, logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].subAdmin) })
    } catch (error) {
      return catchError('AdminAuth.createSubAdminV4', error, req, res)
    }
  }

  /**
 * Get a new token from refreshToken for admin to process login in the background if the JWT token expires.
 * @param {*} req  - Request object containing the refreshToken in the header.
 * @param {*} res  - Response object for the new token with a success message.
 */
  async refreshToken(req, res) {
    try {
      // Extract the refresh token from the request headers
      const sRefreshToken = req.header('RefreshToken')

      const decode = jwt.decode(sRefreshToken)

      if (!decode) {
        return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      }

      // validate token from keyclock or not

      req.sTokenTypeProvider = 'admin'

      // If a refresh token is provided
      if (sRefreshToken && req.sTokenTypeProvider === 'admin') {
        // Find the admin associated with the refresh token
        const admin = await AdminsModel.findByRefreshToken(sRefreshToken)

        // If no admin is found, return an Unauthorized status with a message
        if (!admin) {
          return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
        }
        let sToken = ''
        let newToken = ''

        sToken = jwt.sign({ _id: (admin._id).toHexString(), eType: admin.eType, sLatitude: admin?.sLatitude || '', sLongitude: admin?.sLongitude || '' }, config.JWT_SECRET, { expiresIn: config.JWT_VALIDITY })
        newToken = {
          sToken
        }

        // If the number of JWT tokens for the admin is less than the hard limit or if there is no limit
        if (admin.aJwtTokens.length < config.LOGIN_HARD_LIMIT_ADMIN || config.LOGIN_HARD_LIMIT_ADMIN === 0) {
          // Add the new token to the list of JWT tokens for the admin
          admin.aJwtTokens.push(newToken)
        } else {
          // If the limit has been reached, remove the oldest token and add the new one
          admin.aJwtTokens.splice(0, 1)
          admin.aJwtTokens.push(newToken)
        }

        // Update the admin in the database with the new list of JWT tokens and the current login time
        await AdminsModel.updateOne({ _id: mongify(admin._id) }, { aJwtTokens: admin.aJwtTokens, dLoginAt: new Date() })

        // Return the new JWT token and the refresh token in the response headers and body
        return res.set({ Authorization: sToken, RefreshToken: sRefreshToken }).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].generate_success.replace('##', messages[req.userLanguage].cToken), Authorization: sToken, RefreshToken: sRefreshToken })
      }

      return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].cRefreshToken) })
    } catch (err) {
      return catchError('AdminAuth.refreshToken', err, req, res)
    }
  }

  async changePassword(req, res) {
    try {
      // Extract relevant fields from the request body
      req.body = pick(req.body, ['sOldPassword', 'sNewPassword'])
      removenull(req.body)

      // Destructure the extracted fields
      const { sOldPassword, sNewPassword } = req.body

      const admin = await AdminsModel.findById(req.admin._id).lean()

      // Check if the provided old password matches the admin's current password
      if (!bcrypt.compareSync(sOldPassword, admin.sPassword)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].wrong_old_field })

      // Check if the old password and new password are the same
      if (sOldPassword === sNewPassword) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].old_new_field_same.replace('##', messages[req.userLanguage].cpassword) })

      // Validate the new password
      if (!validatePassword(sNewPassword)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid_pass })

      // Update the user's password and set the password change timestamp
      await AdminsModel.updateOne({ _id: ObjectId(admin._id) }, { dPasswordchangeAt: new Date(), sPassword: bcrypt.hashSync(sNewPassword, salt) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpassword) })
    } catch (error) {
      return catchError('AdminAuth.changePassword', error, req, res)
    }
  }

  async changeUsername(req, res) {
    try {
      // Extract relevant fields from the request body
      req.body = pick(req.body, ['sName'])
      removenull(req.body)
      // Destructure the extracted fields
      const { sName } = req.body

      const admin = await AdminsModel.findById(req.admin._id).lean()

      // Check if the old password and new password are the same
      if (admin.sName === sName) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].old_new_field_same.replace('##', messages[req.userLanguage].username) })

      // Update the user's password and set the password change timestamp
      await AdminsModel.updateOne({ _id: ObjectId(admin._id) }, { sName })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].username) })
    } catch (error) {
      return catchError('AdminAuth.changePassword', error, req, res)
    }
  }

  async getAdminDetails(req, res) {
    try {
      let oAdmin = await AdminsModel.findById(req.admin._id).lean()
      if (!oAdmin) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].admin) })
      oAdmin = AdminsModel.filterData(oAdmin)
      if (oAdmin.sEmail) oAdmin.sEmail = await decryptValuePromise(oAdmin.sEmail)
      if (oAdmin.sMobNum) oAdmin.sMobNum = await decryptValuePromise(oAdmin.sMobNum)
      return res.status(status.OK).jsonp({
        status: jsonStatus[200],
        message: messages[req.userLanguage].succ_login,
        data: oAdmin
      })
    } catch (error) {
      return catchError('AdminAuth.getAdminDetails', error, req, res)
    }
  }
}

module.exports = new AdminAuth()
