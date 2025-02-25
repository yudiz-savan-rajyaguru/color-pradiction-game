const { findSettingV2 } = require('../../setting/services')

/**
 * Function to check the validity of a location.
 * @param {string} sLatitude - The latitude.
 * @param {string} sLongitude - The longitude.
 * @returns {Promise} A promise that resolves with a boolean indicating whether the location details are invalid and the status is active.
 */
async function checkLocationValidity(sLatitude, sLongitude) {
  const defaultSetting = await findSettingV2({ sKey: 'ALE' }, { eStatus: 1 })
  const isLocationDetailsInvalid = !sLatitude || !sLongitude
  const isStatusActive = defaultSetting?.eStatus === 'Y'
  return (isLocationDetailsInvalid && isStatusActive)
}

/**
 * Function to check the validity of a code.
 * @param {string} sCode - The code.
 * @returns {Promise} A promise that resolves with a boolean indicating whether the code is invalid.
 */
function checkCodeValidity(sCode) {
  return new Promise((resolve, reject) => {
    try {
      const isInvalidCode = isNaN(sCode)
      return resolve(isInvalidCode)
    } catch (error) {
      return reject(error)
    }
  })
}

module.exports = {
  checkLocationValidity,
  checkCodeValidity
}
