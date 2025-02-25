const generalEnglish = require('../lang/english/general')
const generalHindi = require('../lang/hindi/general')
const generalPortuguese = require('../lang/portuguese/general')
const wordsEnglish = require('../lang/english/words')
const wordsHindi = require('../lang/hindi/words')
const wordsPortuguese = require('../lang/portuguese/word')

const messages = {
  English: {
    ...generalEnglish,
    ...wordsEnglish
  },
  Hindi: {
    ...generalHindi,
    ...wordsHindi
  },
  Portuguese: {
    ...generalPortuguese,
    ...wordsPortuguese
  }
}

const status = {
  OK: 200,
  Create: 201,
  Deleted: 204,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  Forbidden: 403,
  NotAcceptable: 406,
  ExpectationFailed: 417,
  Locked: 423,
  InternalServerError: 500,
  UnprocessableEntity: 422,
  ResourceExist: 409,
  TooManyRequest: 429
}

const jsonStatus = {
  OK: 200,
  Create: 201,
  Deleted: 204,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  Forbidden: 403,
  NotAcceptable: 406,
  ExpectationFailed: 417,
  Locked: 423,
  InternalServerError: 500,
  UnprocessableEntity: 422,
  ResourceExist: 409,
  TooManyRequest: 429
}

module.exports = {
  messages,
  status,
  jsonStatus
}
