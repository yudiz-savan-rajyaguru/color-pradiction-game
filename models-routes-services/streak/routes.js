const router = require('express').Router()

const { validateAdmin, validate, checkToken } = require('../../middlewares/middleware')

const streakServices = require('./services')
const validators = require('./validators')

// admin add streak
router.post('/admin/streak/add/v1', validators.adminAddStreak, validate, checkToken, validateAdmin('STREAK', 'W'), streakServices.add)

// admin get all streak
router.get('/admin/streak/v1', checkToken, validateAdmin('STREAK', 'R'), streakServices.list)

// admin get all streak
router.get('/admin/streak/:id/v1', validators.validateId, checkToken, validateAdmin('STREAK', 'R'), streakServices.get)

// delete streak
router.delete('/admin/streak/:id/v1', validators.deleteStreak, validate, checkToken, validateAdmin('STREAK', 'W'), streakServices.remove)

// admin update streak
router.put('/admin/streak/:id/v1', validators.adminAddStreak, validate, checkToken, validateAdmin('STREAK', 'W'), streakServices.update)

// upload image for extra type
router.post('/admin/streak/pre-signed-url/v1', validators.getSignedUrl, validate, checkToken, validateAdmin('STREAK', 'W'), streakServices.getSignedUrl)

module.exports = router
