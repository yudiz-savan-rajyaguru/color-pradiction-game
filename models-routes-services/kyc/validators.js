const { body, query, param } = require('express-validator')

const { kycStatus } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

// Validation middleware for updating KYC status
const updateKycStatus = [
  param('id').isMongoId(),
  body('eType').not().isEmpty().toUpperCase().isIn(['PAN', 'AADHAAR']),
  body('eStatus').not().isEmpty().toUpperCase().isIn(kycStatus)
  // body('sRejectReason').not().isEmpty() // Uncomment this line if 'sRejectReason' is a required field
]

// Validation middleware for getting signed URL for KYC
const getSignedUrlKyc = [
  body('oPath').not().isEmpty()
]

// Validation middleware for getting signed URL
const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

// Validation middleware for admin KYC update
const adminKycUpdate = [
  body('eType').not().isEmpty().toUpperCase().isIn(['PAN', 'AADHAAR'])
]

// Validation middleware for user KYC addition
const userKycAdd = [
  body('eType').not().isEmpty().toUpperCase().isIn(['PAN', 'AADHAAR'])
]

// Validation middleware for getting signed URL for user KYC
const userGetSignedUrlKyc = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

// Validation middleware for user KYC update
const userKycUpdate = [
  body('eType').not().isEmpty().isIn(['PAN', 'AADHAAR'])
]

// Validation middleware for query parameter 'limit'
const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

// Validation middleware for sending KYC OTP
const sendKycOTP = [
  body('nAadhaarNo').not().isEmpty()
]

module.exports = {
  updateKycStatus,
  getSignedUrlKyc,
  getSignedUrl,
  adminKycUpdate,
  userKycAdd,
  userGetSignedUrlKyc,
  userKycUpdate,
  limitValidator,
  sendKycOTP
}
