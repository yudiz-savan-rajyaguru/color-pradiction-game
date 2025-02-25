const { body, param } = require('express-validator')

const updateBankDetailsV2 = [
  body('sBankName').not().isEmpty().escape(),
  body('sBranchName').not().isEmpty().escape().optional(),
  body('sAccountHolderName').not().isEmpty().escape(),
  body('sAccountNo').not().isEmpty().isNumeric(),
  body('sIFSC').not().isEmpty()
]

const addBankDetailsV2 = [
  body('sBankName').not().isEmpty().escape(),
  body('sBranchName').not().isEmpty().escape(),
  body('sAccountHolderName').not().isEmpty().escape(),
  body('sAccountNo').not().isEmpty().isNumeric(),
  body('sIFSC').not().isEmpty()
]

const validateParams = [
  param('id').not().isEmpty().isMongoId()
]

module.exports = {
  updateBankDetailsV2,
  addBankDetailsV2,
  validateParams
}
