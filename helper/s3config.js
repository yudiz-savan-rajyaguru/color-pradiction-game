const config = require('../config/config')
const { handleCatchError, generateNumber } = require('./utilities.services')
const { AWS_REGION } = require('../config/thirdPartyConfig')
const axios = require('axios')
const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { Upload } = require('@aws-sdk/lib-storage')

const s3Client = new S3Client({
  endpoint: config.AWS_BUCKET_ENDPOINT,
  region: AWS_REGION,
  credentials: { accessKeyId: config.AWS_ACCESS_KEY, secretAccessKey: config.AWS_SECRET_KEY }
})

async function signedUrl(sFileName, sContentType, path, eType) {
  try {
    sFileName = sFileName.replace('/', '-')
    sFileName = sFileName.replace(/\s/gi, '-')

    const fileKey = `${Date.now()}_${sFileName}`
    const s3Path = path

    const params = {
      Bucket: eType !== 'kyc' ? config.S3_BUCKET_NAME : config.S3_KYC_BUCKET_NAME,
      Key: s3Path + fileKey,
      ContentType: sContentType
    }

    const expiresIn = 300
    const command = new PutObjectCommand(params)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn })

    return { sUrl: signedUrl, sPath: s3Path + fileKey }
  } catch (error) {
    handleCatchError(error)
  }
}

async function deleteObject(s3Params) {
  try {
    const headCommand = new HeadObjectCommand(s3Params)
    const headResponse = await s3Client.send(headCommand)

    if (headResponse) {
      const deleteCommand = new DeleteObjectCommand(s3Params)
      const response = await s3Client.send(deleteCommand)
      return response
    }
  } catch (error) {
    handleCatchError(error)
  }
}

async function putObj(sFileName, sContentType, path, fileStream, deposition) {
  try {
    sFileName = sFileName.replace('/', '-')
    sFileName = sFileName.replace(/\s/gi, '-')

    let fileKey = ''
    const s3Path = path

    fileKey = `${Date.now()}_${sFileName}`

    const params = {
      Bucket: config.S3_KYC_BUCKET_NAME,
      Key: s3Path + fileKey,
      ContentType: sContentType,
      Body: fileStream
    }

    if (deposition) params.ContentDisposition = deposition

    const command = new PutObjectCommand(params)
    const response = await s3Client.send(command)

    response.key = params.Key
    response.Key = params.Key
    return response
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * Gives a s3 bukcket file upload URL and relative path
 * @param {*} url URL of image to upload in s3
 * @param {*} path s3 file upload path
 * @returns s3 image URL and relative path
 */
async function getS3ImageURL(url, path) {
  const response = { sSuccess: false, sUrl: '', sPath: '' }
  try {
    const imageURL = url

    let imageName = imageURL.substring(imageURL.lastIndexOf('/') + 1)
    imageName = (imageName.match(/[^.]+(\.[^?#]+)?/) || [])[0]

    const fileExtensionPattern = /(?:\.([a-z0-9]+)(?=[?#])|\.([a-z0-9]+))$/gi
    const fileExtension = imageName.match(fileExtensionPattern)[0]
    const fileName = generateNumber(100000, 999999).toString()
    const imagePath = path + fileName + fileExtension

    const response = await UploadFromUrlToS3(imageURL, imagePath)
    response.sSuccess = true
    response.sPath = imagePath
    response.sUrl = config.S3_BUCKET_URL + imagePath

    return response
  } catch (error) {
    handleCatchError(error)
    response.error = error
    return response
  }
}

async function UploadFromUrlToS3(url, destPath) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', responseEncoding: 'binary' })
    const params = {
      ContentType: res.headers['content-type'],
      ContentLength: res.headers['content-length'],
      Key: destPath,
      Body: res.data,
      Bucket: config.S3_BUCKET_NAME
    }

    const command = new PutObjectCommand(params)
    const response = await s3Client.send(command)

    return response
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * Generates a signed URL for accessing an object in an S3 bucket.
 * @param {Object} params - The parameters for generating the signed URL.
 * @returns {Promise<string>} - A signed URL that can be used to access the object.
 * @throws {Error} - If an error occurs while generating the signed URL.
 */
async function s3GetObjSignedUrl(params) {
  try {
    const command = new GetObjectCommand(params)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 })
    return url
  } catch (error) {
    handleCatchError(error)
  }
}

async function streamObject(Bucket, Key, ContentType, Body) {
  try {
    const params = { Bucket, Key, Body, ContentType }

    const uploader = new Upload({ client: s3Client, params })

    await uploader.done()
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = {
  signedUrl,
  deleteObject,
  putObj,
  getS3ImageURL,
  s3GetObjSignedUrl,
  streamObject
}
