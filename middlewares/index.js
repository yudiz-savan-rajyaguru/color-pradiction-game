const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const helmet = require('helmet')
const Sentry = require('@sentry/node')
const compression = require('compression')
const hpp = require('hpp')
const config = require('../config/config')
const fileUpload = require('express-fileupload')
const path = require('path')

module.exports = (app) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: config.SENTRY_DSN,
      tracesSampleRate: 1.0
    })
  }
  // cachegoose(mongoose, {
  //   engine: 'redis',
  //   client: config.REDIS_CONNECTION_STRING
  // })

  // app.use(morgan('dev'))

  app.use(cors())
  app.use(helmet())
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", config.S3_BUCKET_URL]
      }
    })
  )
  app.use(fileUpload())
  app.disable('x-powered-by')
  app.use(bodyParser.json({ limit: '1mb' }))
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(hpp())

  /* global appRootPath */
  app.use(express.static(path.join(appRootPath, 'public')))
  app.set('view engine', 'ejs')

  app.use(compression({
    filter: function (req, res) {
      if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false
      }
      // fallback to standard filter function
      return compression.filter(req, res)
    }
  }))

  // set language in request object
  app.use((req, res, next) => {
    switch (req.header('Language')) {
      case 'hi':
        req.userLanguage = 'Hindi'
        break

      case 'en-us':
        req.userLanguage = 'English'
        break

      case 'pt-br':
        req.userLanguage = 'Portuguese'
        break

      default:
        req.userLanguage = 'English'
    }
    next()
  })
}
