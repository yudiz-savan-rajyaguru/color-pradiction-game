const { versionType } = require('../../data')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, isUrl } = require('../../helper/utilities.services')

const VersionModel = require('./model')

class Version {
  /**
   * get versions
   * @param {*} req header : Platform
   * @param {*} res status, message, data
   * @returns {*} data : get all the versions
   */
  async userGet(req, res) {
    try {
      const ePlatform = req.header('Platform')
      const ver = await VersionModel.find({ eType: ePlatform }).sort({ dCreatedAt: -1 }).limit(1).lean()
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].version), version: ver[0] })
    } catch (error) {
      return catchError('Version.userGet', error, req, res)
    }
  }

  async getAllCurrentVersions(req, res) {
    try {
      const data = []
      for (const eType of versionType) {
        const ver = await VersionModel.findOne({ eType }).sort({ dCreatedAt: -1 }).lean()
        if (ver) {
          data.push(ver)
        }
      }
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].version), data })
    } catch (error) {
      return catchError('Version.userGet', error, req, res)
    }
  }

  /**
   * get version
   * @param {*} req params : id
   * @param {*} res status, message, data
   * @returns {*} data : get particular version
   */
  async get(req, res) {
    try {
      const ver = await VersionModel.findOne({ _id: req.params.id }).lean()

      if (!ver) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].version) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].version), data: ver })
    } catch (error) {
      return catchError('Version.get', error, req, res)
    }
  }

  /**
   * post add
   * @param {*} req body : sName, sDescription, eType, sVersion, sUrl, sForceVersion, bInAppUpdate
   * @param {*} res status, message, data
   * @returns {*} data : newly created version
   */
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sDescription', 'eType', 'sVersion', 'sUrl', 'sForceVersion', 'bInAppUpdate', 'sQR'])
      if (req.body.sUrl && !isUrl(req.body.sUrl)) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].url) })
      const data = await VersionModel.create({ ...req.body })
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newVersion), data })
    } catch (error) {
      catchError('Version.add', error, req, res)
    }
  }

  /**
   * get adminList with pagination
   * @param {*} req query : start, limit, sorting, search
   * @param {*} res status, message, data
   * @returns {*} data : versions
   */
  async adminList(req, res) {
    try {
      const { start = 0, limit = 10, sorting, search } = getPaginationValues2(req.query)

      const query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const results = await VersionModel.find(query, {
        sName: 1,
        sDescription: 1,
        eType: 1,
        sUrl: 1,
        sVersion: 1,
        sForceVersion: 1,
        bInAppUpdate: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      const total = await VersionModel.countDocuments({ ...query })

      const data = [{ total, results }]
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].version), data })
    } catch (error) {
      return catchError('Version.list', error, req, res)
    }
  }

  async adminListV1(req, res) {
    try {
      const { start = 0, limit = 10, sorting, search } = getPaginationValues2(req.query)

      const query = search
        ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
        : {}

      let results = []
      const projection = {
        sName: 1,
        sDescription: 1,
        eType: 1,
        sUrl: 1,
        sVersion: 1,
        sForceVersion: 1,
        bInAppUpdate: 1,
        dCreatedAt: 1
      }
      if (['true', true].includes(req.query.isFullResponse)) {
        results = await VersionModel.find(query, projection).sort(sorting).lean()
      } else {
        results = await VersionModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }

      const total = await VersionModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].version), data })
    } catch (error) {
      return catchError('Version.list', error, req, res)
    }
  }

  /**
   * put update Version
   * @param {*} req body : sName, sDescription, eType, sVersion, sUrl, sForceVersion, bInAppUpdate
   * @param {*} res status, message, data
   * @returns {*} data : updated versions
   */
  async update(req, res) {
    try {
      const { sType, sDescription, sUrl } = req.body
      req.body = pick(req.body, ['sName', 'sDescription', 'eType', 'sVersion', 'sUrl', 'sForceVersion', 'bInAppUpdate'])

      if (sUrl && !isUrl(sUrl)) return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].url) })

      const data = await VersionModel.findOneAndUpdate({ _id: req.params.id }, { ...req.body, sType, sDescription, sUrl }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].version) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].versionDetails), data })
    } catch (error) {
      catchError('Version.update', error, req, res)
    }
  }

  /**
   * delete remove version
   * @param {*} req params : id
   * @param {*} res status, message, data
   * @returns {*} data : deleted versions
   */
  async remove(req, res) {
    try {
      const ver = await VersionModel.findOneAndDelete({ _id: req.params.id }).lean()
      if (!ver) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].version) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].version), data: ver })
    } catch (error) {
      catchError('Version.remove', error, req, res)
    }
  }
}

module.exports = new Version()
