// @ts-check
const router = require('express').Router()
const apiLogServices = require('./service')
const { validateAdmin, checkToken } = require('../../middlewares/middleware')
const { limitValidator } = require('./validators')

router.get('/admin/transaction-logs/:id/v1', limitValidator, checkToken, validateAdmin('PASSBOOK', 'R'), apiLogServices.listTransactionLog)

module.exports = router
