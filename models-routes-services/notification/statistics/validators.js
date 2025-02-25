const { param } = require('express-validator')

const validateId = [
  param('id').isMongoId()
]

module.exports = {
  validateId
}
