// @ts-check
const axios = require('axios')

const { handleCatchError, getIp, mongify } = require('../../helper/utilities.services')
const { queuePush } = require('../../helper/redis')
const { jsonStatus, messages } = require('../../helper/api.responses')
const config = require('./../../config/config')
const KycModel = require('./model')
const { KYC_CASHFREE_VERIFICATION, KYC_DIRECT_VALIDATE } = config

/**
 * It is verify pan number using cashfree APIs
 * @param {*} sDocNo
 * @returns {object} if success is true the verified success or it fails
 */
async function verifyPan(sDocNo) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const body = JSON.stringify({ pan: `${sDocNo}` })

        const response = await axios.post(`${config.CASHFREE_VERIFICATION_URL}/${config.CASHFREE_PAN_VERIFY_PATH}`,
          body,
          { headers: { 'x-client-id': config.CASHFREE_CLIENTID, 'x-client-secret': config.CASHFREE_CLIENTSECRET, 'Content-Type': 'application/json' } }
        )

        if (response?.data?.valid) {
          return resolve({ success: true })
        } else {
          return resolve({ success: false, message: response?.data?.message })
        }
      } catch (error) {
        const { response } = error
        if (response) {
          const { status, data } = response
          return resolve({ success: false, status, ...data })
        }
        return resolve({ success: false, ...error })
      }
    })()
  })
}

/**
 * Asynchronous function to send Aadhaar OTP.
 * @param {string} nAadhaarNo - Aadhaar number as a string.
 */
async function sendAadhaarOTP(nAadhaarNo) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Constructing the request body with Aadhaar number
        const body = JSON.stringify({ aadhaar_number: `${nAadhaarNo}` })

        // Making a POST request to the Cashfree Aadhaar OTP sending endpoint
        const response = await axios.post(`${config.CASHFREE_VERIFICATION_URL}/${config.CASHFREE_AADHAAR_SENDOTP_PATH}`,
          body,
          { headers: { 'x-client-id': config.CASHFREE_CLIENTID, 'x-client-secret': config.CASHFREE_CLIENTSECRET, 'Content-Type': 'application/json' } }
        )

        // Checking the response status and forming the result object accordingly
        if (response?.data?.status === 'SUCCESS') {
          return resolve({ success: true, sRefId: response.data.ref_id })
        } else {
          return resolve({ success: false, message: response?.data?.message })
        }
      } catch (error) {
        // Handling errors and forming an appropriate result object
        const { response } = error
        if (response) {
          const { status, data } = response
          return resolve({ success: false, status, ...data })
        }
        return resolve({ success: false, ...error })
      }
    })()
  })
}

/**
 * Asynchronous function to verify Aadhaar OTP.
 * @param {string} sRefId - Reference ID obtained from the OTP sending step.
 * @param {string} sOTP - OTP (One-Time Password) for Aadhaar verification.
 */
async function verifyAadhaar(sRefId, sOTP) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Constructing the request body with OTP and Reference ID
        const body = JSON.stringify({ otp: sOTP, ref_id: sRefId })

        // Making a POST request to the Cashfree Aadhaar verification endpoint
        const response = await axios.post(`${config.CASHFREE_VERIFICATION_URL}/${config.CASHFREE_AADHAAR_VERIFY_PATH}`,
          body,
          { headers: { 'x-client-id': config.CASHFREE_CLIENTID, 'x-client-secret': config.CASHFREE_CLIENTSECRET, 'Content-Type': 'application/json' } }
        )

        // Checking the response status and forming the result object accordingly
        if (response?.data?.status === 'VALID') {
          const { dob, gender, name, split_address: sAddress } = response.data
          return resolve({ success: true, sRefId, dob, gender, name, sAddress })
        } else {
          return resolve({ success: false, message: response?.data?.message })
        }
      } catch (error) {
        // Handling errors and forming an appropriate result object
        const { response } = error
        if (response) {
          const { status, data } = response
          return resolve({ success: false, status, ...data })
        }
        return resolve({ success: false, ...error })
      }
    })()
  })
}

/**
 * Asynchronous function to push KYC (Know Your Customer) notification.
 * @param {object} data - KYC data object containing status information.
 * @param {number} iUserId - User ID associated with the KYC process.
 */
async function pushNotificationKyc(data, iUserId) {
  try {
    // Checking KYC status and determining the type (AADHAAR or PAN)
    if (data['oAadhaar.eStatus'] === 'A' || data['oPan.eStatus'] === 'A') {
      const eType = data['oAadhaar.eStatus'] ? 'AADHAAR' : 'PAN'
      // Pushing a notification for KYC approval
      await queuePush('pushNotification:KYC', { iUserId, eStatus: 'A', eType })
    } else if (data['oAadhaar.eStatus'] === 'R' || data['oPan.eStatus'] === 'R') {
      const eType = data['oAadhaar.eStatus'] ? 'AADHAAR' : 'PAN'
      // Pushing a notification for KYC rejection
      await queuePush('pushNotification:KYC', { iUserId, eStatus: 'R', eType })
    }
  } catch (error) {
    // Handling errors in pushing KYC notifications
    handleCatchError(error)
  }
}

// validate kyc details as per type
async function validateKycAsPerType(payload) {
  const { eType } = payload
  if (eType === 'AADHAAR') {
    const response = await validateAadhar(payload)
    return { validateRes: response }
  } else if (eType === 'PAN') {
    const response = await validatePan(payload)
    return { validateRes: response }
  }
}

// Function to validate Aadhar information
async function validateAadhar(aadharVerificationPayload) {
  const { iUserId, flag, sRefId, request, autoApprove } = aadharVerificationPayload || {}
  const { sFrontImage, sBackImage, sNo, sOTP } = request?.body || {}
  // Check if Aadhaar number already exists for another user
  const numberExist = await KycModel.findOne({ 'oAadhaar.sNo': sNo, iUserId: { $ne: mongify(iUserId) }, 'oAadhaar.eStatus': { $ne: 'R' } }).lean()
  // If Aadhaar number exists for another user, return error
  if (numberExist) {
    return { success: false, status: jsonStatus.ResourceExist, message: messages[request.userLanguage].already_exist.replace('##', messages[request.userLanguage].aadharNum) }
  }

  // Process Aadhar KYC details and get the result
  const processRes = await processAadharKycDetails({ sFrontImage, sBackImage, sNo, sOTP, flag, sRefId, request, autoApprove, iUserId })

  // If the processing result is unsuccessful, return an error
  if (processRes.success === false) return { data: {}, success: false }

  // If successful, return the processed data
  return { data: processRes, success: true }
}

// Function to validate PAN information
async function validatePan(panVerificationPayload) {
  // Destructure properties from the payload
  const { flag, iUserId, request, autoApprove } = panVerificationPayload

  // Destructure properties from the request body
  const { sImage, sNo, sName } = request.body

  // Check if 'sName' is provided; return error if not
  if (!sName) {
    return { success: false, status: jsonStatus.BadRequest, message: messages[request.userLanguage].required.replace('##', messages[request.userLanguage].cName) }
  }

  // Check if PAN number already exists for another user
  const panNo = await KycModel.findOne({ 'oPan.sNo': sNo, iUserId: { $ne: mongify(iUserId) }, 'oPan.eStatus': { $ne: 'R' } }).lean()

  // If PAN number exists for another user, return error
  if (panNo) {
    return { success: false, status: jsonStatus.ResourceExist, message: messages[request.userLanguage].already_exist.replace('##', messages[request.userLanguage].panNum) }
  }

  // Process PAN KYC details and get the result
  const processRes = await processPanKycDetails({ flag, iUserId, sNo, request, autoApprove, sImage, sName })

  // If the processing result is unsuccessful, return an error
  if (processRes.success === false) {
    return { data: {}, success: false }
  }

  // If successful, return the processed data
  return { data: processRes, success: true }
}

// Function to process Aadhar KYC details
async function processAadharKycDetails(kycPayload) {
  // Initialize data object
  let data = {}

  // Destructure properties from the payload
  const { flag, iUserId, sFrontImage, sBackImage, sNo, request, autoApprove, sRefId, sOTP } = kycPayload

  // Check if the context is 'admin'
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
      'oAadhaar.oVerifiedAt.sIP': getIp(request),
      'oAadhaar.oVerifiedAt.iAdminId': request.admin._id,
      'oAadhaar.sRejectReason': undefined
    }
  } else {
    // User context
    // Initialize Aadhaar response object
    let aadhaarRes = {}

    // Initialize auto-approve status
    let autoApproveStatus = 'P'

    // Check if auto-approval is enabled
    if (autoApprove) {
      autoApproveStatus = 'A'
      aadhaarRes.success = true
    } else if (['production', 'staging'].includes(config.NODE_ENV) && KYC_CASHFREE_VERIFICATION) {
      // Perform Aadhaar verification
      aadhaarRes = await verifyAadhaar(sRefId, sOTP)

      // If Aadhaar verification fails, return an error
      if (!aadhaarRes.success) {
        return { success: false, status: jsonStatus.BadRequest, message: messages[request.userLanguage].verify_otp_err }
      }
    } else {
      // Auto-approval is not enabled, and verification is successful
      aadhaarRes.success = true
    }

    // Create data object based on the context and verification results
    data = {
      iUserId,
      'oAadhaar.sFrontImage': sFrontImage,
      'oAadhaar.sBackImage': sBackImage,
      'oAadhaar.eStatus': (KYC_DIRECT_VALIDATE && aadhaarRes.success) || autoApproveStatus,
      'oAadhaar.sNo': sNo,
      'oAadhaar.dCreatedAt': new Date()
    }
  }

  return data
}

// Function to process PAN KYC details
async function processPanKycDetails(kycPanPayload) {
// Destructure properties from the payload
  const { flag, iUserId, sNo, request, autoApprove, sImage, sName } = kycPanPayload

  // Initialize data object
  let data

  // Check if the context is 'admin'
  if (flag === 'admin') {
    // Admin context
    data = {
      iUserId,
      'oPan.sImage': sImage,
      'oPan.eStatus': 'A',
      'oPan.sNo': sNo,
      'oPan.dCreatedAt': new Date(),
      'oPan.oVerifiedAt.dActionedAt': Date.now(),
      'oPan.oVerifiedAt.sIP': getIp(request),
      'oPan.oVerifiedAt.iAdminId': request.admin._id,
      'oPan.sRejectReason': undefined,
      'oPan.sName': sName
    }
  } else {
    // User context

    // Initialize PAN response object
    let panRes = {}

    // Initialize auto-approve status
    let autoApproveStatus = 'P'

    // Check if auto-approval is enabled
    if (autoApprove) {
      panRes.success = true
      autoApproveStatus = 'A'
    } else if (['production', 'staging'].includes(config.NODE_ENV) && KYC_CASHFREE_VERIFICATION) {
      // Perform PAN verification
      panRes = await verifyPan(sNo)

      // If PAN verification fails, return an error
      if (!panRes.success) {
        return { success: false, status: jsonStatus.BadRequest, message: messages[request.userLanguage].invalid.replace('##', messages[request.userLanguage].panNum) }
      }
    } else {
      // Auto-approval is not enabled, and verification is successful
      panRes.success = true
    }

    // Create data object based on the context and verification results
    data = {
      iUserId,
      'oPan.sImage': sImage,
      'oPan.eStatus': (KYC_DIRECT_VALIDATE && panRes.success) || autoApproveStatus,
      'oPan.sNo': sNo,
      'oPan.dCreatedAt': new Date(),
      'oPan.sName': sName
    }
  }

  return data
}

/**
 * Validate KYC data in version 3
 * @param {Object} oData - Object containing necessary data
 * @param {string} oData.iUserId - User ID
 * @param {string} [oData.flag=''] - Flag indicating the context (e.g., 'admin')
 * @param {string} [oData.sRefId] - Reference ID for verification
 * @param {boolean} [oData.autoApprove] - Flag indicating auto-approval
 * @returns {Object} - Object indicating the success status and related information
 */
async function validateKycV3(oData) {
  try {
    const { req, iUserId, flag = '', sRefId, autoApprove } = oData || {}
    const { eType } = req.body
    // Validate KYC type
    if (!['PAN', 'AADHAAR'].includes(eType)) {
      return { success: false, status: jsonStatus.BadRequest, message: messages[req?.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].sType) }
    }

    // based on the type PAN OR AADHAAR it will validate the kyc
    const kycInfo = await validateKycAsPerType({ eType, request: req, iUserId, flag, autoApprove, sRefId })
    if (kycInfo?.validateRes?.success === false) { return { success: false, ...kycInfo.validateRes } }

    // Push notification for KYC
    await pushNotificationKyc(kycInfo?.validateRes, iUserId)

    // Return success status and data
    return { success: true, ...(kycInfo?.validateRes.data || []) }
  } catch (error) {
    // Handle errors
    handleCatchError(error)
    return { success: false }
  }
}

module.exports = {
  verifyPan,
  verifyAadhaar,
  sendAadhaarOTP,
  pushNotificationKyc,
  validateKycAsPerType,
  validateKycV3
}
