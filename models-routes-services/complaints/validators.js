const { body, query, param } = require('express-validator')

const { complaintType } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const userAddComplaint = [
  body('sTitle').not().isEmpty().escape(), // Validate that 'sTitle' is not empty and escape any special characters
  body('sDescription').not().isEmpty().escape(), // Validate that 'sDescription' is not empty and escape any special characters
  body('eType').not().isEmpty().isIn(complaintType)
  // body('eType').not().isEmpty().toUpperCase().isIn(issueType) // Validate that 'eType' is not empty, convert it to uppercase, and check if it is in the list of valid issue types
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(), // Validate that 'sFileName' is not empty
  body('sContentType').not().isEmpty() // Validate that 'sContentType' is not empty
]

const adminUpdateStatus = [
  body('eType').not().isEmpty().toUpperCase().isIn(complaintType) // Validate that 'eType' is not empty, convert it to uppercase, and check if it is in the list of valid issue types
]

const list = [
  query('nLimit').optional().custom(value => {
    const intValue = parseInt(value)
    if (intValue > PAGINATION_LIMIT) {
      throw new Error(`Invalid value, limit must be less than ${PAGINATION_LIMIT}`)
    }
    return true
  })
]

const freshDeskId = [
  body('id').not().isEmpty() // Validate that 'id' is not empty
]

const createTicket = [
  body('email').not().isEmpty(), // Validate that 'email' is not empty
  body('subject').not().isEmpty().toUpperCase(), // Validate that 'subject' is not empty, convert it to uppercase, and check if it is in the list of valid issue types
  body('description').not().isEmpty().escape() // Validate that 'description' is not empty and escape any special characters
]

const adminList = [
  // Validate that 'limit' is an optional integer and does not exceed the pagination limit
  query('limit').optional().custom(value => {
    const intValue = parseInt(value)
    if (intValue > PAGINATION_LIMIT) {
      throw new Error(`Invalid value, limit must be less than ${PAGINATION_LIMIT}`)
    }
    return true
  })

]

const validateId = [
  param('id').isMongoId() // Validate 'id' parameter as a valid MongoDB ObjectId
]

module.exports = {
  userAddComplaint,
  getSignedUrl,
  adminUpdateStatus,
  list,
  adminList,
  freshDeskId,
  validateId,
  createTicket
}
