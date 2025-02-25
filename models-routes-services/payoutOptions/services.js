const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, checkValidImageType, convertToDecimal } = require('../../helper/utilities.services')
const config = require('../../config/config')
const bucket = require('../../helper/cloudStorage.services')

const PayoutOptionModel = require('./model')

class PayoutOption {
  /**
 * Retrieves payout option details by ID.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
  async get(req, res) {
    try {
      // Retrieve payout option by ID
      const payoutOption = await PayoutOptionModel.findById(req.params.id).lean()
      if (!payoutOption) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cpayoutOption) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpayoutOption), data: payoutOption })
    } catch (error) {
      return catchError('PayoutOption.get', error, req, res)
    }
  }

  /**
 * Adds a new payout option.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
  async add(req, res) {
    try {
      // Pick relevant properties from the request body
      req.body = pick(req.body, ['sTitle', 'eType', 'sImage', 'sInfo', 'eKey', 'bEnable', 'nWithdrawFee', 'nMinAmount', 'nMaxAmount', 'bIsFeePercent', 'nPlatformFee'])
      const { bIsFeePercent, nPlatformFee } = req.body

      // Validate fee percentage
      if (bIsFeePercent && nPlatformFee > 100) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cPlatformFee) })

      // Create a new payout option
      const data = await PayoutOptionModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].snewPayoutOption), data })
    } catch (error) {
      catchError('PayoutOption.add', error, req, res)
    }
  }

  /**
 * Retrieves a pre-signed URL for uploading a payout option image.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
  async getSignedUrl(req, res) {
    try {
      // Pick relevant properties from the request body
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      // Validate image type
      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      // Get pre-signed URL for uploading the image to the specified path
      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: config.S3PAYOUTOPTION })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('PayoutOption.getSignedUrl', error, req, res)
    }
  }

  /**
 * Retrieves a list of payout options.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
  async listV2(req, res) {
    try {
      // Retrieve a list of payout options
      const data = await PayoutOptionModel.find().lean()
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpayoutOption), data })
    } catch (error) {
      catchError('PayoutOption.listV2', error, req, res)
    }
  }

  /**
 * Retrieves a list of payout options for admin use with pagination and search functionality.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
  async adminList(req, res) {
    try {
      // Extract pagination and search parameters from the request query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      const query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      // Retrieve a paginated and sorted list of payout options for admin
      const results = await PayoutOptionModel.find(query, {
        sTitle: 1,
        eType: 1,
        sImage: 1,
        eKey: 1,
        sInfo: 1,
        bEnable: 1,
        dCreatedAt: 1,
        nWithdrawFee: 1,
        nMinAmount: 1,
        nMaxAmount: 1,
        nPlatformFee: 1,
        bIsFeePercent: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      // Calculate total number of matching documents
      const total = await PayoutOptionModel.countDocuments({ ...query })

      // Prepare response data
      const data = [{ total, results }]

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpayoutOption), data })
    } catch (error) {
      return catchError('PayoutOption.adminList', error, req, res)
    }
  }

  async adminListV1(req, res) {
    try {
      // Extract pagination and search parameters from the request query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      const query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      // Retrieve a paginated and sorted list of payout options for admin
      let results = []
      const projection = {
        sTitle: 1,
        eType: 1,
        sImage: 1,
        eKey: 1,
        sInfo: 1,
        bEnable: 1,
        dCreatedAt: 1,
        nWithdrawFee: 1,
        nMinAmount: 1,
        nMaxAmount: 1,
        nPlatformFee: 1,
        bIsFeePercent: 1
      }

      if (['true', true].includes(req.query.isFullResponse)) {
        results = await PayoutOptionModel.find(query, projection).sort(sorting).lean()
      } else {
        results = await PayoutOptionModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }

      // Calculate total number of matching documents
      const total = await PayoutOptionModel.countDocuments({ ...query })

      // Prepare response data
      const data = [{ total, results }]

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpayoutOption), data })
    } catch (error) {
      return catchError('PayoutOption.adminList', error, req, res)
    }
  }

  /**
 * Updates an existing payout option.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
  async update(req, res) {
    try {
      // Pick relevant properties from the request body
      req.body = pick(req.body, ['sTitle', 'eType', 'sImage', 'sInfo', 'eKey', 'bEnable', 'nWithdrawFee', 'nMinAmount', 'nMaxAmount', 'nPlatformFee', 'bIsFeePercent'])

      const { sImage, bIsFeePercent, nPlatformFee } = req.body

      if (bIsFeePercent && nPlatformFee > 100) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cPlatformFee) })

      // Update the existing payout option
      const data = await PayoutOptionModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpayoutOption) })

      // Prepare S3 parameters for deleting the old image
      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: data.sImage
      }

      let paymentOption
      if (s3Params && data.sImage && data.sImage !== sImage) {
        // Remove the old image from the S3 bucket as well
        paymentOption = await bucket.deleteObject(s3Params)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpayoutOptionDetails), data: paymentOption || data })
    } catch (error) {
      catchError('PayoutOption.update', error, req, res)
    }
  }

  /**
 * Calculates the platform fee for a payout option.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
  async calculatePlatformFee(req, res) {
    try {
      // Extract the amount from the request body
      const { nAmount } = req.body
      const payoutOption = await PayoutOptionModel.findById(req.params.id).lean()
      if (!payoutOption) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cpayoutOption) })

      // Extract fee-related properties from the payout option
      const { bIsFeePercent = true, nPlatformFee = 0 } = payoutOption

      let nPlatformFeeValue = 0
      let nActualAmount = parseFloat(nAmount)
      if (bIsFeePercent) {
        // Calculate platform fee as a percentage of the amount
        nPlatformFeeValue = convertToDecimal(parseInt(nPlatformFee) * nAmount / 100)
      } else {
        // Use a fixed platform fee
        nPlatformFeeValue = parseInt(nPlatformFee)
      }
      // Calculate the actual amount after deducting the platform fee
      nActualAmount = convertToDecimal(nAmount - nPlatformFeeValue)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cPlatformFee), data: { nPlatformFee: nPlatformFeeValue, nActualAmount } })
    } catch (error) {
      return catchError('UserDeposit.calculatePlatformFee', error, req, res)
    }
  }
}

module.exports = new PayoutOption()
