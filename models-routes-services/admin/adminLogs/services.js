const { getPaginationValues2, catchError, decryptValuePromise, decryptIfExist, maskIfExist, searchRegExp, mongify } = require('../../../helper/utilities.services')
const { decryption } = require('../../../middlewares/middleware')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { checkAdminAuthorization } = require('../../../helper/authorization')
const { processAdminLog } = require('../../queue/adminQueue')
const { findUsers } = require('../../user/auth/services')
const LocationModel = require('./location.model')
const AdminLogModel = require('./logs.model')
const { isValidObjectId } = require('mongoose')

class AdminLogs {
  /**
   * Fetches the admin league logs from the database.
   * @param {Object} req - The request object, containing search parameters, sorting criteria, and pagination limits.
   * @param {Object} res - The response object, used to send the HTTP response with league logs data.
   * @returns {Array} An array of admin league logs, each log containing details about the league, the admin who handled it, and the changes made.
   */
  async getAdminLeagueLogs(req, res) {
    try {
      // Extracting pagination values from the request query
      const { start, limit, sorting } = getPaginationValues2(req.query)

      // Extracting admin ID from the request admin object
      const { _id: iAdminId } = req.admin

      // Extracting additional query parameters
      const { datefrom, dateto } = req.query

      // Building the initial query based on the provided parameters
      let query = {
        eKey: { $in: ['L'] },
        $or: [
          {
            'oOldFields._id': mongify(req.params.id)
          }, {
            'oNewFields._id': mongify(req.params.id)
          }
        ]
      }

      // Adding optional parameters to the query if present
      query = iAdminId ? { ...query, iAdminId: mongify(iAdminId) } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: datefrom, $lte: dateto } } : query

      // Fetching logs data and total count concurrently
      const [logsData, total] = await Promise.all([
        AdminLogModel.find(query, {
          eKey: 1,
          iUserId: 1,
          oOldFields: 1,
          oNewFields: 1,
          oDetails: 1,
          sIP: 1,
          iAdminId: 1,
          dCreatedAt: 1
        })
          .sort(sorting)
          .skip(Number(start))
          .limit(Number(limit))
          .populate('iAdminId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eStatus', 'dLoginAt', 'eType'])
          .lean(),
        AdminLogModel.countDocuments(query)
      ])

      // Decrypting email promises for each log entry
      const decEmailPromises = logsData
        .map(data => data.iAdminId && data.iAdminId.sEmail ? decryptValuePromise(data.iAdminId.sEmail) : null)

      // Resolving all decryption promises concurrently
      const decEmails = await Promise.all(decEmailPromises)

      // Updating logsData with decrypted email values
      for (let i = 0; i < logsData.length; i++) {
        const data = logsData[i]
        if (data.iAdminId && data.iAdminId.sEmail) {
          data.iAdminId = { ...data.iAdminId, sEmail: decEmails[i] }
        }
      }

      // Creating the final response data
      const aResults = logsData && Array.isArray(logsData) ? logsData : []
      const nTotal = total || 0

      const data = { nTotal, aResults }

      // Sending the response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cLeagueLogs), data })
    } catch (error) {
      // Handling errors and logging
      catchError('League.getAdminLeagueLogs', error, req, res)
    }
  }

  /**
 * Retrieves the logs of creation or update performed by the admin.
 * @param {*} req - The request object containing searching, sorting, and limit parameters.
 * @param {*} res - The response object containing the response code and admin logs data.
 * @returns {Array} - The logs of creation or update performed by the admin.
 */
  async AdminLogsV2(req, res) {
    try {
      // Extracting parameters from the request query
      const { nStart = 0, nLimit = 10, order, search, operation, datefrom, dateto, iAdminId } = req.query

      // Determining the sorting order based on the provided 'order' parameter
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { dCreatedAt: orderBy }

      // Building the initial query based on the provided parameters
      let query = iAdminId ? { iAdminId: mongify(iAdminId) } : {}

      query = operation ? { ...query, eKey: operation } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      // If a search query is provided, adding additional parameters to the query
      if (search) {
        const userQuery = await getQueryValues(operation, search)
        query = { ...query, ...userQuery }
      }

      // Fetching list and total count concurrently
      const [list, nTotal] = await Promise.all([
        AdminLogModel
          .find(query, {
            eKey: 1,
            iUserId: 1,
            'oOldFields.sName': 1,
            oDetails: 1,
            sIP: 1,
            iAdminId: 1,
            dCreatedAt: 1,
            sLatitude: 1,
            sLongitude: 1
          })
          .sort(sorting)
          .skip(Number(nStart))
          .limit(Number(nLimit))
          .populate('iAdminId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eStatus', 'dLoginAt', 'eType'])
          .lean(),
        AdminLogModel.countDocuments(query)
      ])

      const aUserId = []
      const promises = []

      // Decrypting admin email promises for each log entry or setting 'CRON' as admin type
      for (const log of list) {
        if (log.iUserId) aUserId.push(log.iUserId)
        if (log.iAdminId) {
          const decEmailPromise = log.iAdminId.sEmail ? decryptValuePromise(log.iAdminId.sEmail) : null
          promises.push(decEmailPromise)
        } else {
          log.iAdminId = { sName: log?.oDetails?.sOperationBy, eType: 'CRON' }
        }
      }

      // Resolving all decryption promises concurrently
      const decryptedEmails = await Promise.all(promises)

      // Updating list with decrypted email values
      let i = 0
      for (const log of list) {
        if (log.iAdminId && log.iAdminId.sEmail) {
          log.iAdminId.sEmail = decryptedEmails[i]
          i++
        }
      }

      if (aUserId.length) {
        // Checking admin authorization
        const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)

        // Fetching users based on the user IDs
        const aUsers = await findUsers({ _id: { $in: aUserId } }, { _id: 1, sName: 1, sUsername: 1, sEmail: 1, sProPic: 1, eType: 1 })

        // Creating a user lookup object for efficient searching
        const userLookup = aUsers.reduce((acc, user) => {
          acc[user._id.toString()] = user
          return acc
        }, {})

        // Updating list with user data based on user ID
        const promises = list.map(async (p) => {
          if (p.iUserId) {
            const iUserId = userLookup[p.iUserId.toString()]
            if (iUserId) {
              if (response.status === 200) {
                iUserId.sEmail = iUserId.sEmail ? await decryptValuePromise(iUserId.sEmail) : iUserId.sEmail
              } else {
                iUserId.sEmail = ''
              }
              p.iUserId = iUserId
            }
          }
        })

        // Resolving all promises concurrently
        await Promise.all(promises)
      }

      // Creating the final response data
      const data = { nTotal, aResult: list }

      // Sending the response
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAdminlog), data })
    } catch (error) {
      // Handling errors and logging
      return catchError('SubAdmin.AdminLogsV2', error, req, res)
    }
  }

  /**
 * Retrieves a single admin log entry.
 * @param {*} req - Request object containing the log ID.
 * @param {*} res - Response object containing the status code and the admin log.
 * @returns {Object} - Single admin log entry.
 */
  async getAdminLog(req, res) {
    try {
      // Fetch the admin log entry based on the provided ID
      const logs = await AdminLogModel
        .findOne({ _id: mongify(req.params?.id) }, {
          eKey: 1,
          oOldFields: 1,
          oNewFields: 1,
          iUserId: 1,
          sCity: 1,
          sCountry: 1,
          sState: 1,
          sLatitude: 1, // Latitude information associated with the log
          sLongitude: 1
        })
        .lean()

      // Decrypt bank account numbers if the log entry involves bank details
      if (logs?.eKey === 'BD') {
        const { oOldFields, oNewFields } = logs
        if (oNewFields?.sAccountNo) logs.oNewFields.sAccountNo = decryption(oNewFields?.sAccountNo)
        if (oOldFields?.sAccountNo) logs.oOldFields.sAccountNo = decryption(oOldFields?.sAccountNo)
      }

      // Check admin authorization for accessing user personal information
      const response = await checkAdminAuthorization('USERS_PERSONAL_INFO', 'R', req)

      // Decrypt personal info if authorized; mask if not authorized
      if (logs?.iUserId && response?.status === 200) {
        await Promise.all([
          decryptIfExist(logs.oOldFields, ['sEmail', 'sMobNum']),
          decryptIfExist(logs.oNewFields, ['sEmail', 'sMobNum'])
        ])
      } else {
        maskIfExist(logs.oOldFields, ['sEmail', 'sMobNum'])
        maskIfExist(logs.oNewFields, ['sEmail', 'sMobNum'])
      }

      // Decrypt additional personal info fields
      await Promise.all([
        decryptIfExist(logs.oOldFields, ['sAddress', 'dDob']),
        decryptIfExist(logs.oNewFields, ['sAddress', 'dDob'])
      ])

      // Response data containing the admin log entry
      const data = logs
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAdminlog), data })
    } catch (error) {
      return catchError('SubAdmin.getAdminLog', error, req, res)
    }
  }

  /**
 * Create admin logs.
 * @param {*} req - Request object containing log data.
 * @param {*} res - Response object.
 * @param {Object} logData - Data to be logged.
 * @returns {void}
 */
  async adminLog(req, res, logData) {
    try {
      // Create admin logs in the AdminLogModel
      const locationRecord = await LocationModel.findOne({
        oLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [logData?.sLongitude || 0, logData?.sLatitude || 0]
            },
            $maxDistance: 10000
          }
        }
      })
      await AdminLogModel.create({ ...logData, sCity: locationRecord?.sName, sState: locationRecord?.sState, sCountry: locationRecord?.sCountry })
    } catch (error) {
      // Handle errors and return an appropriate response
      return catchError('AdminLog.adminLog', error, req, res)
    }
  }

  async createAdminLog(logData) {
    // Check if latitude and longitude are available
    if (logData?.sLatitude && logData?.sLongitude) {
      // Find the nearest location record within 10 km
      const locationRecord = await LocationModel.findOne({
        oLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [logData?.sLongitude || 0, logData?.sLatitude || 0]
            },
            $maxDistance: 10000
          }
        }
      })

      // Update the logData with the location information
      if (locationRecord) {
        logData.sCity = locationRecord?.sName || ''
        logData.sState = locationRecord?.sState || ''
        logData.sCountry = locationRecord?.sCountry || ''
      }
    }

    // Create a new AdminLogModel entry with the parsed log data
    await AdminLogModel.create({ ...logData })
  }
}

/**
 * Create a search query for getting admin logs based on the provided operation and search criteria.
 * @param {*} req - Request object containing operation and search parameters.
 * @param {*} res - Response object.
 * @returns {Object} - Query value for searching admin logs.
 */
async function getQueryValues(operation, search) {
  let query = {}
  let commonQuery = {}

  // Check if the search is a valid ObjectId, and create a query accordingly
  if (isValidObjectId(search) && mongify(search).toString() === search) {
    commonQuery = { ...query, iUserId: mongify(search) }
  } else {
    commonQuery = { ...query, 'oOldFields.sName': { $regex: searchRegExp(search) } }
  }

  // Check for search criteria and set the query based on the operation
  if (search) {
    switch (operation) {
      case 'CR':
        query = {
          $or: [
            { ...query, 'oOldFields.sRuleName': { $regex: searchRegExp(search) } },
            { ...query, 'oOldFields.eRule': { $regex: searchRegExp(search) } }
          ]
        }
        break

      case 'S':
        query = {
          $or: [
            { ...query, 'oOldFields.sTitle': { $regex: searchRegExp(search) } },
            { ...query, 'oOldFields.sKey': { $regex: searchRegExp(search) } }]
        }
        break

      case 'L':
        query = {
          $or: [
            { ...query, 'oOldFields.sName': { $regex: searchRegExp(search) } },
            { ...query, 'oOldFields.sLeagueCategory': { $regex: searchRegExp(search) } },
            { ...query, 'oOldFields.sFilterCategory': { $regex: searchRegExp(search) } }
          ]
        }
        break

      case 'PC':
        query = {
          $or: [
            { ...query, 'oNewFields.sName': { $regex: searchRegExp(search) } },
            { ...query, 'oNewFields.sCode': { $regex: searchRegExp(search) } }
          ]
        }
        break

        // case 'ML':
        // case 'MP':
        // case 'M':
        //   if (['ML', 'MP', 'M'].includes(operation)) {
        //     const matches = await findMatches({ sName: search }, { _id: 1, sName: 1 })

        //     if (matches.length) {
        //       const matchIds = matches.map(match => match._id)
        //       query = {
        //         ...query,
        //         $or: [
        //           { 'oOldFields.sName': { $regex: searchRegExp(search) } },
        //           { 'oNewFields.sName': { $regex: searchRegExp(search) } },
        //           { 'oOldFields.iMatchId': { $in: matchIds } }
        //         ]
        //       }
        //     }
        //   }
        //   break

      default:
        query = commonQuery
    }
  }
  return query
}

module.exports = new AdminLogs()

setTimeout(() => {
  processAdminLog()
}, 2000)
