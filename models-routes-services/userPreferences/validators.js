const { body } = require('express-validator')

const updateUserPreference = [
  body('sKey').optional(),
  body('bEnabled').not().isEmpty(),
  body('eGroup').optional()
]

module.exports = {
  updateUserPreference
}
