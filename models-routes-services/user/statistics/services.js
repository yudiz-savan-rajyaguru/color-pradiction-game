const StatisticsModel = require('./model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, mongify } = require('../../../helper/utilities.services')

class Statistic {
  async get(req, res) {
    try {
      const data = await StatisticsModel.findOne({ iUserId: req.params.id }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].user) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusers), data })
    } catch (error) {
      return catchError('Statistic.get', error, req, res)
    }
  }

  async getProfileStatistics(req, res) {
    try {
      const [statisticsOther, statisticsOwn] = await Promise.all([
        StatisticsModel.findOne({ iUserId: mongify(req.params.id) }).populate('iUserId', ['nXPPoints', 'dCreatedAt', 'sUsername', 'sProPic', 'nLevel', 'sName']).lean(),
        StatisticsModel.findOne({ iUserId: mongify(req.user._id) }).populate('iUserId', ['nXPPoints', 'dCreatedAt', 'sUsername', 'sProPic', 'nLevel', 'sName']).lean()
      ])

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuser),
        data: {
          Other: {
            XPPoints: statisticsOther?.iUserId?.nXPPoints || 0,
            startDate: statisticsOther?.dCreatedAt || new Date(),
            sUsername: statisticsOther?.iUserId?.sUsername || '',
            sProPic: statisticsOther?.iUserId?.sProPic || '',
            nLevel: statisticsOther?.iUserId?.nLevel || 0
          },
          Own: {
            XPPoints: statisticsOwn?.iUserId?.nXPPoints || 0,
            startDate: statisticsOwn?.dCreatedAt || new Date(),
            sUsername: statisticsOwn?.iUserId?.sUsername || '',
            sProPic: statisticsOwn?.iUserId?.sProPic || '',
            nLevel: statisticsOwn?.iUserId?.nLevel || 0
          }
        }
      })
    } catch (error) {
      return catchError('Statistic.getProfileStatistics', error, req, res)
    }
  }
}

module.exports = new Statistic()
