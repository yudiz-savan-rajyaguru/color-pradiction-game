/* eslint-disable no-unused-vars */
const UsersModel = require('../model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, getPaginationValues, pick, projectionFields, getIp, encryptKey, decryptValue, replaceSensitiveInfo, validateEmail, validateMobile, createResponse, ObjectId, fieldsToDecrypt, fieldsToReset } = require('../../../helper/utilities.services')
const data = require('../../../data')
const DeletedAccountsModel = require('../deletedaccounts.model')
const { checkAdminAuthorization, decryptUserInfoAsPerPermission } = require('../../../helper/authorization')
const OTPVerificationsModel = require('../otpverifications.model')
const { createAdminLog } = require('../../admin/adminLogs/handler')
const StatisticsModel = require('../../user/statistics/model')
const moment = require('moment')

class Admins {
  async activeList(req, res) {
    try {
      // Extract parameters from the query
      const { start = 0, limit = 10, search } = req.query

      let query = { eStatus: 'Y' }
      // Apply search criteria if a search term is provided
      if (search && search.length) {
        query = {
          ...query,
          $or: [
            { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          ]
        }
      }

      // Further filter the query based on type and status criteria
      query = { ...query, eType: 'U', eStatus: { $ne: 'D' } }

      let [usersList, total] = await Promise.all([
        UsersModel.find(query, {
          sName: 1,
          sUsername: 1,
          sEmail: 1,
          sMobNum: 1,
          dCreatedAt: 1
        }).sort({ dCreatedAt: -1 }).skip(Number(start)).limit(Number(limit)).lean(),
        UsersModel.countDocuments(query)
      ])

      // Check user permission for email and mobile number, and decrypt accordingly
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      if (response.status === 200) {
        usersList = await decryptUserInfoAsPerPermission(usersList, true)
      } else {
        usersList = await decryptUserInfoAsPerPermission(usersList, false)
      }

      // Return the success response with the user details
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusers), data: { results: usersList, total } })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('Users.listV2', error, req, res)
    }
  }

  async listV2(req, res) {
    try {
      // Extract parameters from the query
      const { start = 0, limit = 10, order, search, mobile, email, ePlatform, datefrom, dateto, isFullResponse } = req.query

      // Determine the sorting order based on the provided 'order' parameter
      const orderBy = order && order === 'asc' ? 1 : -1

      // Construct the sorting criteria
      const sorting = { dCreatedAt: orderBy }

      // Build the initial query based on the provided parameters
      let query = mobile ? { bIsMobVerified: true } : {}
      query = ePlatform ? { ...query, ePlatform } : query
      query = email ? { ...query, bIsEmailVerified: true } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      // Apply search criteria if a search term is provided
      if (search && search.length) {
        query = {
          ...query,
          $or: [
            { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { sEmail: encryptKey(search) },
            { sMobNum: encryptKey(search) }
          ]
        }
      }

      // Further filter the query based on type and status criteria
      query = { ...query, eType: 'U', eStatus: { $ne: 'D' } }

      // Retrieve the list of users based on the constructed query
      let usersList
      if ([true, 'true'].includes(isFullResponse)) {
        // Validate date range if the full response is requested
        if (!datefrom || !dateto) {
          return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].date_filter_err })
        }
        // Fetch the users with full response details
        usersList = await UsersModel.find(query, {
          sName: 1,
          sUsername: 1,
          sEmail: 1,
          sMobNum: 1,
          // bIsEmailVerified: 1,
          bIsMobVerified: 1,
          sProPic: 1,
          eType: 1,
          eGender: 1,
          eStatus: 1,
          iReferredBy: 1,
          sReferCode: 1,
          iStateId: 1,
          dDob: 1,
          iCountryId: 1,
          iCityId: 1,
          sAddress: 1,
          nPinCode: 1,
          dLoginAt: 1,
          sCountryCode: 1,
          // dPasswordchangeAt: 1,
          dCreatedAt: 1,
          // bIsInternalAccount: 1,
          ePlatform: 1,
          iProfileLevelId: 1
          // oUtm: 1
        }).populate({ path: 'oProfileLevel' }).sort(sorting).lean()
      } else {
        // Fetch a paginated list of users
        usersList = await UsersModel.find(query, {
          sName: 1,
          sUsername: 1,
          sEmail: 1,
          sMobNum: 1,
          // bIsEmailVerified: 1,
          bIsMobVerified: 1,
          sProPic: 1,
          eType: 1,
          eGender: 1,
          eStatus: 1,
          iReferredBy: 1,
          sReferCode: 1,
          iStateId: 1,
          dDob: 1,
          iCountryId: 1,
          iCityId: 1,
          sAddress: 1,
          nPinCode: 1,
          dLoginAt: 1,
          dCreatedAt: 1,
          ePlatform: 1,
          sCountryCode: 1,
          iProfileLevelId: 1
        }).populate({ path: 'oProfileLevel' }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }

      // Check user permission for email and mobile number, and decrypt accordingly
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      if (response.status === 200) {
        usersList = await decryptUserInfoAsPerPermission(usersList, true)
      } else {
        usersList = await decryptUserInfoAsPerPermission(usersList, false)
      }

      // Return the success response with the user details
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusers), data: { results: usersList } })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('Users.listV2', error, req, res)
    }
  }

  async getCounts(req, res) {
    try {
      // Extract parameters from the query
      const { search, mobile, email, datefrom, ePlatform, dateto } = req.query

      // Build the initial query based on the provided parameters
      let query = mobile ? { bIsMobVerified: true } : {}
      query = ePlatform ? { ...query, ePlatform } : query
      query = email ? { ...query, bIsEmailVerified: true } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      // Apply search criteria if a search term is provided
      if (search && search.length) {
        query = {
          ...query,
          $or: [
            { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { sEmail: encryptKey(search) },
            { sMobNum: encryptKey(search) }
          ]
        }
      }

      // Further filter the query based on type and status criteria
      query = { ...query, eType: 'U', eStatus: { $ne: 'D' } }

      // Count the number of users based on the constructed query
      const count = await UsersModel.countDocuments({ ...query })

      // Return the success response with the user count
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusersCount), data: { count } })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('Users.getCounts', error, req, res)
    }
  }

  async adminGet(req, res) {
    try {
      const user = await UsersModel.findOne({ _id: req.params.id, eType: 'U' }).populate({ path: 'oProfileLevel' }).lean()
      if (!user) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cprofile) })

      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      let allowDecrypt = false
      if (response.status === 200) {
        allowDecrypt = true
      }
      UsersModel.filterDataForAdmin(user, allowDecrypt)
      // gRPC call goes here....
      const statistics = await StatisticsModel.findOne({ iUserId: req.params.id }, { nReferrals: 1, _id: 0 }).lean()
      const data = { ...user, ...statistics }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cprofile), data })
    } catch (error) {
      return catchError('Users.adminGet', error, req, res)
    }
  }

  async adminUpdate(req, res) {
    try {
      const { sEmail, sMobNum, eStatus, sProPic, bIsMobVerified, bIsEmailVerified, sCountryCode } = req.body
      req.body = pick(req.body, ['sName', 'eGender', 'eStatus', 'sReferCode', 'dDob', 'sAddress', 'nPinCode', 'sEmail', 'sMobNum', 'iCityId', 'iStateId', 'iCountryId', 'sUsername', 'bIsEmailVerified', 'bIsMobVerified', 'sCountryCode', 'sProPic'])

      let { sUsername } = req?.body || {}
      sUsername = sUsername.toLowerCase()
      // if user has access of personal info then update
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'W', req)
      if (sMobNum && response.status !== 200) return res.status(response.status).jsonp({ status: response.status, message: response.message })

      if (sMobNum && response.status !== 200) return res.status(response.status).jsonp({ status: response.status, message: response.message })
      const projection = projectionFields(req.body)

      const iUserId = req.params.id

      const oOldFields = await UsersModel.findOne({ _id: iUserId }, { ...projection, sEmail: 1, sMobNum: 1, aPushTokens: 1, _id: 0, sCountryCode: 1 }).lean()
      if (!oOldFields) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserProfile) })
      if (eStatus && eStatus === 'N') {
        // const { aPushTokens } = oOldFields
        await UsersModel.updateOne({ _id: ObjectId(iUserId) }, { $set: { aPushTokens: [] } })
        // aPushTokens.map((token) => {
        //   // blackListToken(token.s)
        //   // cachegoose.clearCache(`at:${token.sToken}`)
        // })
      }

      const { _id: iAdminId } = req.admin
      const userExist = await UsersModel.findOne({ $or: [{ sMobNum: encryptKey(sMobNum), sCountryCode }, { sUsername }], _id: { $ne: iUserId } }).lean()
      if (userExist) {
        if (sMobNum && userExist.sMobNum === encryptKey(sMobNum)) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].mobileNumber) })
        if (sEmail && userExist.sEmail && userExist.sEmail === encryptKey(sEmail)) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].email) })
        if (sUsername && userExist.sUsername === sUsername) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].username) })

        if (sEmail && userExist.sEmail !== encryptKey(sEmail)) req.body.bIsEmailVerified = true
        if (sMobNum && userExist.sMobNum !== encryptKey(sMobNum)) req.body.bIsMobVerified = true
      }

      if (bIsEmailVerified === true) {
        const sEmail = req.body.sEmail || decryptValue(oOldFields?.sEmail)
        if (!(validateEmail(sEmail))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].email) })
        req.body.bIsEmailVerified = true
      }
      if (bIsMobVerified === true) {
        const sMobNum = req.body.sMobNum || decryptValue(oOldFields?.sMobNum)
        if (validateMobile(sMobNum)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].mobileNumber) })
        req.body.bIsMobVerified = true
      }

      if (req.body.sEmail) req.body.sEmail = encryptKey(req.body.sEmail)
      if (req.body.sMobNum) req.body.sMobNum = encryptKey(req.body.sMobNum)
      if (req.body.dDob) req.body.dDob = encryptKey(req.body.dDob)
      if (req.body.sAddress) req.body.sAddress = encryptKey(req.body.sAddress)
      const user = await UsersModel.findByIdAndUpdate(iUserId, { ...req.body, sProPic }, { new: true, runValidators: true }).lean()

      const oNewFields = { ...req.body }
      let logData = { oOldFields, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: ObjectId(iUserId), eKey: 'P', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      logData = await replaceSensitiveInfo(logData)
      await createAdminLog(logData)

      UsersModel.filterDataForAdmin(user)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cuser), data: user })
    } catch (error) {
      return catchError('Users.adminUpdate', error, req, res)
    }
  }

  // async listCity(req, res) {
  //   try {
  //     // List of City (Static) only be added in DB from backend developer, it'll not be add and update from admin
  //     let { start, limit } = getPaginationValues(req.query)
  //     if (!start || !limit) {
  //       start = 0
  //       limit = 10
  //     }
  //     const data = await findUserCity({ nStateId: Number(req.query.nStateId), limit: parseInt(start) + parseInt(limit), skip: parseInt(start) })

  //     return createResponse({ req, res, statusCode: status.OK, messageKey: messages.success, replacementKey: messages.cUsersCity, data })
  //   } catch (error) {
  //     return catchError('Users.listCity', error, req, res)
  //   }
  // }

  async adminRecommendation(req, res) {
    try {
      let { sSearch, nLimit } = req.query
      sSearch = !sSearch ? '' : sSearch
      nLimit = !nLimit ? 10 : parseInt(nLimit)

      const sValue = { $regex: new RegExp('^.*' + sSearch + '.*', 'i') }
      const query = { $or: [{ sName: sValue }, { sUsername: sValue }, { sEmail: encryptKey(sValue) }, { sMobNum: encryptKey(sValue) }] }

      let [data, response] = await Promise.all([
        UsersModel.find(query, { _id: 1, sName: 1, sEmail: 1, sUsername: 1, sMobNum: 1 }).limit(nLimit).lean(),
        checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      ])
      data = data.map(value => {
        const aField = ['sEmail', 'sMobNum']
        if (response.status === 200) {
          value = fieldsToDecrypt(aField, value)
        } else {
          value = fieldsToReset(aField, value)
        }
        return value
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cRecommendedUsers), data })
    } catch (error) {
      return catchError('Users.adminRecommendation', error, req, res)
    }
  }

  async referredByUserList(req, res) {
    try {
      const { start = 0, limit = 10, sort = 'dCreatedAt', order, search } = req.query

      const orderBy = order && order === 'asc' ? 1 : -1

      const sorting = { [sort]: orderBy }

      let query = { iReferredBy: ObjectId(req.params.id) }
      if (search && search.length) {
        query = {
          ...query,
          $or: [
            { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { sEmail: encryptKey(search) },
            { sMobNum: encryptKey(search) }
          ]
        }
      }
      let usersList = await UsersModel.find(query, {
        sName: 1,
        sUsername: 1,
        sEmail: 1,
        sMobNum: 1,
        bIsEmailVerified: 1,
        bIsMobVerified: 1,
        sProPic: 1,
        eType: 1,
        eGender: 1,
        eStatus: 1,
        iReferredBy: 1,
        sReferCode: 1,
        iStateId: 1,
        dDob: 1,
        iCountryId: 1,
        iCityId: 1,
        sAddress: 1,
        nPinCode: 1,
        dLoginAt: 1,
        dPasswordchangeAt: 1,
        dCreatedAt: 1,
        eReferStatus: 1,
        nReferrerAmount: 1,
        nReferAmount: 1,
        sReferrerRewardsOn: 1,
        sCountryCode: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const count = await UsersModel.countDocuments({ ...query })

      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)

      usersList = usersList.map(data => {
        const aField = ['sMobNum', 'sAddress']
        const aFieldToDecryptReset = ['sEmail', 'dDob']
        if (response.status === 200) {
          data = fieldsToDecrypt(aFieldToDecryptReset, data)
        } else {
          data = fieldsToReset(aFieldToDecryptReset, data)
        }
        data = fieldsToDecrypt(aField, data)
        return data
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserrefferals), data: { results: usersList, count } })
    } catch (error) {
      return catchError('Users.referredByUserList', error, req, res)
    }
  }

  async deletedUsers(req, res) {
    try {
      const { start = 0, limit = 10, order, search, mobile, ePlatform, email, datefrom, dateto, isFullResponse } = req.query
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { dDeletedAt: orderBy }

      let query = mobile ? { bIsMobVerified: true } : {}
      query = email ? { ...query, bIsEmailVerified: true } : query
      query = ePlatform ? { ...query, ePlatform } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      if (search && search.length) {
        query = {
          ...query,
          $or: [
            { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { sEmail: search },
            { sMobNum: search }
          ]
        }
      }

      query = { ...query, eStatus: 'D', eType: 'U' }
      const oProjection = {
        sName: 1,
        sUsername: 1,
        sEmail: 1,
        sMobNum: 1,
        bIsEmailVerified: 1,
        bIsMobVerified: 1,
        eType: 1,
        eStatus: 1,
        dDeletedAt: 1,
        dCreatedAt: 1,
        sReason: 1,
        ePlatform: 1,
        iUserId: 1,
        oCoordinates: 1,
        oUtm: 1,
        sCountryCode: 1
      }
      let usersList
      let count = 0
      if ([true, 'true'].includes(isFullResponse)) {
        if (!datefrom || !dateto) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
        }
        usersList = await DeletedAccountsModel.find(query, oProjection).sort(sorting).populate('oDeletedUser').lean()
        count = await DeletedAccountsModel.countDocuments(query)
      } else {
        [usersList, count] = await Promise.all([
          DeletedAccountsModel.find(query, oProjection).sort(sorting).skip(Number(start)).limit(Number(limit)).populate({ path: 'oDeletedUser', select: 'sName sReason eType eGender iReferredBy sReferCode iStateId dDob iCountryId iCityId sAddress nPinCode dLoginAt dPasswordchangeAt dCreatedAt' }).lean(),
          DeletedAccountsModel.countDocuments(query)
        ])
      }
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      let permissionForRead = false
      if (response.status === 200) permissionForRead = true
      usersList = usersList.map(value => {
        if (!permissionForRead) {
          value.sEmail = ''
          value.sMobNum = ''
        }
        return value
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusers), data: { results: usersList, count } })
    } catch (error) {
      return catchError('Users.deletedUsers', error, req, res)
    }
  }

  async getSingleDeletedUser(req, res) {
    try {
      const iUserId = req.params.id
      const data = await DeletedAccountsModel.findOne({ iUserId }).populate({ path: 'oDeletedUser', select: 'sName eType eGender eStatus iReferredBy sReferCode iStateId dDob iCountryId iCityId sAddress nPinCode dLoginAt dPasswordchangeAt dCreatedAt' }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuser), data })
    } catch (error) {
      return catchError('Users.getSingleDeletedUser', error, req, res)
    }
  }

  /**
   * This will fetch the list of otps of those users who haven't registered
   * @param {*} req
   * @param {*} res
   * @returns This will return count of users, count of entries(one user can have multiple entries) and list
   */
  async fetchDroppedRegistered(req, res) {
    try {
      // Pick relevant query parameters from the request
      req.query = pick(req.query, ['nStart', 'nLimit', 'sSort', 'sOrder', 'sSearch', 'dDateFrom', 'dDateTo', 'sType', 'ePlatform'])
      const { nStart, nLimit, sSort, sOrder, sSearch, dDateFrom, dDateTo, sType, ePlatform } = req.query

      // Extract values from the picked parameters for pagination and sorting
      const { start, limit, sorting, search } = getPaginationValues({ start: nStart, limit: nLimit, sort: sSort, order: sOrder, search: sSearch })

      // Initialize the query object with default values
      let query = { sAuth: 'R', bIsRegistered: false }
      // Add date range to the query if provided
      query = dDateFrom && dDateTo ? { ...query, dCreatedAt: { $gte: new Date(dDateFrom), $lte: new Date(dDateTo) } } : query
      // Add type to the query if provided
      query = sType ? { ...query, sType } : query
      // Add platform to the query if provided
      query = ePlatform ? { ...query, ePlatform } : query

      // Add search term to the query if provided
      if (search && search.length) {
        query = {
          ...query,
          sLogin: encryptKey(search)
        }
      }

      // Fetch total unique users with a count query
      let [[totalUsers], data, totalEntries] = await Promise.all([
        OTPVerificationsModel.aggregate([
          { $match: query },
          { $group: { _id: '$sLogin' } },
          { $count: 'finalCount' }]),
        OTPVerificationsModel.find(query, { __v: 0 }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        OTPVerificationsModel.countDocuments(query)
      ])

      // Check if the user has permission to access user personal info
      // If permission is granted, decrypt mobile and email; otherwise, decrypt only dob and address
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      if (response.status === 200) {
        data = await decryptUserInfoAsPerPermission(data, true)
      } else {
        data = await decryptUserInfoAsPerPermission(data, false)
      }

      // Return the response with the fetched data
      return createResponse({ req, res, statusCode: status.OK, messageKey: messages.success, replacementKey: messages.droppedRegs, others: { result: { nTotalUsers: totalUsers ? totalUsers.finalCount : 0, nTotal: totalEntries, data } } })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('User.fetchDroppedRegistered', error, req, res)
    }
  }

  /**
   * This will fetch the list of otps of those users who haven't registered
   * @param {*} req
   * @param {*} res
   * @returns This will return count of users, count of entries(one user can have multiple entries) and list
   */
  async fetchDroppedRegisteredV1(req, res) {
    try {
      // Pick relevant query parameters from the request
      req.query = pick(req.query, ['nStart', 'nLimit', 'sSort', 'sOrder', 'sSearch', 'dDateFrom', 'dDateTo', 'sType', 'ePlatform', 'isFullResponse'])
      const { nStart, nLimit, sSort, sOrder, sSearch, dDateFrom, dDateTo, sType, ePlatform } = req.query

      // Extract values from the picked parameters for pagination and sorting
      const { start, limit, sorting, search } = getPaginationValues({ start: nStart, limit: nLimit, sort: sSort, order: sOrder, search: sSearch })

      // Initialize the query object with default values
      let query = { sAuth: 'R', bIsRegistered: false }
      // Add date range to the query if provided
      query = dDateFrom && dDateTo ? { ...query, dCreatedAt: { $gte: new Date(dDateFrom), $lte: new Date(dDateTo) } } : query
      // Add type to the query if provided
      query = sType ? { ...query, sType } : query
      // Add platform to the query if provided
      query = ePlatform ? { ...query, ePlatform } : query

      // Add search term to the query if provided
      if (search && search.length) {
        query = {
          ...query,
          sLogin: encryptKey(search)
        }
      }

      // Fetch total unique users with a count query
      let [[totalUsers], data, totalEntries] = await Promise.all([
        OTPVerificationsModel.aggregate([
          { $match: query },
          { $group: { _id: '$sLogin' } },
          { $count: 'finalCount' }]),
        [true, 'true'].includes(req.query.isFullResponse) ? OTPVerificationsModel.find(query, { __v: 0 }).sort(sorting).lean() : OTPVerificationsModel.find(query, { __v: 0 }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        OTPVerificationsModel.countDocuments(query)
      ])

      // Check if the user has permission to access user personal info
      // If permission is granted, decrypt mobile and email; otherwise, decrypt only dob and address
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      if (response.status === 200) {
        data = await decryptUserInfoAsPerPermission(data, true)
      } else {
        data = await decryptUserInfoAsPerPermission(data, false)
      }

      // Return the response with the fetched data
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].droppedRegs), data: { nTotalUsers: totalUsers ? totalUsers.finalCount : 0, nTotal: totalEntries, data } })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('User.fetchDroppedRegistered', error, req, res)
    }
  }

  async updateKYCStatus(req, res) {
    try {
      const aUserList = await UsersModel.find({
        $and: [
          { eKYCStatus: 's' },
          { dKYCStartedAt: { $exists: true } },
          { dKYCStartedAt: { $lte: moment().add(5, 'minute').toDate() } }
        ]
      }, { _id: 1 }).lean()
      const aBulkUpdateKYCStatus = []
      aUserList.forEach(oUser => {
        console.log('Changing KYC status for user: ', oUser._id)
        aBulkUpdateKYCStatus.push({
          updateOne: {
            filter: { _id: oUser._id },
            update: {
              $set: {
                eKYCStatus: 'p'
              }
            }
          }
        })
      })
      if (aBulkUpdateKYCStatus.length) {
        await UsersModel.bulkWrite(aBulkUpdateKYCStatus)
      }
      return res.sendStatus(status.OK)
    } catch (error) {
      return catchError('User.updateKYCStatus', error, req, res)
    }
  }
}

module.exports = new Admins()
