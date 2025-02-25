const axios = require('axios')

const config = require('../config/config')
const { smsProvider } = require('../data')

const { handleCatchError, generateNumber } = require('./utilities.services')

/**
 * to send otp to user from various providers
 * @param  {string} sProvider, SMS provider name
 * @param  {object} => {sPhone, sOTP}
 * sPhone= user's phone number, sOTP= OTP to send on it
 * @return {object} => {isSuccess, message}
 */
const sendOTPFromProvider = async (sProvider, oUser) => {
  try {
    if (!smsProvider.includes(sProvider)) throw new Error(`Provider ${sProvider} does not exist`)
    let data
    if (sProvider === 'MSG91') data = await msg91SendOrVerifyOTP('send', oUser)

    if (!data || !data.isSuccess) return { isSuccess: false }
    return data
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * The function `verifyOTPFromProvider` verifies the OTP (One-Time Password) from a specified provider
 * for a given user.
 * @param sProvider - The `sProvider` parameter is a string that represents the name of the SMS
 * provider. It is used to determine which provider's API should be used to verify the OTP (One-Time
 * Password).
 * @param oUser - The parameter `oUser` is an object that contains user information. It could include
 * properties such as `phoneNumber`, `otp`, `apiKey`, etc., depending on the requirements of the
 * `msg91SendOrVerifyOTP` function.
 * @returns The function `verifyOTPFromProvider` returns an object with the property `isSuccess`. If
 * the condition `if (!data || !data.isSuccess)` is true, then the returned object will have
 * `isSuccess` set to `false`. Otherwise, it will return the `data` object.
 */
const verifyOTPFromProvider = async (sProvider, oUser) => {
  try {
    if (!smsProvider.includes(sProvider)) throw new Error(`Provider ${sProvider} does not exist`)
    let data

    if (sProvider === 'MSG91') data = await msg91SendOrVerifyOTP('verify', oUser)

    if (!data || !data.isSuccess) return { isSuccess: false }
    return data
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

/**
 * The function generates a random OTP (One-Time Password) of a specified length.
 * @param nLength - The parameter `nLength` represents the length of the OTP (One-Time Password) that
 * you want to generate.
 * @returns The function `generateOTP` returns a string representing a randomly generated OTP (One-Time
 * Password) of the specified length `nLength`.
 */
const generateOTP = (nLength) => {
  const digits = '0123456789'
  let OTP = ''
  for (let i = 0; i < nLength; i++) {
    OTP += digits[generateNumber(0, 10)]
  }
  if (Number(OTP).toString().length !== nLength) {
    return generateOTP(nLength)
  }
  return OTP
}

/**
 * The function `msg91SendOrVerifyOTP` is an asynchronous function that sends or verifies an OTP
 * (One-Time Password) using the Msg91 API.
 * @param [sAction] - The `sAction` parameter is a string that specifies the action to be performed. It
 * can have two possible values:
 * @param oUser - The `oUser` parameter is an object that contains the following properties:
 * @returns an object with properties `isSuccess` and `message`.
 */
async function msg91SendOrVerifyOTP(sAction = '', oUser) {
  try {
    const { sPhone, sOTP } = oUser
    if (!sPhone || !sOTP || !sAction) throw new Error('Invalid details')

    if (sAction === 'send') {
      try {
        const response = await axios.get('https://api.msg91.com/api/v5/otp', {
          params:
                  {
                    template_id: config.MSG91_TEMPLATE_ID,
                    mobile: `91${sPhone}`,
                    authkey: config.MSG91_AUTH_KEY,
                    otp: sOTP
                  }
        })
        if (!response || response.data.type !== 'success') return { isSuccess: false, message: response.data.message || response.data }
        return { isSuccess: true, message: 'OTP sent successfully!' }
      } catch (error) {
        handleCatchError(error)
      }
    } else if (sAction === 'verify') {
      try {
        const response = await axios.get('https://api.msg91.com/api/v5/otp/verify', {
          params:
                      {
                        mobile: `91${sPhone}`,
                        authkey: config.MSG91_AUTH_KEY,
                        otp: sOTP
                      }
        })
        if (!response || response.data.type !== 'success') return { isSuccess: false, message: response.data.message || response.data }

        const data = response.data && response.data.type === 'success'
          ? { isSuccess: true, message: 'OTP verified successfully!' }
          : { isSuccess: false, message: 'OTP verification failed!' }

        return data
      } catch (error) {
        handleCatchError(error)
      }
    } else {
      return { isSuccess: false, message: 'Invalid action!' }
    }
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = {
  verifyOTPFromProvider,
  generateOTP,
  sendOTPFromProvider
}
