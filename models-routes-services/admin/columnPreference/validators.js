const { body } = require('express-validator')

const { moduleName } = require('../../../data')

const addOrUpdate = [
  body('sModuleName').not().isEmpty().toUpperCase().isIn(moduleName) // Validate that 'sModuleName' is not empty, convert it to uppercase, and check if it is in the list of valid module names
]

module.exports = {
  addOrUpdate
}
