const ThreadModel = require('./threads.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, mongify } = require('../../helper/utilities.services')
const { eThreadStatus } = require('../../data')
const { CACHE_12 } = require('../../config/config')
const enums = require('../../data')

const thread = {}

thread.get = async (req, res) => {
  try {
    const id = mongify(req.params.id)
    const oThread = await ThreadModel.findOne({ $or: [{ iUserId: id }, { _id: id }] }).lean()
    if (!oThread) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].thread) })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].thread), data: oThread })
  } catch (error) {
    return catchError('thread.get', error, req, res)
  }
}

thread.adminList = async (req, res) => {
  try {
    const { start = 0, limit = 10, order, isFullResponse, sort, threadStatus, iUserId } = req.query
    const orderBy = order && order === 'asc' ? 1 : -1
    const sorting = { [sort]: orderBy }
    const query = (threadStatus && eThreadStatus.includes(threadStatus)) ? { eThreadStatus: threadStatus } : {}
    if (iUserId) query.iUserId = mongify(iUserId)
    let results
    const projection = {
      iUserId: 1,
      iAdminId: 1,
      eThreadStatus: 1,
      dLastMsgAt: 1,
      bIsRead: 1
    }
    if ([true, 'true'].includes(isFullResponse)) {
      results = await ThreadModel.find(query, projection).sort(sorting).populate({ path: 'oUser', select: ['sUsername'] }).lean()
    } else {
      results = await ThreadModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).populate({ path: 'oUser', select: ['sUsername'] }).lean()
    }
    const total = await ThreadModel.countDocuments({ ...query })
    const data = { total, results }
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].threads), data })
  } catch (error) {
    return catchError('thread.adminList', error, req, res)
  }
}

thread.updateThreadStatus = async (req, res) => {
  try {
    const { eThreadStatus, bIsRead } = req.body
    const oUpdate = {}
    if (eThreadStatus) {
      if (!enums?.eThreadStatus?.includes(eThreadStatus)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].thread) })
      oUpdate.eThreadStatus = eThreadStatus
      oUpdate.iAdminId = req.admin?._id
    }
    if (bIsRead) oUpdate.bIsRead = bIsRead

    const updatedThread = await ThreadModel.findByIdAndUpdate(req.params.id, oUpdate, { new: true }).lean()
    if (!updatedThread) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].thread) })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].threadStatus), data: updatedThread })
  } catch (error) {
    return catchError('message.updateThreadStatus', error, req, res)
  }
}

module.exports = thread
