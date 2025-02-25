const { status, jsonStatus, messages } = require('../../helper/api.responses')
const { catchError, getPaginationValues2, removenull, pick, getIp, ObjectId, handleCatchError, decryptValue } = require('../../helper/utilities.services')
const UserSegmentModel = require('./model')
const SegmentModel = require('../segmentations/model')
const { streamObject } = require('../../helper/s3config')
const { createAdminLog } = require('../admin/adminLogs/handler')
const { findUsers, findUser } = require('../user/auth/services')
const csv = require('fast-csv')
const { getKycStatus } = require('./common')
const config = require('../../config/config')
const { readCSVFile, readTSVFile, readExcelFile, readJSONFile, validObjectId } = require('../../helper/utilities.services')
const fs = require('fs')

class UserSegments {
  async list(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      const { bReport } = req.query
      let query = { iSegmentId: req.params.id }
      if (search) {
        query = { ...query, $or: [{ sName: new RegExp('^.*' + search + '.*', 'i') }, { sUsername: new RegExp('^.*' + search + '.*', 'i') }] }
      }

      if (req.query?.iUserId) {
        query = { ...query, iUserId: ObjectId(req.query.iUserId) }
      }

      let data
      let total = 0
      if ([true, 'true'].includes(bReport)) {
        query.eStatus = 'Y'

        const oSegment = await SegmentModel.findById(req.params.id, { sName: 1 }).lean()
        // eslint-disable-next-line no-unexpected-multiline, no-sequences
        const [listData, nTotal] = await Promise.all([
          UserSegmentModel.find(query).sort(sorting).lean(),
          UserSegmentModel.find(query).countDocuments()
        ])
        if (listData.length && nTotal > 0) await generateReport(listData, nTotal, oSegment.sName)
        data = listData
        total = nTotal
      } else {
        let [listData, nTotal] = await Promise.all([
          [true, 'true'].includes(req.query?.isFullResponse) ? UserSegmentModel.find(query, {
            sName: 1,
            sUsername: 1,
            eStatus: 1,
            iUserId: 1,
            iSegmentId: 1
          }).sort(sorting).lean() : UserSegmentModel.find(query, {
            sName: 1,
            sUsername: 1,
            eStatus: 1,
            iUserId: 1,
            iSegmentId: 1
          }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
          UserSegmentModel.find(query).countDocuments()])

        if (listData.length) {
          const users = await findUsers({ _id: { $in: listData.map((e) => e.iUserId) } }, { sName: 1, sUsername: 1, sEmail: 1, sMobNum: 1 }, {})

          // Create a map of admins by _id
          const userMap = users.reduce((acc, user) => {
            acc[user._id] = {
              sUsername: user.sUsername,
              sName: user.sName,
              sEmail: decryptValue(user?.sEmail),
              sMobNum: decryptValue(user?.sMobNum)
            }
            return acc
          }, {})

          // Add admin usernames to listData
          listData = listData.map(segment => {
            return {
              ...segment,
              sUsername: userMap[segment.iUserId]?.sUsername || null,
              sName: userMap[segment.iUserId]?.sName || null,
              sEmail: userMap[segment.iUserId]?.sEmail || null,
              sMobNum: userMap[segment.iUserId]?.sMobNum || null
            }
          })
        }
        data = listData
        total = nTotal
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUserSegments),
        nTotal: total,
        data
      })
    } catch (error) {
      return catchError('UserSegments.list', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params
      const data = await UserSegmentModel.findOne({ _id: id }, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].segment) })

      removenull(req.body)

      req.body = pick(req.body, ['eStatus'])
      req.body.iAdminId = req.admin._id

      await UserSegmentModel.updateOne({ _id: id }, req.body)
      const logData = { oOldFields: data, oNewFields: req.body, sIP: getIp(req), iAdminId: ObjectId(req.body.iAdminId), iUserId: null, eKey: 'SG', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].segment) })
    } catch (error) {
      return catchError('UserSegments.update', error, req, res)
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params
      const data = await UserSegmentModel.findOne({ _id: id }, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].segment) })

      removenull(req.body)

      await UserSegmentModel.deleteOne({ _id: id })
      const logData = { oOldFields: data, oNewFields: req?.body, sIP: getIp(req), iAdminId: ObjectId(req.body.iAdminId), iUserId: null, eKey: 'SG', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].segment) })
    } catch (error) {
      return catchError('UserSegments.delete', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params
      let result = await UserSegmentModel.findById({ _id: id }, { dCreatedAt: 0, dUpdateAt: 0, __v: 0 }).populate({
        path: 'iSegmentId'
      }).lean()
      if (!result) {
        return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages.not_exist.replace('##', messages.record).segmentExist })
      }
      const oUser = await findUser({ _id: result.iUserId }, { _id: 1, sName: 1, sUsername: 1, sEmail: 1, sMobNum: 1 }, {})

      if (oUser) {
        result = { ...result, sName: oUser?.sName || null, sUsername: oUser?.sUsername || null, sEmail: decryptValue(oUser?.sEmail) || null, sMobNum: decryptValue(oUser?.sMobNum) || null }
      }
      return res.status(status.OK).jsonp({ status: status.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].segment), data: result })
    } catch (error) {
      return catchError('UserSegments.get', error, req, res)
    }
  }

  async importSegmentUsers(req, res) {
    let tempFilePath
    try {
      const buffer = req.files.file.data

      const segmentExist = await SegmentModel.findById(req.params.id, { sName: 1 }).lean()
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
                update: { $setOnInsert: { iUserId: record.iUserId, iSegmentId: segmentExist._id, sName: record?.sName, sUserName: record?.sUserName } },
                upsert: true
              }
            })
          }
        }
        if (bulkOps.length) await UserSegmentModel.bulkWrite(bulkOps, { ordered: false })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cUserSegments) })
    } catch (error) {
      catchError('UserSegments.importSegmentUsers', error, req, res)
    } finally {
      fs.unlinkSync(tempFilePath)
    }
  }
}
async function generateReport(data, nTotal, sSegmentName) {
  try {
    const nLimit = 5000
    let nSkip = 0
    const csvStream = csv.format({ headers: true, quoteHeaders: true })

    streamObject(config.S3_BUCKET_NAME, config.s3UserSegmentReport + `${sSegmentName}.csv`, 'text/csv', csvStream)
      .then(async (res) => {
        await SegmentModel.updateOne({ _id: data[0].iSegmentId }, { sReportUrl: config.s3UserSegmentReport + `${sSegmentName}.csv` })
      })

    while (nSkip < nTotal) {
      const aFields = ['User Id', 'Username', 'Name', 'Deposit Amount', 'Withdrawal Amount', 'Contest Transaction Type', 'Contest Transaction Amount', 'Aadhaar Status', 'Pan Status', 'Kyc Status']

      for (const oData of data) {
        const oHeaders = {
          'User Id': 'iUserId',
          Username: 'sUsername',
          Name: 'sName',
          'Deposit Amount': 'nAmount',
          'Withdrawal Amount': 'nAmount',
          'Contest Transaction Type': 'eTransactionType',
          'Contest Transaction Amount': 'nAmount',
          'Aadhaar Status': 'eAdhaarStatus',
          'Pan Status': 'ePanStatus',
          'Kyc Status': 'eKycStatus'
        }
        const oDataRow = aFields.reduce((oRow, sField) => {
          oRow[sField] = oData[oHeaders[sField]]
          return oRow
        }, {})

        for (const oSegment of oData.aSegmentDetails) {
          if (oSegment.eType === 'D') oDataRow['Deposit Amount'] = oSegment[oHeaders['Deposit Amount']]
          if (oSegment.eType === 'W') oDataRow['Withdrawal Amount'] = oSegment[oHeaders['Withdrawal Amount']]
          if (oSegment.eType === 'C') {
            oDataRow['Contest Transaction Type'] = oSegment[oHeaders['Contest Transaction Type']]
            oDataRow['Contest Transaction Amount'] = oSegment[oHeaders['Contest Transaction Amount']]
          }
          if (oSegment.eType === 'K') {
            if (oSegment?.eAdhaarStatus) oDataRow['Aadhaar Status'] = getKycStatus(oSegment?.eAdhaarStatus)
            if (oSegment?.ePanStatus) oDataRow['Pan Status'] = getKycStatus(oSegment?.ePanStatus)
            if (oSegment?.eKycStatus) oDataRow['Kyc Status'] = getKycStatus(oSegment?.eKycStatus)
          }
        }
        csvStream.write(oDataRow)

        nSkip += nLimit
      }
    }
    csvStream.end()
  } catch (error) {
    handleCatchError(error)
  }
}
module.exports = new UserSegments()
