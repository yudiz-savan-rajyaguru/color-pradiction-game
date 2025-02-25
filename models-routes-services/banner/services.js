const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, isUrl, getPaginationValues2, checkValidImageType, getBucketName } = require('../../helper/utilities.services')
const config = require('../../config/config')
const bucket = require('../../helper/cloudStorage.services')

const BannerModel = require('./model')

class AdminBanner {
  // get particular banner
  async get(req, res) {
    try {
      // let sportsQuery = {}
      // to manage sports wise permission we need to add conditions for sports
      // if (req.admin.eType !== 'SUPER') {
      //   sportsQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }, { eCategory: '' }] }
      // }

      // const query = { _id: req.params.id, ...sportsQuery }
      const query = { _id: req.params.id }
      const banner = await BannerModel.findOne(query).lean()

      if (!banner) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].banner), data: banner })
    } catch (error) {
      return catchError('AdminBanner.get', error, req, res)
    }
  }

  async adminListV1(req, res) {
    try {
      // let sportsQuery = {}
      // to manage sports wise permission we need to add conditions for sports
      // if (req.admin.eType !== 'SUPER') {
      //   sportsQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }, { eCategory: '' }] }
      // }

      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      // if (req.admin?.sports?.length) sportsQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }] }
      // const query = search && search.length ? { sLink: { $regex: new RegExp('^.*' + search + '.*', 'i') }, ...sportsQuery } : { ...sportsQuery }

      const query = search && search.length ? { sLink: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : { }

      let results = []
      const projection = {
        sImage: 1,
        eType: 1,
        eStatus: 1,
        sLink: 1,
        eScreen: 1,
        sDescription: 1,
        nPosition: 1,
        ePlace: 1,
        // eCategory: 1,
        dCreatedAt: 1
      }
      if (['true', true].includes(req.query.isFullResponse)) {
        results = await BannerModel.find(query, projection).sort(sorting).lean()
      } else {
        results = await BannerModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }

      const total = await BannerModel.countDocuments({ ...query })

      const data = [{ total, results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].banner), data })
    } catch (error) {
      return catchError('AdminBanner.adminList', error, req, res)
    }
  }

  // Banner list in APP
  async list(req, res) {
    try {
      const data = await BannerModel.find({ eStatus: 'Y', ePlace: req.params.place.toUpperCase() }, {
        __v: 0, dUpdatedAt: 0, dCreatedAt: 0
      }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].banner), data })
    } catch (error) {
      catchError('AdminBanner.list', error, req, res)
    }
  }

  // Add new banner
  async add(req, res) {
    try {
      let { eType, sLink, eScreen, nPosition } = req.body

      if (eType === 'L') req.body = pick(req.body, ['sLink', 'sImage', 'eType', 'eStatus', 'sDescription', 'nPosition', 'ePlace', 'iCategoryId', 'iSubCategoryId', 'iEventId'])
      if (eType === 'S') req.body = pick(req.body, ['sImage', 'eType', 'eStatus', 'sDescription', 'eScreen', 'ePlace', 'nPosition', 'iCategoryId', 'iSubCategoryId', 'iEventId'])

      nPosition = nPosition ? parseInt(nPosition) : undefined
      if (eType === 'L' && !sLink) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].link) })
      if (eType === 'L' && !isUrl(sLink)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].link) })
      if (eType === 'S' && !eScreen) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].screen) })

      const data = await BannerModel.create({ ...req.body, nPosition })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newBanner), data })
    } catch (error) {
      catchError('AdminBanner.add', error, req, res)
    }
  }

  // To get signedUrl for banner image
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: config.S3BANNERS })
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('AdminBanner.getSignedUrl', error, req, res)
    }
  }

  // Update banner details
  async update(req, res) {
    try {
      // let sportsQuery = {}
      // to manage sports permission we need to add sports condition in query object
      const query = { _id: req.params.id }

      // // to manage sports permission we need to add sports condition in query object
      // if (req.admin.eType !== 'SUPER') {
      //   sportsQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }, { eCategory: '' }] }
      // }

      let { eType, sLink, eScreen, sImage, nPosition } = req.body

      if (eType === 'L') req.body = pick(req.body, ['sLink', 'sImage', 'eType', 'eStatus', 'sDescription', 'nPosition', 'ePlace', 'iCategoryId', 'iSubCategoryId', 'iEventId'])
      if (eType === 'S' && eScreen !== 'CR') req.body = pick(req.body, ['sImage', 'eType', 'eStatus', 'sDescription', 'eScreen', 'nPosition', 'ePlace', 'iCategoryId', 'iSubCategoryId', 'iEventId'])
      if (eType === 'CR') req.body = pick(req.body, ['sImage', 'eStatus', 'sDescription', 'eType', 'nPosition', 'ePlace', 'iCategoryId', 'iSubCategoryId', 'iEventId'])

      nPosition = nPosition ? parseInt(nPosition) : ''
      if (eType === 'CR') {
        req.body.eType = 'S'
        // const upcomingMatch = await findMatch(iMatchId)
        // if (!upcomingMatch) return createResponse({ req, res, statusCode: status.BadRequest, messageKey: messages.match_not_upcoming })
        // if (upcomingMatch.eCategory !== eCategory) return createResponse({ req, res, statusCode: status.BadRequest, messageKey: messages.match_not_upcoming })
        // if (iMatchLeagueId) {
        //   const league = await findMatchLeague(iMatchLeagueId)
        //   if (!league) return createResponse({ req, res, statusCode: status.NotFound, messageKey: messages.not_exist, replacementKey: messages.cmatchLeague })
        // } else {
        //   iMatchLeagueId = ''
        // }
      } else {
        if (eType === 'L' && !sLink) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].link) })
        if (eType === 'L' && !isUrl(sLink)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].link) })
        if (eType === 'S' && !eScreen) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].screen) })
      }

      let data = await BannerModel.findOneAndUpdate(query, { ...req.body, nPosition }, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      const sBucketName = getBucketName()

      const bucketParams = {
        Bucket: sBucketName,
        Key: data.sImage
      }

      if (bucketParams && data.sImage !== sImage) {
        data = await bucket.deleteObject(bucketParams)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].bannerDetails), data })
    } catch (error) {
      catchError('AdminBanner.update', error, req, res)
    }
  }

  // Remove banner
  async remove(req, res) {
    try {
      // let sportsQuery = {}
      // to manage sports permission we need to add sports condition in query object
      // if (req.admin.eType !== 'SUPER') {
      //   sportsQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }, { eCategory: '' }] }
      // }
      // const query = { _id: req.params.id, ...sportsQuery }

      const query = { _id: req.params.id }
      const data = await BannerModel.findOneAndDelete(query).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].banner), data })
    } catch (error) {
      return catchError('BannerModel.remove', error, req, res)
    }
  }
}
module.exports = new AdminBanner()
