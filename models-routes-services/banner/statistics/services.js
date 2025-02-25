const BannerModel = require('../model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, getPaginationValues, ObjectId } = require('../../../helper/utilities.services')
const BannerStatisticModel = require('../statistics/model')
const { CACHE_1 } = require('../../../config/config')
const { findUsers } = require('../../user/auth/services')
const { bannerPlatform } = require('../../../data')

class BannerStatistic {
  // To get single banner's statistics details
  async getV2(req, res) {
    try {
      const { datefrom, dateto } = req.query

      const { iUserId } = req.query
      let { start, limit, sorting } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      const banner = await BannerModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      if (!banner) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      let query = { iBannerId: ObjectId(req.params.id) }
      query = iUserId ? { ...query, iUserId: ObjectId(iUserId) } : query

      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      if (req.query.ePlatform && bannerPlatform.includes(req.query.ePlatform)) query = { ...query, ePlatform: req.query.ePlatform.toUpperCase() }

      const total = await BannerStatisticModel.countDocuments(query)
      const bannerStats = await BannerStatisticModel.find(query).sort(sorting).skip(start).limit(limit).lean()

      const aUserIds = bannerStats.map(aBanner => aBanner.iUserId)
      const aUserData = await findUsers({ _id: { $in: aUserIds } }, { _id: 1, sUsername: 1 })

      const aBannerData = bannerStats.map(aBanner => {
        const user = aUserData.find(u => u._id.toString() === aBanner.iUserId.toString())
        return { ...aBanner, oUser: user }
      })

      const nTotalBannerClick = await BannerStatisticModel.countDocuments({ iBannerId: banner._id })

      const data = { total, data: aBannerData, nTotalBannerClick }
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbannerStatistic), data })
    } catch (error) {
      return catchError('BannerStatistic.getV2', error, req, res)
    }
  }

  async log(req, res) {
    try {
      const { _id: iUserId } = req.user

      const banner = await BannerModel.findOne({ _id: ObjectId(req.params.id) }, { _id: 1 }).lean()
      // .cache(CACHE_1, `banner:${req.params.id}`)
      if (!banner) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      const data = await BannerStatisticModel.create(
        {
          iUserId,
          iBannerId: req.params.id,
          ePlatform: bannerPlatform.includes(req.header('Platform')) ? req.header('Platform') : 'O'
        }
      )
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cbannerLog), data })
    } catch (error) {
      return catchError('BannerStatistic.log', error, req, res)
    }
  }
}

module.exports = new BannerStatistic()
