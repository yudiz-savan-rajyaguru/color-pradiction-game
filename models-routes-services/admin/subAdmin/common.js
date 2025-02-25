const bcrypt = require('bcryptjs')

const { status, messages, jsonStatus } = require('../../../helper/api.responses')
const { checkAlphanumeric, validateMobile } = require('../../../helper/utilities.services')
const RolesModel = require('../roles/model')

/**
 * Validates various fields in the request body.
 * @param {*} req - Express request object.
 * @param {*} res - Express response object to send the response.
 * @param {*} body - Request body containing fields to be validated.
 * @returns {Promise} - A promise that resolves with an object containing roles if validation is successful,
 *                     or rejects with an error if validation fails.
 */
async function validateFields(req, res, body) {
  // Destructure fields from the request body.
  const { aRole, roleCount, subadmin, sUsername, sMobNum, sPassword } = body
  // Validate the number of roles against the specified role count.
  const roleLength = aRole.length
  if (roleLength > roleCount) {
    return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].roles) })
  }

  // Check if the provided password is the same as the subadmin's password.
  if (sPassword) {
    const isSamePassword = bcrypt.compareSync(sPassword, subadmin.sPassword)
    if (isSamePassword) {
      return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].old_new_field_same.replace('##', messages[req.userLanguage].cpassword) })
    }
  }

  // Validate that the username is alphanumeric.
  if (sUsername && !checkAlphanumeric(sUsername)) {
    return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].must_alpha_num })
  }

  // Validate the mobile number.
  if (sMobNum && validateMobile(sMobNum)) {
    return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].mobileNumber) })
  }

  // Find roles in the RolesModel based on provided role IDs.
  const roles = await RolesModel.find({ _id: { $in: aRole }, eStatus: 'Y' }, { _id: 1, aPermissions: 1, sName: 1 }).lean()

  // If no valid roles are found, respond with a not found status and message.
  if (!roles.length) {
    return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].do_not_exist.replace('##', messages[req.userLanguage].croles) })
  }
  // Resolve with the validated roles.
  return { roles }
}

module.exports = {
  validateFields
}
