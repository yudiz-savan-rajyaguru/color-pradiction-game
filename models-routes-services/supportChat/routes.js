const router = require('express').Router()
const chatServices = require('./chatServices')
const validators = require('./validators')
const threadServices = require('./threadServices')
const { validateAdmin, isUserAuthenticated, checkToken } = require('../../middlewares/middleware')

// admin
router.get('/admin/message/list/v1', validators.listMessages, checkToken, validateAdmin('SUPPORT_CHAT', 'R'), chatServices.adminList)
router.get('/admin/message/:id/v1', validators.get, checkToken, validateAdmin('SUPPORT_CHAT', 'R'), chatServices.get)
router.post('/admin/message/add/v1', validators.validateAdminMessageAdd, checkToken, validateAdmin('SUPPORT_CHAT', 'W'), chatServices.adminAdd)

// admin - thread
router.put('/admin/thread/:id/v1', validators.validateUpdateThreadStatus, checkToken, validateAdmin('SUPPORT_CHAT', 'W'), threadServices.updateThreadStatus)
router.get('/admin/thread/list/v1', validators.list, checkToken, validateAdmin('SUPPORT_CHAT', 'R'), threadServices.adminList)
router.get('/admin/thread/:id/v1', validators.get, checkToken, validateAdmin('SUPPORT_CHAT', 'R'), threadServices.get)

// user
router.post('/user/message/add/v1', validators.validateUserMessageAdd, isUserAuthenticated, chatServices.userAdd)
router.get('/user/message/list/v1', isUserAuthenticated, chatServices.userList)
router.get('/user/message/unread-count/v1', isUserAuthenticated, chatServices.unreadCount)
module.exports = router
