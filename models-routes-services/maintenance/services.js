const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, createResponse } = require('../../helper/utilities.services')

const MaintenanceModel = require('./model')

class Maintenance {
  /**
   * get all maintenance record
   * @param {*} req  : ''
   * @param {*} res status, message, data
   * @returns {*} data : all the maintenance record
   */
  async get(req, res) {
    try {
      const data = await MaintenanceModel.find({}).lean()

      if (!data[0]) return res.status(status.NotFound).json({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmaintenance) })

      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmaintenance), data: data[0] })
    } catch (error) {
      return catchError('Maintenance.get', error, req, res)
    }
  }

  // not in use
  async add(req, res) {
    try {
      const { sMessage, bIsMaintenanceMode } = req.body
      const data = await MaintenanceModel.create({ sMessage, bIsMaintenanceMode })
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cmaintenance), data })
    } catch (error) {
      return catchError('Maintenance.get', error, req, res)
    }
  }

  /**
   * update maintenance record
   * @param {*} req  : body bIsMaintenanceMode, sMessage
   * @param {*} res status, message, data
   * @returns {*} data : updated maintenance record
   */
  async update(req, res) {
    try {
      const { bIsMaintenanceMode, sMessage, dStartTime = new Date(), dEndTime = new Date() } = req.body

      // code for checking if start time is greater than end time
      if (new Date(dStartTime).getTime() > new Date(dEndTime).getTime()) {
        return res.status(status.BadRequest).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].start_time_end_time })
      }

      const data = await MaintenanceModel.findOneAndUpdate({}, { bIsMaintenanceMode, sMessage, dStartTime, dEndTime }, { new: true, runValidators: true }).lean()
      return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cmaintenance), data })
    } catch (error) {
      catchError('Maintenance.update', error, req, res)
    }
  }

  /**
   * get single maintenance record
   * @param {*} req
   * @param {*} res status, message, data
   * @returns {*} data : single maintenance record
   */
  async getMaintenance(req, res) {
    try {
      const data = await MaintenanceModel.findOne({}, { bIsMaintenanceMode: 1, sMessage: 1, _id: 0, dStartTime: 1, dEndTime: 1 }).lean()

      if (!data) return res.status(status.NotFound).json({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].cmaintenance) })

      const currentTime = new Date()

      if (data.bIsMaintenanceMode || (currentTime >= new Date(data.dStartTime) && currentTime <= new Date(data.dEndTime))) {
        return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmaintenance), data: { ...data, bIsMaintenanceMode: true } })
      } else {
        return res.status(status.OK).json({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmaintenance), data: { ...data, bIsMaintenanceMode: false } })
      }
    } catch (error) {
      return catchError('Maintenance.get', error, req, res)
    }
  }
}
module.exports = new Maintenance()
