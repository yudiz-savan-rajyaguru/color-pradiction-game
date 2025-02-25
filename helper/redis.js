const Redis = require('ioredis')
const config = require('../config/config')
const jwt = require('jsonwebtoken')
const { handleCatchError } = require('./utilities.services')
const sanitizeHtml = require('sanitize-html')
const { historyStatus } = require('../data')
const { getPortfolioCardAndCountKey, getPortfolioKey } = require('../models-routes-services/user/auth/helper')

const redisClient = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  username: config.REDIS_USERNAME,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB
  // maxRetriesPerRequest: null,
  // enableReadyCheck: false
})
const redisSocketClient = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  username: config.REDIS_USERNAME,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB
  // maxRetriesPerRequest: null,
  // enableReadyCheck: false
})

redisClient.on('error', function (error) {
  console.log('Error in Redis', error)
  handleCatchError(error)
  process.exit(1)
})

redisClient.on('connect', function () {
  console.log('redis connected')
})

redisSocketClient.on('error', function (error) {
  console.log('Error in Redis2', error)
  handleCatchError(error)
  process.exit(1)
})
redisSocketClient.on('connect', function () { console.log('redis2 connected') })

const queueObject = {
  'pushNotification:KYC': { name: 'pushNotification:KYC', client: null },
  'pushNotification:referCodeBonus': { name: 'pushNotification:referCodeBonus', client: null },
  'pushNotification:registerBonus': { name: 'pushNotification:registerBonus', client: null },
  'pushNotification:registerReferBonus': { name: 'pushNotification:registerReferBonus', client: null },
  NOTIFY: { name: 'NOTIFY', client: null },
  updateNotificationPreference: { name: 'updateNotificationPreference', client: null },
  AdminLogs: { name: 'AdminLogs', client: null },
  'pushNotification:bonusCredit': { name: 'pushNotification:bonusCredit', client: null },
  AuthLogs: { name: 'AuthLogs', client: null },
  'pushNotification:ORDER': { name: 'pushNotification:ORDER', client: null },
  'pushNotification:EVENT_OUTCOME': { name: 'pushNotification:EVENT_OUTCOME', client: null },
  TransactionLog: { name: 'TransactionLog', client: null },
  OrderLog: { name: 'OrderLog', client: null },
  sendSms: { name: 'sendSms', client: null }
}

async function asignClientToQueues(queues) {
  for (const queue in queues) {
    queues[queue].client = await new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      username: config.REDIS_USERNAME,
      password: config.REDIS_PASSWORD,
      db: config.REDIS_DB
    })
  }
}
asignClientToQueues(queueObject)

async function createRedisHash(key, data, expireTime) {
  try {
    if (typeof key !== 'string' || typeof data !== 'object' || data === null) {
      throw new Error('Invalid input: key must be a string and data must be an object')
    }
    // Use HSET to set multiple fields in the hash
    await redisClient.hset(key, data)

    // Set expiration if expireTime is provided
    if (expireTime && Number.isInteger(expireTime) && expireTime > 0) {
      await redisClient.expire(key, expireTime)
    }
    return true
  } catch (error) {
    handleCatchError(error)
    return false
  }
}

async function getRedisHash(key) {
  try {
    if (typeof key !== 'string') {
      throw new Error('Invalid input: key must be a string')
    }
    return await redisClient.hgetall(key)
  } catch (error) {
    handleCatchError(error)
    return false
  }
}

async function removeRedisKey({ aRegexRedisKey = [], aExactRedisKey = [] }) {
  try {
    for (const sRegexRedisKey of aRegexRedisKey) {
      const aExactRedisKeyFetched = await redisClient.keys(`*${sRegexRedisKey}*`)
      for (const sExactRedisKey of aExactRedisKeyFetched) {
        aExactRedisKey.push(sExactRedisKey)
      }
    }
    for (const sExactRedisKey of aExactRedisKey) {
      await redisClient.del(sExactRedisKey)
    }
  } catch (error) {
    console.log(error)
    handleCatchError(error)
  }
}

module.exports = {
  queueObject,
  redisSocketClient,
  cacheRoute: function (duration, sKey = '') {
    return async (req, res, next) => {
      let key
      if (sKey === 'portfolio' && req.query?.eHistoryStatus === historyStatus.map.CLOSED) key = getPortfolioKey({ eHistoryStatus: req.query?.eHistoryStatus, iUserId: req.user?._id.toString() })
      else if (sKey === 'portfolio-count' && req.query?.eHistoryStatus === historyStatus.map.CLOSED) key = getPortfolioCardAndCountKey({ eHistoryStatus: req.query?.eHistoryStatus, iUserId: req.user?._id.toString() })
      else if ((sKey === 'portfolio' || sKey === 'portfolio-count') && req.query?.eHistoryStatus === historyStatus.map.LIVE) return next()
      else key = '__express__' + sanitizeHtml(req.originalUrl || req.url)
      const cachedBody = await redisClient.get(key)
      if (cachedBody) {
        res.setHeader('is-cache', 1)
        res.setHeader('content-type', 'application/json')
        res.status(JSON.parse(cachedBody)?.status || 200)

        return res.send(cachedBody)
      } else {
        res.sendResponse = res.send
        res.send = (body) => {
          redisClient.set(key, body, 'EX', duration)
          res.setHeader('content-type', 'application/json')
          res.sendResponse(body)
        }
        next()
      }
    }
  },

  checkRateLimitOTP: function (sLogin, sType = 'M', sAuth) {
    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV === 'dev') resolve()
      if (!config.THRESHOLD_RATE_LIMIT) resolve()
      if (!sLogin || !sType || !sAuth) resolve()
      redisClient.incr(`rlotp:${sLogin}:${sType}:${sAuth}:${(new Date()).getHours()}`).then(data => {
        if (data > config.THRESHOLD_RATE_LIMIT) {
          resolve('LIMIT_REACHED')
        } else {
          redisClient.expire(`rlotp:${sLogin}:${sType}:${sAuth}:${(new Date()).getHours()}`, 1800).then().catch()
          resolve()
        }
      }).catch(error => {
        handleCatchError(error)
        resolve()
      })
    })
  },

  // It will check only rate limit count if limit is reached returns 'LIMIT_REACHED'
  getRateLimitStatus: function (sLogin, sType, sAuth) {
    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV === 'dev') resolve()
      if (!sLogin || !sType || !sAuth) resolve()
      redisClient.get(`rlotp:${sLogin}:${sType}:${sAuth}:${(new Date()).getHours()}`).then(data => {
        if (data > 5) {
          return resolve('LIMIT_REACHED')
        }
        return resolve()
      }).catch(error => {
        handleCatchError(error)
        resolve()
      })
    })
  },

  //  It will check whether sent otp is expired or not
  getOTPExpiryStatus: function (sLogin, sType = 'M', sAuth) {
    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV === 'dev') resolve()
      if (!sLogin || !sType || !sAuth) resolve()
      redisClient.ttl(`rlotp:${sLogin}:${sType}:${sAuth}:${(new Date()).getHours()}`).then(data => {
        if (data <= 0) {
          return resolve('EXPIRED')
        }
        return resolve()
      }).catch(error => {
        handleCatchError(error)
        resolve()
      })
    })
  },

  checkProcessed: function (sKey, nExpire = 15) {
    return new Promise((resolve, reject) => {
      if (!sKey) return resolve()
      redisClient.incr(sKey).then(data => {
        if (data > 1) {
          return resolve('EXIST')
        } else {
          redisClient.expire(sKey, nExpire).then().catch()
          return resolve()
        }
      }).catch(error => {
        handleCatchError(error)
        return resolve()
      })
    })
  },

  checkRateLimit: async function (threshold, path, ip, nTTL = 1800) {
    try {
      if (!config.THRESHOLD_RATE_LIMIT) return
      const ipLimit = await redisClient.incr(`${path}:${ip}`)
      if (ipLimit > threshold) {
        // return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].request) })
        return 'LIMIT_REACHED'
      } else {
        const ttl = await redisClient.ttl(`${path}:${ip}`)
        if (ttl === -1) {
          await redisClient.expire(`${path}:${ip}`, nTTL)
        }
        // return next()
      }
    } catch (error) {
      handleCatchError(error)
      // return next()
    }
    // }
  },

  blackListToken: function (token) {
    try {
      const sBlackListKey = `BlackListToken:${token}`
      const tokenData = jwt.decode(token, { complete: true })
      const tokenExp = tokenData.payload.exp
      redisClient.setex(sBlackListKey, tokenExp, 0)
    } catch (error) {
      handleCatchError(error)
    }
  },

  queuePush: function (queueName, data) {
    if (queueObject[`${queueName}`]) {
      queueObject[`${queueName}`].client.rpush(queueObject[`${queueName}`].name, JSON.stringify(data))
    } else redisClient.rpush(queueName, JSON.stringify(data))
  },

  queuePop: function (queueName) {
    if (queueObject[`${queueName}`]) {
      return queueObject[`${queueName}`].client.blpop(queueName, 10)
    }
    return redisClient.lpop(queueName)
  },

  bulkQueuePop: function (queueName) {
    if (queueObject[`${queueName}`]) {
      return queueObject[`${queueName}`].client.blpop(queueName, 10)
    }
    return redisClient.lpop(queueName)
  },

  queueLen: function (queueName) {
    if (queueObject[`${queueName}`]) {
      return queueObject[`${queueName}`].client.llen(queueObject[`${queueName}`].name)
    }
    return redisClient.llen(queueName)
  },

  totalKeysCount: async function (keyPattern) {
    const totalKeys = await redisClient.keys(keyPattern)
    return totalKeys.length
  },

  createRedisHash,
  getRedisHash,
  removeRedisKey,
  redisClient
}
