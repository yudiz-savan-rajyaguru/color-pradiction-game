// @ts-check
const { messages, status } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, checkValidImageType, convertToDecimal, createResponse } = require('../../helper/utilities.services')
const config = require('../../config/config')
const bucket = require('../../helper/cloudStorage.services')

const PaymentOptionModel = require('./model')

class PaymentOption {
  /**
  * Retrieves a payment option based on the provided ID.
  * @param {object} req - Express request object.
  * @param {object} res - Express response object.
  */
  async get(req, res) {
    try {
      const paymentOption = await PaymentOptionModel.findById(req.params.id).lean()
      if (!paymentOption) return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages?.[req.userLanguage]?.not_exist.replace('##', messages?.[req.userLanguage]?.cpaymentOption) })
      return res.status(status.OK).jsonp({ status: status.OK, message: messages?.[req.userLanguage]?.success?.replace('##', messages?.[req.userLanguage]?.cpaymentOption), data: paymentOption })
    } catch (error) {
      // Handle errors and return an appropriate response
      return catchError('PaymentOption.get', error, req, res)
    }
  }

  /**
   * Adds a new payment option.
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async add(req, res) {
    try {
      // Extract relevant fields from the request body
      req.body = pick(req.body, ['sName', 'nOrder', 'sImage', 'sOffer', 'eKey', 'bEnable', 'bIsFeePercent', 'nPlatformFee', 'nAutoCancelTimeFrame'])
      const { bIsFeePercent, nPlatformFee } = req.body

      // Validate platform fee percentage
      if (bIsFeePercent && nPlatformFee > 100) { return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages?.[req.userLanguage]?.invalid?.replace('##', messages?.[req.userLanguage]?.cPlatformFee) }) }

      // Create a new payment option
      const data = await PaymentOptionModel.create({ ...req.body })
      return res.status(status.OK).jsonp({ status: status.OK, message: messages?.[req.userLanguage]?.add_success?.replace('##', messages?.[req.userLanguage]?.snewPaymentOption), data })
    } catch (error) {
      catchError('PaymentOption.add', error, req, res)
    }
  }

  /**
   * Generates a signed URL for a payment option image upload.
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async getSignedUrl(req, res) {
    try {
      // Extract relevant fields from the request body
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body
      // Validate image type
      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages?.[req.userLanguage]?.invalid?.replace('##', messages?.[req.userLanguage]?.image) })

      // Generate a signed URL for the payment option image upload
      const data = await bucket.getSignedUrl({ sFileName, sContentType, path: config.S3PAYMENTOPTION })
      return res.status(status.OK).jsonp({ status: status.OK, message: messages?.[req.userLanguage]?.presigned_succ, data })
    } catch (error) {
      catchError('PaymentOption.getSignedUrl', error, req, res)
    }
  }

  /**
   * Retrieves a list of payment options (version 2).
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async listV2(req, res) {
    try {
      // Retrieve a list of payment options (excluding the 'sKey' field) in version 2 format
      const data = await PaymentOptionModel.find({}, { sKey: 0 }).lean()
      return res.status(status.OK).jsonp({ status: status.OK, message: messages?.[req.userLanguage].success?.replace('##', messages?.[req.userLanguage]?.cpaymentOption), data })
    } catch (error) {
      catchError('PaymentOption.listV2', error, req, res)
    }
  }

  /**
   * Retrieves a list of payment options for administrators.
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async adminList(req, res) {
    try {
      // Extract pagination and search parameters from the request query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      // Create a query based on search parameters
      const query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      // Retrieve paginated results of payment options for administrators
      const results = await PaymentOptionModel.find(query, {
        sName: 1,
        nOrder: 1,
        sImage: 1,
        eKey: 1,
        sOffer: 1,
        bEnable: 1,
        dCreatedAt: 1,
        nPlatformFee: 1,
        bIsFeePercent: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      // Retrieve the total count of payment options for administrators
      const total = await PaymentOptionModel.countDocuments({ ...query })

      // Respond with the paginated results and total count
      const data = [{ total, results }]
      return createResponse({ req, res, statusCode: status.OK, messageKey: messages.success, replacementKey: messages.cpaymentOption, data })
    } catch (error) {
      // Handle errors and return an appropriate response
      return catchError('PaymentOption.list', error, req, res)
    }
  }

  async adminListV1(req, res) {
    try {
      // Extract pagination and search parameters from the request query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      // Create a query based on search parameters
      const query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      // Retrieve paginated results of payment options for administrators
      let results = []

      // Retrieve the total count of payment options for administrators
      const total = await PaymentOptionModel.countDocuments({ ...query })
      const projection = {
        sName: 1,
        nOrder: 1,
        sImage: 1,
        eKey: 1,
        sOffer: 1,
        bEnable: 1,
        dCreatedAt: 1,
        nPlatformFee: 1,
        bIsFeePercent: 1
      }
      if (['true', true].includes(req.query.isFullResponse)) {
        results = await PaymentOptionModel.find(query, projection).sort(sorting).lean()
      } else {
        results = await PaymentOptionModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }

      // Respond with the paginated results and total count
      const data = { total, results }
      return res.status(status.OK).jsonp({ status: status.OK, message: messages?.[req.userLanguage].success?.replace('##', messages?.[req.userLanguage].cpaymentOption), data })
    } catch (error) {
      // Handle errors and return an appropriate response
      return catchError('PaymentOption.list', error, req, res)
    }
  }

  /**
   * Updates an existing payment option.
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async update(req, res) {
    try {
      // Extract relevant fields from the request body
      req.body = pick(req.body, ['sName', 'nOrder', 'sImage', 'sOffer', 'bEnable', 'bIsFeePercent', 'nPlatformFee', 'nAutoCancelTimeFrame'])

      const { sImage, bIsFeePercent, nPlatformFee } = req.body

      // Validate platform fee percentage
      if (bIsFeePercent && nPlatformFee > 100) return res.status(status.BadRequest).jsonp({ status: status.BadRequest, message: messages?.[req.userLanguage]?.invalid?.replace('##', messages?.[req.userLanguage]?.cPlatformFee) })

      // Update the payment option
      const data = await PaymentOptionModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      // Handle if the payment option is not found
      if (!data) return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages?.[req.userLanguage]?.not_exist?.replace('##', messages?.[req.userLanguage]?.cpaymentOption) })

      // Prepare S3 parameters for image deletion
      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: data.sImage
      }

      let paymentOption

      // Delete the old image from the S3 bucket if the image is updated
      if (s3Params && data.sImage !== sImage) {
        paymentOption = await bucket.deleteObject(s3Params)
      }
      return res.status(status.OK).jsonp({ status: status.OK, message: messages?.[req.userLanguage]?.update_success?.replace('##', messages?.[req.userLanguage]?.cpaymentOption), data: paymentOption || data })
    } catch (error) {
      catchError('PaymentOption.update', error, req, res)
    }
  }

  /**
   * Calculates the platform fee for a given amount and payment option.
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async calculatePlatformFee(req, res) {
    try {
      const { nAmount } = req.body
      // Retrieve the payment option by ID
      const paymentOption = await PaymentOptionModel.findById(req.params.id).lean()
      // Handle if the payment option is not found
      if (!paymentOption) return res.status(status.NotFound).jsonp({ status: status.NotFound, message: messages?.[req.userLanguage]?.not_found?.replace('##', messages?.[req.userLanguage]?.cpaymentOption) })

      const { bIsFeePercent = true, nPlatformFee = 0 } = paymentOption

      let nPlatformFeeValue = 0
      let nActualAmount = parseFloat(nAmount)
      // Calculate the platform fee based on the payment option settings
      if (bIsFeePercent) {
        nPlatformFeeValue = convertToDecimal(parseInt(nPlatformFee) * nAmount / 100)
      } else {
        nPlatformFeeValue = parseInt(nPlatformFee)
      }
      // Calculate the actual amount after deducting the platform fee
      nActualAmount = convertToDecimal(nAmount - nPlatformFeeValue)

      // Respond with the calculated platform fee and actual amount
      return res.status(status.OK).jsonp({ status: status.OK, message: messages?.[req.userLanguage]?.success?.replace('##', messages?.[req.userLanguage]?.cPlatformFee), data: { nPlatformFee: nPlatformFeeValue, nActualAmount } })
    } catch (error) {
      return catchError('UserDeposit.calculatePlatformFee', error, req, res)
    }
  }
}

module.exports = new PaymentOption()
