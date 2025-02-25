// @ts-check
const config = require('../../config/config')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues, getIp, handleCatchError, replaceSensitiveInfo, mongify } = require('../../helper/utilities.services')
const { createAdminLog } = require('../admin/adminLogs/handler')
const { verifyPan, verifyAadhaar, pushNotificationKyc, validateKycV3 } = require('../kyc/common')
const bucket = require('../../helper/cloudStorage.services')
const UsersModel = require('../user/model')
const KycModel = require('./model')
const { getKYCRules } = require('../commonRules/services')
const { findUsers } = require('../user/auth/services')
const { S3_KYC_BUCKET_NAME } = require('../../config/config')
const { KYC_CASHFREE_VERIFICATION, KYC_DIRECT_VALIDATE } = config

class Kyc {
  /*
  Async function to handle the addition of KYC (Know Your Customer) details
  Expected Request Parameters:
  - Body: {Object} req.body
     - {string} eType - Type of KYC document (e.g., 'AADHAAR' or 'PAN').
  - User ID (depends on user presence in request):
     - If user is present: Extracted from req.user._id
     - If user is not present: Extracted from req.params.id
  */
  async add(req, res) {
    try {
      const { eType } = req.body
      // Determining the user ID based on the presence of the user in the request
      const iUserId = req.user ? mongify(req.user._id) : mongify(req.params.id)

      // Setting adminFlag based on the presence of the user in the request
      const adminFlag = req.user ? '' : 'admin'

      // Checking if the operation is performed by an admin
      if (!adminFlag) {
        // Counting users with the specified ID
        const user = await UsersModel.countDocuments({ _id: iUserId })
        // Returning unauthorized response if the user is not found
        if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      }

      // Fetching KYC details for the user
      const user = await KycModel.findOne({ iUserId }).lean()

      // Checking if KYC details exist for the user and the specified eType (AADHAAR or PAN)
      if (user && eType === 'AADHAAR') {
        // Returning a response if AADHAAR verification is under review
        if (user?.oAadhaar?.eStatus === 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
      } else if (user && eType === 'PAN') {
        // Returning a response if PAN verification is under review
        if (user?.oPan.eStatus === 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
      }

      // Retrieving the reference ID from AADHAAR details if available
      const sRefId = user?.oAadhaar?.sRefId

      // Validating KYC details using the validateKycV2 function
      const kycDetails = await validateKycV2({ req, iUserId, flag: adminFlag, sRefId })

      // Returning an error response if KYC validation fails
      if (kycDetails && !kycDetails.success) return res.status(kycDetails.status).jsonp({ status: kycDetails.status, message: kycDetails.message })

      let data

      // Updating existing KYC details if user exists, otherwise creating new KYC details
      if (user) {
        data = await KycModel.findOneAndUpdate({ iUserId }, { ...kycDetails }, { new: true, runValidators: true }).lean()
      } else {
        data = await KycModel.create({ ...kycDetails })
      }
      if (data?.oPan?.eStatus === 'A' && data?.oAadhaar?.eStatus === 'A') await UsersModel.findOneAndUpdate({ _id: iUserId }, { eKYCStatus: 'c' }).lean()
      else if (data?.oPan?.eStatus === 'A' || data?.oAadhaar?.eStatus === 'A') await UsersModel.findOneAndUpdate({ _id: iUserId }, { eKYCStatus: 's' }).lean()

      // await affiliateEventReward({ iUserId, ...data })
      // Removing sensitive information from the response based on eType
      if (eType === 'AADHAAR') {
        data.oPan = undefined
      } else {
        data.oAadhaar = undefined
      }

      // Returning a success response with the updated/new KYC details
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newKyc), data })
    } catch (error) {
      // Handling and logging errors
      catchError('adminKyc.add', error, req, res)
    }
  }

  /**
 * Updates KYC (Know Your Customer) details for a user.
 * Expected Request Parameters:
 * - Body: {Object} req.body
 *    - {string} eType - Type of KYC document (e.g., 'AADHAAR' or 'PAN').
 * - User ID (depends on user presence in request):
 *    - If user is present: Extracted from req.user._id
 *    - If user is not present: Extracted from req.params.id
 */
  async update(req, res) {
    let autoApprove = false

    try {
      // Extracting properties from the request body
      const { eType } = req.body

      // Determining the user ID based on the presence of the user in the request
      const iUserId = req.user ? mongify(req.user._id) : mongify(req.params.id)

      // Setting adminFlag based on the presence of the user in the request
      const adminFlag = req.user ? '' : 'admin'

      // Variables to store old and new KYC fields (for admin logs)
      let oOldFields, oNewFields

      // Fetching KYC details for the user
      const user = await KycModel.findOne({ iUserId }).lean()

      // Checking KYC rules for auto-approval
      const kycRules = await getKYCRules()
      for (const rule of kycRules) {
        if (rule.eRule === 'AKYC') autoApprove = true
      }

      // If the user is present, checking KYC status before updating
      if (req.user) {
        if (user && eType === 'AADHAAR') {
          if (user?.oAadhaar?.eStatus === 'P' && !autoApprove) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
        } else if (user && eType === 'PAN') {
          if (user?.oPan?.eStatus === 'P' && !autoApprove) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
        }
      }

      // Retrieving AADHAAR reference ID
      const sRefId = user?.oAadhaar?.sRefId

      // Validating KYC details using version 3 of the validation function
      const updateObject = await validateKycV3({ req, iUserId, flag: adminFlag, sRefId, autoApprove })

      // Returning an error response if KYC validation fails
      if (updateObject && !updateObject.success) return res.status(updateObject.status).jsonp({ status: updateObject.status, message: updateObject.message })

      // Updating KYC details in the database
      const data = await KycModel.findOneAndUpdate({ iUserId }, updateObject, { runValidators: true, new: true }).lean()
      if (data?.oPan?.eStatus === 'A' && data?.oAadhaar?.eStatus === 'A') await UsersModel.findOneAndUpdate({ _id: iUserId }, { eKYCStatus: 'c' }).lean()
      else if (data?.oPan?.eStatus === 'A' || data?.oAadhaar?.eStatus === 'A') await UsersModel.findOneAndUpdate({ _id: iUserId }, { eKYCStatus: 's' }).lean()
      else await UsersModel.findOneAndUpdate({ _id: iUserId }, { eKYCStatus: 'p' }).lean()

      // Returning a not found response if the user does not exist
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })

      // await affiliateEventReward({ iUserId, ...data })
      // Logging admin activity if the update is performed by an admin
      if (req.admin) {
        let { _id: iAdminId } = req.admin
        iAdminId = mongify(iAdminId)

        // Determining old and new KYC fields for logging
        if (user && eType === 'AADHAAR') {
          oNewFields = data?.oAadhaar
          oOldFields = user?.oAadhaar
        } else if (eType === 'PAN') {
          oNewFields = data?.oPan
          oOldFields = user?.oPan
        }

        // Constructing log data and replacing sensitive information
        let logData = { oOldFields, oNewFields, iAdminId, iUserId, sIP: getIp(req), eKey: 'KYC', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
        logData = await replaceSensitiveInfo(logData)

        // Creating an admin log entry
        await createAdminLog(logData)
      }

      // Removing sensitive information from the response based on eType
      if (eType === 'AADHAAR') {
        data.oPan = undefined
      } else {
        data.oAadhaar = undefined
      }

      // Returning a success response with the updated KYC details
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].kycDetails), data })
    } catch (error) {
      // Handling and logging errors
      catchError('adminKyc.update', error, req, res)
    }
  }

  /**
 * Retrieves a list of pending KYC (Know Your Customer) details with optional filters.
 *
 * Expected Query Parameters:
 * - panFilter: {string} - Filter for PAN status ('P', 'A', 'R', 'N').
 * - aadhaarFilter: {string} - Filter for Aadhaar status ('P', 'A', 'R', 'N').
 * - iUserId: {string} - User ID for filtering.
 * - datefrom: {string} - Start date for filtering (YYYY-MM-DD).
 * - dateto: {string} - End date for filtering (YYYY-MM-DD).
 * - isFullResponse: {string} - Flag to indicate whether to return full response.
 * - sort: {string} - Sorting order ('asc' or 'desc').
 * - start: {string} - Pagination start index.
 * - limit: {string} - Pagination limit.
 * - search: {string} - Search term.
 * - order: {string} - Sorting order ('asc' or 'desc').
 *
 * @returns {Object} - Express response object with a list of pending KYC details.
 */
  async pendingKycListV2(req, res) {
    try {
      // Destructuring and filtering relevant properties from the query parameters
      let { panFilter, aadhaarFilter, iUserId, datefrom, dateto, isFullResponse, sort } = req.query
      req.query = pick(req.query, ['start', 'limit', 'sort', 'order', 'search'])

      // Extracting values for pagination and sorting
      let { start, limit, sorting } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      // Transforming filters to uppercase
      panFilter = panFilter ? panFilter.toUpperCase() : undefined
      aadhaarFilter = aadhaarFilter ? aadhaarFilter.toUpperCase() : undefined

      // Initializing query objects
      let query = {}
      let filterQuery = {}

      // Applying PAN filter if present
      if (panFilter && ['P', 'A', 'R', 'N'].includes(panFilter)) {
        query = { 'oPan.eStatus': panFilter }
      }

      // Applying Aadhaar filter if present
      if (aadhaarFilter && ['P', 'A', 'R', 'N'].includes(aadhaarFilter)) {
        filterQuery = { 'oAadhaar.eStatus': aadhaarFilter }
      }

      // Applying user ID filter if present
      if (iUserId) {
        query.iUserId = mongify(iUserId)
      }

      // Applying date range filter if both datefrom and dateto are present
      if (datefrom && dateto) {
        query = {
          ...query,
          $or: [
            { 'oPan.dCreatedAt': { $gte: datefrom, $lte: dateto } },
            { 'oAadhaar.dCreatedAt': { $gte: datefrom, $lte: dateto } }
          ]
        }
      }

      // Combining query and filterQuery
      query = { ...query, ...filterQuery }

      let kycDetails

      // Counting total documents based on the query
      const total = await KycModel.countDocuments(query)

      // Retrieving KYC details based on filters and pagination
      if ([true, 'true'].includes(isFullResponse)) {
        // Retrieving full response without pagination
        kycDetails = await KycModel.find(query).sort(sorting).lean()
      } else {
        // Retrieving paginated response with optional sorting
        kycDetails = sort
          ? await KycModel.find(query).sort(sorting).skip(start).limit(limit).lean()
          : await KycModel.find(query).sort({ 'oAadhaar.dCreatedAt': -1 }).skip(start).limit(limit).lean()
      }

      // Returning a response if no pending KYC details are found
      if (!kycDetails.length) {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_pending_kyc })
      }
      // Extracting user IDs from KYC details
      const aUserId = kycDetails.map(k => k.iUserId)

      // Retrieving user information based on user IDs
      const aUser = await findUsers({ _id: { $in: aUserId } }, { _id: 1, sUsername: 1 })
      const kycAllInfo = []
      for (const rec of kycDetails) {
        if (rec.iUserId) {
          const iUserId = aUser.find(u => u._id.toString() === rec?.iUserId?.toString())
          kycAllInfo.push({ ...rec, iUserId })
        }
      }

      // Constructing response data
      // as per the front-end requirement we need to send array as a response
      const data = { total, data: kycAllInfo }

      // Returning a response with the pending KYC details
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].kyc), data })
    } catch (error) {
      // Handling and logging errors
      return catchError('adminKyc.pendingKycListV2', error, req, res)
    }
  }

  // Async function to get the count of KYC documents based on PAN and Aadhaar status within a date range
  async getKycCount(req, res) {
    try {
      // Destructuring values from the query parameters
      const { ePanStatus, eAadharStatus, datefrom, dateto } = req.query

      // Initialize an object to store KYC counts
      const data = {}
      // Count PAN documents based on status and date range
      data.nPanCount = await KycModel.countDocuments({ 'oPan.eStatus': ePanStatus, 'oPan.dUpdatedAt': { $gte: datefrom, $lte: dateto } })
      // Count Aadhaar documents based on status and date range
      data.nAadharCount = await KycModel.countDocuments({ 'oAadhaar.eStatus': eAadharStatus, 'oAadhaar.dUpdatedAt': { $gte: datefrom, $lte: dateto } })

      // Create a response with KYC counts
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].kyc_count), data })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('adminKyc.getCounts', error, req, res)
    }
  }

  // Async function to get KYC details for a user
  async getKycDetails(req, res) {
    try {
      // Determine the user ID based on whether it's from the request or parameters
      const iUserId = req.user ? (req.user._id) : mongify(req.params.id)

      // Find KYC data for the user
      const data = await KycModel.findOne({ iUserId }).lean()

      // If no data is found, return a not found response
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })

      // If PAN status is 'R', modify the response object
      if (data?.oPan?.eStatus === 'R') {
        data.oPan = { sRejectReason: data.oPan ? data.oPan.sRejectReason : '', eStatus: 'R' }
      }

      // If Aadhaar status is 'R', modify the response object
      if (data?.oAadhaar?.eStatus === 'R') {
        data.oAadhaar = { sRejectReason: data.oAadhaar ? data.oAadhaar.sRejectReason : '', eStatus: 'R' }
      }

      // Return the KYC details response
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].kyc, data })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('adminKyc.getKycDetails', error, req, res)
    }
  }

  // Async function to update KYC status for a user
  async updateKycStatus(req, res) {
    try {
      // Pick specific fields from the request body
      req.body = pick(req.body, ['eStatus', 'sRejectReason', 'eType'])
      const { eStatus, sRejectReason, eType } = req.body
      const iUserId = mongify(req.params.id)
      let { _id: iAdminId } = req.admin
      iAdminId = mongify(iAdminId)
      // Validate KYC type
      if (!(['PAN', 'AADHAAR'].includes(eType))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].sType) })

      const deleteObjs = []
      let data, oOldFields, oNewFields
      if (eType === 'PAN') {
        const ePanStatus = eStatus === 'R' ? ['P', 'A'] : ['P']
        const user = await KycModel.findOne({ iUserId: mongify(iUserId), 'oPan.eStatus': { $in: ePanStatus } }).lean()
        if (!user) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].user) })

        oOldFields = user.oPan

        if (eStatus === 'A') {
          data = await KycModel.findOneAndUpdate({ iUserId }, {
            'oPan.eStatus': eStatus,
            'oPan.oVerifiedAt.dActionedAt': Date.now(),
            'oPan.oVerifiedAt.sIP': getIp(req),
            'oPan.oVerifiedAt.iAdminId': req.admin._id,
            'oPan.sRejectReason': ''
          }, { runValidators: true, new: true }).lean()
        }
        // Update PAN status to 'R'
        if (eStatus === 'R') {
          if (user?.oPan?.sImage) deleteObjs.push({ Key: user?.oPan?.sImage })
          data = await KycModel.findOneAndUpdate({ iUserId }, {
            'oPan.eStatus': eStatus,
            'oPan.sImage': '',
            'oPan.sNo': '',
            'oPan.oVerifiedAt.dActionedAt': Date.now(),
            'oPan.oVerifiedAt.iAdminId': req.admin._id,
            'oPan.oVerifiedAt.sIP': getIp(req),
            'oPan.sRejectReason': sRejectReason,
            'oPan.sName': ''
          }, { runValidators: true, new: true }).lean()
        }
        oNewFields = data?.oPan
        await pushNotificationKyc({ 'oPan.eStatus': eStatus }, iUserId)
      } else {
        const eAadhaarStatus = eStatus === 'R' ? ['P', 'A'] : ['P']
        const user = await KycModel.findOne({ iUserId, 'oAadhaar.eStatus': { $in: eAadhaarStatus } }).lean()
        if (!user) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].user) })

        oOldFields = user.oAadhaar
        // Update Aadhaar status to 'A'
        if (eStatus === 'A') {
          data = await KycModel.findOneAndUpdate({ iUserId }, {
            'oAadhaar.eStatus': eStatus,
            'oAadhaar.oVerifiedAt.dActionedAt': Date.now(),
            'oAadhaar.oVerifiedAt.sIP': getIp(req),
            'oAadhaar.oVerifiedAt.iAdminId': req.admin._id,
            'oAadhaar.sRejectReason': undefined
          }, { runValidators: true, new: true }).lean()
        }
        if (eStatus === 'R') {
          if (user?.oAadhaar?.sFrontImage) deleteObjs.push({ Key: user.oAadhaar.sFrontImage })
          if (user?.oAadhaar?.sBackImage) deleteObjs.push({ Key: user?.oAadhaar?.sBackImage })
          data = await KycModel.findOneAndUpdate({ iUserId }, {
            'oAadhaar.eStatus': eStatus,
            'oAadhaar.sFrontImage': '',
            'oAadhaar.sBackImage': '',
            'oAadhaar.sNo': '',
            'oAadhaar.oVerifiedAt.dActionedAt': Date.now(),
            'oAadhaar.oVerifiedAt.iAdminId': req.admin._id,
            'oAadhaar.oVerifiedAt.sIP': getIp(req),
            'oAadhaar.sRejectReason': sRejectReason
          }, { runValidators: true, new: true }).lean()
        }
        await pushNotificationKyc({ 'oAadhaar.eStatus': eStatus }, iUserId)
        oNewFields = data?.oAadhaar
      }
      const sBucketName = S3_KYC_BUCKET_NAME
      if (deleteObjs.length) {
        const bucketParams = {
          Bucket: sBucketName,
          Delete: {
            Objects: deleteObjs,
            Quiet: false
          }
        }

        bucket.deleteObject(bucketParams, function (err, dta) {
          if (err) {
            handleCatchError(err)
          }
        })
      }
      const oKYC = await KycModel.findOne({ iUserId }).lean()
      if (oKYC?.oPan?.eStatus === 'A' && oKYC?.oAadhaar?.eStatus === 'A') await UsersModel.findOneAndUpdate({ _id: iUserId }, { eKYCStatus: 'c' }).lean()
      else if (oKYC?.oPan?.eStatus === 'A' || oKYC?.oAadhaar?.eStatus === 'A') await UsersModel.findOneAndUpdate({ _id: iUserId }, { eKYCStatus: 's' }).lean()
      else await UsersModel.findOneAndUpdate({ _id: iUserId }, { eKYCStatus: 'p' }).lean()

      // await affiliateEventReward({ iUserId, ...data })
      let logData = { oOldFields, oNewFields, iAdminId, iUserId, sIP: getIp(req), eKey: 'KYC', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      logData = await replaceSensitiveInfo(logData)
      await createAdminLog(logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', (eType === 'PAN') ? 'Pancard status' : 'Aadhar Card status'), data })
    } catch (error) {
      return catchError('adminKyc.updateKycStatus', error, req, res)
    }
  }
}

/**
 * Validate KYC data in version 2
 * @param {Object} oData - Object containing necessary data
 * @param {string} oData.iUserId - User ID
 * @param {string} [oData.flag=''] - Flag indicating the context (e.g., 'admin')
 * @param {string} [oData.sRefId] - Reference ID for verification
 * @returns {Object} - Object indicating the success status and related information
 */
async function validateKycV2(oData) {
  try {
    const { req, iUserId, flag = '', sRefId } = oData
    const { eType } = req.body

    // Validate KYC type
    if (!['PAN', 'AADHAAR'].includes(eType)) {
      return { success: false, status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].sType) }
    }

    let data

    if (eType === 'AADHAAR') {
      const { sFrontImage, sBackImage, sNo, sOTP } = req.body

      // Check if Aadhaar number already exists for another user
      const numberExist = await KycModel.findOne({ 'oAadhaar.sNo': sNo, iUserId: { $ne: mongify(iUserId) }, 'oAadhaar.eStatus': { $ne: 'R' } }).lean()
      if (numberExist) {
        return { success: false, status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].aadharNum) }
      }

      if (flag === 'admin') {
        // Admin context
        data = {
          iUserId,
          'oAadhaar.sFrontImage': sFrontImage,
          'oAadhaar.sBackImage': sBackImage,
          'oAadhaar.eStatus': 'A',
          'oAadhaar.sNo': sNo,
          'oAadhaar.dCreatedAt': new Date(),
          'oAadhaar.oVerifiedAt.dActionedAt': Date.now(),
          'oAadhaar.oVerifiedAt.sIP': getIp(req),
          'oAadhaar.oVerifiedAt.iAdminId': req.admin._id,
          'oAadhaar.sRejectReason': undefined
        }
      } else {
        // User context
        let aadhaarRes = {}

        if (['production', 'staging'].includes(process.env.NODE_ENV) && KYC_CASHFREE_VERIFICATION) {
          // Perform Aadhaar verification
          aadhaarRes = await verifyAadhaar(sRefId, sOTP)

          if (!aadhaarRes.success) {
            return { success: false, status: jsonStatus[400], message: messages[req.userLanguage].verify_otp_err }
          }
        } else {
          aadhaarRes.success = true
        }

        data = {
          iUserId,
          'oAadhaar.sFrontImage': sFrontImage,
          'oAadhaar.sBackImage': sBackImage,
          'oAadhaar.eStatus': KYC_DIRECT_VALIDATE && aadhaarRes.success ? 'A' : 'P',
          'oAadhaar.sNo': sNo,
          'oAadhaar.dCreatedAt': new Date()
        }
      }
    } else if (eType === 'PAN') {
      const { sImage, sNo, sName } = req.body

      if (!sName) return { success: false, status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].cName) }
      // Check if PAN number already exists for another user
      const panNo = await KycModel.findOne({ 'oPan.sNo': sNo, iUserId: { $ne: mongify(iUserId) }, 'oPan.eStatus': { $ne: 'R' } }).lean()

      if (panNo) {
        return { success: false, status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].panNum) }
      }

      if (flag === 'admin') {
        // Admin context
        data = {
          iUserId,
          'oPan.sImage': sImage,
          'oPan.eStatus': 'A',
          'oPan.sNo': sNo,
          'oPan.dCreatedAt': new Date(),
          'oPan.oVerifiedAt.dActionedAt': Date.now(),
          'oPan.oVerifiedAt.sIP': getIp(req),
          'oPan.oVerifiedAt.iAdminId': req.admin._id,
          'oPan.sRejectReason': undefined,
          'oPan.sName': sName
        }
      } else {
        // User context
        let panRes = {}

        if (['production', 'staging'].includes(process.env.NODE_ENV) && KYC_CASHFREE_VERIFICATION) {
          // Perform PAN verification
          panRes = await verifyPan(sNo)

          if (!panRes.success) {
            return { success: false, status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].panNum) }
          }
        } else {
          panRes.success = true
        }

        data = {
          iUserId,
          'oPan.sImage': sImage,
          'oPan.eStatus': KYC_DIRECT_VALIDATE && panRes.success ? 'A' : 'P',
          'oPan.sNo': sNo,
          'oAadhaar.dCreatedAt': new Date(),
          'oPan.sName': sName
        }
      }
    }

    // Push notification for KYC
    await pushNotificationKyc(data, iUserId)

    // Return success status and data
    return { success: true, ...data }
  } catch (error) {
    // Handle errors
    handleCatchError(error)
  }
}

module.exports = new Kyc()
