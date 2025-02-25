const { messages, status } = require('../../helper/api.responses')
const { catchError, pick, removenull, getPaginationValues2, ObjectId, getIp, decryptValue } = require('../../helper/utilities.services')
const { createAdminLog } = require('../admin/adminLogs/services')
const { validateAndDetectIPRange } = require('./common')
const NetAccessModel = require('./model')
const { findAdmins, findAdmin } = require('../admin/subAdmin/services')

const adminLogServices = require('../admin/adminLogs/services')

class NetAccess {
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sDescription'])
      removenull(req.body)

      const checkIPRange = validateAndDetectIPRange(req.body.sName)

      if (!(checkIPRange?.isValid)) return res.status(status.UnprocessableEntity).jsonp({ status: status.UnprocessableEntity, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].ipRange) })

      const findIpRange = await NetAccessModel.findOne({ sName: checkIPRange.input }).lean()

      if (findIpRange) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].ipRange) })

      const data = await NetAccessModel.create({
        sName: checkIPRange.input,
        eIpType: checkIPRange?.ipType || 'IPV6',
        iAdminId: req.admin._id,
        sDescription: req.body?.sDescription || ''
      })

      const logData = { oNewFields: data, iAdminId: ObjectId(req.admin._id), sIP: getIp(req), eKey: 'IP', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await adminLogServices.createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].ipRange), data })
    } catch (error) {
      return catchError('NetAccess.add', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const { searchType, eIpType } = req.query
      let query = {}

      if (eIpType) {
        query = { ...query, eIpType: eIpType }
      }

      if (search) {
        if (searchType === 'IP') {
          query = { ...query, sName: new RegExp('^.*' + search + '.*', 'i') }
        } else if (searchType === 'DESCRIPTION') {
          query = { ...query, sDescription: new RegExp('^.*' + search + '.*', 'i') }
        } else {
          query = { ...query, sDescription: new RegExp('^.*' + search + '.*', 'i') }
        }
      }
      if (req.query?.iAdminId) query.iAdminId = req.query?.iAdminId

      let [listData, nTotal] = await Promise.all([
        NetAccessModel.find(query).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        NetAccessModel.countDocuments(query)
      ])

      listData = !listData.length ? [] : listData

      const aAdmin = await findAdmins({ _id: { $in: listData.map((e) => e?.iAdminId) } }, { sUsername: 1, sName: 1, sEmail: 1 })

      const adminMap = aAdmin.reduce((acc, admin) => {
        acc[admin._id] = {
          sUsername: admin?.sUsername,
          sName: admin?.sName,
          sEmail: decryptValue(admin?.sEmail)
        }
        return acc
      }, {})

      listData = listData.map(ips => {
        const adminInfo = adminMap[ips.iAdminId] || {}
        return {
          ...ips,
          sAdminUsername: adminInfo?.sUsername || null,
          sAdminName: adminInfo?.sName || null,
          sAdminEmail: adminInfo?.sEmail || null
        }
      })
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ipRange), data: { listData, nTotal } })
    } catch (error) {
      return catchError('NetAccess.list', error, req, res)
    }
  }

  async getIpRange(req, res) {
    try {
      const ipRange = await NetAccessModel.findById(req.params.id).lean()

      if (!ipRange) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].ipRange) })

      if (ipRange?.iAdminId) {
        const adminInfo = await findAdmin({ _id: ObjectId(ipRange?.iAdminId) }, { sUsername: 1, sName: 1, sEmail: 1 })
        ipRange.sAdminUserName = adminInfo?.sUsername || ''
        ipRange.sAdminName = adminInfo?.sName || ''
        ipRange.sAdminEmail = adminInfo?.sEmail || ''
      }

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ipRange), data: ipRange })
    } catch (error) {
      return catchError('NetAccess.getIpRange', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const ipRange = await NetAccessModel.findById(req.params.id).lean()
      if (!ipRange) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].ipRange) })

      req.body = pick(req.body, ['sName', 'eStatus', 'sDescription'])
      removenull(req.body)

      const checkIPRange = validateAndDetectIPRange(req.body.sName, req.body.eType)

      if (!(checkIPRange?.isValid)) return res.status(status.UnprocessableEntity).jsonp({ status: status.UnprocessableEntity, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].ipRange) })

      const exist = await NetAccessModel.findOne({ sName: checkIPRange.input, _id: { $ne: req.params.id } })
      if (exist) return res.status(status.ResourceExist).jsonp({ status: status.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].ipRange) })

      const ipRangeUpdate = await NetAccessModel.findByIdAndUpdate({ _id: ObjectId(req.params.id) }, {
        sName: checkIPRange.input,
        iAdminId: req.admin._id,
        eIpType: checkIPRange?.ipType || 'IPV6',
        eStatus: req.body.eStatus,
        sDescription: req.body?.sDescription || ''
      }, { new: true, validate: true }).lean()

      const logData = { oOldFields: ipRange, oNewFields: ipRangeUpdate, iAdminId: ObjectId(req.admin._id), sIP: getIp(req), eKey: 'IP', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)

      if (ipRangeUpdate?.iAdminId) {
        const adminInfo = await findAdmin({ _id: ObjectId(ipRangeUpdate?.iAdminId) }, { sUsername: 1, sName: 1, sEmail: 1 })

        ipRangeUpdate.sAdminName = adminInfo?.sUsername || ''
        ipRangeUpdate.sAdminUsername = adminInfo?.sName || ''
        ipRangeUpdate.sEmail = adminInfo?.sEmail || ''
      }
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].ipRange), data: ipRangeUpdate })
    } catch (error) {
      return catchError('NetAccess.update', error, req, res)
    }
  }

  async delete(req, res) {
    try {
      const ipRange = await NetAccessModel.findById(req.params.id).lean()
      if (!ipRange) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].ipRange) })

      await NetAccessModel.deleteOne({ _id: ObjectId(req.params.id) }).lean()

      const logData = { oOldFields: ipRange, oNewFields: {}, iAdminId: ObjectId(req.admin._id), sIP: getIp(req), eKey: 'IP', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].ipRange) })
    } catch (error) {
      return catchError('NetAccess.delete', error, req, res)
    }
  }
}

module.exports = new NetAccess()
