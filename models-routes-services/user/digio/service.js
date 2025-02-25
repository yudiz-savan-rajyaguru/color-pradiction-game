// @ts-check
const { default: axios } = require('axios')
const { DIGIO_CLIENT_ID, DIGIO_SECRET, DIGIO_BASE_URL, DIGIO_WORKFLOW_NAME, CACHE_6 } = require('../../../config/defaultConfig')
const DigioModel = require('./model')
const enums = require('../../../data')
const { putObj } = require('../../../helper/s3config')
const KYCModel = require('../../kyc/model')
const { S3_KYC_AADHAAR, S3_KYC_PAN } = require('../../../config/thirdPartyConfig')
const UserModel = require('../model')
const { jsonStatus, messages } = require('../../../helper/api.responses')
const { isValidObjectId } = require('mongoose')
const { queuePush } = require('../../../helper/redis')
const CommonModel = require('../../common/model')

const oDigioService = {}
const auth = 'Basic ' + Buffer.from(`${DIGIO_CLIENT_ID}:${DIGIO_SECRET}`).toString('base64')

oDigioService.startKYC = async (req, res) => {
  try {
    const { _id } = req.user
    const oCommon = await CommonModel.findOne({ eType: 'L' }).lean()
    // .cache(CACHE_6, 'LOGO')
    const oUserDetails = await UserModel.findOne({ _id, eStatus: 'Y' }).lean()
    if (!oUserDetails) return res.status(404).json({ status: jsonStatus?.NotFound, message: messages[req.userLanguage]?.user_not_found })
    UserModel.filterDataForUser(oUserDetails)
    const response = await oDigioService.invokeDigioWorkflow({ _id: oUserDetails?._id?.toString(), sMobile: oUserDetails?.sMobNum, sName: oUserDetails?.sUsername })
    await UserModel.updateOne({ _id: oUserDetails?._id }, { eKYCStatus: 's', dKYCStartedAt: new Date().toISOString() }).lean()
    return res.status(200).json({ status: jsonStatus?.OK, message: messages[req.userLanguage]?.kyc_started, data: { KID: response?.id, ...response, sLogo: oCommon?.sUrl !== '' || oCommon?.sUrl !== undefined ? oCommon?.sUrl : 'logo/1726134151292_logo.png' } })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Something went wrong' })
  }
}

const getFileNameFromHeader = (sHeader = '') => {
  const filenameMatch = sHeader.match(/filename="?(.+)"?/i)
  if (filenameMatch) {
    return filenameMatch[1]
  }
  return ''
}

oDigioService.fetchDocuments = async ({ RID, sDocType, iRefId, sPath, sContentType = 'application/pdf' }) => {
  try {
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${DIGIO_BASE_URL}/client/kyc/v2/media/${RID}?doc_type=${sDocType}`,
      headers: {
        Authorization: auth
      },
      responseType: 'arraybuffer'
    }
    const oResponse = (await axios.request(config))
    const contentDisposition = oResponse?.headers?.['content-disposition']
    const sFileName = getFileNameFromHeader(contentDisposition)
    const sAppliedContentType = enums?.eDocumentContentType?.[sFileName?.split('.')?.pop()?.toUpperCase()] || sContentType
    const oDocumentResponse = oResponse?.data
    const oFileResponse = await putObj(`${iRefId}_${sDocType}`, sAppliedContentType, sPath, oDocumentResponse)
    return oFileResponse
  } catch (error) {
    console.log(error)
    throw error
  }
}

oDigioService.invokeDigioWorkflow = async ({ sMobile, sName, _id }) => {
  try {
    const oPayload = {
      customer_identifier: sMobile,
      customer_name: sName,
      template_name: DIGIO_WORKFLOW_NAME,
      notify_customer: false,
      expire_in_days: 1,
      generate_access_token: true,
      reference_id: _id
    }

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${DIGIO_BASE_URL}/client/kyc/v2/request/with_template`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth
      },
      data: oPayload
    }
    const response = await axios.request(config)
    return response?.data
  } catch (error) {
    console.log(error)
    throw error
  }
}

oDigioService.getVerificationInfo = async ({ KID }) => {
  try {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${DIGIO_BASE_URL}/client/kyc/v2/${KID}/response`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth
      }
    }
    const oKycResponse = (await axios.request(config))?.data
    const ACTION_TYPES = {
      DIGI_LOCKER: 'digilocker',
      IMAGE: 'image'
    }
    let bIsRejected = false
    const oKYCPayload = { iUserId: oKycResponse?.reference_id }
    for (const oActions of (oKycResponse?.actions || [])) {
      switch (oActions?.type) {
        case ACTION_TYPES?.DIGI_LOCKER:
          if (['approved', 'skipped']?.includes(oActions?.status)) {
            const RID = oKycResponse?.actions?.[0]?.execution_request_id
            if (!RID) throw new Error('Media ID not found')
            if (oActions?.details?.aadhaar) {
              const oAadharDetails = oActions?.details?.aadhaar
              const oAadharResponse = await oDigioService.fetchDocuments({ RID, sDocType: 'AADHAAR', iRefId: oKycResponse?.reference_id, sPath: S3_KYC_AADHAAR })
              oKYCPayload.oAadhaar = {
                sNo: oAadharDetails?.id_number,
                sFrontImage: oAadharResponse?.key,
                eDocumentType: enums?.eDocumentType?.map?.PDF,
                sBackImage: '',
                eStatus: 'A',
                dCreatedAt: new Date().toISOString(),
                dUpdatedAt: new Date().toISOString()
              }
              if (oActions?.details?.pan) {
                const oPanDetails = oKycResponse?.actions?.[0]?.details?.pan
                const oPanResponse = await oDigioService.fetchDocuments({ RID, sDocType: 'PAN', iRefId: oKycResponse?.reference_id, sPath: S3_KYC_PAN })
                const isAlreadyExists = await KYCModel.countDocuments({ iUserId: { $ne: oKycResponse?.reference_id }, 'oPan.sNo': oPanDetails?.id_number }).lean()
                if (isAlreadyExists) {
                  oKYCPayload.oPan = {
                    sNo: oPanDetails?.id_number,
                    eStatus: 'R',
                    sImage: oPanResponse?.key,
                    eDocumentType: enums?.eDocumentType?.map?.PDF,
                    sName: oPanDetails?.name,
                    dCreatedAt: new Date().toISOString(),
                    dUpdatedAt: new Date().toISOString()
                  }
                  bIsRejected = true
                } else {
                  oKYCPayload.oPan = {
                    sNo: oPanDetails?.id_number,
                    eStatus: 'A',
                    sImage: oPanResponse?.key,
                    eDocumentType: enums?.eDocumentType?.map?.PDF,
                    sName: oPanDetails?.name,
                    dCreatedAt: new Date().toISOString(),
                    dUpdatedAt: new Date().toISOString()
                  }
                }
              }
            }
          }
          break
        case ACTION_TYPES?.IMAGE:
          if (oActions?.status === 'approved') {
            const oImageResponse = oActions?.id_card_data_response
            const RID = oActions?.file_id
            const oPanResponse = await oDigioService.fetchDocuments({
              RID,
              sDocType: 'PAN',
              iRefId: oKycResponse?.reference_id,
              sPath: S3_KYC_PAN,
              sContentType: enums?.eDocumentContentType?.map?.JPEG
            })

            if (oImageResponse?.id_type === 'PAN') {
              const isAlreadyExists = await KYCModel.countDocuments({ iUserId: { $ne: oKycResponse?.reference_id }, 'oPan.sNo': oImageResponse?.id_no }).lean()
              if (isAlreadyExists) {
                oKYCPayload.oPan = {
                  sNo: oImageResponse?.id_no,
                  eStatus: 'R',
                  sImage: oPanResponse?.key,
                  eDocumentType: enums?.eDocumentType?.map?.IMAGE,
                  sName: oImageResponse?.name,
                  dCreatedAt: new Date().toISOString(),
                  dUpdatedAt: new Date().toISOString()
                }
                bIsRejected = true
              } else {
                oKYCPayload.oPan = {
                  sNo: oImageResponse?.id_no,
                  eStatus: 'A',
                  sImage: oPanResponse?.key,
                  eDocumentType: enums?.eDocumentType?.map?.IMAGE,
                  sName: oImageResponse?.name,
                  dCreatedAt: new Date().toISOString(),
                  dUpdatedAt: new Date().toISOString()
                }
              }
            }
          }
          break
        default:
          break
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      await DigioModel.create({
        webhook: {
          KYCResponse: true,
          oKycResponse
        }
      })
    }

    if (isValidObjectId(oKycResponse?.reference_id)) {
      const oUpdateData = !bIsRejected ? { eKYCStatus: 'c' } : { eKYCStatus: 'r', sKYCRejectReason: 'Duplicate PAN/Aadhar card found' }
      await Promise.all([
        KYCModel.updateOne({ iUserId: oKycResponse?.reference_id }, oKYCPayload, { upsert: true }),
        UserModel.updateOne({ _id: oKycResponse?.reference_id }, oUpdateData)
      ])
      queuePush('pushNotification:KYC', { iUserId: oKycResponse?.reference_id, eStatus: !bIsRejected ? 'A' : 'R' })
    }
    return oKycResponse
  } catch (error) {
    console.log(error)
  }
}

oDigioService.webhook = async (req, res) => {
  try {
    const sEventName = req?.body?.event
    switch (sEventName) {
      case enums?.eDigioEvents?.['kyc.request.approved']:
        for (const sVerificationEntity of (req?.body?.entities || [])) {
          if (sVerificationEntity === enums?.eDigioEvents?.kyc_request) {
            const KID = req?.body?.payload?.[sVerificationEntity]?.id
            if (KID) await oDigioService.getVerificationInfo({ KID })
          }
        }
        break
      case enums?.eDigioEvents?.['kyc.request.created']:
        {
          const iUserId = req?.body?.payload?.kyc_request?.reference_id
          if (isValidObjectId(iUserId)) await UserModel.updateOne({ _id: iUserId }, { eKYCStatus: 's' })
          // Change KYC status to Started here
        }
        break
      default:
        break
    }
    if (process.env.NODE_ENV !== 'production') {
      await DigioModel.create({
        webhook: req.body
      })
    }
    return res.status(200).json({ message: 'Webhook received successfully' })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Something went wrong' })
  }
}

module.exports = oDigioService
