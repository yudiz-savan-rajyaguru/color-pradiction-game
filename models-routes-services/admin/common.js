const CredentialModel = require('./credential.model')
const { CACHE_2 } = require('../../config/config')

async function findCredential(query = {}, projection = {}) {
  try {
    // Find a CredentialModel entry matching the query and projection, then cache the result
    const credential = await CredentialModel.findOne(query, projection).lean()
    // .cache(CACHE_2, 'credential:PAY')

    // Return the found credential data
    return credential
  } catch (error) {
    throw new Error(error) // Rethrow the error to allow the caller to handle it
  }
}

module.exports = {
  findCredential
}
