const { param } = require('express-validator')

const validateId = [
  param('id').isMongoId().not().isEmpty()
]

module.exports = { validateId }
