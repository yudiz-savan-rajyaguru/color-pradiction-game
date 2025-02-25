const router = require('express').Router()

const { validateAdmin, isUserAuthenticated, checkToken, importFileValidation } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

const notificationsServices = require('./services')
const broadcastServices = require('./broadcast.services')
const notificationMessages = require('./notificationMessages.services')
const validators = require('./validators')

router.post('/admin/notification/v1', validators.adminAddNotification, checkToken, validateAdmin('NOTIFICATION', 'W'), notificationsServices.add)
router.post('/admin/notification/timed/v1', validators.adminAddTimedNotification, checkToken, validateAdmin('NOTIFICATION', 'W'), notificationsServices.addTimedNotification)
router.get('/admin/notification/types/v1', cacheRoute(5 * 60), notificationsServices.listTypes)

router.get('/admin/notification/automated-list/v1', checkToken, validateAdmin('NOTIFICATION', 'R'), notificationsServices.automatedList)
router.get('/admin/notification/automated/:id/v1', validators.validateId, checkToken, validateAdmin('NOTIFICATION', 'R'), notificationsServices.getAutomatedNotification)
router.put('/admin/notification/automated/:id/v1', validators.updateAutomatedNotification, checkToken, validateAdmin('NOTIFICATION', 'W'), notificationsServices.updateAutomatedNotification)

router.put('/admin/notification/:id/v1', validators.adminUpdateNotification, checkToken, validateAdmin('NOTIFICATION', 'W'), notificationsServices.updateNotification)
router.get('/admin/notification/list/v1', validators.limitValidator, checkToken, validateAdmin('NOTIFICATION', 'R'), notificationsServices.listNotification)
router.get('/admin/notification/:id/v1', validators.adminOpsPushNotification, checkToken, validateAdmin('NOTIFICATION', 'R'), notificationsServices.get)
router.delete('/admin/notification/:id/v1', validators.adminOpsPushNotification, checkToken, validateAdmin('NOTIFICATION', 'W'), notificationsServices.deleteNotification)

router.get('/user/notification/types/v1', cacheRoute(5 * 60), notificationsServices.listTypes)
router.get('/user/notification/unread-count/v1', isUserAuthenticated, notificationsServices.unreadCount)
router.get('/user/notification/list/v1', validators.list, isUserAuthenticated, notificationsServices.list)
router.post('/user/add-push-token/v1', validators.addPushToken, isUserAuthenticated, notificationsServices.addPushToken)

router.post('/admin/push-notification/v1', validators.adminPushNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), notificationsServices.pushNotification)
router.get('/admin/push-notification-list/v1', validators.limitValidator, checkToken, validateAdmin('PUSHNOTIFICATION', 'R'), notificationsServices.pushNotificationList)
router.get('/admin/push-notification/:id/v1', validators.adminOpsPushNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'R'), notificationsServices.getSinglePushNotification)

router.put('/admin/push-notification/:id/v1', validators.adminUpdatePushNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), notificationsServices.updatePushNotification)
router.delete('/admin/push-notification/:id/v1', validators.adminDeleteNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), notificationsServices.deletePushNotification)

router.put('/admin/notification-message/:id/v1', validators.adminAddNotificationMessage, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), notificationMessages.updateNotificationMessage)
router.post('/admin/notification-message/v1', validators.adminAddNotificationMessage, checkToken, validateAdmin('NOTIFICATION', 'W'), notificationMessages.addNotificationMessage)
router.get('/admin/notification-message-list/v1', checkToken, validateAdmin('PUSHNOTIFICATION', 'R'), notificationMessages.NotificationMessageList)
router.get('/admin/notification-message/:id/v1', validators.validateId, checkToken, validateAdmin('PUSHNOTIFICATION', 'R'), notificationMessages.NotificationMessageDetails)

router.post('/admin/broadcast-notification/v1', validators.addBroadCastNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), broadcastServices.add)
router.put('/admin/broadcast-notification/:id/v1', validators.updateBroadCastNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), broadcastServices.update)
router.get('/admin/broadcast-notification-list/v1', checkToken, validateAdmin('PUSHNOTIFICATION', 'R'), broadcastServices.broadcastNotificationList)
router.get('/admin/broadcast-notification/:id/v1', validators.adminOpsPushNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'R'), broadcastServices.getBroadcastNotification)
router.post('/admin/broadcast-notifications-import/v1', importFileValidation, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), broadcastServices.importBroadcastNotifications)
router.delete('/admin/broadcast-notification/delete/v1', validators.deleteMultipleBroadCastNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), broadcastServices.deleteMultipleBroadcastNotifications)
router.delete('/admin/broadcast-notification/deleteAll/v1', checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), broadcastServices.deleteAllBroadcastNotifications)
router.delete('/admin/broadcast-notification/:id/v1', validators.deleteBroadCastNotification, checkToken, validateAdmin('PUSHNOTIFICATION', 'W'), broadcastServices.deleteBroadcastNotifications)

module.exports = router
