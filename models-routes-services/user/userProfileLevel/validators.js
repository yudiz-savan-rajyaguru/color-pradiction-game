const { body } = require('express-validator')

const ValidateSyncUserProfileById = [
  body('id').isMongoId().not().isEmpty()
]

module.exports = { ValidateSyncUserProfileById }
