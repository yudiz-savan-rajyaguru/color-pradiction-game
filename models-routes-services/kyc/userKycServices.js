// @ts-check
const config = require('../../config/config')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, checkValidImageType, trimNumber, mongify } = require('../../helper/utilities.services')
const bucket = require('../../helper/cloudStorage.services')
const KycModel = require('./model')
const { S3_KYC_PAN, S3_KYC_AADHAAR, KYC_CASHFREE_VERIFICATION } = config
const { S3_KYC_BUCKET_NAME } = require('../../config/config')

class UserKyc {
  async getSignedUrl(req, res) {
    try {
      // Extracting and filtering relevant properties from the request body
      req.body = pick(req.body, ['sFileName', 'sContentType'])

      // Destructuring properties from the filtered request body
      let { sFileName, sContentType } = req.body

      // Extracting parameters from the request params
      const { type, id } = req.params

      // Validating the KYC document type
      if (!['PAN', 'AADHAAR'].includes(type)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].sType) })
      }

      // Validating the image type based on file name and content type
      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })
      }

      // Modifying file name for URL compatibility
      sFileName = sFileName.replace('/', '-')
      sFileName = sFileName.replace(/\s/gi, '-')

      // Defining the storage path based on the KYC document type
      let path = ''
      if (type === 'PAN') {
        path = S3_KYC_PAN
      } else {
        path = S3_KYC_AADHAAR
      }

      // Constructing the full file name based on user presence
      if (req.user) {
        sFileName = `${req.user._id}_${type}_${sFileName}`
      } else {
        sFileName = `${id}_${type}_${sFileName}`
      }

      // Retrieving a signed URL for the specified file
      const data = await bucket.getSignedUrl({ sFileName, sContentType, path, eType: 'kyc' })

      // Returning a success response with the generated signed URL
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      // Handling and logging errors during URL generation
      catchError('userKyc.getSignedUrl', error, req, res)
    }
  }

  /**
 * Retrieves signed URLs for KYC (Know Your Customer) documents for file uploads.
 * Expected Request Parameters:
 * - Body: {Object} req.body
 *    - {Object} oPath - Object containing paths for KYC documents.
 */
  async getSignedUrlKyc(req, res) {
    try {
      // Extracting and filtering relevant properties from the request body
      req.body = pick(req.body, ['oPath'])

      // Destructuring properties from the filtered request body
      const { oPath } = req.body

      // Retrieving the KYC bucket name
      const sBucketName = S3_KYC_BUCKET_NAME

      // Object to store signed URLs for KYC documents
      const signedUrls = {}

      // Iterating over each path in the oPath object
      for (const path in oPath) {
        const key = path
        const value = oPath[path]

        // Configuring parameters for generating a signed URL
        const params = {
          Bucket: sBucketName,
          Key: value,
          Expires: 300 // URL expiration time (in seconds)
        }

        let url = ''

        try {
          // Generating a signed URL for the specified path
          if (value) url = await bucket.getObjSignedUrl(params)

          // Adding the signed URL to the result object
          Object.assign(signedUrls, { [key]: url })
        } catch (error) {
          // Handling and logging errors during URL generation
          return catchError('userKyc.getSignedUrlKyc', error, req, res)
        }
      }

      // Returning a success response with the generated signed URLs
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data: signedUrls })
    } catch (error) {
      // Handling and logging unexpected errors
      return catchError('userKyc.getSignedUrlKyc', error, req, res)
    }
  }

  // Get disclaimer information
  getDisclaimer(req, res) {
    try {
      // Create and send response with disclaimer information
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDisclaimer), data: { sInfo: messages[req.userLanguage].kyc_info } })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('userKyc.getDisclaimer', error, req, res)
    }
  }

  // Async function to get KYC details for a user with additional details
  async getKycDetailsV2(req, res) {
    try {
      // Determine the user ID based on whether it's from the request or parameters
      const iUserId = req.user ? mongify(req.user._id) : mongify(req.params.id)

      // Find KYC data for the user
      const data = await KycModel.findOne({ iUserId }).lean()

      // If no data is found, return a not found response
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })

      // If PAN status is 'R', modify the response object
      if (data.oPan.eStatus === 'R') {
        data.oPan = { sRejectReason: data.oPan ? data.oPan.sRejectReason : '', eStatus: 'R' }
      }

      // If Aadhaar status is 'R', modify the response object
      if (data.oAadhaar.eStatus === 'R') {
        data.oAadhaar = { sRejectReason: data.oAadhaar ? data.oAadhaar.sRejectReason : '', eStatus: 'R' }
      }

      // Additional processing for images if KYC_CASHFREE_VERIFICATION is false
      if (data.oAadhaar && !KYC_CASHFREE_VERIFICATION) {
        if (data.oAadhaar.sFrontImage) {
          data.oAadhaar.sFrontImage = await getUrl(data.oAadhaar.sFrontImage)
        }
        if (data.oAadhaar.sBackImage) {
          data.oAadhaar.sBackImage = await getUrl(data.oAadhaar.sBackImage)
        }
      }
      if (data.oPan && !KYC_CASHFREE_VERIFICATION) {
        if (data.oPan.sImage) {
          data.oPan.sImage = await getUrl(data.oPan.sImage)
        }
      }

      // Trim and modify certain fields for display
      if (data.oAadhaar.sNo) data.oAadhaar.sNo = trimNumber(data.oAadhaar.sNo)
      if (data.oPan.sNo) data.oPan.sNo = trimNumber(data.oPan.sNo)

      // Return the KYC details
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].kyc), data })
    } catch (error) {
      // Handle errors and return an error response
      return catchError('userKyc.getKycDetails', error, req, res)
    }
  }
}

/**
 * Asynchronous function to generate a signed URL for an object in the KYC (Know Your Customer) bucket.
 * @param {string} path - Path of the object for which the signed URL is generated.
 */
function getUrl(path) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Retrieving the KYC bucket name
        const sBucketName = S3_KYC_BUCKET_NAME

        // Setting parameters for generating a signed URL
        const params = {
          Bucket: sBucketName,
          Key: path,
          Expires: 300 // URL expiration time in seconds (e.g., 5 minutes)
        }

        try {
          // Generating a signed URL for the specified object
          const url = await bucket.getObjSignedUrl(params)
          return resolve(url)
        } catch (error) {
          // Handling errors in the process of getting the signed URL
          reject(error)
        }
      } catch (error) {
        // Handling errors in the overall process
        reject(error)
      }
    })()
  })
}

module.exports = new UserKyc()
