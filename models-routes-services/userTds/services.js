// @ts-check
const UserTdsModel = require('../userTds/model')
const UsersModel = require('../user/model')
const KYCModel = require('../kyc/model')
const { Op } = require('sequelize')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, searchValues, decryptValue } = require('../../helper/utilities.services')
const { tdsStatus, userType } = require('../../data')
const { checkAdminAuthorization } = require('../../helper/authorization')

class UserTds {
  async adminList(req, res) {
    try {
      const { start = 0, limit = 10, datefrom, dateto, search, sort = 'dCreatedAt', order, isFullResponse, eStatus, eUserType, sportsType = '' } = req.query
      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'

      const query = []
      let users = []

      if (search) {
        const userQuery = searchValues(search)
        users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
        if (!users.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: [] })
      }

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: new Date(datefrom) } })
        query.push({ dCreatedAt: { [Op.lte]: new Date(dateto) } })
      }
      const userIds = users.map(user => user._id.toString())
      if (users.length) {
        query.push({ iUserId: { [Op.in]: userIds } })
      }

      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : {
        offset: parseInt(start),
        limit: parseInt(limit)
      }

      if (eStatus && tdsStatus.includes(eStatus)) {
        query.push({ eStatus })
      }

      if (eUserType && userType?.value.includes(eUserType)) {
        query.push({ eUserType })
      }

      if (sportsType) {
        query.push({ eCategory: sportsType })
      }

      const data = await UserTdsModel.findAll({
        where: {
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        attributes: ['id', 'iUserId', 'iEventId', 'nAmount', 'nOriginalAmount', 'nPercentage', 'dCreatedAt', 'iPassbookId', 'eStatus', 'eUserType', 'nActualAmount', 'nEntryFee', 'eCategory'],
        raw: true
      })
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
      let allowDecrypt = false
      if (response.status === 200) {
        allowDecrypt = true
      }
      const tdsData = users.length ? await addUserFields(data, users, allowDecrypt) : await addUserFields(data, [], allowDecrypt)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: tdsData })
    } catch (error) {
      return catchError('UserTds.adminList', error, req, res)
    }
  }

  async getCounts(req, res) {
    try {
      const { datefrom, dateto, search, eStatus, eUserType, sportsType } = req.query

      const query = []
      let users = []

      if (search) {
        const userQuery = searchValues(search)
        users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
        if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: { count: 0, rows: [] } })
      }

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: new Date(datefrom) } })
        query.push({ dCreatedAt: { [Op.lte]: new Date(dateto) } })
      }

      const userIds = users.map(user => user._id.toString())
      if (users.length) {
        query.push({ iUserId: { [Op.in]: userIds } })
      }

      if (eStatus && tdsStatus.includes(eStatus)) {
        query.push({ eStatus })
      }

      if (eUserType && userType?.value.includes(eUserType)) {
        query.push({ eUserType })
      }
      if (sportsType) {
        query.push({ eCategory: sportsType })
      }

      const count = await UserTdsModel.count({
        where: {
          [Op.and]: query
        },
        col: 'id'
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cCounts), data: { count } })
    } catch (error) {
      return catchError('UserTds.getCount', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { eStatus } = req.body

      const tds = await UserTdsModel.findOne({
        where: { id: req.params.id },
        attributes: ['id', 'iUserId', 'nAmount', 'nOriginalAmount', 'nPercentage', 'dCreatedAt', 'iPassbookId', 'eStatus', 'nActualAmount', 'nEntryFee'],
        raw: true
      })
      if (!tds) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cTds) })

      await UserTdsModel.update({ eStatus }, { where: { id: req.params.id } })

      const data = { ...tds, eStatus }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cTds), data })
    } catch (error) {
      return catchError('UserTds.update', error, req, res)
    }
  }

  async matchLeagueTdsList(req, res) {
    try {
      const { start = 0, limit = 10, datefrom, dateto, search, sort = 'dCreatedAt', order, isFullResponse, eStatus, eUserType } = req.query
      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'

      const query = []
      let users = []

      if (search) {
        const userQuery = searchValues(search)

        users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
        if (!users.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: [] })
      }

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: new Date(datefrom) } })
        query.push({ dCreatedAt: { [Op.lte]: new Date(dateto) } })
      }

      const userIds = users.map(user => user._id.toString())
      if (users.length) {
        query.push({ iUserId: { [Op.in]: userIds } })
      }

      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : {
        offset: parseInt(start),
        limit: parseInt(limit)
      }

      if (eStatus && tdsStatus.includes(eStatus)) {
        query.push({ eStatus })
      }

      if (eUserType && userType?.value.includes(eUserType)) {
        query.push({ eUserType })
      }

      const data = await UserTdsModel.findAll({
        where: {
          iEventId: req.params.id.toString(),
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        attributes: ['id', 'iUserId', 'iEventId', 'nAmount', 'nOriginalAmount', 'nPercentage', 'dCreatedAt', 'iPassbookId', 'eStatus', 'eUserType', 'nActualAmount', 'nEntryFee'],
        raw: true
      })
      const results = users.length ? await addUserFields(data, users) : await addUserFields(data)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: results })
    } catch (error) {
      return catchError('UserTds.matchLeagueTdsList', error, req, res)
    }
  }

  async matchLeagueTdsCount(req, res) {
    try {
      const { datefrom, dateto, search, eStatus, eUserType } = req.query

      const query = []
      let users = []

      if (search) {
        const userQuery = searchValues(search)

        users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
        if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: { count: 0, rows: [] } })
      }

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: new Date(datefrom) } })
        query.push({ dCreatedAt: { [Op.lte]: new Date(dateto) } })
      }

      const userIds = users.map(user => user._id.toString())
      if (users.length) {
        query.push({ iUserId: { [Op.in]: userIds } })
      }

      if (eStatus && tdsStatus.includes(eStatus)) {
        query.push({ eStatus })
      }

      if (eUserType && userType?.value.includes(eUserType)) {
        query.push({ eUserType })
      }

      const count = await UserTdsModel.count({
        where: {
          iEventId: req.params.id.toString(),
          [Op.and]: query
        },
        col: 'id'
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cCounts), data: { count } })
    } catch (error) {
      return catchError('UserTds.matchLeagueTdsCount', error, req, res)
    }
  }
}

module.exports = new UserTds()

/**
 * It will add users fields for admin tds list
 * @param { Array } tds
 * @param { Array } users
 * @returns { Object } user's kyc , payment and other details
 */
async function addUserFields(tds, users = [], allowDecrypt) {
  let data, kycData

  if (users.length) {
    data = users
  } else {
    const tdsIds = tds.map(p => (p.iUserId.toString()))
    data = await UsersModel.find({ _id: { $in: tdsIds } }, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
    kycData = await KYCModel.find({ iUserId: { $in: tdsIds }, eStatus: -1 }).lean()
  }
  return tds.map(p => {
    const user = data.find(u => u._id.toString() === p.iUserId.toString())
    let kyc = {}
    if (kycData && kycData.length) {
      kyc = kycData.find(u => u.iUserId.toString() === p.iUserId.toString())
    }
    if (allowDecrypt) {
      if (user?.sEmail) user.sEmail = decryptValue(user.sEmail)
      if (user?.sMobNum) user.sMobNum = decryptValue(user.sMobNum)
    } else {
      if (user?.sEmail) user.sEmail = ''
      if (user?.sMobNum) user.sMobNum = ''
    }
    return { ...p, ...user, ...kyc, _id: undefined }
  })
}
