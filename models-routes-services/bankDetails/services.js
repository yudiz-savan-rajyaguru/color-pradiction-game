//  @ts-check
const { decryption } = require('../../middlewares/middleware')
const { catchError, pick, removenull, projectionFields, validateIFSC, trimNumber, getIp, replaceSensitiveInfo, mongify } = require('../../helper/utilities.services')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { ALLOW_BANK_UPDATE } = require('../../config/config')
const { encryption } = require('../../middlewares/middleware')
const { createAdminLog } = require('../admin/adminLogs/handler')
const BankModel = require('./model')
const BankDetailHistoryModel = require('./changeHistory/model')
const UsersModel = require('../user/model')
class BankDetails {
  /**
 * Add bank details for the authenticated user.
 */
  async addV2(req, res) {
    try {
      // Destructure relevant properties from the request body.
      let { sAccountNo, sIFSC } = req.body

      // Extract and clean relevant properties from the request body.
      req.body = pick(req.body, ['sBankName', 'sBranchName', 'sAccountHolderName', 'sAccountNo', 'sIFSC'])

      // Retrieve the user's existing bank details, if any.
      const user = await BankModel.findOne({ iUserId: req.user._id }).lean()

      // If the user already has bank details, respond with an error.
      if (user) {
        return res.status(status.ResourceExist).jsonp({ status: status.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cuserData) })
      }

      // Validate the provided IFSC code.
      if (!validateIFSC(sIFSC)) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cIfscCode) })
      }

      // Encrypt the account number before saving.
      sAccountNo = encryption(sAccountNo)

      // Create a new bank entry in the database.
      const data = await BankModel.create({ ...req.body, iUserId: req.user._id, eStatus: 'A', sAccountNo })

      // Trim the displayed account number for privacy.
      data.sAccountNo = trimNumber(req.body.sAccountNo, -4)

      // Respond with a success message and the added bank details.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      // Handle errors by responding with an error message and logging the error.
      catchError('UserBankDetails.addV2', error, req, res)
    }
  }

  /**
 * Admin adds bank details for a specific user.
 */
  async adminAddV2(req, res) {
    try {
      // Get the user ID from the request parameters.
      const iUserId = req.params.id

      // Extract and clean relevant properties from the request body.
      req.body = pick(req.body, ['sBankName', 'sBranchName', 'sAccountHolderName', 'sAccountNo', 'sIFSC', 'bIsBankApproved'])
      removenull(req.body)

      // Destructure the cleaned properties from the request body, with a default value for 'bIsBankApproved'.
      let { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved = false } = req.body

      // Validate the provided IFSC code.
      if (!validateIFSC(sIFSC)) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cIfscCode) })
      }

      // Encrypt the account number before saving.
      sAccountNo = encryption(sAccountNo)

      // Get the admin ID from the request.
      const { _id: iAdminId } = req.admin

      // Create a new bank entry in the database.
      const data = await BankModel.create({ iUserId, sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved })

      const oBankDetailsHistory = { ...req.body, iUserId, sAccountNo: req.body.sAccountNo, eStatus: 'A', sRejectReason: '', oOldDetails: { ...req.body, sAccountNo: req.body.sAccountNo, eStatus: 'A', sRejectReason: '', iUserId } }

      await BankDetailHistoryModel.create(oBankDetailsHistory)

      // Prepare new fields for logging.
      const oNewFields = { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved }

      // Prepare log data for admin log creation.
      let logData = {
        oOldFields: {}, // No old fields as it's an addition.
        oNewFields,
        sIP: getIp(req),
        iAdminId: mongify(iAdminId),
        iUserId: mongify(iUserId),
        eKey: 'BD', // Assuming 'BD' represents 'Bank Details' for logging.
        sLatitude: req.admin.sLatitude,
        sLongitude: req.admin.sLongitude

      }

      // Replace sensitive info in the log data.
      logData = await replaceSensitiveInfo(logData)

      // Create an admin log with the added bank details.
      await createAdminLog(logData)

      // Trim the displayed account number for privacy.
      // data.sAccountNo = trimNumber(req.body.sAccountNo, -4)

      // Respond with a success message and the added bank details.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      // Handle errors by responding with an error message and logging the error.
      return catchError('BankDetails.adminAddV2', error, req, res)
    }
  }

  /**
 * Admin update bank details for a specific user.
 */
  async adminUpdateV2(req, res) {
    try {
      // Get the user ID from the request parameters.
      const iUserId = req.params.id

      // Extract and clean relevant properties from the request body.
      req.body = pick(req.body, ['sBankName', 'sBranchName', 'sAccountHolderName', 'sAccountNo', 'sIFSC', 'bIsBankApproved'])
      removenull(req.body)

      // Create a projection object based on the request body.
      const projection = projectionFields(req.body)

      // Destructure the cleaned properties from the request body.
      let { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved } = req.body

      // Validate the provided IFSC code.
      if (!validateIFSC(sIFSC)) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cIfscCode) })
      }

      // Encrypt the account number before updating.
      sAccountNo = encryption(sAccountNo)

      // Retrieve old fields for logging purposes.
      const oOldFields = await BankModel.findOne({ iUserId: mongify(iUserId) }, { ...projection, _id: 0, sAccountNo: 1, sAccountHolderName: 1 }).lean()

      // Check if old fields were not found.
      if (!oOldFields) {
        return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserBankDetails) })
      }

      // Get the admin ID from the request.
      const { _id: iAdminId } = req.admin

      // Update bank details in the database.
      const data = await BankModel.findOneAndUpdate(
        { iUserId: mongify(iUserId) },
        { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved, eStatus: 'A', sRejectReason: '' },
        { runValidators: true, new: true }
      ).lean()

      const oBankDetailsHistory = { ...req.body, iUserId, sAccountNo: req.body.sAccountNo, eStatus: 'A', sRejectReason: '', oOldDetails: { ...oOldFields, sAccountNo: req.body.sAccountNo, eStatus: 'A', sRejectReason: '', iUserId } }

      await BankDetailHistoryModel.create(oBankDetailsHistory)

      // Check if the update was successful.
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserBankDetails) })
      }

      // Prepare new fields for logging.
      const oNewFields = { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved }

      // Prepare log data for admin log creation.
      let logData = {
        oOldFields,
        oNewFields,
        sIP: getIp(req),
        iAdminId: mongify(iAdminId),
        iUserId: mongify(iUserId),
        eKey: 'BD', // Assuming 'BD' represents 'Bank Details' for logging.
        sLatitude: req.admin.sLatitude,
        sLongitude: req.admin.sLongitude
      }

      // Replace sensitive info in the log data.
      logData = await replaceSensitiveInfo(logData)

      // Create an admin log with the updated bank details.
      await createAdminLog(logData)

      // Trim the displayed account number for privacy.
      data.sAccountNo = trimNumber(req.body.sAccountNo, -4)

      // Respond with a success message and the updated bank details.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      // Handle errors by responding with an error message and logging the error.
      return catchError('BankDetails.adminUpdateV2', error, req, res)
    }
  }

  /**
 * Updates bank details for the currently authenticated user.
 */
  async updateV2(req, res) {
    try {
      // Get the user ID from the authenticated user in the request.
      const iUserId = req.user._id

      // Extract and clean relevant properties from the request body.
      req.body = pick(req.body, ['sBankName', 'sBranchName', 'sAccountHolderName', 'sAccountNo', 'sIFSC'])
      removenull(req.body)

      // Destructure the cleaned properties from the request body.
      let { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC } = req.body

      // Validate the provided IFSC code.
      if (!validateIFSC(sIFSC)) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cIfscCode) })
      }

      const oOldBankDetails = await BankModel.findOne({ iUserId: mongify(iUserId) }).lean()

      // Encrypt the account number before updating.
      sAccountNo = encryption(sAccountNo)
      await BankModel.updateOne(
        { iUserId: mongify(iUserId) },
        { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, eStatus: 'A', sRejectReason: '' },
        { upsert: true, runValidators: true }
      )

      const data = await BankModel.findOne({ iUserId: mongify(iUserId) }).lean()

      // Check if the update was successful.
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserBankDetails) })
      }

      data.sAccountNo = req.body.sAccountNo
      const oBankDetailsHistory = { iUserId: mongify(iUserId), sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, eStatus: 'A', sRejectReason: '', oOldDetails: oOldBankDetails }
      // if (oUpdateResponse?.upsertedCount || oUpdateResponse?.modifiedCount) {
      if (oOldBankDetails?.sBankName !== req.body.sBankName || oOldBankDetails?.sAccountHolderName !== req.body.sAccountHolderName || decryption(oOldBankDetails?.sAccountNo || '') !== req.body.sAccountNo || oOldBankDetails?.sIFSC !== req.body.sIFSC) {
        const oBankDetailsId = await BankDetailHistoryModel.create(oBankDetailsHistory)
        data.iBankDetailId = oBankDetailsId._id
      } else {
        const oBankDetailsId = await BankDetailHistoryModel.findOne({ iUserId: mongify(iUserId) }, { _id: 1 }).sort({ _id: -1 }).lean()
        data.iBankDetailId = oBankDetailsId._id
      }

      // }
      // Respond with a success message and the updated bank details.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      // Handle errors by responding with an error message and logging the error.
      return catchError('UserBankDetails.updateV2', error, req, res)
    }
  }

  /**
 * Get bank details in version 2
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
  async getV2(req, res) {
    try {
      // Find bank details for the user
      const data = await BankModel.findOne({ iUserId: req.user._id }).lean()

      // Check if bank details exist
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cbankDetails) })
      }

      // Decrypt and trim the account number
      data.sAccountNo = decryption(data.sAccountNo)
      // data.sAccountNo = trimNumber(data.sAccountNo, -4)

      // Return bank details in the response
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      // Handle errors
      return catchError('UserBankDetails.getV2', error, req, res)
    }
  }

  /**
  * Retrieves bank details for a user in the context of an admin.
  */
  async adminGetV2(req, res) {
    try {
      // Retrieve bank details for the specified user ID from the database.
      const data = await BankModel.findOne({ iUserId: mongify(req.params.id) }).lean()

      // Check if bank details were not found.
      if (!data) {
        // Respond with default data and a flag indicating whether bank details update is allowed.
        return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cbankDetails), data: { bAllowUpdate: ALLOW_BANK_UPDATE } })
      }

      // Decrypt and trim the account number in the retrieved data.
      data.sAccountNo = decryption(data.sAccountNo)
      data.sAccountNo = trimNumber(data.sAccountNo, -4)

      // Respond with the retrieved bank details and a flag indicating whether bank details update is allowed.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbankDetails), data: { ...data, bAllowUpdate: ALLOW_BANK_UPDATE } })
    } catch (error) {
      // Handle errors by responding with an error message and logging the error.
      return catchError('BankDetails.adminGetV2', error, req, res)
    }
  }

  async adminGetBankDetailsHistory(req, res) {
    try {
      const iUserId = req.params.id
      const oUser = await UsersModel.findById(iUserId).lean()
      if (!oUser) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuser) })

      const [results, total] = await Promise.all([
        BankDetailHistoryModel.find({ iUserId: mongify(iUserId) }, { oOldDetails: 0 }).sort({ dCreatedAt: -1 }).lean(),
        BankDetailHistoryModel.countDocuments({ iUserId })
      ])
      results.forEach((oBankDetail) => {
        oBankDetail.sAccountNo = decryption(oBankDetail?.sAccountNo || '')
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbankDetails), data: { nTotal: total, aResult: results } })
    } catch (error) {
      return catchError('BankDetails.adminGetBankDetailsHistory', error, req, res)
    }
  }
}

module.exports = new BankDetails()
