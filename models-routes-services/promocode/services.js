/* eslint-disable no-inner-declarations */
const PromocodeModel = require('./model')
const PromoCodeLogs = require('./logs.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { removenull, catchError, pick, getPaginationValues2, getIp, ObjectId } = require('../../helper/utilities.services')
const { redisClient } = require('../../helper/redis')
const enumData = require('../../data')
const { createAdminLog } = require('../admin/adminLogs/handler')

class Promocode {
  // To create new promocode of type deposit or match
  async addV2(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sCode', 'bIsPercent', 'nMaxDiscount', 'eStatus', 'sInfo', 'nAmount', 'aPromocode', 'nMaxAllow', 'dStartTime', 'dExpireTime', 'eType', 'bMaxAllowForAllUser', 'nPerUserUsage', 'bAutoApply', 'nMaxAmount', 'nMinAmount', 'bShow'])

      removenull(req.body)
      const { nMinAmount, nMaxAmount, dExpireTime, dStartTime, nAmount, bIsPercent, eType, sCode } = req.body
      const { _id: iAdminId } = req.admin

      if (nMinAmount || nMaxAmount) {
        if (isNaN(nMinAmount) || isNaN(nMaxAmount)) {
          return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })
        }
      }

      const promoExist = await PromocodeModel.findOne({ sCode, eStatus: 'Y' }).lean()
      if (promoExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpromocode) })

      if (bIsPercent && (parseInt(nAmount) < 0 || parseInt(nAmount) > 100)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].snAmount) })

      if (eType === 'DEPOSIT') {
        if (nMinAmount && nMaxAmount && parseInt(nMinAmount) > parseInt(nMaxAmount)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].minAmount).replace('#', messages[req.userLanguage].cmaximumAmount) })
      }

      if (dExpireTime && new Date(dExpireTime) < new Date(Date.now())) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].past_date_err.replace('##', messages[req.userLanguage].cexpireTime) })

      if (dStartTime && dExpireTime && new Date(dStartTime) > new Date(dExpireTime)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cstartTime).replace('#', messages[req.userLanguage].cexpireTime) })

      const data = await PromocodeModel.create({ ...req.body })
      // cachegoose.clearCache('promocode')

      const oNewFields = { ...data }
      const logData = { oOldFields: {}, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'PC', sLatitude: req.admin?.sLatitude, sLongitude: req.admin?.sLongitude }
      await createAdminLog(logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cpromocode), data })
    } catch (error) {
      return catchError('Promocode.addV2', error, req, res)
    }
  }

  // update promocode of type deposit or match
  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'eCategory', 'sCode', 'sInfo', 'nAmount', 'eStatus', 'nMinAmount', 'nMaxAmount', 'nMaxAllow', 'dStartTime', 'dExpireTime', 'bIsPercent', 'nBonusExpireDays', 'eType', 'aMatches', 'aLeagues', 'bMaxAllowForAllUser', 'nPerUserUsage', 'nDecrementValue', 'bAutoApply', 'bShow', 'nMaxDiscount', 'aSegmentIds'])

      const { nMinAmount, nMaxAmount, dExpireTime, dStartTime, nAmount, bIsPercent, nBonusExpireDays, eType, sCode, nDecrementValue, eCategory } = req.body

      const { _id: iAdminId } = req.admin

      if (req.admin.eType !== 'SUPER' && eType === 'MATCH') {
        // if admin does not have permission for sports then send error
        // to manage sports wise permission
        if (!req.admin.sports.includes(eCategory)) {
          return res.status(status.Forbidden).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].write_access_denied.replace('##', messages[req.userLanguage].cModule) })
        }
      }
      if (nMinAmount || nMaxAmount) {
        if (isNaN(nMinAmount) || isNaN(nMaxAmount)) {
          return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })
        }
      }

      const promoExist = await PromocodeModel.findById(req.params.id).lean()
      if (!promoExist) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpromocode) })

      if (sCode) {
        const checkPromo = await PromocodeModel.findOne({ sCode, eStatus: 'Y', _id: { $ne: req.params.id } }).lean()
        if (checkPromo) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpromocode) })
      }

      if (bIsPercent && (parseInt(nAmount) < 0 || parseInt(nAmount) > 100)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })
      if (eType === 'DEPOSIT') {
        if (nMinAmount && nMaxAmount && parseInt(nMinAmount) > parseInt(nMaxAmount)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cMinimumAmount).replace('#', messages[req.userLanguage].cMaximumAmount) })
      }
      if (dExpireTime && new Date(dExpireTime) < new Date(Date.now())) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].past_date_err.replace('##', messages[req.userLanguage].cexpireTime) })
      if (dStartTime && dExpireTime && new Date(dStartTime) > new Date(dExpireTime)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cstartTime).replace('#', messages[req.userLanguage].cexpireTime) })
      if (nBonusExpireDays && (nBonusExpireDays < 1)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].expired_days_err.replace('#', messages[req.userLanguage].cBonusExpire) })

      if (nDecrementValue) {
        if (!bIsPercent) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].decrement_promocode_err.replace('#', messages[req.userLanguage].cBonusExpire) })
      }

      const data = await PromocodeModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpromocode) })
      // cachegoose.clearCache('promocode')

      const oOldFields = { ...promoExist }
      const oNewFields = { ...data }
      const logData = { oOldFields, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'PC', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpromocode), data })
    } catch (error) {
      return catchError('Promocode.update', error, req, res)
    }
  }

  // remove promocode
  async remove(req, res) {
    try {
      const { _id: iAdminId } = req.admin

      // to manage sports wise permission
      let sportsPermissionQuery = {}
      if (req.admin.eType !== 'SUPER') {
        sportsPermissionQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }, { eCategory: '' }] }
      }
      // to manage sports wise permission

      // if admin does not have permission of sports then do not delete
      const query = { _id: req.params.id, ...sportsPermissionQuery }
      const data = await PromocodeModel.findOneAndDelete(query).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpromocode) })
      // cachegoose.clearCache('promocode')

      const oOldFields = { ...data }
      const logData = { oOldFields, oNewFields: {}, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'PC', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cpromocode), data })
    } catch (error) {
      return catchError('Promocode.remove', error, req, res)
    }
  }

  // get list of promocode details for admin
  async list(req, res) {
    try {
      const { eType, datefrom, dateto } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const eTypeFilter = eType ? [eType] : enumData.promocodeTypes

      const datefilter = datefrom && dateto ? { dStartTime: { $gte: (datefrom) }, dExpireTime: { $lte: (dateto) } } : {}
      const codeQuery = {}
      if (search) codeQuery.sCode = { $regex: new RegExp('^.*' + search + '.*', 'i') }

      // to manage sports wise permission
      let sportsQuery = {}
      if (req.admin.eType !== 'SUPER') {
        sportsQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }, { eCategory: '' }] }
      }

      // to manage sports wise permission
      const query = { ...datefilter, eType: { $in: eTypeFilter }, ...codeQuery, ...sportsQuery }
      const results = await PromocodeModel.find(query, {
        sCode: 1,
        eCategory: 1,
        bShow: 1,
        sInfo: 1,
        nAmount: 1,
        bIsPercent: 1,
        eStatus: 1,
        nMinAmount: 1,
        nMaxAmount: 1,
        nMaxAllow: 1,
        dStartTime: 1,
        dExpireTime: 1,
        nBonusExpireDays: 1,
        bMaxAllowForAllUser: 1,
        nPerUserUsage: 1,
        dCreatedAt: 1,
        eType: 1,
        aMatches: 1,
        aLeagues: 1,
        nMaxDiscount: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await PromocodeModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: data })
    } catch (error) {
      return catchError('Promocode.list', error, req, res)
    }
  }

  async listV1(req, res) {
    try {
      const { eType, datefrom, dateto, isFullResponse } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const eTypeFilter = eType ? [eType] : enumData.promocodeTypes

      const datefilter = datefrom && dateto ? { dStartTime: { $gte: (datefrom) }, dExpireTime: { $lte: (dateto) } } : {}
      const codeQuery = {}
      if (search) codeQuery.sCode = { $regex: new RegExp('^.*' + search + '.*', 'i') }

      // to manage sports wise permission
      let sportsQuery = {}
      if (req.admin.eType !== 'SUPER') {
        sportsQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }, { eCategory: '' }] }
      }

      // to manage sports wise permission
      const query = { ...datefilter, eType: { $in: eTypeFilter }, ...codeQuery, ...sportsQuery }
      let results = []
      if ([true, 'true'].includes(isFullResponse)) {
        results = await PromocodeModel.find(query, {
          sCode: 1,
          eCategory: 1,
          bShow: 1,
          sInfo: 1,
          nAmount: 1,
          bIsPercent: 1,
          eStatus: 1,
          nMinAmount: 1,
          nMaxAmount: 1,
          nMaxAllow: 1,
          dStartTime: 1,
          dExpireTime: 1,
          nBonusExpireDays: 1,
          bMaxAllowForAllUser: 1,
          nPerUserUsage: 1,
          dCreatedAt: 1,
          eType: 1,
          aMatches: 1,
          aLeagues: 1,
          nMaxDiscount: 1
        }).sort(sorting).lean()
      } else {
        results = await PromocodeModel.find(query, {
          sCode: 1,
          eCategory: 1,
          bShow: 1,
          sInfo: 1,
          nAmount: 1,
          bIsPercent: 1,
          eStatus: 1,
          nMinAmount: 1,
          nMaxAmount: 1,
          nMaxAllow: 1,
          dStartTime: 1,
          dExpireTime: 1,
          nBonusExpireDays: 1,
          bMaxAllowForAllUser: 1,
          nPerUserUsage: 1,
          dCreatedAt: 1,
          eType: 1,
          aMatches: 1,
          aLeagues: 1,
          nMaxDiscount: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }

      const total = await PromocodeModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: data })
    } catch (error) {
      return catchError('Promocode.list', error, req, res)
    }
  }

  // get details of single promocode
  async get(req, res) {
    try {
      let sportsPermissionQuery = {}
      if (req.admin.eType !== 'SUPER') {
        sportsPermissionQuery = { $or: [{ eCategory: { $in: req.admin.sports } }, { eCategory: { $exists: false } }, { eCategory: '' }] }
      }
      const query = { _id: req.params.id, ...sportsPermissionQuery }
      const promo = await PromocodeModel.findOne(query).lean()
      if (!promo) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpromocode) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: promo })
    } catch (error) {
      return catchError('Promocode.get', error, req, res)
    }
  }

  async addMultiplePromocodes(req, res) {
    try {
      let aPromoCode = []
      let aExistingCode = []
      let newPromoCodeObject = []
      req.body = pick(req.body, ['sName', 'bIsPercent', 'eStatus', 'sInfo', 'nAmount', 'nMinAmount', 'nMaxAmount', 'nMaxAllow', 'dStartTime', 'dExpireTime', 'nBonusExpireDays', 'eType', 'bMaxAllowForAllUser', 'nPerUserUsage', 'nCount', 'nLength', 'sPrefix', 'sSuffix', 'bShow'])
      removenull(req.body)

      const { _id: iAdminId } = req.admin
      const { nMinAmount, nMaxAmount, dExpireTime, dStartTime, nAmount, bIsPercent, nBonusExpireDays, eType, nCount, nLength } = req.body
      const sPrefix = req.body.sPrefix?.toUpperCase()
      const sSuffix = req.body.sSuffix?.toUpperCase()

      if (bIsPercent && (parseInt(nAmount) < 0 || parseInt(nAmount) > 100)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].snAmount) })

      if (eType === 'DEPOSIT') {
        if (nMinAmount && nMaxAmount && parseInt(nMinAmount) > parseInt(nMaxAmount)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].minAmount).replace('#', messages[req.userLanguage].cmaximumAmount) })
      }

      if (dExpireTime && new Date(dExpireTime) < new Date(Date.now())) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].past_date_err.replace('##', messages[req.userLanguage].cexpireTime) })

      if (dStartTime && dExpireTime && new Date(dStartTime) > new Date(dExpireTime)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cstartTime).replace('#', messages[req.userLanguage].cexpireTime) })

      if (nBonusExpireDays && (nBonusExpireDays < 1)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].expired_days_err.replace('#', messages[req.userLanguage].cBonusExpire) })

      const sChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      // eslint-disable-next-line max-params
      const randomString = (sPrefix, sSuffix, nLength, sChars) => {
        let sResult = sPrefix || ''
        for (let i = nLength; i > 0; --i) sResult += sChars[Math.round(Math.random() * (sChars.length - 1))]
        if (sSuffix) sResult += sSuffix
        return sResult
      }
      const data = { ...req.body }
      data.sPrefix = sPrefix
      data.sSuffix = sSuffix
      data.nLength = nLength
      const oNewFields = { ...data }
      const logData = { oOldFields: {}, oNewFields, sIP: getIp(req), iAdminId, eKey: 'PC', sLatitude: req.admin.sLatitude, sLongitude: req.admin.sLongitude }
      await createAdminLog(logData)

      const checkPattern = await PromoCodeLogs.find({ sPrefix, sSuffix })

      if (!checkPattern.length) {
        await PromoCodeLogs.create({ sPrefix, sSuffix, nLength })
        // If the pattern does not exist, we create new promo codes and add it to PromoCode set
        for (let i = 1; i <= nCount; i++) {
          const sCode = randomString(sPrefix, sSuffix, nLength, sChars)
          await redisClient.sadd('PromoCode', sCode)
        }

        if (nCount > 5000) {
          let nChunk = Math.ceil(nCount / 5000)
          while (nChunk > 0) {
            let nRemainingCount = nCount
            const redisData = await redisClient.spop('PromoCode', 5000)
            for (let i = 0; i < 5000; i++) {
              nRemainingCount -= 1
              if (nRemainingCount > 0) {
                newPromoCodeObject.push({ ...data, sCode: redisData[i] })
              } else break
            }
            await promoCreation(newPromoCodeObject, nCount)
            newPromoCodeObject = []
            nChunk--
          }
        } else {
          const redisData = await redisClient.spop('PromoCode', nCount)
          for (let i = 0; i < nCount; i++) {
            newPromoCodeObject.push({ ...data, sCode: redisData[i] })
          }
          await promoCreation(newPromoCodeObject, nCount)
          newPromoCodeObject = []
        }
      } else {
        // Creating the promo code logs to save to pattern and check generating promo codes in chunks and inserting
        await PromoCodeLogs.create({ sPrefix, sSuffix, nLength })
        const generateString = async (count) => {
          if (count >= 5000) {
            let nChunk = Math.ceil(count / 5000)
            let nRemainingCount = count

            while (nChunk > 0) {
              for (let i = 1; i <= 5000; i++) {
                const sCode = await randomString(sPrefix, sSuffix, nLength, sChars)
                nRemainingCount -= 1
                if (nRemainingCount > 0) {
                  aPromoCode.push(sCode)
                  newPromoCodeObject.push({ ...data, sCode })
                } else break
              }
              await promoCreation(newPromoCodeObject, count, aPromoCode)
              newPromoCodeObject = []
              aPromoCode = []
              nChunk--
            }
          } else {
            for (let i = 1; i <= count; i++) {
              const sCode = await randomString(sPrefix, sSuffix, nLength, sChars)
              aPromoCode.push(sCode)
              newPromoCodeObject.push({ ...data, sCode })
            }
            await promoCreation(newPromoCodeObject, count, aPromoCode)
            newPromoCodeObject = []
            aPromoCode = []
          }
        }

        await generateString(nCount)
        if (aExistingCode.length) {
          await generateString(aExistingCode.length)
          aExistingCode = []
        }
      }

      async function promoCreation(newPromoCodeObject, count, aPromoCode) {
        if (aPromoCode?.length) {
          const promoExist = await PromocodeModel.find({ sCode: { $in: aPromoCode }, eStatus: 'Y' }).lean()
          if (promoExist.length) {
            promoExist?.forEach((e) => aExistingCode.push(e.sCode))
          }
        }

        // Ensure newPromoCodeObject does not exceed the required count
        if (newPromoCodeObject.length > count) {
          newPromoCodeObject.splice(0, newPromoCodeObject.length - count)
        }

        try {
          await PromocodeModel.insertMany(newPromoCodeObject)
        } catch (error) {
          console.error('Error while inserting promo codes:', error)
        }

        newPromoCodeObject = []
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cpromocode) })
    } catch (error) {
      return catchError('Promocode.addMultiplePromocodes', error, req, res)
    }
  }
}
module.exports = new Promocode()
