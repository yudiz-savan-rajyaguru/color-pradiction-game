const { XP_QUEUE_CONCURRENCY } = require('../../../config/defaultConfig')
const enums = require('../../../data')
const { subscribeQueue, createQueue } = require('../../../helper/bullmq')
const oUserProfileLevelServices = require('./services')
const XpQueue = createQueue({ sQueueName: enums?.eQueueNames?.XP_QUEUE })
async function XpQueueJobHandler(job) {
  try {
    const eType = job?.data?.eType
    switch (eType) {
      case enums?.xpQueueStatus?.SET_XP:
        oUserProfileLevelServices.addXpUserProfitLevel(job?.data)
        break
      default:
        break
    }
  } catch (error) {
    console.log(`Error Occurred on executeJob ${job.id} ${job.data.channel}! `)
    console.error(error)
  }
}

const startXpWorker = async () => {
  console.log('XP WORKER STARTED')
  const worker = subscribeQueue({ callBack: XpQueueJobHandler, config: { concurrency: Number(XP_QUEUE_CONCURRENCY) }, oQueue: XpQueue })
  worker.on('completed', (job) => {
    // console.log(`${job.id} and name ${job.name} has completed!`)
  })
  worker.on('failed', (job, err) => {
    console.log(`${job?.id} and name ${job?.name} has failed with ${err.message}`)
  })
  worker.on('active', job => {
    // console.log(`worker: active: ${job.name} Active!`)
  })
  worker.on('stalled', job => {
    console.log(`stalled job ${job}, BID-${job}, UID-${job}`)
  })
}

startXpWorker()
