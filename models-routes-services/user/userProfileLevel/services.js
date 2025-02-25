// @ts-check
const enums = require('../../../data')
const { jsonStatus } = require('../../../helper/api.responses')
const { handleCatchError, convertToDecimal } = require('../../../helper/utilities.services')
const ProfileLevelModel = require('../../profileLevel/model')
const UserModel = require('../model')
const UserProfileLevelModel = require('./model')
const CommonRuleModel = require('../../commonRules/model')
const oUserProfileLevelServices = {}

oUserProfileLevelServices.calculateXP = async ({ nSpent = 0 }) => {
  try {
    const oXPCommonRule = await CommonRuleModel.findOne({ eRule: 'XPS', eStatus: enums?.eStatus?.map?.ACTIVE }).lean()
    if (!oXPCommonRule) return { success: false, message: 'XP common rule not found' }
    const nXP = Math.floor((oXPCommonRule?.nXP * nSpent) / oXPCommonRule?.nAmount)
    return nXP
  } catch (error) {
    return handleCatchError(error)
  }
}

const getAffectedProfileLevel = async ({ nLevel, oUserCriteria, oPreviousProfileLevel, eDirections = enums?.eDirections?.map?.UP }) => {
  try {
    const oProfileLevel = await ProfileLevelModel.findOne({ eStatus: enums?.eStatus?.map?.ACTIVE, nLevel }).lean()
    if (!oProfileLevel) return oPreviousProfileLevel
    const bIsCriteriaFulfilled = oProfileLevel?.oCriteria?.nMinXP < oUserCriteria?.nMinXP
    if (!bIsCriteriaFulfilled) return oPreviousProfileLevel
    const nNextLevel = eDirections === enums?.eDirections?.map?.UP ? nLevel + 1 : nLevel - 1
    return getAffectedProfileLevel({ nLevel: nNextLevel, oUserCriteria, oPreviousProfileLevel: oProfileLevel })
  } catch (error) {
    return handleCatchError(error)
  }
}

oUserProfileLevelServices.updateUserProfileLevel = async ({ iUserId, nXP = 0 }) => {
  try {
    // FIND USER XP
    const nXPPoints = nXP
    const oCurrentUserProfileLevel = await UserProfileLevelModel.findOne({ iUserId, eStatus: enums?.eStatus?.map?.ACTIVE }).populate({ path: 'oProfileLevel', select: ['nLevel', 'sName'], match: { eStatus: enums?.eStatus?.map?.ACTIVE } }).lean()
    let oCurrentProfileLevel = null
    // const oPreviousProfileLevel = null
    if (!oCurrentUserProfileLevel) {
      const oProfileLevel = await ProfileLevelModel.findOne({ nLevel: 1, eStatus: enums?.eStatus?.map?.ACTIVE }).lean()
      if (!oProfileLevel) return { success: false, message: 'Current level not found' }
      await UserProfileLevelModel.updateOne({
        iUserId,
        iProfileLevelId: oProfileLevel?._id
      }, {
        iUserId,
        iProfileLevelId: oProfileLevel?._id,
        nLevel: 1,
        oCriteriaCmp: { nMinXP: true },
        aLevelUpdateDetails: [
          {
            sType: 'nMinXP',
            oCriteria: { nMinXP: 0 },
            oFullFilledCriteria: { nMinXP: nXPPoints || 0 }
          }
        ],
        sHexCode: oProfileLevel?.sHexCode,
        eStatus: enums?.eStatus?.map?.ACTIVE
      }, { upsert: true })

      oCurrentProfileLevel = oProfileLevel
      console.log('nXPPoints profile level not found', nXPPoints, iUserId)
      await UserModel.updateOne({ _id: iUserId }, { iProfileLevelId: oProfileLevel?._id, nXPPoints: nXPPoints || 0 }, { readPreference: 'primary' })
      return { success: true, message: 'User profile level updated' }
    } else {
      const oProfileLevel = await ProfileLevelModel.findOne({ nLevel: oCurrentUserProfileLevel?.oProfileLevel?.nLevel, eStatus: enums?.eStatus?.map?.ACTIVE }).lean()
      if (!oProfileLevel) return { success: false, message: 'Current level not found' }
      oCurrentProfileLevel = oProfileLevel
    }

    // if (oCurrentProfileLevel?.nLevel > 1) {
    //   const oProfileLevel = await ProfileLevelModel.findOne({ nLevel: (oCurrentUserProfileLevel?.oProfileLevel?.nLevel - 1), eStatus: enums?.eStatus?.map?.ACTIVE }).lean()
    //   if (!oProfileLevel) return { success: false, message: 'Previous level not found' }
    //   oPreviousProfileLevel = oProfileLevel
    // }
    const bIsCriteriaFulfilled = nXPPoints >= oCurrentProfileLevel?.oCriteria?.nMinXP
    let oNextAffectedLevel = null
    if (!bIsCriteriaFulfilled) {
      // IF CURRENT LEVEL CRITERIA NOT FULFILLED THEN CHECK FOR PREVIOUS LEVEL

      // const bIsPreviousCriteriaFulfilled = nXPPoints > oPreviousProfileLevel?.oCriteria?.nMinXP
      // console.log('bIsPreviousCriteriaFulfilled', bIsPreviousCriteriaFulfilled)
      // if (bIsPreviousCriteriaFulfilled) return { success: true, message: 'User profile level already updated' }
      // oNextAffectedLevel = await getAffectedProfileLevel({
      //   nLevel: oPreviousProfileLevel?.nLevel - 1,
      //   oUserCriteria: { nMinXP: nXPPoints || 0 },
      //   oPreviousProfileLevel: oCurrentProfileLevel,
      //   eDirections: enums?.eDirections?.map?.DOWN
      // })
    } else {
      oNextAffectedLevel = await getAffectedProfileLevel({
        nLevel: oCurrentUserProfileLevel?.oProfileLevel?.nLevel + 1,
        oUserCriteria: { nMinXP: nXPPoints },
        oPreviousProfileLevel: oCurrentProfileLevel,
        eDirections: enums?.eDirections?.map?.UP
      })
    }

    const oUpdateResponse = await UserProfileLevelModel.updateMany({ iUserId, eStatus: enums?.eStatus?.map?.ACTIVE }, { eStatus: enums?.eStatus?.map?.INACTIVE })
    if (oUpdateResponse?.modifiedCount) {
      console.log('nXPPoints', nXPPoints)
      await UserModel.updateOne({ _id: iUserId }, { iProfileLevelId: oNextAffectedLevel?._id, nXPPoints: nXPPoints || 0 })
      await UserProfileLevelModel.updateOne({
        iUserId,
        iProfileLevelId: oNextAffectedLevel?._id
      }, {
        iUserId,
        iProfileLevelId: oNextAffectedLevel?._id,
        nLevel: oNextAffectedLevel?.nLevel,
        oCriteriaCmp: {
          nMinXP: nXPPoints >= oNextAffectedLevel?.oCriteria?.nMinXP
        },
        aLevelUpdateDetails: [
          {
            sType: 'nMinXP',
            oCriteria: oNextAffectedLevel?.oCriteria,
            oFullFilledCriteria: { nMinXP: nXPPoints }
          }
        ],
        eStatus: enums?.eStatus?.map?.ACTIVE
      }, { upsert: true })
      return { success: true, message: 'User profile level updated' }
    }
    return { success: false, message: 'Current active user profile level not updated' }
  } catch (error) {
    return handleCatchError(error)
  }
}

oUserProfileLevelServices.syncUserProfileLevelById = async (req, res) => {
  try {
    const { iUserId } = req.body
    const oResponse = await oUserProfileLevelServices.updateUserProfileLevel({ iUserId })
    if (oResponse?.success) {
      return res.status(jsonStatus.OK).jsonp({ status: jsonStatus.OK, message: oResponse?.message })
    } else {
      return res.status(jsonStatus.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: oResponse?.message })
    }
  } catch (error) {
    return handleCatchError(error)
  }
}

oUserProfileLevelServices.addXpUserProfitLevel = async (data) => {
  try {
    const { iUserId, nTotalSpent } = data
    const oUser = await UserModel.findOne({ _id: iUserId, eStatus: enums?.eStatus?.map?.ACTIVE }).lean()
    const nXp = await oUserProfileLevelServices.calculateXP({ nSpent: nTotalSpent })
    const oResult = await oUserProfileLevelServices.updateUserProfileLevel({ iUserId, nXP: convertToDecimal(nXp + oUser?.nXPPoints) })
    // console.log({ UserXP: oUser?.nXPPoints, nXp, nTotalSpent })
    if (!oResult?.success) return { success: false, message: 'User XP not updated' }
    return { success: true, message: 'User XP updated' }
  } catch (error) {
    handleCatchError(error)
  }
}

oUserProfileLevelServices.syncProfileLevelForAllUsers = async (req, res) => {
  try {
    const aUserList = await UserModel.find({ eStatus: enums?.eStatus?.map?.ACTIVE }).lean()
    aUserList?.forEach((oUserInfo) => {
      oUserProfileLevelServices.updateUserProfileLevel({ iUserId: oUserInfo?._id?.toString(), nXP: oUserInfo?.nXPPoints })
    })
    return res.status(jsonStatus.OK).jsonp({ status: jsonStatus.OK, message: 'User profile will sync in few minutes' })
  } catch (error) {
    return handleCatchError(error)
  }
}

module.exports = oUserProfileLevelServices
