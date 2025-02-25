const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { removenull, catchError, pick, getIp, ObjectId, decryptValue } = require('../../../helper/utilities.services')
const { getPolicies } = require('../../cms/services')
const commonModel = require('../../common/model')
const UsersModel = require('../model')

const { processRegisterAndReferBonus, checkUserExist } = require('./common')

// const client = new OAuth2Client(config.GOOGLE_CLIENT_ID_W)

class RegisterAndLogin {
  async registerV4(req, res) {
    try {
      // Extract relevant fields from the request body
      req.body = pick(req.body, ['sEmail', 'sReferCode', 'sCode', 'sMobNum', 'sDeviceToken', 'sPushToken', 'iPolicyId', 'aPolicyId', 'sProPic', 'idToken', 'sCountryCode', 'sUsername'])
      removenull(req.body)

      // Destructure the extracted fields
      let { sUsername } = req.body
      const { sEmail, sMobNum, aPolicyId, sProPic, sCountryCode = '+91' } = req.body

      // Ensure consistent username format (e.g., lowercase)
      sUsername = sUsername.toLowerCase()
      if (sUsername) {
        const userExist = await UsersModel.findOne({ $or: [{ sUsername }, { sUsername: sUsername.toLowerCase() }] }, null, { readPreference: 'primary' }).lean()
        if (userExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].username) })
      }

      // req.body?.sEmail = req.body?.sEmail.toLowerCase()
      const avatarData = await commonModel.findOne({ eType: 'A' }).lean()
      if (!sProPic && avatarData?.aProPic?.length > 0) {
        const randomIndex = Math.floor(Math.random() * avatarData?.aProPic?.length)
        req.body.sProPic = avatarData.aProPic[randomIndex]
      }

      let userConcents = []

      const Ip = getIp(req)

      // Handle policies and user consents
      if (aPolicyId?.length) {
        const policies = await getPolicies({ _id: { $in: aPolicyId }, eStatus: 'Y' })
        if (!policies?.length) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].check_policy_err })
        userConcents = policies.reduce((userConcents, policy) => {
          userConcents.push({
            iPolicyId: ObjectId(policy._id),
            sIp: Ip
          })
          return userConcents
        }, [])
      }

      // Check if the user already exists
      const result = await checkUserExist({ sUsername: req?.body?.sUsername, sMobNum, sEmail, sCountryCode })
      if (!result.isSuccess) return res.status(result.status).jsonp({ status: result.status, message: result.message, replacementKey: result.replacementKey })

      // Check if the OTP exists and is verified
      // const isOTPExist = await OTPVerificationsModel.findOne({ sLogin: encryptKey(sMobNum), sType: 'M', sAuth: 'R', sCode, bIsVerify: true }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean()
      // if (!isOTPExist || isOTPExist.sCode !== parseInt(sCode)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cotpVerification) })

      req.body.bIsMobVerified = true
      req.body.ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'
      // req.body.oUtm = oUtm
      // Process register and refer bonus
      const oProcessBonusResult = await processRegisterAndReferBonus(req.body, req.userLanguage, Ip, userConcents)
      if (oProcessBonusResult.isSuccess === false) return res.status(oProcessBonusResult.status).jsonp({ status: oProcessBonusResult.status, message: oProcessBonusResult.message })

      // const sFullName = sUsername

      if (oProcessBonusResult?.data?.user?.sEmail) oProcessBonusResult.data.user.sEmail = decryptValue(oProcessBonusResult.data.user.sEmail)
      if (oProcessBonusResult?.data?.user?.sMobNum) oProcessBonusResult.data.user.sMobNum = decryptValue(oProcessBonusResult.data.user.sMobNum)

      // Send welcome mail to new user
      // await queuePush('SendMail', {
      //   sSlug: 'welcome-email',
      //   replaceData: {
      //     firstName: sFullName[0],
      //     lastName: sFullName[1] || ''
      //   },
      //   to: sEmail
      // })

      // oProcessBonusResult.data.user = fieldsToDecrypt(aField, oProcessBonusResult.data.user)

      // Set headers and return success response
      res.header({ Authorization: oProcessBonusResult.data.Authorization, RefreshToken: oProcessBonusResult.sRefreshToken })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].reg_success, data: oProcessBonusResult.data.user, others: { Authorization: oProcessBonusResult.data.Authorization, RefreshToken: oProcessBonusResult.sRefreshToken } })
    } catch (error) {
      // Handle any errors and return an error response
      return catchError('UserAuth.registerV4', error, req, res)
    }
  }
}
module.exports = new RegisterAndLogin()
