const { catchError, encryptKey, searchValues, getPaginationValues2, removenull, handleCatchError, mongify } = require('../../helper/utilities.services')
const PassbookModel = require('./model')
const UserModel = require('../user/model')
const TransactionReportModel = require('./transactionReportModel')
const AdminModel = require('../admin/model')
const { status, jsonStatus, messages } = require('../../helper/api.responses')
const { transactionType, passbookType, passbookStatus, eTab, paymentStatus } = require('../../data')
const { Op } = require('sequelize')
const { checkAdminAuthorization } = require('../../helper/authorization')
const { addUserFields } = require('../userDeposit/common')
const { streamObject } = require('../../helper/s3config')
const csv = require('fast-csv')
const moment = require('moment')
const config = require('../../config/config')
const { isValidObjectId } = require('mongoose')
const UserDeposit = require('../userDeposit/model')
const UserWithdraw = require('../userWithdraw/model')
const EventModel = require('../event/model')

const oPassbookService = {}

oPassbookService.transactionHistory = async (req, res) => {
  try {
    let { eTransactionType, eType, eStatus, eTabs, start = 0, limit = 10 } = req.query
    const iUserId = req.user._id.toString()
    let query = { iUserId }
    let result = {}
    switch (eTabs) {
      case eTab.map.ACCOUNT:
        {
          let subQuery = { eTransactionType: { [Op.in]: transactionType.value } }
          subQuery = eTransactionType ? { eTransactionType, ...subQuery } : { ...subQuery }
          subQuery = eType ? { eType, ...subQuery } : { ...subQuery }
          subQuery = eStatus ? { eStatus, ...subQuery } : { ...subQuery }
          query = { ...subQuery, ...query }
          result = await PassbookModel.findAll({ attributes: ['iUserId', 'nAmount', 'nBonus', 'nCash', 'eTransactionType', 'iCategoryId', 'iSubCategoryId', 'iTransactionId', 'sRemarks', 'eStatus', 'eType', 'nBuyCommission', 'nSellCommission', 'iEventId', 'iOrderId', 'dCreatedAt', 'nWithdrawFee', 'nApplicableTax', 'nTaxPercentage', 'nXPPoints', 'nUserLevelPercent'], where: query, order: [['dCreatedAt', 'DESC']], offset: Number(start), limit: Number(limit), raw: true })
        }
        break
      case eTab.map.REWARDS:
        {
          const subQuery = { ...query }
          if (eStatus === 'CMP') eStatus = 'S'
          if (eStatus && paymentStatus.includes(eStatus)) subQuery.ePaymentStatus = eStatus
          result = await UserDeposit.findAll({ where: subQuery })
        }
        break
      case eTab.map.WITHDRAW:
        {
          const subQuery = { ...query }
          if (eStatus === 'CMP') eStatus = 'S'
          if (eStatus && paymentStatus.includes(eStatus)) subQuery.ePaymentStatus = eStatus
          result = await UserWithdraw.findAll({ where: subQuery })
        }
        break
      default:
        break
    }
    // console.log({ total })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionHistory), data: result })
  } catch (error) {
    catchError('oPassbookService.transactionHistory', error, req, res)
  }
}

oPassbookService.passbookCount = async (req, res) => {
  try {
    const { eTransactionType, eType, eStatus, eTabs } = req.query
    const iUserId = req.user._id.toString()
    let query = { iUserId }
    switch (eTabs) {
      case eTab.map.ACCOUNT:
        {
          let subQuery = { eTransactionType: { [Op.in]: transactionType.value } }
          subQuery = eTransactionType ? { eTransactionType, ...subQuery } : { ...subQuery }
          subQuery = eType ? { eType, ...subQuery } : { ...subQuery }
          subQuery = eStatus ? { eStatus, ...subQuery } : { ...subQuery }
          query = { ...subQuery, ...query }
        }
        break
      case eTab.map.REWARDS:
        {
          let subQuery = { eTransactionType: transactionType.map.DEPOSIT }
          subQuery = eStatus ? { eStatus, ...subQuery } : { ...subQuery }
          query = { ...subQuery, ...query }
        }
        break
      case eTab.map.WITHDRAW:
        {
          let subQuery = { eTransactionType: { [Op.in]: [transactionType.map.WITHDRAW, transactionType.map.WITHDRAW_RETURN] } }
          subQuery = eStatus ? { eStatus, ...subQuery } : { ...subQuery }
          query = { ...subQuery, ...query }
        }
        break
      default:
        break
    }
    const total = await PassbookModel.count({ where: query })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cCount), data: total })
  } catch (error) {
    catchError('oPassbookService.passbookCount', error, req, res)
  }
}

oPassbookService.listPassbookTypes = async (req, res) => {
  try {
    const oEnums = {}
    oEnums.transactionType = transactionType.value
    oEnums.passbookType = passbookType.value
    oEnums.passbookStatus = passbookStatus
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cPassbookStatus), data: oEnums })
  } catch (error) {
    catchError('oPassbookService.listPassbookTypes', error, req, res)
  }
}

oPassbookService.adminListV2 = async (req, res) => {
  try {
    const { start = 0, limit = 10, sort = 'dActivityDate', order, search, searchType = 'DEFAULT', datefrom, dateto, particulars, type, id, isFullResponse, eStatus = '', eUserType, iEventId, iSubCategoryId, iOrderId, iCategoryId } = req.query

    const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'
    const query = []
    if (datefrom && dateto) {
      query.push({ dActivityDate: { [Op.gte]: new Date(datefrom) } })
      query.push({ dActivityDate: { [Op.lte]: new Date(dateto) } })
    }
    if (iEventId) {
      query.push({ iEventId })
    }
    if (iSubCategoryId) {
      query.push({ iSubCategoryId })
    }
    if (iCategoryId) {
      query.push({ iCategoryId })
    }
    if (iOrderId) {
      query.push({ iOrderId })
    }

    if (eStatus && ['R', 'CMP', 'CNCL'].includes(eStatus.toUpperCase())) {
      query.push({ eStatus: eStatus.toUpperCase() })
    }

    if (id) {
      query.push({ id: Number(id) })
    }
    if (type && ['Dr', 'Cr'].includes(type)) {
      query.push({ eType: type })
    }
    if (particulars && transactionType.value.includes(particulars)) {
      query.push({ eTransactionType: particulars })
    }

    if (eUserType) {
      query.push({ eUserType })
    }

    let users = []
    if (search) {
      if (searchType === 'PASSBOOK' && isNaN(Number(search))) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionHistory), data: { rows: [] } })
      let userQuery = {}

      switch (searchType) {
        case 'NAME':
          userQuery = { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          break
        case 'USERNAME':
          userQuery = { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          break
        case 'MOBILE':
          userQuery = { sMobNum: encryptKey(search) }
          break
        case 'PASSBOOK':
          userQuery = {}
          break
        case 'EVENT':
          {
            const aIds = await EventModel.find({ sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }, { _id: 1 }).lean()
            query.push({ iEventId: { [Op.in]: aIds.map(id => id?._id.toString()) } })
          }
          break
        default:
          userQuery = searchValues(search)
          break
      }

      if (isValidObjectId(search)) {
        users = await UserModel.findById(search, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
        if (!users) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionHistory), data: { rows: [] } })
        users = [users]
      } else {
        users = await UserModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
      }
      if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionHistory), data: { rows: [] } })
    }

    const userIds = users.map(user => user._id.toString())

    if (search) {
      if (searchType === 'PASSBOOK') {
        query.push({ id: Number(search) })
      } else {
        if (!isNaN(Number(search))) {
          if (users.length) {
            query.push({ [Op.or]: [{ id: { [Op.like]: search + '%' } }, { iUserId: { [Op.in]: userIds } }] })
          } else {
            query.push({ id: { [Op.or]: [{ [Op.like]: search + '%' }] } })
          }
        } else {
          query.push({ iUserId: { [Op.in]: userIds } })
        }
      }
    }

    if ((!datefrom || !dateto) && [true, 'true'].includes(isFullResponse)) {
      return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
    }

    if (([true, 'true'].includes(isFullResponse)) && !eUserType) query.push({ eUserType: 'U' })
    const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : {
      offset: parseInt(start),
      limit: parseInt(limit)
    }
    const data = await PassbookModel.findAll({
      where: {
        [Op.and]: query
      },
      order: [[sort, orderBy]],
      ...paginationFields,
      attributes: ['id', 'iUserId', 'bIsBonusExpired', 'nAmount', 'nBonus', 'nCash', 'eTransactionType', 'iPreviousId', 'iEventId', 'iCategoryId', 'iSubCategoryId', 'iUserDepositId', 'iWithdrawId', 'sRemarks', 'sCommonRule', 'eType', 'dActivityDate', 'nNewWinningBalance', 'nNewDepositBalance', 'nNewTotalBalance', 'nNewBonus', 'dProcessedDate', 'nWithdrawFee', 'sPromocode', 'eStatus', 'eUserType', 'iTransactionId', 'nXPPoints', 'nBuyCommission', 'nSellCommission', 'nActualAmount', 'nApplicableTax', 'nTaxPercentage', 'nUserLevelPercent', 'iOrderId'],
      raw: true
    })
    const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
    let allowDecrypt = false
    if (response.status === 200) {
      allowDecrypt = true
    }
    const passbookData = await addUserFields(data, users, allowDecrypt)
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionHistory), data: { rows: passbookData } })
  } catch (error) {
    catchError('Passbook.listV2', error, req, res)
  }
}

oPassbookService.getCountsV2 = async (req, res) => {
  try {
    const { search, searchType = 'DEFAULT', datefrom, dateto, particulars, type, id, isFullResponse, eStatus = '', eUserType, iEventId, iSubCategoryId, iOrderId } = req.query

    const query = []
    if (datefrom && dateto) {
      query.push({ dActivityDate: { [Op.gte]: new Date(datefrom) } })
      query.push({ dActivityDate: { [Op.lte]: new Date(dateto) } })
    }

    if (iEventId) {
      query.push({ iEventId })
    }
    if (iSubCategoryId) {
      query.push({ iSubCategoryId })
    }
    if (iOrderId) {
      query.push({ iOrderId })
    }
    if (eStatus && ['R', 'CMP', 'CNCL'].includes(eStatus.toUpperCase())) {
      query.push({ eStatus: eStatus.toUpperCase() })
    }
    if (id) {
      query.push({ id: Number(id) })
    }
    if (type && ['Dr', 'Cr'].includes(type)) {
      query.push({ eType: type })
    }
    if (particulars && transactionType.value.includes(particulars)) {
      query.push({ eTransactionType: particulars })
    }
    if (eUserType) {
      query.push({ eUserType })
    }

    let users = []

    if (search) {
      if (searchType === 'PASSBOOK' && isNaN(Number(search))) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionHistory), data: { count: 0 } })
      let userQuery = {}

      switch (searchType) {
        case 'NAME':
          userQuery = { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          break
        case 'USERNAME':
          userQuery = { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          break
        case 'MOBILE':
          userQuery = { sMobNum: encryptKey(search) }
          break
        case 'PASSBOOK':
          userQuery = {}
          break
        default:
          userQuery = searchValues(search)
          break
      }

      if (isValidObjectId(search)) {
        users = await UserModel.findById(search, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
        if (!users) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionHistory), data: { count: 0 } })
        users = [users]
      } else {
        users = await UserModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
      }
      if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionHistory), data: { count: 0 } })
    }

    const userIds = users.map(user => user._id.toString())

    if (search) {
      if (searchType === 'PASSBOOK') {
        query.push({ id: Number(search) })
      } else {
        if (!isNaN(Number(search))) {
          if (users.length) {
            query.push({ [Op.or]: [{ id: { [Op.like]: search + '%' } }, { iUserId: { [Op.in]: userIds } }] })
          } else {
            query.push({ id: { [Op.or]: [{ [Op.like]: search + '%' }] } })
          }
        } else {
          query.push({ iUserId: { [Op.in]: userIds } })
        }
      }
    }
    if (([true, 'true'].includes(isFullResponse)) && !eUserType) query.push({ eUserType: 'U' })

    const count = await PassbookModel.count({
      where: {
        [Op.and]: query
      },
      col: 'id',
      raw: true
    })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].cTransactionHistory} ${messages[req.userLanguage].cCounts}`), data: { count } })
  } catch (error) {
    catchError('Passbook.getCountsV2', error, req, res)
  }
}

oPassbookService.transactionReport = async (req, res) => {
  try {
    const { dDateFrom, dDateTo, aTransactionType, aType, aStatus, aCategoryId, aSubCategoryId, aEventId, sReportName } = req.body

    const iAdminId = req.admin._id
    removenull(req.body)

    if (!dDateFrom || !dDateTo) {
      return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
    }

    if (new Date(dDateFrom) > new Date(dDateTo)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cDateFrom).replace('#', messages[req.userLanguage].cDateTo) })

    const query = []
    if (dDateFrom && dDateTo) {
      query.push({ dActivityDate: { [Op.gte]: new Date(dDateFrom) } })
      query.push({ dActivityDate: { [Op.lte]: new Date(dDateTo) } })
    }

    if (aStatus && aStatus?.length) {
      query.push({ eStatus: { [Op.in]: aStatus.map(e => e.toUpperCase()) } })
    }

    if (aCategoryId && aCategoryId?.length) {
      query.push({ iCategoryId: { [Op.in]: aCategoryId } })
    }

    if (aSubCategoryId && aSubCategoryId?.length) {
      query.push({ iSubCategoryId: { [Op.in]: aSubCategoryId } })
    }

    if (aEventId && aEventId?.length) {
      query.push({ iEventId: { [Op.in]: aEventId } })
    }

    if (aType && aType?.length) {
      query.push({ eType: { [Op.in]: aType } })
    }

    if (aTransactionType && aTransactionType?.length) {
      query.push({ eTransactionType: { [Op.in]: aTransactionType } })
    }

    query.push({ eUserType: 'U' })

    const nTotal = await PassbookModel.count({
      where: { [Op.and]: query },
      raw: true
    })
    const reportName = `${sReportName}_${new Date().getTime()}`
    const report = await TransactionReportModel.create({ ...req.body, nTotal, oFilter: { ...req.body, sReportName: reportName }, iAdminId, eStatus: 'P' })

    const oData = { iReportId: report._id, query, nTotal }
    const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)
    let allowDecrypt = false
    if (response.status === 200) {
      allowDecrypt = true
    }
    generateReport(oData, allowDecrypt, reportName)

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cGenerationProcess.replace('##', messages[req.userLanguage].creport) })
  } catch (error) {
    catchError('Passbook.transactionReport', error, req, res)
  }
}

oPassbookService.listTransactionReport = async (req, res) => {
  try {
    const { start, limit, sorting } = getPaginationValues2(req.query)
    const { datefrom, dateto, iAdminId } = req.query

    let query = {}
    query = datefrom && dateto ? { dCreatedAt: { $gte: new Date(datefrom), $lte: new Date(dateto) } } : {}
    if (iAdminId) query = { ...query, iAdminId: mongify(iAdminId) }

    let [aData, nTotal] = await Promise.all([
      TransactionReportModel.find(query).sort(sorting).skip(start).limit(limit).lean(),
      TransactionReportModel.countDocuments(query)
    ])

    const adminIds = aData.map(report => report.iAdminId)
    const adminData = await AdminModel.find({ _id: { $in: adminIds } }, { sUsername: 1 })

    aData = aData.map(data => {
      const oAdminId = adminData.find(a => a?._id?.toString() === data?.iAdminId?.toString())
      return { ...data, iAdminId: oAdminId }
    })
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].creport), data: { aData, nTotal } })
  } catch (error) {
    catchError('Passbook.listTransactionReport', error, req, res)
  }
}

oPassbookService.listTransactionType = async (req, res) => {
  try {
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTransactionTypes), data: { eTransactionTypes: transactionType?.value } })
  } catch (error) {
    catchError('Passbook.listTransactionType', error, req, res)
  }
}

async function generateReport(data, allowDecrypt, reportName) {
  try {
    const { iReportId, query, nTotal } = data

    const nLimit = 5000
    let nSkip = 0
    const sort = 'id'
    const orderBy = 'ASC'
    const csvStream = csv.format({ headers: true, quoteHeaders: true })

    streamObject(config.S3_BUCKET_NAME, config.s3TransactionReport + `${reportName}.csv`, 'text/csv', csvStream)
      .then(async (data) => {
        await TransactionReportModel.updateOne({ _id: iReportId }, { sReportUrl: config.s3TransactionReport + `${reportName}.csv`, eStatus: 'S' }, { readPreference: 'primary' })
      })

    while (nSkip < nTotal) {
      const data = await PassbookModel.findAll({
        where: { [Op.and]: query },
        attributes: ['id', 'iUserId', 'nAmount', 'nBonus', 'nCash', 'eTransactionType', 'eType', 'dActivityDate', 'nNewTotalBalance', 'nNewBonus', 'eStatus', 'eUserType', 'iTransactionId', 'nXPPoints', 'iEventId', 'iOrderId', 'iUserLevelId', 'iCategoryId', 'iSubCategoryId'],
        order: [[sort, orderBy]],
        limit: nLimit,
        offset: nSkip,
        raw: true
      })

      const aPassBookData = await addUserFields(data, [], allowDecrypt)
      // console.log('aPassBookData', aPassBookData)

      const aFields = ['ID', 'Username', 'Mobile No', 'Cash', 'Bonus', 'Amount', 'Available Total Balance', 'Available Bonus', 'Type', 'Transaction Type', 'Transaction ID', 'Request Date', 'Event Name', 'Category Name', 'Sub Category Name']

      for (const oPassBook of aPassBookData) {
        oPassBook.dActivityDate = oPassBook?.dActivityDate ? moment(oPassBook.dActivityDate).format('MM/DD/YYYY h:mm A') : ''
        const oData = { ID: 'id', Username: 'sUsername', 'Mobile No': 'sMobNum', Cash: 'nCash', Bonus: 'nBonus', Amount: 'nAmount', 'Available Total Balance': 'nNewTotalBalance', 'Available Bonus': 'nNewBonus', Type: 'eType', 'Transaction Type': 'eTransactionType', 'Transaction ID': 'iTransactionId', 'Request Date': 'dActivityDate', 'Event Name': 'sEventName', 'Category Name': 'sCategoryName', 'Sub Category Name': 'sSubCategoryName' }

        const oPassBookRow = aFields.reduce((oRow, sField) => {
          oRow[sField] = oPassBook[oData[sField]]
          return oRow
        }, {})

        csvStream.write(oPassBookRow)
      }
      nSkip += nLimit
    }
    csvStream.end()
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = oPassbookService
