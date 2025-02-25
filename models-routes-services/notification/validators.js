const { body, query, param } = require('express-validator')

const { notificationTopic, notificationMessageKeys, notificationGroups } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/config')

const adminAddNotification = [
  body('iUserId').not().isEmpty(),
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('iType').not().isEmpty()
]

const adminAddTimedNotification = [
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('iType').not().isEmpty(),
  body('dExpTime').not().isEmpty()
]

const adminUpdatePushNotification = [
  param('id').isMongoId().not().isEmpty(),
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('sTopic').not().isEmpty().isIn(notificationTopic),
  body('dExpTime').not().isEmpty()
]

const adminDeleteNotification = [
  param('id').isMongoId().not().isEmpty(),
  body('sTopic').not().isEmpty(),
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty()
]

const adminPushNotification = [
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('sTopic').not().isEmpty().isIn(notificationTopic),
  body('dExpTime').not().isEmpty()
]

const adminAddNotificationMessage = [
  param('id').isMongoId(),
  body('eKey').not().isEmpty().isIn(notificationMessageKeys)
]
const adminAddPushNotificationType = [
  body('sKey').not().isEmpty().isIn(notificationMessageKeys),
  body('sGroup').not().isEmpty().isIn(notificationGroups),
  body('sKey').not().isEmpty().isString(),
  body('bEnabled').optional().isBoolean()
]

const adminUpdateNotification = [
  param('id').isMongoId().not().isEmpty(),
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('iType').not().isEmpty(),
  body('aReadIds').optional().isArray(),
  body('eStatus').optional().isInt()
]

const list = [
  query('limit').optional().custom(value => {
    const intValue = parseInt(value)
    if (intValue > PAGINATION_LIMIT || intValue < 0) {
      throw new Error('Invalid limit value')
    }
    return true
  })
]

const limitValidator = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const adminOpsPushNotification = [
  param('id').isMongoId().not().isEmpty()
]

const updateAutomatedNotification = [
  param('id').isMongoId().not().isEmpty(),
  body('sKey').not().isEmpty()
]

const addPushToken = [
  body('sPushToken').not().isEmpty()
]

const validateId = [
  param('id').isMongoId()
]

const addBroadCastNotification = [
  body('sHeading').not().isEmpty(),
  body('sName').not().isEmpty(),
  body('sDescription').not().isEmpty()
]

const updateBroadCastNotification = [
  param('id').isMongoId().not().isEmpty(),
  body('bEnableNotifications').optional().isBoolean()
]

const deleteBroadCastNotification = [
  param('id').not().isEmpty().isMongoId()
]

const deleteMultipleBroadCastNotification = [
  body('aId').not().isEmpty().isArray({ min: 1 }),
  body('aId.*').not().isEmpty().isMongoId()
]

module.exports = {
  adminAddNotification,
  adminAddTimedNotification,
  adminPushNotification,
  adminAddNotificationMessage,
  adminUpdateNotification,
  list,
  limitValidator,
  adminUpdatePushNotification,
  adminDeleteNotification,
  adminOpsPushNotification,
  adminAddPushNotificationType,
  updateAutomatedNotification,
  addPushToken,
  validateId,
  addBroadCastNotification,
  updateBroadCastNotification,
  deleteBroadCastNotification,
  deleteMultipleBroadCastNotification
}
