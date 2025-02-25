const router = require('express').Router()

const { isUserAuthenticated } = require('../../middlewares/middleware')

const userStreakServices = require('./services')

router.get('/user/streak/reward/v1', isUserAuthenticated, userStreakServices.getStreakReward)

module.exports = router
