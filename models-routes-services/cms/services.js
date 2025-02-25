const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull } = require('../../helper/utilities.services')
const { INCLUDE_POLICIES } = require('../../config/common')

const CSSModel = require('./CSS.model')
const CMSModel = require('./model')

class CMS {
  /**
   * add cms
   * @param {*} req body : sSlug, sCategory, sDescription, sTitle, sDetails, sContent, nPriority, eStatus
   * @param {*} res status, message, data
   * @returns data : added cms
   */
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sSlug', 'sCategory', 'sDescription', 'sTitle', 'sDetails', 'sContent', 'nPriority', 'eStatus'])
      removenull(req.body)

      let { sSlug } = req.body

      sSlug = sSlug.toLowerCase()

      const exist = await CMSModel.findOne({ sSlug })
      if (exist) return res.status(status.ResourceExist).json({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cmsSlug) })

      const data = await CMSModel.create({ ...req.body })
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].content), data })
    } catch (error) {
      return catchError('CMS.add', error, req, res)
    }
  }

  /**
   * get list of cms
   * @param {*} req query : search
   * @param {*} res status, message, data
   * @returns data : all the cms information as per request query
   */
  async list(req, res) {
    try {
      const { search, start = 0, limit = 10 } = req.query
      let query = {}

      if (search) {
        query = search.length ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}
      }
      const cms = await CMSModel.find(query).skip(Number(start)).limit(Number(limit)).lean()
      const nTotal = await CMSModel.countDocuments(query)
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].content), data: cms, nTotal })
    } catch (error) {
      return catchError('CMS.list', error, req, res)
    }
  }

  /**
   * get cms by slug
   * @param {*} req params : sSlug
   * @param {*} res status, message, data
   * @returns {*} data : all cms info
   */
  async adminGet(req, res) {
    try {
      const data = await CMSModel.findOne({ sSlug: req.params.sSlug }).lean()

      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].content) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].content), data })
    } catch (error) {
      return catchError('CMS.adminGet', error, req, res)
    }
  }

  /**
   * update cms
   * @param {*} req body : sDescription, sCategory
   * @param {*} res status, message, data
   * @returns {*} data : updated cms data
   */
  async update(req, res) {
    try {
      const { sDescription } = req.body
      const { sCategory } = req.body
      req.body = pick(req.body, ['sSlug', 'sCategory', 'sTitle', 'sDetails', 'sContent', 'nPriority', 'eStatus'])
      removenull(req.body)

      req.body.sSlug = req.body.sSlug.toLowerCase()
      const exist = await CMSModel.findOne({ sSlug: req.body.sSlug, _id: { $ne: req.params.id } })
      if (exist) return res.status(status.ResourceExist).json({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cmsSlug) })

      const data = await CMSModel.findByIdAndUpdate(req.params.id, { ...req.body, sDescription, sCategory, dUpdatedAt: Date.now() }, { new: true, runValidators: true })

      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cms) })
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cms), data })
    } catch (error) {
      return catchError('CMS.update', error, req, res)
    }
  }

  /**
   * remove cms
   * @param {*} req params : id
   * @param {*} res status, message, data
   * @returns {*} data : deleted cms record
   */
  async remove(req, res) {
    try {
      const data = await CMSModel.findOneAndDelete({ _id: req.params.id }).lean()
      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cms) })
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cms), data })
    } catch (error) {
      return catchError('CMS.remove', error, req, res)
    }
  }

  /**
   * all cms as per as per category
   * @param {*} req query : format
   * @param {*} res status, message, data
   * @returns {*} data : all cms record
   */
  async userList(req, res) {
    try {
      const format = req.query.format ? { sCategory: req.query.format } : {}

      const data = await CMSModel.find({ eStatus: 'Y', ...format }).lean()
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].content), data })
    } catch (error) {
      return catchError('CMS.userList', error, req, res)
    }
  }

  /**
   * specific cms as per slug
   * @param {*} req params : sSlug
   * @param {*} res status, message, data
   * @returns {*} data : cms record as per slug
   */
  async get(req, res) {
    try {
      const data = await CMSModel.findOne({ sSlug: req.params.sSlug, eStatus: 'Y' }).lean()

      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].content) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].content), data })
    } catch (error) {
      return catchError('CMS.get', error, req, res)
    }
  }

  /**
   * create or update slug
   * @param {*} req body : sTitle, sContent
   * @param {*} res status, message, data
   * @returns {*} data : cms record as per slug
   */
  async addCss(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sContent'])
      removenull(req.body)

      let { eType } = req.params
      eType = eType.toUpperCase()

      if (!['COMMON', 'CONDITION'].includes(eType)) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cssType) })

      const exist = await CSSModel.findOne({ eType }).lean()

      let data
      if (exist) {
        data = await CSSModel.findOneAndUpdate({ _id: exist._id }, { ...req.body }, { new: true, runValidators: true }).lean()
      } else {
        data = await CSSModel.create({ ...req.body, eType })
      }
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.addCss', error, req, res)
    }
  }

  /**
   * update css slug
   * @param {*} req body : sTitle, sContent
   * @param {*} res status, message, data
   * @returns {*} data : updated cms record
   */
  async updateCss(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sContent'])
      removenull(req.body)

      let { eType } = req.params
      eType = eType.toUpperCase()

      if (!['COMMON', 'CONDITION'].includes(eType)) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cssType) })

      const data = await CSSModel.findOneAndUpdate({ eType }, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cssStyle) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.updateCss', error, req, res)
    }
  }

  /**
   * get specific css record as per the eType for admin
   * @param {*} req params : eType
   * @param {*} res status, message, data
   * @returns {*} data : css record as per the type
   */
  async adminGetCss(req, res) {
    try {
      let { eType } = req.params
      eType = eType.toUpperCase()

      if (!['COMMON', 'CONDITION'].includes(eType)) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cssType) })
      const data = await CSSModel.findOne({ eType }).lean()
      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cssStyle) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.adminGetCss', error, req, res)
    }
  }

  /**
   * get specific css record as per the eType for user
   * @param {*} req params : eType
   * @param {*} res status, message, data
   * @returns {*} data : css record as per the eType
   */
  async getCss(req, res) {
    try {
      let { eType } = req.params
      eType = eType.toUpperCase()

      if (!['COMMON', 'CONDITION', 'TRUTH'].includes(eType)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cssType) })
      const data = await CSSModel.findOne({ eType }, { sContent: 1, _id: 0 }).lean()

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.getCss', error, req, res)
    }
  }

  /**
   * get all css record
   * @param {*} req
   * @param {*} res status, message, data
   * @returns {*} data : all css record
   */
  async listCss(req, res) {
    try {
      const data = await CSSModel.find({}).lean()
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.listCss', error, req, res)
    }
  }

  /**
   * get register policy
   * @param {*} req
   * @param {*} res status, message, data
   * @returns {*} data : all register policy
   */
  async registerPolicies(req, res) {
    try {
      const aPolicies = await CMSModel.find({ sSlug: { $in: INCLUDE_POLICIES }, eStatus: 'Y' }, { sTitle: 1, sSlug: 1 }).lean()
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].policies), data: aPolicies })
    } catch (error) {
      return catchError('CMS.list', error, req, res)
    }
  }

  async getPolicies(query, projection) {
    try {
      // Find policies in the database matching the parsed query
      const policies = await CMSModel.find(query, projection).lean()
      // Return the found policies
      return policies
    } catch (error) {
      throw new Error(error)
    }
  }
}

module.exports = new CMS()
