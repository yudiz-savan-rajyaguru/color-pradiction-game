const { param, body, query } = require('express-validator')
const { messages } = require('../../helper/api.responses')
const { segmentationType, paymentOptionsKey, transactionType, timeRange, passbookStatus, paymentStatus, payoutStatus, status, amountTypeSegment, units } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/defaultConfig')
const { validObjectId } = require('../../helper/utilities.services')
function validateFields(segment, userLanguage) {
  if (segment.nAmountFrom && segment.nAmountTo && segment.nAmount) throw new Error(messages[userLanguage].amount_field_msg)
  if (segment.dDateFrom && segment.dDateTo && segment.eTimeRange) throw new Error(messages[userLanguage].date_field_msg)
  if (segment.dDateFrom && segment.dDateTo) {
    if (new Date(segment.dDateFrom) > new Date(segment.dDateTo)) throw new Error(messages[userLanguage].greater_then_err.replace('##', messages[userLanguage].cDateTo).replace('#', messages[userLanguage].cDateFrom))
  }

  if (segment?.nAmountFrom && segment?.nAmountTo && (Number(segment?.nAmountFrom) > Number(segment?.nAmountTo))) throw new Error(messages[userLanguage].greater_then_err.replace('##', messages[userLanguage].cAmountTo).replace('#', messages[userLanguage].cAmountFrom))

  if (segment?.eTransactionStatus) {
    if (segment.eType === 'D') {
      if (!paymentStatus.includes(segment?.eTransactionStatus)) throw new Error(messages[userLanguage].invalid.replace('##', messages[userLanguage].cDepositStatus))
    }
    if (segment.eType === 'W') {
      if (!payoutStatus.includes(segment?.eTransactionStatus)) throw new Error(messages[userLanguage].invalid.replace('##', messages[userLanguage].cWithdrawStatus))
    }
  }
}
const add = [
  body('sName').trim().notEmpty().isString(),
  body('oFrequency').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isObject(),
  body('bAutomated').notEmpty().isBoolean(),
  body('oFrequency.nValue')
    .if((value, { req }) => ['true', true].includes(req.body?.bAutomated))
    .isInt({ min: 1 }),
  body('oFrequency.nUnit')
    .if((value, { req }) => ['true', true].includes(req.body?.bAutomated))
    .isIn(units),
  body('aSegment.*.eType').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(segmentationType),
  body('aSegment.*.ePaymentGateway').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(paymentOptionsKey),
  body('aSegment.*.eTransactionStatus').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn([...passbookStatus, ...paymentStatus, ...payoutStatus]),
  body('aSegment.*.eTransactionType').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(transactionType.value),
  body('aSegment.*.eTimeRange').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(timeRange),
  body('aSegment.*.eAmount').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(amountTypeSegment),
  body('aSegment').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).custom((value, { req }) => {
    const eTypeCount = {

    }

    if (['true', true].includes(req.body?.bAutomated)) {
      value.forEach(element => {
        if (eTypeCount[element.eType]) eTypeCount[element.eType]++
        else eTypeCount[element.eType] = 1

        if (eTypeCount[element.eType] > 1) throw new Error(messages[req.userLanguage].duplicate_segment_found)
        else if (eTypeCount[element.eType] === 1) {
          validateFields(element, req.userLanguage)
          if (element.eType === 'D') element.eTransactionType = 'Deposit'
          if (element.eType === 'W') element.eTransactionType = 'Withdraw'
        }
      })
    }

    return true
  })
]
const update = [
  body('sName').trim().notEmpty().isString(),
  body('oFrequency').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isObject(),
  body('bAutomated').isBoolean(),
  body('eStatus').isIn(status),
  body('oFrequency.nValue')
    .if((value, { req }) => ['true', true].includes(req.body?.bAutomated))
    .isInt({ min: 1 }),
  body('oFrequency.nUnit')
    .if((value, { req }) => ['true', true].includes(req.body?.bAutomated))
    .isIn(units),
  body('aSegment.*.eType').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(segmentationType),
  body('aSegment.*.ePaymentGateway').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(paymentOptionsKey),
  body('aSegment.*.eTimeRange').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(timeRange),
  body('aSegment.*.eAmount').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(amountTypeSegment),
  body('aSegment.*.eTransactionStatus').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn([...passbookStatus, ...paymentStatus, ...payoutStatus]),
  body('aSegment.*.eTransactionType').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).optional().isIn(transactionType.value),
  body('aSegment').if((value, { req }) => ['true', true].includes(req.body?.bAutomated)).custom((value, { req }) => {
    const eTypeCount = {

    }
    if (['true', true].includes(req.body?.bAutomated)) {
      value?.forEach(element => {
        if (!element.eType) throw new Error(messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].segment))

        if (eTypeCount[element.eType]) eTypeCount[element.eType]++
        else eTypeCount[element.eType] = 1

        if (eTypeCount[element.eType] > 1) throw new Error(messages[req.userLanguage].duplicate_segment_found)
        else if (eTypeCount[element.eType] === 1) {
          validateFields(element, req.userLanguage)
          if (element.eType === 'D') element.eTransactionType = 'Deposit'
          if (element.eType === 'W') element.eTransactionType = 'Withdraw'
        }
      })
    }

    return true
  })
]

const addManualUsers = [
  body('aUserId').notEmpty().isArray().custom((value, { req }) => {
    value.forEach(element => {
      if (!validObjectId(element)) throw new Error(messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cMongoId))
    })

    return true
  })
]

const list = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('iAdminId').optional().isMongoId()
]

const idParam = [
  param('id').isMongoId(),
  param('sid').optional().isMongoId()
]
module.exports = {
  validateFields,
  idParam,
  add,
  list,
  update,
  addManualUsers
}
