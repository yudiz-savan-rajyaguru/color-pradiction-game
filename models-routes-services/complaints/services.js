const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { findUsers } = require('../user/auth/services')
const UsersModel = require('../user/model')
const AdminLogModel = require('../admin/adminLogs/logs.model')
const bucket = require('../../helper/cloudStorage.services')
const { S3_COMPLAINT } = require('../../config/config')
const { complaintsStatus, issueType, complaintType } = require('../../data')
const { catchError, pick, getPaginationValues, checkValidImageType, getIp, decryptValuePromise, createResponse, mongify, searchRegExp } = require('../../helper/utilities.services')
const { checkAdminAuthorization } = require('../../helper/authorization')
const AdminsModel = require('../admin/model')
const ComplaintModel = require('./model')
const PassbookModel = require('../passbook/model')
const DepositModel = require('../userDeposit/model')
const SettingModel = require('../setting/model')
const WithdrawModel = require('../userWithdraw/model')
const shortuuid = require('short-uuid')

class Complaint {
  /**
   * To add Complaint manually
   * @param {*} req 'sImage', 'sTitle', 'sDescription', 'eType'
   * @param {*} res Complaint details
   * @returns Complaint details
   */
  async addComplaint(req, res) {
    try {
      // Extract user ID from the request
      const { _id: iUserId } = req.user

      // Extract complaint type from the request body
      // const { eType } = req.body
      // Pick only the required fields from the request body
      req.body = pick(req.body, ['sImage', 'sTitle', 'sDescription', 'eType', 'sRefId'])

      // Check if the user exists
      const user = await UsersModel.findOne({ _id: mongify(iUserId) }, { sUsername: 1 }).lean()
      // If the user does not exist, return an Unauthorized status
      if (!user) {
        return res.status(status.Unauthorized).jsonp({ status: status.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      }

      const oSetting = await SettingModel.findOne({ sKey: 'UserPendingComplaintLimit' }).lean()

      if (oSetting && oSetting?.sValue) {
        const nLimit = parseInt(oSetting.sValue)
        const nCount = await ComplaintModel.countDocuments({ iUserId, eStatus: { $in: ['P', 'I'] } }).lean()
        if (nCount >= nLimit) {
          return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].max_complaint_limit })
        }
      }

      const sExternalId = shortuuid.generate()

      const data = await ComplaintModel.create({ ...req.body, iUserId, sExternalId })

      // If the complaint type is feedback, return a success message for feedback
      // if (eType === 'F') {
      //   return createResponse({ req, res, messageKey: messages.add_success, replacementKey: messages.feedback, data })
      // }

      // Otherwise, return a success message for complaints
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      // If an error occurs, catch it and return the error
      return catchError('Complaint.addComplaint', error, req, res)
    }
  }

  /**
   * Get a signed URL for a Complaint image.
   * @param {*} req 'sFileName', 'sContentType'
   * @param {*} res Image sign-url
   * @returns Image sign-url
   */
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      // Validate the image type and content type
      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })
      }
      // Get a signed URL for the image from the S3 bucket
      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: S3_COMPLAINT })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      // If an error occurs, catch it and return the error
      return catchError('Complaint.getSignedUrl', error, req, res)
    }
  }

  /**
   * Get details of a single Complaint.
   * @param {*} req Complaint ID
   * @param {*} res Complaint details if it exists
   * @returns Details of a single Complaint
   */
  async get(req, res) {
    try {
      // Extract user ID from the request
      const { _id: iUserId } = req.user
      // Retrieve details of the specified Complaint for the user
      const data = await ComplaintModel.findOne({ _id: mongify(req.params.id), iUserId }).lean()

      // Check if the Complaint exists; if not, return a NotFound response
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].complaints) })
      }

      // Return the details of the single Complaint in the response
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      // If an error occurs, catch it and return the error
      return catchError('Complaint.get', error, req, res)
    }
  }

  /**
   * Get a list of Complaints with pagination and sorting.
   * @param {*} req Pagination and sorting parameters
   * @param {*} res List of Complaints
   * @returns List details of Complaints
   */
  async list(req, res) {
    try {
      // Extract user ID from the request
      const { _id: iUserId } = req.user
      // Extract pagination and sorting parameters from the request
      let { nLimit, nOffset } = req.query

      // Set default values for limit and offset if not provided
      nLimit = parseInt(nLimit) || 10
      nOffset = parseInt(nOffset) || 0

      // Retrieve Complaints for the specified user, sorted by creation date
      const data = await ComplaintModel.find({ iUserId }).sort({ dCreatedAt: -1 }).skip(nOffset).limit(nLimit).lean()

      // Return the list of Complaints in the response
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      // If an error occurs, catch it and return the error
      return catchError('Complaint.list', error, req, res)
    }
  }

  /**
   * Delete a user's complaint.
   * @param {*} req Complaint ID
   * @param {*} res Delete message if the complaint is found
   * @returns Delete complaint message
   */
  async removeComplaint(req, res) {
    try {
      // Extract user ID from the request
      const { _id: iUserId } = req.user

      // Find and delete the specified Complaint for the user
      const data = await ComplaintModel.findOneAndDelete({ _id: mongify(req.params.id), iUserId }).lean()

      // Check if the Complaint exists; if not, return a NotFound response
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].complaints) })
      }

      // Return the delete message in the response
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      // If an error occurs, catch it and return the error
      return catchError('Complaint.removeComplaint', error, req, res)
    }
  }

  /**
   * Update the status of a complaint by an admin.
   * @param {*} req Complaint ID, status, comment, and type
   * @param {*} res Complaint details after updating the status
   * @returns Complaint details with the updated status
   */
  async updateStatus(req, res) {
    try {
      // Extract status, comment, and type from the request body
      const { eStatus, sComment, eType, sReply } = req.body

      if (eStatus && !complaintsStatus.includes(eStatus)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].complaintStatus) })
      // Find the existing complaint based on the provided ID and type
      const comp = await ComplaintModel.findOne({ _id: mongify(req.params.id), eType }).lean()

      // Check if the complaint exists; if not, return a NotFound response
      if (!comp) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].complaints) })
      }

      // For Declined complaints, check if a comment (reason) is provided
      if (eStatus === 'D' && !sComment) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].declined_comment.replace('##', messages[req.userLanguage].complaints) })

      // Prepare the update object based on the status
      const insertObj = eStatus === 'D' ? { eStatus, sComment } : { eStatus, sReply }
      // inserting the AdminId who has tried to modify the details
      insertObj.iModifiedBy = mongify(req.admin._id)
      // Update the complaint and retrieve the updated details
      const data = await ComplaintModel.findByIdAndUpdate(req.params.id, insertObj, { new: true, runValidators: true }).lean()

      // Log the update action for future reference
      const logData = {
        eKey: 'CF',
        iUserId: comp.iUserId,
        oOldFields: comp,
        oNewFields: data,
        iAdminId: mongify(req.admin._id),
        sIp: getIp(req)

      }
      await AdminLogModel.create(logData)

      // Return the updated complaint details in the response
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      // If an error occurs, catch it and return the errors
      return catchError('Complaint.updateStatus', error, req, res)
    }
  }

  /**
   * Get all complaints details with filtering options.
   * @param {*} req Complaint type, status, date range, and user ID
   * @param {*} res Complaint details after applying filters
   * @returns All complaints details after filtering
   */
  async adminList(req, res) {
    try {
      // Extract filtering parameters from the request
      const { type, status: eStatus, datefrom, dateto, iUserId, iModifiedBy } = req.query
      // Extract pagination and sorting values from the request
      const { start, limit, sorting } = getPaginationValues(req.query)

      const query = {}
      // Add type filter if provided and valid
      if (type && issueType.includes(type)) query.eType = type

      // Add status filter if provided and valid
      if (eStatus && complaintsStatus.includes(eStatus)) query.eStatus = eStatus

      // Add date range filter if both dates are provided
      if (datefrom && dateto) {
        query.dCreatedAt = { $gte: datefrom, $lte: dateto }
      }

      // Add user ID filter if provided
      if (iUserId) query.iUserId = mongify(iUserId)

      // Add user ID filter if provided
      if (iModifiedBy) query.iModifiedBy = mongify(iModifiedBy)

      // Retrieve the total count and paginated complaint data based on the filters
      let [nTotal, complainsData] = await Promise.all([
        ComplaintModel.countDocuments(query),
        ComplaintModel.find(query).skip(start).limit(limit).sort(sorting).lean()
      ])
      // Extract user IDs and ModifiedBy (AdminIds) from the complaint data
      const aAdminIds = []
      const aUserIds = []
      complainsData?.forEach(complain => {
        aUserIds.push(complain.iUserId)
        aAdminIds.push(complain.iModifiedBy)
      })

      // Retrieve user details for the extracted user IDs
      const userData = await findUsers({ _id: { $in: aUserIds } }, { _id: 1, sUsername: 1 })
      // Retrieve Admin Details for modifiedBy details
      const aAdminData = await AdminsModel.find({ _id: { $in: aAdminIds }, eStatus: 'Y' }, { _id: 1, sUsername: 1, eType: 1 }).lean()
      // Map user details to each complaint
      complainsData = complainsData?.map(complain => {
        const iUserIds = userData.find(u => u._id.toString() === complain.iUserId.toString())
        const oModifiedBy = aAdminData.find(e => e._id.toString() === complain?.iModifiedBy?.toString())
        return { ...complain, iUserIds, oModifiedBy }
      })
      // Prepare the response data with total count and paginated complaint details
      const data = { nTotal, aData: complainsData }
      // Return the response with the filtered complaint details
      return createResponse({ req, res, replacementKey: messages.complaints, data })
    } catch (error) {
      // If an error occurs, catch it and return the error
      return catchError('Complaint.adminList', error, req, res)
    }
  }

  async adminListV1(req, res) {
    try {
      // Extract filtering parameters from the request
      const { type, status: eStatus, datefrom, dateto, iModifiedBy, isFullResponse, search, searchType } = req.query
      // Extract pagination and sorting values from the request
      const { start, limit, sorting } = getPaginationValues(req.query)

      const query = {}
      // Add type filter if provided and valid
      if (type && complaintType.includes(type)) query.eType = type

      // Add status filter if provided and valid
      if (eStatus && complaintsStatus.includes(eStatus)) query.eStatus = eStatus

      // Add date range filter if both dates are provided
      if (datefrom && dateto) {
        query.dCreatedAt = { $gte: datefrom, $lte: dateto }
      }

      // Add user ID filter if provided
      if (iModifiedBy) query.iModifiedBy = mongify(iModifiedBy)

      if (search) {
        if (searchType === 'USERNAME') {
          const matchingUsers = await findUsers({ sUsername: searchRegExp(search) }, { _id: 1 })
          const userIds = matchingUsers.map(user => user._id)
          if (userIds.length > 0) {
            query.iUserId = { $in: userIds }
          } else {
            query.iUserId = null
          }
        } else if (searchType === 'TITLE' || !searchType) {
          query.sTitle = searchRegExp(search)
        }
      }

      // Retrieve the total count and paginated complaint data based on the filters
      let [nTotal, complainsData] = await Promise.all([
        ComplaintModel.countDocuments({ ...query }),
        [true, 'true'].includes(isFullResponse) ? ComplaintModel.find({ ...query }).sort(sorting).lean() : ComplaintModel.find({ ...query }).skip(start).limit(limit).sort(sorting).lean()
      ])
      // Extract user IDs and ModifiedBy (AdminIds) from the complaint data
      const aAdminIds = []
      const aUserIds = []
      // eslint-disable-next-line array-callback-return
      complainsData?.forEach(complain => {
        aUserIds.push(complain.iUserId)
        aAdminIds.push(complain.iModifiedBy)
      })

      // Retrieve user details for the extracted user IDs
      const userData = await findUsers({ _id: { $in: aUserIds } }, { _id: 1, sUsername: 1 })
      // Retrieve Admin Details for modifiedBy details
      const aAdminData = await AdminsModel.find({ _id: { $in: aAdminIds }, eStatus: 'Y' }, { _id: 1, sUsername: 1, eType: 1 }).lean()
      // Map user details to each complaint
      complainsData = complainsData?.map(complain => {
        const iUserIds = userData.find(u => u._id.toString() === complain.iUserId.toString())
        const oModifiedBy = aAdminData.find(e => e._id.toString() === complain?.iModifiedBy?.toString())
        return { ...complain, iUserIds, oModifiedBy }
      })
      // Prepare the response data with total count and paginated complaint details
      const data = { nTotal, aData: complainsData }
      // Return the response with the filtered complaint details
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      // If an error occurs, catch it and return the error
      return catchError('Complaint.adminList', error, req, res)
    }
  }

  /**
   * To get details of user Complaint
   * @param {*} req complaint id
   * @param {*} res complaint details if exist
   * @returns details of single Complaint
   */
  async adminGet(req, res) {
    try {
      // Find the complaint by ID
      const data = await ComplaintModel.findById(req.params.id).lean()
      // If the complaint does not exist, return a NotFound status
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].complaints) })
      }

      // Check if the admin has authorization to view user's personal info
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      // Find the user associated with the complaint
      const userData = await UsersModel.findOne({ _id: mongify(data.iUserId) }, { _id: 1, sUsername: 1, iStateId: 1, iCityId: 1, sAddress: 1, iCountryId: 1, nPinCode: 1, sName: 1, sMobNum: 1, sEmail: 1 })
      // If the admin has authorization, decrypt the user's email and mobile number
      if (response.status === 200) {
        if (userData.sEmail) userData.sEmail = await decryptValuePromise(userData.sEmail)
        if (userData.sMobNum) userData.sMobNum = await decryptValuePromise(userData.sMobNum)
      } else {
        // If the admin does not have authorization, clear the user's email and mobile number
        if (userData.sEmail) userData.sEmail = ''
        if (userData.sMobNum) userData.sMobNum = ''
      }
      // Replace the user ID in the complaint data with the user data
      data.iUserId = userData
      if (data?.sRefId && ['WITHDRAW_COIN', 'DEPOSIT_COIN', 'DEPOSIT', 'WITHDRAW'].includes(data.eType)) {
        let eTransactionType
        switch (data.eType) {
          case 'WITHDRAW_COIN':
            eTransactionType = 'Withdraw-Coin'
            break
          case 'DEPOSIT_COIN':
            eTransactionType = 'Deposit-Coin'
            break
          case 'DEPOSIT':
            eTransactionType = 'Deposit'
            break
          case 'WITHDRAW':
            eTransactionType = 'Withdraw'
            break
        }
        const transactionQuery = {
          id: data.sRefId, // Assuming 'sRefId' maps to 'sTransactionId' in the database
          eTransactionType: eTransactionType // Using eTransactionType to filter
        }

        // Fetch transaction details based on sRefId and eTransactionType
        const transactionDetails = await PassbookModel.findOne({
          where: transactionQuery,
          attributes: ['id', 'eType', 'nCash', 'nAmount', 'eTransactionType', 'sRemarks', 'dActivityDate', 'iTransactionId', 'dProcessedDate', 'eStatus', 'iUserDepositId', 'iWithdrawId'],
          order: [['id', 'desc']],
          raw: true
        })

        // Attach transaction details to the complaint data if available
        if (transactionDetails) {
          let depositDetails = {}
          let withdrawDetails = {}

          if (transactionDetails?.iUserDepositId) {
            depositDetails = await DepositModel.findOne({
              where: { id: transactionDetails?.iUserDepositId },
              raw: true
            })
            let logQuery = { iDepositId: depositDetails.id }
            if (depositDetails.ePaymentGateway === 'ADMIN') {
              logQuery.eKey = 'AD'
            } else if (depositDetails?.iUserId) {
              logQuery = { ...logQuery, iUserId: mongify(depositDetails.iUserId), eKey: 'D' }
            }
            const logData = await AdminLogModel.findOne(logQuery, { _id: 1, iAdminId: 1 }).populate('iAdminId', ['sName', 'sUsername', 'sEmail']).lean()
            depositDetails.sDepositDoneBy = logData?.iAdminId?.sUsername
          }
          if (transactionDetails?.iWithdrawId) {
            withdrawDetails = await WithdrawModel.findOne({
              where: { id: transactionDetails?.iWithdrawId },
              raw: true
            })
            const AdminDetails = await AdminsModel.findOne({ _id: mongify(withdrawDetails?.iWithdrawalDoneBy) }, { _id: 1, sUsername: 1 }).lean()
            withdrawDetails.sWithdrawalDoneBy = AdminDetails?.sUsername
          }
          data.oTransactionDetails = transactionDetails
          if (Object.keys(depositDetails).length > 0) data.oDepositDetails = depositDetails
          if (Object.keys(withdrawDetails).length > 0) data.oWithdrawDetails = withdrawDetails
        }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      // If an error occurs, catch it and return the error
      catchError('Complaint.adminGet', error, req, res)
    }
  }
}
module.exports = new Complaint()
