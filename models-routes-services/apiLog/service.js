// @ts-check
const TransactionLogModel = require('../apiLog/TransactionLog.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, getPaginationValues2 } = require('../../helper/utilities.services')
class ApiLog {
  async listTransactionLog(req, res) {
    try {
      const { start, limit, sorting } = getPaginationValues2(req.query)
      const { eType } = req.query

      const query = (eType === 'W') ? { iWithdrawId: Number(req.params.id) } : { $or: [{ iDepositId: req.params.id }, { iOrderId: req.params.id }] }

      const [aResult, nTotal] = await Promise.all([
        TransactionLogModel.find(query, { __v: 0, dUpdatedAt: 0 }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        TransactionLogModel.countDocuments(query)
      ])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cLogs), data: { aResult, nTotal } })
    } catch (error) {
      return catchError('ApiLog.listTransactionLog', error, req, res)
    }
  }
}

module.exports = new ApiLog()
