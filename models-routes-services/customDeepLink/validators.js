const { param } = require('express-validator')

const codeParam = [
  param('code').not().isEmpty()
]

module.exports = {
  codeParam
}
