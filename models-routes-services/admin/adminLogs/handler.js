const AdminLogsModel = require('./logs.model')
const LocationModel = require('./location.model')

const oAdminLogsHandler = {}

oAdminLogsHandler.createAdminLog = async (logData) => {
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
  await AdminLogsModel.create({ ...logData })
}

oAdminLogsHandler.adminLog = async (req, res, logData) => {
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
    await AdminLogsModel.create({ ...logData, sCity: locationRecord?.sName, sState: locationRecord?.sState, sCountry: locationRecord?.sCountry })
  } catch (error) {
    // Handle errors and return an appropriate response
    throw new Error(error)
  }
}

module.exports = oAdminLogsHandler
