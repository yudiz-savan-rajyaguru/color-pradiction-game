const { messages, jsonStatus } = require('../helper/api.responses')
const { decryptValue } = require('../helper/utilities.services')
const RolesModel = require('../models-routes-services/admin/roles/model')

/**
 * Checks if an admin has the required authorization.
 * @param {string} sKey - The key representing the resource to access.
 * @param {string} eType - The type of access required ('R' for read, 'W' for write, 'N' for none).
 * @param {Object} req - The request object, containing the admin's details.
 * @returns {Promise} A promise that resolves with an object containing the status and message, or rejects with an error.
 */
const checkAdminAuthorization = async(sKey, eType, req) => {
  // If the admin is a super admin, they have all permissions
  if (req.admin.eType === 'SUPER') {
    return { status: jsonStatus.OK, message: '' }
  } else {
    // If the admin does not have a role, they are unauthorized
    if (!req.admin.aRole) {
      return { status: jsonStatus.Unauthorized, message: messages[req.userLanguage].access_denied }
    }

    // Fetch the admin's roles from the database
    const role = await RolesModel.find({ _id: { $in: req.admin.aRole }, eStatus: 'Y' }, { aPermissions: 1 }).lean()
    if (!role.length) return { status: jsonStatus.Unauthorized, message: messages[req.userLanguage].access_denied }

    // Extract the permissions from the roles
    let aPermissions = role.map(role => role.aPermissions)
    aPermissions = [...aPermissions]?.flat()

    // Check if the admin has the required permission
    const hasPermission = aPermissions.find((permission) => {
      return (
        permission.sKey === sKey &&
            (permission.eType === eType ||
              (eType === 'R' && permission.eType === 'W'))
      )
    })

    // If the admin does not have the required permission, they are unauthorized
    if (!hasPermission) {
      let message
      switch (eType) {
        case 'R':
          message = messages[req.userLanguage].read_access_denied.replace('##', sKey)
          break
        case 'W':
          message = messages[req.userLanguage].write_access_denied.replace('##', sKey)
          break
        case 'N':
          message = messages[req.userLanguage].access_denied
          break
        default:
          message = messages[req.userLanguage].error
      }
      return { status: jsonStatus[401], message }
    }

    // If the admin has the required permission, they are authorized
    return { status: jsonStatus.OK, message: '' }
  }
}

/**
 * Decrypts a value if it is present.
 * @param {string} data - The data to decrypt.
 * @returns {string} The decrypted data if it was present, or the original data otherwise.
 */
const decryptValueIfPresent = (data) => {
  // If the data is present, decrypt it
  if (data) {
    return decryptValue(data)
  }
  // If the data is not present, return it as is
  return data
}

/**
 * Decrypts user information based on the given permissions.
 * @param {Array} usersList - The list of users whose information needs to be decrypted.
 * @param {boolean} allData - A flag indicating whether all data should be decrypted. If false, only the date of birth and address are decrypted.
 * @returns {Promise} A promise that resolves with the list of users with decrypted information, or rejects with an error.
 */
const decryptUserInfoAsPerPermission = (usersList, allData = true) => {
  return new Promise(function (resolve, reject) {
    try {
      // Map through each user in the list
      usersList = usersList.map(data => {
        // Decrypt the date of birth and address for each user
        data.dDob = decryptValueIfPresent(data.dDob)
        data.sAddress = decryptValueIfPresent(data.sAddress)

        // If the allData flag is false, clear the email, mobile number, and login
        // Otherwise, decrypt these values
        if (!allData) {
          data.sEmail = ''
          data.sMobNum = ''
          data.sLogin = ''
        } else {
          data.sEmail = decryptValueIfPresent(data.sEmail)
          data.sMobNum = decryptValueIfPresent(data.sMobNum)
          data.sLogin = decryptValueIfPresent(data.sLogin)
        }

        // Return the updated user data
        return data
      })

      // Resolve the promise with the updated users list
      resolve(usersList)
    } catch (error) {
      // If an error occurs, reject the promise with the error
      reject(error)
    }
  })
}

module.exports = {
  checkAdminAuthorization,
  decryptUserInfoAsPerPermission
}
