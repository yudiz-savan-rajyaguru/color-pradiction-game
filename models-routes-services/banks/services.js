//  @ts-check
const { messages, jsonStatus, status } = require('../../helper/api.responses')
const { catchError, getPaginationValues } = require('../../helper/utilities.services')

const BankModel = require('./model')

class Bank {
  /**
 * List banks based on pagination and search criteria.
 */
  async listBank(req, res) {
    try {
      // Extract pagination values from the request query.
      let { start, limit, search } = getPaginationValues(req.query)

      // Set default values for start and limit if not provided.
      start = (!start) ? 0 : start
      limit = (!limit) ? 10 : limit

      // Create a query object to filter banks with 'Y' status.
      const query = { eStatus: 'Y' }
      // If search criteria is provided, add it to the query for case-insensitive partial matching.
      if (search) {
        query.sName = { $regex: new RegExp('^.*' + search + '.*', 'i') }
      }
      // Count the total number of documents matching the query.
      const nTotal = await BankModel.countDocuments(query)

      // Retrieve bank data based on the query, sort by name, and apply pagination.
      const aData = await BankModel.find(query, { sName: 1 }).sort({ sName: 1 }).skip(start).limit(limit).lean()

      // Respond with the total count and the paginated bank data.
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cListBank), data: { nTotal, aData } })
    } catch (error) {
      console.log(error)
      // Handle errors by responding with an error message and logging the error.
      return catchError('Bank.listBank', error, req, res)
    }
  }
}

module.exports = new Bank()
