const { body, oneOf, query } = require('express-validator')

const { bannerType, status, bannerScreen, bannerPlace } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminAddBanner = [
  body('sImage').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(bannerType),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status),
  body('ePlace').not().isEmpty().toUpperCase().isIn(bannerPlace),
  oneOf([
    body('sLink').not().isEmpty(),
    body('eScreen').not().isEmpty().toUpperCase().isIn(bannerScreen),
    body('eType').not().isEmpty().toUpperCase().isIn('CR')
  ])
  // body('eCategory').not().isEmpty().optional().isIn(eCategory)
]

const adminUpdateBanner = [
  body('sImage').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(bannerType),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status),
  body('ePlace').not().isEmpty().toUpperCase().isIn(bannerPlace),
  oneOf([
    body('sLink').not().isEmpty(),
    body('eScreen').not().isEmpty().toUpperCase().isIn(bannerScreen),
    body('eType').not().isEmpty().toUpperCase().isIn('CR')
  ])
  // body('eCategory').not().isEmpty().optional().isIn(eCategory)
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = {
  adminAddBanner,
  adminUpdateBanner,
  getSignedUrl,
  limitValidator
}
