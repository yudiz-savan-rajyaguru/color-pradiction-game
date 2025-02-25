const path = require('path')

const { Storage } = require('@google-cloud/storage')

const config = require('../config/config')
const { handleCatchError } = require('../helper/utilities.services')
const storage = new Storage({ keyFilename: path.join(__dirname, './third-party-cred/gcsKey.json'), projectId: config.GCS_PROJECT_ID })

/**
 * Generates a signed URL for a file to be stored in Google Cloud Storage.
 * @param {string} sFileName - The name of the file.
 * @param {string} sContentType - The content type of the file.
 * @param {string} path - The path where the file will be stored.
 * @returns {Promise} A promise that resolves with an object containing the signed URL and the path of the file in the storage, or rejects with an error.
 */
async function signedUrl(sFileName, sContentType, path) {
  try {
    // Replace slashes and spaces in the file name with hyphens
    sFileName = sFileName.replace('/', '-')
    sFileName = sFileName.replace(/\s/gi, '-')

    // Generate a unique key for the file
    const fileKey = `${Date.now()}_${sFileName}`

    // Set the expiry time for the signed URL
    const dExpiry = new Date()
    dExpiry.setSeconds(dExpiry.getSeconds() + 300)

    // Define the options for the signed URL
    const options = {
      version: 'v4',
      action: 'write',
      expires: dExpiry,
      contentType: sContentType
    }

    // Get a signed URL from the GCS bucket
    const [url] = await storage
      .bucket(config.GCS_BUCKET_NAME)
      .file(path + fileKey)
      .getSignedUrl(options)

    // Return the signed URL and the path of the file in the storage
    return { sUrl: url, sPath: path + fileKey }
  } catch (error) {
    // Handle any errors that occur during the process
    handleCatchError(error)
    return error
  }
}

module.exports = {
  signedUrl
}
