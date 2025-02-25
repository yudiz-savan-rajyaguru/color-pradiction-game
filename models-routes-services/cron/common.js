const { Transaction, Op } = require('sequelize')
const UserDepositModel = require('../userDeposit/model')
const db = require('../../database/sequelize')
const { processRazorpayPayment } = require('../userDeposit/userDepositCommon')
const RssFeedModel = require('../newsLetter/rssfeed/model')
const NewsLetterModel = require('../newsLetter/model')
const axios = require('axios')
const xml2js = require('xml2js')
const data = require('../../data')
const { handleCatchError, getDates } = require('../../helper/utilities.services')
const { fn, col, literal } = require('sequelize')
const PassbookModel = require('../passbook/model')
async function getDataForProcessing(dCurrentTime) {
  try {
    // Start a Sequelize transaction with READ_COMMITTED isolation level.
    return await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      // Use Sequelize to find all deposits meeting the specified criteria.
      const data = await UserDepositModel.findAll({
        where: {
          ePaymentStatus: 'P',
          ePaymentGateway: { [Op.in]: ['RAZORPAY'] },
          [Op.and]: [{
            dUpdatedAt: { [Op.gte]: dCurrentTime }
          }, {
            dUpdatedAt: { [Op.lte]: new Date(new Date().getTime()) } // 5 minutes before from the current time.
          }]
        },
        raw: true,
        attributes: ['id', 'ePaymentGateway', 'iOrderId', 'iUserId', 'iReferenceId', 'iTransactionId', 'ePaymentStatus'],
        order: [['dUpdatedAt', 'DESC']],
        transaction: t,
        lock: true
      })

      // Return the retrieved deposit data.
      return data
    })
  } catch (error) {
    // Handle any errors that occurred during the transaction or data retrieval.
    return Promise.reject(error)
  }
}

async function processPaymentByGateway(deposit) {
  try {
    const { ePaymentGateway } = deposit
    const oPayload = {
      iDepositId: deposit.id,
      orderId: deposit.iOrderId,
      ePaymentGateway,
      ePaymentStatus: deposit.ePaymentStatus,
      iTransactionId: deposit.iTransactionId
    }

    switch (ePaymentGateway) {
      case 'RAZORPAY':
        {
          const response = await processRazorpayPayment(oPayload)
          console.log('response', JSON.stringify(response))
        }
        break

      default:
        await processRazorpayPayment(oPayload)
    }
  } catch (error) {
    // Handle errors or log them as needed
    return Promise.reject(error)
  }
}
async function fetchTopicBaseNewsFormRss() {
  try {
    const rssTopics = await RssFeedModel.find({ eStatus: 'Y', sProvider: { $in: (data?.rssFeedProvider || []) } }).lean()
    const bulkOperations = []

    if (rssTopics.length === 0) {
      console.log('No active RSS feeds found.')
      return
    }

    const fetchAndProcess = async (topic) => {
      try {
        const response = await axios.get(topic.sLink)
        const parsedData = await xml2js.parseStringPromise(response.data, { explicitArray: false })
        const items = (parsedData?.rss?.channel?.item || [])

        for (const item of items) {
          const { sProvider, sTopic, _id } = topic
          let sImage = ''
          const dPubDate = item?.pubDate ? new Date(item.pubDate) : null

          if (sProvider === 'TIMESOFINDIA') {
            sImage = item?.enclosure?.$?.url || ''
          } else if (sProvider === 'HINDUSTANTIMES') {
            sImage = item['media:content']?.$?.url || ''
          }

          bulkOperations.push({
            updateOne: {
              filter: { sTitle: item?.title || '', iRssFeedId: _id },
              update: {
                $setOnInsert: {
                  sTitle: item?.title || '',
                  sDescription: item?.description || '',
                  sLink: item?.link || '',
                  sNewsCategory: sTopic || '',
                  sImage,
                  dPubDate,
                  eStatus: 'Y',
                  iRssFeedId: _id
                }
              },
              upsert: true
            }
          })
        }
      } catch (topicError) {
        console.error(`Error processing topic ${topic.sLink}:`, topicError)
      }
    }

    // Fetch and process feeds in parallel
    await Promise.all(rssTopics.map(fetchAndProcess))

    if (bulkOperations.length > 0) {
      await NewsLetterModel.bulkWrite(bulkOperations)
      console.log(`${bulkOperations.length} news items processed successfully.`)
    } else {
      console.log('No new news items to process.')
    }
  } catch (error) {
    console.error('Error fetching and writing news:', error)
    throw new Error(error)
  }
}

async function processAutoSegment(oSegment, aUsersId = []) {
  try {
    const aUserId = new Set()
    if (aUsersId?.length) aUsersId.forEach(item => aUserId.add(item))

    const oUserDetails = {}
    const actualUsers = []
    let oData
    let i = 0
    for (const oCriteria of oSegment.aSegment) {
      getDates(oCriteria)
      switch (oCriteria.eType) {
        case 'D':
        case 'W':
          oData = await getDepositWIthdrawSegmentUsers(oCriteria, aUserId, oUserDetails, {}, oSegment.aSegment?.length || 0, i++)
          break
        default:
          break
      }
    }

    actualUsers.push(oData)

    return { aUserId: Object.keys(Object.assign({}, ...actualUsers)), tempo: Object.assign({}, ...actualUsers) }
  } catch (error) {
    handleCatchError(error)
  }
}

async function getDepositWIthdrawSegmentUsers(oCriteria, aUserId, oUserDetails, query = {}, segmentStep, rotate = 0) {
  try {
    const { eType, nAmount = 0, ePaymentGateway = '', nActionNo = 0, nAmountFrom = 0, nAmountTo = 0, dDateFrom = '', dDateTo = '', eTransactionStatus = 'CMP' } = oCriteria
    query.eUserType = 'U'

    if (aUserId?.size) query.aUserId = [...aUserId]
    if (eTransactionStatus) query.ePaymentStatus = eTransactionStatus

    if (eType === 'D' && ePaymentGateway) query.ePaymentGateway = ePaymentGateway
    if (eType === 'W' && ePaymentGateway) query.ePaymentGateway = ePaymentGateway

    if (eType === 'D') query.eTransactionType = 'Deposit'
    if (eType === 'W') query.eTransactionType = 'Withdraw'

    if (nAmountFrom && nAmountTo) {
      query.nAmountFrom = nAmountFrom
      query.nAmountTo = nAmountTo
    }

    if (nAmount) query.nAmount = nAmount

    if (nActionNo) query.nActionNo = nActionNo

    if (dDateFrom && dDateTo) {
      query.dDateFrom = dDateFrom
      query.dDateTo = dDateTo
    }

    query.rotate = rotate

    let data
    if (eType === 'D') data = await getSegmentationDepositUsers(query)
    if (eType === 'W') data = await getSegmentationWithdrawUsers(query)

    return addUserIds(data, aUserId, oUserDetails, eType, {}, segmentStep)
  } catch (error) {
    handleCatchError(error, 'Error in getDepositWIthdrawSegmentUsers:')
  }
}

async function getSegmentationDepositUsers(query) {
  try {
    if (!query) return []

    const { nAmount, nAmountFrom, nAmountTo, nActionNo, dDateFrom, dDateTo, eTransactionType, eStatus = 'CMP', aUserId = [], rotate = 0 } = query
    const whereQuery = {}
    if (eStatus) whereQuery.eStatus = eStatus
    if (eTransactionType) whereQuery.eTransactionType = eTransactionType

    if (rotate !== 0 && aUserId) {
      whereQuery.iUserId = {
        [Op.in]: aUserId
      }
    }

    if (dDateFrom && dDateTo) {
      whereQuery[Op.and] = [
        { dCreatedAt: { [Op.gte]: dDateFrom } },
        { dCreatedAt: { [Op.lt]: dDateTo } }
      ]
    }
    const attributeQuery = []

    attributeQuery.push([fn('sum', col('nAmount')), 'nAmount'], 'iUserId')
    attributeQuery.push([fn('count', col('iUserId')), 'nUsers'])
    const havingQuery = []
    if (nAmount) {
      whereQuery.nAmount = { nAmount: { [Op.eq]: nAmount } }
    }
    if (nAmountFrom && nAmountTo) {
      whereQuery.nAmount = { [Op.between]: [nAmountFrom, nAmountTo] }
    }
    if (nActionNo) {
      havingQuery.push({ nUsers: { [Op.eq]: nActionNo } })
    }

    if (nAmount && !nActionNo) {
      havingQuery.push({ nAmount: { [Op.eq]: nAmount } })
      delete whereQuery.nAmount
    }
    if (nAmountFrom && nAmountTo && !nActionNo) {
      havingQuery.push({ nAmount: { [Op.between]: [nAmountFrom, nAmountTo] } })
      delete whereQuery.nAmount
    }

    const depositQuery = { where: whereQuery, raw: true }
    depositQuery.group = literal('iUserId')

    depositQuery.attributes = attributeQuery

    if (havingQuery) {
      depositQuery.having = havingQuery
    }

    const data = await PassbookModel.findAll(depositQuery)
    return data
  } catch (error) {
    handleCatchError(error)
  }
}

async function getSegmentationWithdrawUsers(query) {
  try {
    if (!query) return []
    const { nAmount, nAmountFrom, nAmountTo, nActionNo, dDateFrom, dDateTo, eTransactionType, aUserId = [], eStatus = 'CMP', rotate } = query

    const whereQuery = {}
    if (eStatus) whereQuery.eStatus = eStatus
    if (eTransactionType) { whereQuery.eTransactionType = eTransactionType }
    if (rotate !== 0 && aUserId) {
      whereQuery.iUserId = {
        [Op.in]: aUserId
      }
    }

    if (dDateFrom && dDateTo) {
      whereQuery[Op.and] = [
        { dCreatedAt: { [Op.gte]: dDateFrom } },
        { dCreatedAt: { [Op.lt]: dDateTo } }
      ]
    }

    const attributeQuery = []

    attributeQuery.push([fn('sum', col('nAmount')), 'nAmount'], 'iUserId')
    attributeQuery.push([fn('count', col('iUserId')), 'nUsers'])
    const havingQuery = []
    if (nAmount) {
      whereQuery.nAmount = { nAmount: { [Op.eq]: nAmount } }
    }
    if (nAmountFrom && nAmountTo) {
      whereQuery.nAmount = { [Op.between]: [nAmountFrom, nAmountTo] }
    }
    if (nActionNo) {
      havingQuery.push({ nUsers: { [Op.eq]: nActionNo } })
    }

    if (nAmount && !nActionNo) {
      havingQuery.push({ nAmount: { [Op.eq]: nAmount } })
      delete whereQuery.nAmount
    }
    if (nAmountFrom && nAmountTo && !nActionNo) {
      havingQuery.push({ nAmount: { [Op.between]: [nAmountFrom, nAmountTo] } })
      delete whereQuery.nAmount
    }

    const withdrawQuery = { where: whereQuery, raw: true }
    withdrawQuery.group = literal('iUserId')

    withdrawQuery.attributes = attributeQuery

    if (havingQuery) {
      withdrawQuery.having = havingQuery
    }

    const data = await PassbookModel.findAll(withdrawQuery)
    return data
  } catch (error) {
    handleCatchError(error)
  }
}

function addUserIds(aResult, aUserId, oUserDetails, eType, oKycDetails = {}, segmentStep) {
  // Extract current user IDs from aResult

  const currentUserIds = new Set(aResult.map(user => user.iUserId?.toString()))

  if (aUserId?.size) {
    // Retain only common user IDs between existing aUserId and currentUserIds
    for (const id of [...aUserId]) {
      if (!currentUserIds.has(id)) {
        aUserId.delete(id) // Remove IDs not present in the current results
        delete oUserDetails[id] // Remove their details from oUserDetails
      }
    }
  } else {
    // Initialize aUserId with the first batch of user IDs
    aResult.forEach(user => aUserId.add(user.iUserId?.toString()))
  }

  // Update oUserDetails with the current result
  for (const user of aResult) {
    const userId = user?.iUserId?.toString()
    if (!userId || !aUserId.has(userId)) continue

    user.eType = eType

    if (eType === 'K') {
      const { eKycStatus = '', eAdhaarStatus = '', ePanStatus = '' } = oKycDetails
      if (eKycStatus) user.eKycStatus = eKycStatus
      if (eAdhaarStatus) user.eAdhaarStatus = eAdhaarStatus
      if (ePanStatus) user.ePanStatus = ePanStatus
    }

    if (!oUserDetails[userId]) {
      oUserDetails[userId] = []
    }

    oUserDetails[userId].push({ ...user, iUserId: undefined, _id: undefined })
  }

  return oUserDetails
}

module.exports = {
  getDataForProcessing,
  processPaymentByGateway,
  fetchTopicBaseNewsFormRss,
  processAutoSegment
}
