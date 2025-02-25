const config = require('../config/config')
const { handleCatchError } = require('../helper/utilities.services')

const s3Bucket = require('./s3config')
const gcsBucket = require('./gcsConfig')
const azureContainer = require('./azureConfig')

/**
 * Generates a signed URL for a file to be stored in a cloud storage provider.
 * The provider is determined by the CLOUD_STORAGE_PROVIDER configuration.
 * @param {Object} params - An object containing the file name, content type, and path.
 * @returns {Promise} A promise that resolves with the signed URL, or rejects with an error.
 */
async function getSignedUrl(params) {
  try {
    // Destructure the file name, content type, and path from the parameters
    const { sFileName, sContentType, path, eType = '' } = params

    let data
    // Determine the cloud storage provider
    switch (config.CLOUD_STORAGE_PROVIDER) {
      case 'AWS':
        // If the provider is AWS, get a signed URL from the S3 bucket
        data = await s3Bucket.signedUrl(sFileName, sContentType, path, eType)
        break
      case 'GC':
        // If the provider is Google Cloud, get a signed URL from the GCS bucket
        data = await gcsBucket.signedUrl(sFileName, sContentType, path)
        break
      case 'AZURE':
        // If the provider is Azure, get a SAS URL from the Azure container
        data = azureContainer.sasUrl(sFileName, path)
        break
      default:
        // If the provider is not specified, default to getting a signed URL from the S3 bucket
        data = await s3Bucket.signedUrl(sFileName, sContentType, path)
    }
    // Return the signed URL
    return data
  } catch (error) {
    // Handle any errors that occur during the process
    handleCatchError(error)
    return error
  }
}

/**
 * The function `getObjSignedUrl` retrieves a signed URL for an object from a cloud storage provider
 * (AWS, GC, or Azure) based on the configuration.
 * @param params - The `params` parameter is an object that contains the necessary information to
 * generate a signed URL for accessing an object in a cloud storage provider. The specific properties
 * of the `params` object will depend on the cloud storage provider being used.
 * @returns the signed URL for the object in the cloud storage provider specified in the
 * `config.CLOUD_STORAGE_PROVIDER` variable.
 */
async function getObjSignedUrl(params) {
  try {
    let data
    switch (config.CLOUD_STORAGE_PROVIDER) {
      case 'AWS':
        data = await s3Bucket.s3GetObjSignedUrl(params)
        break
      case 'GC':
        data = await gcsBucket.gcsGetObjSignedUrl(params)
        break
      case 'AZURE':
        data = await azureContainer.azureGetBlobSasUrl(params)
        break
      default:
        data = await s3Bucket.s3GetObjSignedUrl(params)
    }
    return data
  } catch (error) {
    handleCatchError(error)
    return error
  }
}

/**
 * The function `deleteObject` is an asynchronous function that deletes an object from a cloud storage
 * provider (AWS, GC, or Azure) based on the configuration and returns the result.
 * @param params - The `params` parameter is an object that contains the necessary information to
 * identify and delete the object. The specific properties of the `params` object will depend on the
 * cloud storage provider being used.
 * @returns the `data` variable, which contains the result of the delete operation from the cloud
 * storage provider. If an error occurs, it will be caught and handled by the `handleCatchError`
 * function, and the error object will be returned.
 */
async function deleteObject(params) {
  try {
    let data
    switch (config.CLOUD_STORAGE_PROVIDER) {
      case 'AWS':
        data = await s3Bucket.deleteObject(params)
        break
      case 'GC':
        data = await gcsBucket.deleteObject(params)
        break
      case 'AZURE':
        data = await azureContainer.deleteBlob(params)
        break
      default:
        data = await s3Bucket.deleteObject(params)
    }
    return data
  } catch (error) {
    handleCatchError(error)
    return error
  }
}

module.exports = {
  getSignedUrl,
  getObjSignedUrl,
  deleteObject
}
