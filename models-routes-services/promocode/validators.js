const { body, query } = require('express-validator')
const { promocodeTypes } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const addPromoCodeV2 = [
  body('sName').not().isEmpty(),
  body('sCode').not().isEmpty(),
  body('nAmount').not().isEmpty().isNumeric(),
  body('nMinAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('nMaxAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('bIsPercent').not().isEmpty().isBoolean(),
  body('nMaxAllow').not().isEmpty().isInt(),
  body('dStartTime').not().isEmpty(),
  body('dExpireTime').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(promocodeTypes),
  body('nMaxDiscount').custom((value, { req }) => {
    if (req.body.bIsPercent === true && (!value || value <= 0)) {
      throw new Error()
    }
    return true
  })
]

const updatePromoCodeV2 = [
  body('bIsPercent').not().isEmpty().isBoolean(),
  body('nAmount').not().isEmpty().isNumeric(),
  body('nMinAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('nMaxAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('dStartTime').not().isEmpty(),
  body('dExpireTime').not().isEmpty(),
  body('nMaxDiscount').custom((value, { req }) => {
    if (req.body.bIsPercent === true && (!value || value <= 0)) {
      throw new Error()
    }
    return true
  })
]

const checkPromocode = [
  body('sPromo').not().isEmpty(),
  body('nAmount').not().isEmpty().isNumeric()
]

const listPromocode = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const addNPromoCodes = [
  body('sName').not().isEmpty(),
  body('nLength').not().isEmpty(),
  body('nCount').not().isEmpty(),
  body('nAmount').not().isEmpty().isNumeric(),
  body('nMinAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('nMaxAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('bIsPercent').not().isEmpty().isBoolean(),
  body('nMaxAllow').not().isEmpty().isInt(),
  body('dStartTime').not().isEmpty(),
  body('dExpireTime').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(promocodeTypes)
]

module.exports = {
  checkPromocode,
  listPromocode,
  addNPromoCodes,
  addPromoCodeV2,
  updatePromoCodeV2
}
