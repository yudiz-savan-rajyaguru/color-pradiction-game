const router = require('express').Router()
const { cacheRoute } = require('../../helper/redis')
const { isUserAuthenticated, checkToken, validateAdmin } = require('../../middlewares/middleware')
const oPassbookService = require('./service')
const validators = require('./validators')

router.get('/user/transaction-history/v1', validators.list, isUserAuthenticated, oPassbookService.transactionHistory)
router.get('/user/transaction-count/v1', validators.add, isUserAuthenticated, /* cacheRoute(CACHE_3), */ oPassbookService.passbookCount)
router.get('/user/enums/v1', isUserAuthenticated, oPassbookService.listPassbookTypes)

// admin
router.get('/admin/passbook/list/v1', validators.limitValidator, checkToken, validateAdmin('PASSBOOK', 'R'), oPassbookService.adminListV2)
router.get('/admin/passbook/counts/v1', checkToken, validateAdmin('PASSBOOK', 'R'), oPassbookService.getCountsV2)
router.post('/admin/passbook/transaction-report/v1', validators.reportValidator, checkToken, validateAdmin('PASSBOOK', 'R'), oPassbookService.transactionReport)
router.get('/admin/passbook/list-transaction-report/v1', checkToken, validateAdmin('PASSBOOK', 'R'), oPassbookService.listTransactionReport)
router.get('/admin/passbook/list-transaction-type/v1', checkToken, validateAdmin('PASSBOOK', 'R'), cacheRoute(60), oPassbookService.listTransactionType)

module.exports = router
