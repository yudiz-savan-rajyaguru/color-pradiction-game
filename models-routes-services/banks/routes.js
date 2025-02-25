//  @ts-check
const router = require('express').Router()

const { cacheRoute } = require('../../helper/redis')

const bankServices = require('./services')

router.get('/user/bank/v1', cacheRoute(300), bankServices.listBank)

module.exports = router
