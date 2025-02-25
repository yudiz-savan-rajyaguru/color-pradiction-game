const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob')

const config = require('../config/config')
const { handleCatchError } = require('../helper/utilities.services')
const sharedKeyCredential = new StorageSharedKeyCredential(config.AZURE_ACCOUNT_NAME, config.AZURE_ACCOUNT_KEY)
const blobServiceClient = new BlobServiceClient(`https://${config.AZURE_ACCOUNT_NAME}.blob.core.windows.net`, sharedKeyCredential)
const containerClient = blobServiceClient.getContainerClient(config.AZURE_STORAGE_CONTAINER_NAME)

/**
 * Generates a Shared Access Signature (SAS) URL for a file to be stored in Azure Blob Storage.
 * @param {string} sFileName - The name of the file.
 * @param {string} path - The path where the file will be stored.
 * @returns {Object} An object containing the SAS URL and the path of the file in the storage.
 */
function sasUrl(sFileName, path) {
  try {
    // Replace slashes and spaces in the file name with hyphens
    sFileName = sFileName.replace('/', '-')
    sFileName = sFileName.replace(/\s/gi, '-')

    // Generate a unique key for the file
    const fileKey = `${Date.now()}_${sFileName}`

    // Set the expiry time for the SAS URL
    const dExpiry = new Date()
    dExpiry.setSeconds(dExpiry.getSeconds() + 300)

    // Get a block blob client for the file
    const blockBlobClient = containerClient.getBlockBlobClient(fileKey)

    // Generate the SAS query parameters
    const blobSAS = generateBlobSASQueryParameters({
      containerName: config.AZURE_STORAGE_CONTAINER_NAME,
      blobName: path + fileKey,
      permissions: BlobSASPermissions.parse('w'),
      startsOn: new Date(),
      expiresOn: dExpiry
    }, sharedKeyCredential
    ).toString()

    // Generate the SAS URL
    const sUrl = `${blockBlobClient.url}?${blobSAS}`

    // Return the SAS URL and the path of the file in the storage
    return { sUrl, sPath: path + fileKey }
  } catch (error) {
    // Handle any errors that occur during the process
    handleCatchError(error)
    return error
  }
}

module.exports = {
  sasUrl
}
