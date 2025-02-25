const { status, jsonStatus, messages } = require('../../helper/api.responses')
const { catchError, getPaginationValues2, removenull, pick, getIp, ObjectId } = require('../../helper/utilities.services')
const SegmentModel = require('./model')
const UserSegmentModel = require('../usersegments/model')
const { createAdminLog } = require('../admin/adminLogs/handler')
const { processAutoSegment } = require('../cron/common')
const { findAdmins, findAdmin } = require('../admin/subAdmin/services')
const { findUsers } = require('../user/auth/services')
const { readCSVFile, readTSVFile, readExcelFile, readJSONFile, validObjectId } = require('../../helper/utilities.services')
const fs = require('fs')

class Segments {
  async add(req, res) {
    let tempFilePath
    try {
      removenull(req.body)
      req.body = pick(req.body, ['sName', 'bAutomated', 'aSegment', 'oFrequency'])
      req.body.iAdminId = req.admin._id

      const checkExist = await SegmentModel.findOne({ sName: req.body.sName }).lean()

      if (checkExist) return res.status(status.ResourceExist).jsonp({ status: status.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].segment) })

      if ([true, 'true'].includes(req?.body?.bAutomated)) {
        const priority = { D: 1, W: 2, C: 3, K: 4, G: 5, A: 6 }

        req.body.aSegment = req.body.aSegment.sort((a, b) => priority[a.eType] - priority[b.eType])
      }
      const data = await SegmentModel.create(req.body)

      const logData = { oOldFields: {}, oNewFields: data, sIP: getIp(req), iAdminId: ObjectId(req.body.iAdminId), iUserId: null, eKey: 'SG', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)

      if (['false', false].includes(req.body?.bAutomated) && req?.files?.file?.data) {
        const buffer = req.files.file.data

        const segmentExist = await SegmentModel.findById(data._id, { sName: 1 }).lean()
        if (!segmentExist) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].segment) })

        const tempDir = './temp'
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir)
        }
        tempFilePath = `${tempDir}/${new Date().getTime()}_${req.files.file.name}`
        fs.writeFileSync(tempFilePath, buffer)

        let records = []

        if (req.files.file.mimetype === 'text/csv') {
          records = await readCSVFile(tempFilePath)
        }

        if (req.files.file.mimetype === 'text/tab-separated-values') {
          records = await readTSVFile(tempFilePath)
        }

        if (req.files.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          records = readExcelFile(tempFilePath)
        }

        if (req.files.file.mimetype === 'application/json') {
          records = await readJSONFile(tempFilePath)
        }

        const bulkOps = []
        if (records.length) {
          for (const record of records) {
            if (validObjectId(record?.iUserId)) {
              bulkOps.push({
                updateOne: {
                  filter: { iUserId: record?.iUserId, iSegmentId: segmentExist?._id },
                  update: { $setOnInsert: { iUserId: record.iUserId, iSegmentId: segmentExist._id, sName: record?.sName, sUsername: record?.sUsername } },
                  upsert: true
                }
              })
            }
          }
          if (bulkOps.length) await UserSegmentModel.bulkWrite(bulkOps, { ordered: false })
        }
      }

      const totalUsers = await UserSegmentModel.countDocuments({ iSegmentId: data?._id, eStatus: 'Y' })
      await SegmentModel.updateOne({ _id: data?._id }, { nUsers: totalUsers })

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].segment) })
    } catch (error) {
      return catchError('Segments.add', error, req, res)
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
        console.log(`File at ${tempFilePath} was deleted successfully.`)
      } else {
        console.log('File does not exist.')
      }
    }
  }

  async list(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      let query = {}
      if (search) {
        query = { ...query, sName: new RegExp('^.*' + search + '.*', 'i') }
      }
      if (req.query?.bAutomated && ['true', 'false', true, false].includes(req.query?.bAutomated)) query.bAutomated = req.query?.bAutomated
      if (req.query?.iAdminId) query.iAdminId = req.query?.iAdminId

      let [listData, nTotal] = await Promise.all([
        SegmentModel.find(query, {
          sName: 1,
          bAutomated: 1,
          iAdminId: 1,
          eStatus: 1,
          nUsers: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        SegmentModel.find(query).countDocuments()
      ])
      listData = !listData.length ? [] : listData

      const aAdmin = await findAdmins({ _id: { $in: listData.map((e) => e?.iAdminId) } }, { sUsername: 1, sName: 1 })
      const adminMap = aAdmin.reduce((acc, admin) => {
        acc[admin._id] = admin.sUsername
        acc[admin._id] = admin.sName
        return acc
      }, {})

      listData = listData.map(segment => {
        return {
          ...segment,
          sAdminUsername: adminMap[segment.iAdminId] || null,
          sAdminName: adminMap[segment.iAdminId] || null
        }
      })

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].segment),
        nTotal,
        data: listData
      })
    } catch (error) {
      return catchError('Segment.list', error, req, res)
    }
  }

  async update(req, res) {
    let tempFilePath
    try {
      const { id } = req.params
      const data = await SegmentModel.findById(req.params.id, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].segment) })

      removenull(req.body)

      // check other exist with same name
      const checkExist = await SegmentModel.findOne({ sName: req.body.sName, _id: { $nin: id } }).lean()

      if (checkExist) return res.status(status.ResourceExist).jsonp({ status: status.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].segment) })

      req.body = pick(req.body, ['sName', 'bAutomated', 'aSegment', 'oFrequency', 'eStatus'])
      req.body.iAdminId = req.admin._id

      if ([true, 'true'].includes(req?.body?.bAutomated)) {
        const priority = { D: 1, W: 2, C: 3, K: 4, G: 5, A: 6 }

        req.body.aSegment = req.body.aSegment.sort((a, b) => priority[a.eType] - priority[b.eType])
      }
      await SegmentModel.updateOne({ _id: id }, req.body)

      if (data?.eStatus !== req?.body?.eStatus || (data?.bAutomated.toString() !== req?.body?.bAutomated.toString())) {
        await UserSegmentModel.updateMany({ iSegmentId: req.params.id }, { eStatus: 'N' })
      }

      const logData = { oOldFields: data, oNewFields: req.body, sIP: getIp(req), iAdminId: ObjectId(req.body.iAdminId), iUserId: null, eKey: 'SG', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)

      if (['false', false].includes(req.body?.bAutomated) && req?.files?.file?.data) {
        const buffer = req.files.file.data

        const segmentExist = await SegmentModel.findById(data._id, { sName: 1 }).lean()
        if (!segmentExist) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].segment) })

        const tempDir = './temp'
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir)
        }
        tempFilePath = `${tempDir}/${new Date().getTime()}_${req.files.file.name}`
        fs.writeFileSync(tempFilePath, buffer)

        let records = []

        if (req.files.file.mimetype === 'text/csv') {
          records = await readCSVFile(tempFilePath)
        }

        if (req.files.file.mimetype === 'text/tab-separated-values') {
          records = await readTSVFile(tempFilePath)
        }

        if (req.files.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          records = readExcelFile(tempFilePath)
        }

        if (req.files.file.mimetype === 'application/json') {
          records = await readJSONFile(tempFilePath)
        }

        const bulkOps = []
        if (records.length) {
          for (const record of records) {
            if (validObjectId(record?.iUserId)) {
              bulkOps.push({
                updateOne: {
                  filter: { iUserId: record?.iUserId, iSegmentId: segmentExist?._id, eStatus: 'Y' },
                  update: { $setOnInsert: { iUserId: record.iUserId, iSegmentId: segmentExist._id, sName: record?.sName, sUsername: record?.sUsername } },
                  upsert: true
                }
              })
            }
          }
          if (bulkOps.length) await UserSegmentModel.bulkWrite(bulkOps, { ordered: false })
        }
      }

      const totalUsers = await UserSegmentModel.countDocuments({ iSegmentId: data?._id, eStatus: 'Y' })
      await SegmentModel.updateOne({ _id: data?._id }, { nUsers: totalUsers })

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].segment) })
    } catch (error) {
      return catchError('Segment.update', error, req, res)
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
        console.log(`File at ${tempFilePath} was deleted successfully.`)
      } else {
        console.log('File does not exist.')
      }
    }
  }

  async updateSpecificSegment(req, res) {
    try {
      const { id, sId } = req.params
      const data = await SegmentModel.findOne({ _id: ObjectId(req.params.id), 'aSegment._id': ObjectId(sId) }, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].segment) })

      removenull(req.body)

      req.body = pick(req.body, ['eType', 'eKycStatus', 'eAdhaarStatus', 'ePanStatus', 'dDateFrom', 'dDateTo', 'eTransactionType', 'eTimeRange', 'nAmountFrom', 'nAmountTo', 'nAmount', 'ePaymentGateway', 'eTransactionStatus', 'nActionNo', 'eStatus'])
      req.body.iAdminId = req.admin._id

      await SegmentModel.updateOne({ _id: id, 'aSegment._id': ObjectId(sId) }, {})
      const logData = { oOldFields: data, oNewFields: req.body, sIP: getIp(req), iAdminId: ObjectId(req.body.iAdminId), iUserId: null, eKey: 'SG', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].segment) })
    } catch (error) {
      return catchError('Segment.update', error, req, res)
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params
      const data = await SegmentModel.findById(req.params.id, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].segment) })
      await SegmentModel.deleteOne({ _id: id })

      await UserSegmentModel.deleteMany({ iSegmentId: req.params.id })

      const logData = { oOldFields: data, oNewFields: { ...data, eStatus: 'N' }, sIP: getIp(req), iAdminId: ObjectId(req.query._id), iUserId: null, eKey: 'SG', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].segment) })
    } catch (error) {
      return catchError('Segment.delete', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params
      const result = await SegmentModel.findById({ _id: id }, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).lean()
      if (!result) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages.not_exist.replace('##', messages.record) })
      }

      if (result?.iAdminId) {
        const adminInfo = await findAdmin({ _id: ObjectId(result?.iAdminId) }, { sUsername: 1, sName: 1 })
        result.sAdminName = adminInfo?.sUsername || ''
        result.sAdminName = adminInfo?.sName || ''
      }

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].segment), data: result })
    } catch (error) {
      return catchError('Segment.get', error, req, res)
    }
  }

  async getMatchingUsers(req, res) {
    try {
      const { id } = req.params
      const oSegment = await SegmentModel.findById({ _id: id, eStatus: 'Y' }, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).lean()
      if (!oSegment) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages.not_exist.replace('##', messages[req.userLanguage].record) })
      }

      let { aUserId, oUserDetails: oSegmentDetails = {} } = await processAutoSegment(oSegment)
      aUserId = [...aUserId]

      const data = []
      if (aUserId.length) {
        const existingUsers = await UserSegmentModel.find({ iUserId: { $in: aUserId }, iSegmentId: id }, { _id: 0, iUserId: 1 }).lean()

        aUserId = aUserId.filter(item => {
          const idx = existingUsers.findIndex(value => value.iUserId.toString() === item)
          if (idx === -1) return item
        })

        if (aUserId.length) {
          const userData = await findUsers({ _id: { $in: [...aUserId] } }, { sName: 1, sUsername: 1 })
          for (const oUser of userData) {
            oSegmentDetails[oUser._id.toString()].push({ sName: oUser.sName, sUsername: oUser.sUsername })
          }

          for (const userId of aUserId) {
            const nSegmentDetailsLen = oSegmentDetails[userId].length - 1
            const { sUsername = '', sName = '' } = oSegmentDetails[userId][nSegmentDetailsLen]
            data.push({ iUserId: userId, sUsername, sName, aSegmentDetails: oSegmentDetails[userId] })
          }
        }
      }

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].segment), data })
    } catch (error) {
      catchError('Segments.getMatchingUsers', error, req, res)
    }
  }

  async addManualUser(req, res) {
    try {
      let { aUserId } = req.body
      const oSegment = await SegmentModel.findById({ _id: req.params.id, eStatus: 'Y' }, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).lean()

      if (!oSegment) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages.not_exist.replace('##', messages.record) })
      }

      const existingUsers = await UserSegmentModel.find({ iUserId: { $in: aUserId }, iSegmentId: req.params.id }, { _id: 0, iUserId: 1 }).lean()

      if (existingUsers.length) {
        aUserId = aUserId.filter(item => {
          const idx = existingUsers.findIndex(value => value.iUserId.toString() === item)
          if (idx === -1) return item
        })
      }

      if (!aUserId.length) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cUserSegments) })

      let { aUserId: aActualUserId, oUserDetails: oSegmentDetails = {} } = await processAutoSegment(oSegment, aUserId)

      aActualUserId = [...aActualUserId]
      if (aActualUserId.length) {
        const userData = await findUsers({ _id: { $in: aActualUserId } }, { sName: 1, sUsername: 1 })
        for (const oUser of userData) {
          oSegmentDetails[oUser._id.toString()].push({ sName: oUser.sName, sUsername: oUser.sUsername })
        }

        const aBulkUserSegmentsUpdate = []

        for (const userId of aActualUserId) {
          const nSegmentDetailsLen = oSegmentDetails[userId].length - 1
          const { sUsername = '', sName = '' } = oSegmentDetails[userId][nSegmentDetailsLen]

          if (sUsername && sName) oSegmentDetails[userId].pop()

          aBulkUserSegmentsUpdate.push({
            updateOne: {
              filter: { iSegmentId: ObjectId(oSegment._id), iUserId: userId, eStatus: 'Y' },
              update: { iSegmentId: ObjectId(oSegment._id), iUserId: userId, eStatus: 'Y', sName, sUsername, aSegmentDetails: oSegmentDetails[userId] },
              upsert: true
            }
          })
        }

        aBulkUserSegmentsUpdate.push({
          updateMany: {
            filter: { iSegmentId: ObjectId(oSegment._id), iUserId: { $nin: aUserId }, eStatus: 'Y' },
            update: { $set: { eStatus: 'N' } }
          }
        })

        if (aBulkUserSegmentsUpdate.length) await UserSegmentModel.bulkWrite(aBulkUserSegmentsUpdate, { ordered: false })

        await SegmentModel.updateOne({ _id: ObjectId(oSegment._id), eStatus: 'Y' }, { $inc: { nUsers: 1 } })
      }

      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cUserSegments) })
    } catch (error) {
      return catchError('Segments.addManualUser', error, req, res)
    }
  }

  async activeSegments(req, res) {
    try {
      const data = await SegmentModel.find({ eStatus: 'Y' }, { _id: 1, sName: 1, bAutomated: 1 }).lean()
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].segment), data })
    } catch (error) {
      return catchError('Segments.activeSegments', error, req, res)
    }
  }
}

module.exports = new Segments()
