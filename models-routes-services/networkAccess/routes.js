const router = require('express').Router()

const { validateAdmin, checkToken } = require('../../middlewares/middleware')

const netAccessServices = require('./services')
const validators = require('./validators')

// user add coupons
router.post('/admin/net-access/add/v1', validators.addIpRange, checkToken, validateAdmin('NETACCESS', 'W'), netAccessServices.add)
router.get('/admin/net-access/:id/v1', validators.ipIdValidate, checkToken, validateAdmin('NETACCESS', 'R'), netAccessServices.getIpRange)
router.get('/admin/net-access/v1', validators.listValidate, checkToken, validateAdmin('NETACCESS', 'R'), netAccessServices.list)
router.put('/admin/net-access/:id/v1', validators.updateIpRange, checkToken, validateAdmin('NETACCESS', 'W'), netAccessServices.update)
router.delete('/admin/net-access/:id/v1', validators.ipIdValidate, checkToken, validateAdmin('NETACCESS', 'W'), netAccessServices.delete)
module.exports = router
