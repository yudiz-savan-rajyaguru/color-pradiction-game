const { messages, status } = require('../../helper/api.responses')
const { catchError, getPaginationValues2, createResponse } = require('../../helper/utilities.services')

const StreakModel = require('./model')

class UserStreak {
  async getStreakReward(req, res) {
    try {
      const { start, limit, sorting } = getPaginationValues2(req.query)
      const data = await StreakModel.find({ eStatus: 'Y' }, { __v: false, dUpdatedAt: false, dCreatedAt: false, eStatus: false }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      return createResponse({ req, res, statusCode: status.OK, messageKey: messages.success, replacementKey: messages.streakReward, data })
    } catch (error) {
      catchError('streak.getStreakReward', error, req, res)
    }
  }
}

module.exports = new UserStreak()
