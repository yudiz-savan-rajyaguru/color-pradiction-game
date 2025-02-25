// @ts-check
const UsersModel = require('../model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, pick, checkValidImageType, removenull, validateUsername, ObjectId, fieldsToDecrypt } = require('../../../helper/utilities.services')
const { S3_USER_PROFILE_PATH } = require('../../../config/config')
const data = require('../../../data')
const bucket = require('../../../helper/cloudStorage.services')
const UserBalanceModel = require('../../userbalance/model')
const userBalanceServices = require('../../userbalance/services')
const StatisticsModel = require('../../user/statistics/model')

class Users {
  async getV2(req, res) {
    try {
      const user = await UsersModel.findById(req.user._id, { dLoginAt: 0 }).populate({ path: 'oProfileLevel', select: ['nLevel', 'sName', 'sImage', 'oRules', 'sHexCode'] }).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      const balanceExist = await UserBalanceModel.findOne({ where: { iUserId: req.user._id.toString() }, raw: true })

      // gRPC call goes here...
      // const llc = await commonRuleServices.findRule('LCC')
      // const llc = await findCommonRule('LCC')
      // const nLeagueCreatorCom = llc ? llc.nAmount : undefined

      if (!balanceExist) {
        const openAccount = await userBalanceServices.openAccount({ iUserId: user?._id, sUsername: user?.sUsername, eType: user?.eType })
        if (openAccount.isSuccess === false) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user), data: { ...user, id: undefined, iUserId: undefined } })
        }
      }
      UsersModel.filterDataForUser(user)
      const statistics = await StatisticsModel.findOne({ iUserId: req.user._id }, { nReferrals: 1, _id: 0, nTotalReferBonus: 1 }).lean()
      const balance = await UserBalanceModel.findOne({ where: { iUserId: req.user._id.toString() }, raw: true })

      balance.eUserType = undefined

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuser), data: { ...user, ...balance, id: undefined, iUserId: undefined, ...statistics, nTotalReferBonus: statistics?.nTotalReferBonus || 0 } })
    } catch (error) {
      return catchError('Users.get', error, req, res)
    }
  }

  async updateV2(req, res) {
    try {
      let { sUsername } = req.body
      sUsername = sUsername?.toLowerCase()
      // let { dDob, sAddress } = req.body
      req.body = pick(req.body, ['sUsername', 'sProPic', 'sCountryCode'])
      removenull(req.body)
      if (sUsername && !validateUsername(sUsername)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].username) })

      const iUserId = req.user._id
      const userNameExist = await UsersModel.findOne({ $or: [{ sUsername }], _id: { $ne: iUserId } }).lean()
      if (userNameExist) {
        if (sUsername && userNameExist?.sUsername === sUsername) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].username) })
      }
      if (sUsername) {
        const user = await UsersModel.findOne({ _id: iUserId }, { sUsername: 1, bIsUsernameChanged: 1 }).lean()
        if (user?.sUsername !== sUsername && user?.bIsUsernameChanged) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].cant_change_username })
        if (user?.sUsername !== sUsername) req.body.bIsUsernameChanged = true
      }
      let user = await UsersModel.findByIdAndUpdate(iUserId, { ...req.body, sUsername }, { new: true, runValidators: true }).lean()
      UsersModel.filterDataForUser(user)

      const aField = ['sMobNum']
      user = fieldsToDecrypt(aField, user)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cprofile), data: user })
    } catch (error) {
      return catchError('Users.updateV2', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: S3_USER_PROFILE_PATH })
      // const data = await s3.signedUrl(sFileName, sContentType, S3_USER_PROFILE_PATH)
      return res.status(status.OK).json({ message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('Users.getSignedUrl', error, req, res)
    }
  }

  async userReferrals(req, res) {
    try {
      const { start = 0, limit = 10, sort = 'dCreatedAt', order, search, eReferStatus, sReferrerRewardsOn } = req.query
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { [sort]: orderBy }

      let query = { iReferredBy: ObjectId(req.user._id) }
      if (eReferStatus) { query = { ...query, eReferStatus } }
      if (sReferrerRewardsOn) { query = { ...query, sReferrerRewardsOn } }
      if (search && search.length) {
        query = {
          ...query,
          sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') }
        }
      }
      const [aResult, nCount] = await Promise.all([
        UsersModel.find(query, {
          sUsername: 1,
          nReferrerAmount: 1,
          sReferrerRewardsOn: 1,
          eReferStatus: 1,
          dCreatedAt: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        UsersModel.countDocuments(query)
      ])
      if (!aResult?.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cuserrefferals), data: [] })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserrefferals), data: { aResult, nCount } })
    } catch (error) {
      return catchError('Users.userReferrals', error, req, res)
    }
  }

  listOfReason(req, res) {
    try {
      // Return a success response with the list of reasons for deleting accounts
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].reasons), data: { aReason: data.reasonsForDeleteAccount } })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('Users.listOfReason', error, req, res)
    }
  }

  async changeKYCStatus(req, res) {
    try {
      await UsersModel.updateOne({ _id: req.user._id }, { eKYCStatus: 'p' })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].kyc) })
    } catch (error) {
      return catchError('Users.listOfReason', error, req, res)
    }
  }
}

module.exports = new Users()
