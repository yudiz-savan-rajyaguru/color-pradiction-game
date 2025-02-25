// @ts-check
const MessagesModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, removenull, mongify, getPaginationValues2 } = require('../../helper/utilities.services')
const { eMessageUserType } = require('../../data')
const ThreadModel = require('./threads.model')
const UserModel = require('../user/model')
const customEventEmitter = require('../../helper/eventemitter')
const enums = require('../../data')
const AdminsModel = require('../admin/model')

const message = {}

message.get = async (req, res) => {
  try {
    const oMessage = await MessagesModel.findById(req.params.id).lean()
    if (!oMessage) return res.status(status.NOT_FOUND).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].message) })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].message), data: oMessage })
  } catch (error) {
    return catchError('message.get', error, req, res)
  }
}

message.adminList = async (req, res) => {
  try {
    const { search, isFullResponse, userType, iThreadId } = req.query
    const { start, limit, sorting } = getPaginationValues2(req.query)
    const query = search ? { sMessage: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}
    const oThread = await ThreadModel.findOne({ _id: iThreadId }).lean()
    const oUserInfo = await UserModel.findOne({ _id: oThread?.iUserId }, { sUsername: 1, sProPic: 1 }).lean()
    if (!oThread) return res.status(jsonStatus?.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].thread) })
    if (userType && eMessageUserType.includes(userType)) query.eUserType = userType
    if (iThreadId) query.iThreadId = mongify(iThreadId)
    let results
    const projection = {
      iUserId: 1,
      iAdminId: 1,
      sMessage: 1,
      eUserType: 1,
      dSentAt: 1,
      iThreadId: 1
    }
    if ([true, 'true'].includes(isFullResponse)) {
      results = await MessagesModel.find(query, projection).sort(sorting).populate({ path: 'oAdmin', select: ['sName', 'sUsername'] }).lean()
    } else {
      results = await MessagesModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).populate({ path: 'oAdmin', select: ['sName', 'sUsername'] }).lean()
    }
    const total = await MessagesModel.countDocuments({ ...query })
    const data = { total, results, oUserInfo }
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].messages), data })
  } catch (error) {
    return catchError('message.adminList', error, req, res)
  }
}

message.userAdd = async (req, res) => {
  try {
    const { sMessage } = req.body
    removenull(req.body)

    let threadId
    // Find or create a thread for the user
    const thread = await ThreadModel.findOne({ iUserId: req?.user?._id }).lean()
    if (!thread) {
      // If thread not found, create a new thread for the user
      const oThread = await ThreadModel.create({ iUserId: req?.user?._id })
      threadId = oThread._id
    } else {
      threadId = thread._id
      // If thread exists but is closed, activate it again
      if (thread?.eThreadStatus === 'C') {
        await ThreadModel.updateOne({ _id: thread._id }, { eThreadStatus: 'A', dLastMsgAt: new Date().toISOString(), bIsRead: false })
      } else {
        await ThreadModel.updateOne({ _id: thread._id }, { dLastMsgAt: new Date().toISOString(), bIsRead: false })
      }
    }

    // Prepare the message data for the user
    const oUser = await UserModel.findOne({ _id: req?.user?._id }, { sUsername: 1, sProPic: 1 }).lean()
    const data = {
      iThreadId: threadId,
      sMessage,
      eUserType: 'U',
      iUserId: req?.user?._id
    }
    // Create the message
    const oMessage = await MessagesModel.create(data)
    customEventEmitter.emit(enums?.socketEvents?.MESSAGE, {
      eType: enums?.socketEvents?.MSG_UPDATES,
      oData: { ...oMessage, oUser }
    })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].message), data: oMessage })
  } catch (error) {
    return catchError('message.addUser', error, req, res)
  }
}

message.adminAdd = async (req, res) => {
  try {
    const { sMessage, iThreadId } = req.body
    removenull(req.body)
    const oThread = await ThreadModel.findOne({ _id: iThreadId }).lean()
    if (!oThread) return res.status(jsonStatus?.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].thread) })
    // If thread exists but is closed, activate it again
    if (oThread?.eThreadStatus === 'C') {
      await ThreadModel.updateOne({ _id: oThread._id }, { eThreadStatus: 'A', dLastMsgAt: new Date().toISOString() })
    }

    const data = {
      iThreadId,
      sMessage,
      eUserType: 'A',
      iAdminId: req?.admin?._id?.toString(),
      iUserId: oThread?.iUserId?.toString() // This links the message to the target user
    }

    // Create the message
    const oAdmin = await AdminsModel.findOne({ _id: req?.admin?._id }, { sUsername: 1, sName: 1 }).lean()
    const oPayload = {
      eType: enums?.socketEvents?.MSG_UPDATES,
      oData: { ...data, oAdmin }
    }
    customEventEmitter.emit(enums?.socketEvents?.MESSAGE, oPayload)

    const oMessage = await MessagesModel.create(data)
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].message), data: oMessage })
  } catch (error) {
    return catchError('message.addAdmin', error, req, res)
  }
}

message.userList = async (req, res) => {
  try {
    const { start, limit, sorting } = getPaginationValues2(req.query)
    const query = { iUserId: req.user._id }
    const projection = {
      sMessage: 1,
      eUserType: 1,
      dSentAt: 1,
      iThreadId: 1
    }
    const [results, total] = await Promise.all([
      MessagesModel.find(query, projection).sort(sorting).skip(start).limit(limit).populate({ path: 'oAdmin', select: ['sName', 'sUsername'] }).lean(),
      MessagesModel.countDocuments({ ...query })
    ])

    await MessagesModel.updateMany({ iUserId: req.user._id, eUserType: 'A' }, { bIsRead: true })
    const data = { total, results }
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].messages), data })
  } catch (error) {
    return catchError('message.userList', error, req, res)
  }
}

message.unreadCount = async (req, res) => {
  try {
    const count = await MessagesModel.countDocuments({ iUserId: req.user._id, bIsRead: false, eUserType: 'A' })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].unreadMessageCount), data: { nUnreadCount: count } })
  } catch (error) {
    return catchError('message.unreadCount', error, req, res)
  }
}

module.exports = message
