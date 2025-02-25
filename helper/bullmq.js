const { Queue, Worker } = require('bullmq')
const Redis = require('ioredis')
const config = require('../config/config')

const connection = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  username: config.REDIS_USERNAME,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  db: config.REDIS_DB
})

const createQueue = ({ sQueueName = '' }) => {
  return new Queue(sQueueName, { connection })
}

const addJob = async ({ oQueue, sKey, oPayload, nTimeMS, oConfig = {} }) => {
  return await oQueue.add(sKey, oPayload, { delay: nTimeMS, removeOnComplete: true, jobId: sKey, ...oConfig })
}

const removeRepeatableJob = async({ oQueue, sKey, oRepeatConfig }) => {
  return await oQueue.removeRepeatable(sKey, oRepeatConfig, sKey)
}

const addBulkJobs = async ({ oQueue, aJobs }) => {
  return await oQueue.addBulk(aJobs)
}

const deleteJob = async ({ sKey, oQueue }) => {
  const job = await oQueue.getJob(sKey)
  if (job) await job.remove()
  return true
}

const updateJobTTL = async ({ sKey, nTimeMS, oQueue }) => {
  const job = await oQueue.getJob(sKey)
  if (job) {
    await job.changeDelay(nTimeMS)
  }
  return true
}

const subscribeQueue = ({ oQueue, config, callBack }) => {
  const queueMsg = `Subscribing data from queue '${oQueue.name
    }' || ${new Date().toLocaleDateString()}|${new Date().toLocaleTimeString()}`
  console.log(queueMsg)
  const worker = new Worker(
    oQueue.name,
    async job => {
      try {
        await callBack(job)
      } catch (error) {
        if (error?.message === 'RETRY_JOB') {
          throw new Error(
            `Failed to process the job internally so retrying... attemptsMade:${job.attemptsMade} attemptsStarted:${job.attemptsStarted}`
          )
        } else {
          throw new Error('Something went wrong while processing the job')
        }
      }
    },
    {
      connection,
      ...config
    }
  )
  return worker
}

module.exports = {
  createQueue,
  addJob,
  deleteJob,
  updateJobTTL,
  subscribeQueue,
  addBulkJobs,
  removeRepeatableJob
}
