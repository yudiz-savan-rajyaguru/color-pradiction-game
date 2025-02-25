// @ts-check
const SettingModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, handleCatchError, checkValidImageType, convertToDecimal, mongify } = require('../../helper/utilities.services')
const { CACHE_2 } = require('../../config/config')
const cachegoose = require('recachegoose')
// const mongoose = require('mongoose')
const config = require('../../config/config')
const { contestKeys, oSettingValueType, aTaxTransactions } = require('../../data')
const { redisClient } = require('../../helper/redis')
const bucket = require('../../helper/cloudStorage.services')
// const adminServices = require('../admin/adminLogs/services')
class Setting {
  async findSettingV2(query, projection) {
    try {
      const setting = await SettingModel.findOne(query, projection).lean()
      return setting
    } catch (error) {
      throw new Error(error)
    }
  }

  async findSettings(query, projection) {
    try {
      const setting = await SettingModel.find(query, projection).lean()
      return setting
    } catch (error) {
      throw new Error(error)
    }
  }

  async updateSetting(query = {}, update = {}) {
    try {
      // Perform the update operation
      const setting = await SettingModel.findOneAndUpdate(query, update, { new: true, runValidators: true }).lean()

      // Return the updated setting
      if (setting) return { data: setting }
    } catch (error) {
      // Handle the error
      handleCatchError(error)
      throw error // Optionally rethrow the error to be handled by the caller
    }
  }

  findSetting(key) {
    return SettingModel.findOne({ sKey: key, eStatus: 'Y' }).lean()
    // .cache(CACHE_2, `setting:${key}`)
  }

  // To add Setting
  // If you are adding notification type setting then need to add eType = 'NOTIFICATION'
  async add(req, res) {
    try {
      const { sKey, eValueType, sValue: nInActivityCharge } = req.body
      if (eValueType === 'F') req.body = pick(req.body, ['sTitle', 'sKey', 'eStatus', 'sDescription', 'sValue', 'sLogo', 'sImage', 'sShortName', 'eValueType', 'eType', 'eCategory'])
      else if (eValueType === 'R') req.body = pick(req.body, ['sTitle', 'sKey', 'nMax', 'nMin', 'eStatus', 'sDescription', 'sLogo', 'sImage', 'sShortName', 'eValueType', 'eType', 'eCategory'])
      else req.body = pick(req.body, ['sTitle', 'sKey', 'eStatus', 'sDescription', 'sLogo', 'sImage', 'sShortName', 'eType', 'eCategory'])

      const sStaticVal = oSettingValueType[sKey]
      if (sStaticVal && eValueType !== sStaticVal) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].value_type_invalid.replace('##', sKey) })

      removenull(req.body)

      const { nMin, nMax, sValue } = req.body

      if (eValueType === 'F' && !sValue) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cSettingValue) })
      if (eValueType === 'R' && (((Number(nMin) !== 0 && !Number(nMin)) || (Number(nMax) !== 0 && !Number(nMax))) || (Number(nMin) >= Number(nMax)))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cSettingRangeValue) })

      const exist = await SettingModel.findOne({ sKey: { $regex: new RegExp('^.*' + req.body.sKey + '.*', 'i') } }).lean()
      if (exist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cvalidationSetting) })

      if (contestKeys?.includes(sKey.toUpperCase())) {
        req.body.eStatus = 'Y'
      }

      if (sKey === 'DEACTIVATE_USERS') {
        // in this case sValue is Charge
        req.body.sValue = nInActivityCharge
      }
      const data = await SettingModel.create({ ...req.body })

      // const logData = { oOldFields: {}, oNewFields: data, sIP: getIp(req), iAdminId: mongify(iAdminId), iUserId: null, eKey: 'S', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      // await adminServices.adminLog(req, res, logData)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewSetting), data })
    } catch (error) {
      catchError('Setting.add', error, req, res)
    }
  }

  // To update Setting
  async update(req, res) {
    try {
      const { sKey, eValueType, sValue: nInActivityCharge } = req.body
      if (eValueType === 'F') req.body = pick(req.body, ['sTitle', 'sKey', 'eStatus', 'sDescription', 'sValue', 'sLogo', 'sImage', 'sShortName', 'eType', 'eValueType', 'eCategory'])
      else if (eValueType === 'R') req.body = pick(req.body, ['sTitle', 'sKey', 'nMax', 'nMin', 'eStatus', 'sDescription', 'sLogo', 'sImage', 'sShortName', 'eType', 'eValueType', 'eCategory'])
      else req.body = pick(req.body, ['sTitle', 'sKey', 'eStatus', 'sDescription', 'sLogo', 'sImage', 'sShortName', 'eType', 'eCategory'])

      const sStaticVal = oSettingValueType[sKey]
      if (sStaticVal && eValueType !== sStaticVal) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].value_type_invalid.replace('##', sKey) })

      removenull(req.body)

      if (sKey === 'APPLICATIONS_POPUP' && !['Y', 'N'].includes(req.body.sValue)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cSettingValue) + ' PASS Y OR N' })
      }

      let { nMin = null, nMax = null, sValue = null, eType = null } = req.body

      const setting = await Promise.all([
        SettingModel.findOne({ sKey: req.body.sKey, _id: { $ne: mongify(req.params.id) } }).lean(),
        SettingModel.findOne({ _id: mongify(req.params.id) }).lean()
      ])

      if (setting[0]) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cvalidationSetting) })
      if (eValueType === 'F' && !sValue) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cSettingValue) })
      if (eValueType === 'R' && (((Number(nMin) !== 0 && !Number(nMin)) || (Number(nMax) !== 0 && !Number(nMax))) || (Number(nMin) >= Number(nMax)))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cSettingRangeValue) })

      if (contestKeys.includes(sKey.toUpperCase())) {
        req.body.eStatus = 'Y'
      }

      if (sKey === 'DEACTIVATE_USERS') {
        // in this case sValue is Charge
        sValue = nInActivityCharge
      }

      let data
      if (eValueType) {
        data = await SettingModel.findByIdAndUpdate(req.params.id, { ...req.body, eValueType, nMin, nMax, sValue, eType, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()
      } else {
        data = await SettingModel.findByIdAndUpdate(req.params.id, { ...req.body, eType, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()
      }
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csetting) })

      if (['DEPOSIT_TAX', 'WITHDRAW_TAX', 'CONTEST_JOIN_TAX'].includes(sKey)) {
        // const logData = { oOldFields: setting[1], oNewFields: data, sIP: getIp(req), iAdminId: mongify(iAdminId), iUserId: null, eKey: 'TAX', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
        // await adminServices.adminLog(req, res, logData)
      }

      // cachegoose.clearCache(`setting:${data.sKey}`)
      if (data.sKey === 'Withdraw') {
        await redisClient.del('__express__/api/user/setting/Withdraw/v2')
      } else if (data.sKey === 'PCF' || data.sKey === 'PCS') {
        await redisClient.del('__express__/api/user/setting/PrivateLeague/v2')
      } else if (data.sKey === 'Deposit') {
        await redisClient.del('__express__/api/user/setting/Deposit/v2')
      }
      // const logData = { oOldFields: setting[1], oNewFields: data, sIP: getIp(req), iAdminId: mongify(iAdminId), iUserId: null, eKey: 'S', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      // await adminServices.adminLog(req, res, logData)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.update', error, req, res)
    }
  }

  // To get List of Setting with pagination, sorting and searching
  async list(req, res) {
    try {
      const { start = 0, limit = 10, order, search, isFullResponse, sort, eCategory } = req.query
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { [sort]: orderBy }
      let query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') }, eType: { $ne: 'NOTIFICATION' } } : { eType: { $ne: 'NOTIFICATION' } }
      let results
      const projection = {
        sTitle: 1,
        sKey: 1,
        nMax: 1,
        nMin: 1,
        eStatus: 1,
        sValue: 1,
        sDescription: 1,
        dCreatedAt: 1,
        eValueType: 1,
        eCategory: 1
      }
      if (eCategory) {
        query = { ...query, eCategory }
      }
      if ([true, 'true'].includes(isFullResponse)) {
        results = await SettingModel.find(query, projection).sort(sorting).lean()
      } else {
        results = await SettingModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }
      const total = await SettingModel.countDocuments({ ...query })
      const data = [{ total, results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data: data })
    } catch (error) {
      return catchError('Setting.list', error, req, res)
    }
  }

  // To get details of single Setting by _id
  async get(req, res) {
    try {
      const data = await SettingModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csetting) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.get', error, req, res)
    }
  }

  // To get details of single Setting by key for admin side validation
  async getSettingByKeyAdmin(req, res) {
    try {
      const data = await SettingModel.findOne({ sKey: req.params.key.toUpperCase() }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data: data || {} })
    } catch (error) {
      catchError('Setting.get', error, req, res)
    }
  }

  async getDepositWithdrawSettingByType(req, res) {
    try {
      const type = req.params.type
      let data
      if (type === 'Deposit' || type === 'Withdraw') {
        data = await SettingModel.findOne({ sKey: type }).lean()
      }
      const currencySetting = await SettingModel.findOne({ sKey: 'CURRENCY' }, { sLogo: 1 }).lean()
      const symbol = currencySetting && currencySetting.sLogo ? currencySetting.sLogo : '₹'

      // we'll add validation message according to setting type from below format
      if (type === 'Deposit' && data) {
        data.sMinMessage = messages[req.userLanguage].min_deposit_amount.replace('₹', symbol).replace('##', data.nMin)
        data.sMaxMessage = messages[req.userLanguage].max_deposit_amount.replace('₹', symbol).replace('##', data.nMax)
      } else if (type === 'Withdraw' && data) {
        data.sMinMessage = messages[req.userLanguage].min_withdraw_amount.replace('₹', symbol).replace('##', data.nMin)
        data.sMaxMessage = messages[req.userLanguage].max_withdraw_amount.replace('₹', symbol).replace('##', data.nMax)
      } else if (type === 'PrivateLeague') {
        data = await SettingModel.find({ sKey: { $in: ['PUBC', 'PCF'] } }, { sKey: 1, nMax: 1, nMin: 1, sTitle: 1 }).lean()

        let oSize = {}
        let oPrize = {}

        data?.forEach((d) => {
          if (d.sKey === 'PUBC') {
            oSize = {
              ...d,
              sName: d.sTitle,
              sMinMessage: messages[req.userLanguage].contest_size_err.replace('#', d.nMin).replace('##', d.nMax),
              sMaxMessage: messages[req.userLanguage].contest_size_err.replace('#', d.nMin).replace('##', d.nMax)
            }
          } else if (d.sKey === 'PCF') {
            oPrize = {
              ...d,
              sName: d.sTitle,
              sMinMessage: messages[req.userLanguage].win_amount_err.replace('#', d.nMin).replace('##', d.nMax).replaceAll('₹', symbol),
              sMaxMessage: messages[req.userLanguage].win_amount_err.replace('#', d.nMin).replace('##', d.nMax).replaceAll('₹', symbol)
            }
          }
        })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data: { oSize, oPrize } })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.getDepositWithdrawSettingByType', error, req, res)
    }
  }

  async getDepositWithdrawSettingByTypeV2(req, res) {
    try {
      const type = req.params.type
      let data
      if (['Deposit', 'Withdraw', 'FD'].includes(type)) {
        data = await SettingModel.findOne({ sKey: type }, { __v: false, dUpdatedAt: false, dCreatedAt: false }).lean()
      }
      const currencySetting = await SettingModel.findOne({ sKey: 'CURRENCY' }, { sLogo: 1 }).lean()
      const symbol = currencySetting && currencySetting.sLogo ? currencySetting.sLogo : '₹'

      // we'll add validation message according to setting type from below format
      if (type === 'Deposit' && data) {
        data.sMinMessage = messages[req.userLanguage].min_deposit_amount.replace('₹', symbol).replace('##', data.nMin)
        data.sMaxMessage = messages[req.userLanguage].max_deposit_amount.replace('₹', symbol).replace('##', data.nMax)
      } else if (type === 'Withdraw' && data) {
        data.sMinMessage = messages[req.userLanguage].min_withdraw_amount.replace('₹', symbol).replace('##', data.nMin)
        data.sMaxMessage = messages[req.userLanguage].max_withdraw_amount.replace('₹', symbol).replace('##', data.nMax)
      } else if (type === 'PrivateLeague') {
        data = await SettingModel.find({ sKey: { $in: ['PCS', 'PCF'] } }, { sKey: 1, nMax: 1, nMin: 1, sTitle: 1 }).lean()

        let oSize = {}
        let oPrize = {}

        data?.forEach((d) => {
          if (d.sKey === 'PCS') {
            oSize = {
              ...d,
              sName: d.sTitle,
              sMinMessage: messages[req.userLanguage].contest_size_err.replace('#', d.nMin).replace('##', d.nMax),
              sMaxMessage: messages[req.userLanguage].contest_size_err.replace('#', d.nMin).replace('##', d.nMax)
            }
          } else if (d.sKey === 'PCF') {
            oPrize = {
              ...d,
              sName: d.sTitle,
              sMinMessage: messages[req.userLanguage].win_amount_err.replace('#', d.nMin).replace('##', d.nMax).replaceAll('₹', symbol),
              sMaxMessage: messages[req.userLanguage].win_amount_err.replace('#', d.nMin).replace('##', d.nMax).replaceAll('₹', symbol)
            }
          }
        })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data: { oSize, oPrize } })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.getDepositWithdrawSettingByType', error, req, res)
    }
  }

  // To update COUNTRY Currency
  async updateCurrency(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sShortName', 'sLogo', 'sDescription'])
      removenull(req.body)

      let data = await SettingModel.findOneAndUpdate({ sKey: 'CURRENCY' }, { ...req.body, dUpdatedAt: Date.now() }, { runValidators: true }).lean()

      if (!data) {
        data = await SettingModel.create({ ...req.body, sKey: 'CURRENCY' })
      }
      const oNewFields = { ...data, ...req.body }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].currency), data: oNewFields })
    } catch (error) {
      catchError('Setting.updateCurrency', error, req, res)
    }
  }

  // To get details of single COUNTRY Currency by _id
  async getCurrency(req, res) {
    try {
      const data = await SettingModel.findOne({ sKey: 'CURRENCY' }, { sTitle: 1, sLogo: 1, sShortName: 1, sKey: 1, sDescription: 1 }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].currency), data })
    } catch (error) {
      catchError('Setting.getCurrency', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: config.s3SideBackground })
      // const data = await s3.signedUrl(sFileName, sContentType, config.s3SideBackground)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('Setting.getSignedUrl', error, req, res)
    }
  }

  async getSideBackground(req, res) {
    try {
      const data = await SettingModel.findOne({ sKey: req.params.key }, { sImage: 1, sKey: 1, sDescription: 1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].sideBackground), data })
    } catch (error) {
      catchError('Setting.getSideBackground', error, req, res)
    }
  }

  async getUserSideBackground(req, res) {
    try {
      const data = {
        sBackImage: 'side-background/1688020512846_1663837879152_GettyImages-463485384_Cropped.jpeg',
        sImage: ''
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].sideBackground), data })
    } catch (error) {
      catchError('Setting.getUserSideBackground', error, req, res)
    }
  }

  async updateSideBackground(req, res) {
    try {
      const { sImage, sKey } = req.body
      const { _id: iAdminId } = req.admin
      req.body = pick(req.body, ['sImage', 'sDescription'])

      let data = await SettingModel.findOneAndUpdate({ sKey }, { ...req.body, dUpdatedAt: Date.now() }, { runValidators: true }).lean()
      if (!data) {
        const sTitle = sKey === 'BG' ? 'Side Background' : 'Side Image'
        data = await SettingModel.create({ sImage, sKey, sTitle })
      }
      const oNewFields = { ...data, ...req.body }
      // const logData = { oOldFields: data, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'S', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      // await adminServices.adminLog(req, res, logData)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].sideBackground), data: oNewFields })
    } catch (error) {
      catchError('Setting.updateSideBackground', error, req, res)
    }
  }

  async getFixDepositSetting(req, res) {
    try {
      const data = await SettingModel.find({ sKey: /FIX_DEPOSIT*/, eStatus: 'Y' }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.getFixDepositSetting', error, req, res)
    }
  }

  async getCurrencySymbol() {
    try {
      const data = await SettingModel.findOne({ sKey: 'CURRENCY' }, { sLogo: 1 }).lean()
      // .cache(CACHE_2, 'setting:CURRENCY')
      return data && data.sLogo ? data.sLogo : '₹'
    } catch (error) {
      handleCatchError(error)
      return '₹'
    }
  }

  async getServerTime(req, res) {
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].serverTime), dCurrentTime: new Date() })
  }

  async defaultAdminPanelConfig(req, res) {
    try {
      // ALE : ADMIN LOCATION ENABLED
      const data = await SettingModel.find({ sKey: 'ALE' }, { sKey: 1, sTitle: 1, eStatus: 1 }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('defaultAdminPanelConfig.get', error, req, res)
    }
  }

  // Deduct money only from win balance flag for withdraw and app store deduction
  async getDeductMoneyFlag(req, res) {
    try {
      const data = await SettingModel.find({ sKey: { $in: ['WinBifurcate', 'WINNING_BALANCE_MERCHANDISE'] } }, { sKey: 1, sTitle: 1, eStatus: 1 }).lean()
      let bWithdrawFlag = true
      let bMerchandiseFlag = false
      data.forEach(setting => {
        if (setting.sKey === 'WinBifurcate' && setting.eStatus === 'Y') bWithdrawFlag = false
        if (setting.sKey === 'WINNING_BALANCE_MERCHANDISE' && setting.eStatus === 'Y') bMerchandiseFlag = true
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cFlags), data: { bWithdrawFlag, bMerchandiseFlag } })
    } catch (error) {
      return catchError('Setting.getDeductMoneyFlag', error, req, res)
    }
  }

  async getDefaultSetting(req, res) {
    try {
      const settingsToFetch = ['WinBifurcate', 'WINNING_BALANCE_MERCHANDISE', 'FD']
      const data = await SettingModel.find({ sKey: { $in: settingsToFetch } }, { sKey: 1, sTitle: 1, eStatus: 1 }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cSettings), data })
    } catch (error) {
      return catchError('Setting.getDefaultSetting', error, req, res)
    }
  }

  async taxCalculate(req, res) {
    try {
      const { sTransactionKey, nAmount = 0 } = req.query
      if (!aTaxTransactions.includes(sTransactionKey)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cTransactionKey) })
      const taxSetting = await SettingModel.findOne({ sKey: sTransactionKey }).lean()
      // .cache(CACHE_2, `setting:${sTransactionKey}`)
      let { sValue = 0 } = taxSetting
      sValue = parseInt(sValue)
      const nTaxValue = convertToDecimal(sValue * nAmount / 100)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cSettings), data: { nTaxValue, nTaxPercentage: sValue } })
    } catch (error) {
      return catchError('Setting.taxCalculate', error, req, res)
    }
  }
}

module.exports = new Setting()
