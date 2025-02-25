const enums = require('../../data')
const { subscribeQueue, createQueue } = require('../../helper/bullmq')
const oReportService = require('./service')
const oLeaderBoardHandler = require('../leaderboard/handler')
const ReportQueue = createQueue({ sQueueName: enums?.eQueueNames?.REPORT_QUEUE })
async function ReportQueueJobHandler(job) {
  const eType = job?.data?.eType
  switch (eType) {
    case enums?.eReportQueueStatus?.SET_REPORT:
      oReportService.createEventReport(job?.data)
      break
    case enums?.eReportQueueStatus?.SET_GLOBAL_LEADERBOARD_REMOVE_REDIS_KEY:
      oLeaderBoardHandler.buildAllLeaderBoard({ iEventId: job?.data?.iEventId, aLeaderBoardEnums: job?.data?.aLeaderBoardEnums, aLeaderBoardType: job?.data?.eLeaderBoardType, bIsDeleteKeys: job?.data?.bIsDeleteKeys })
      break
    default:
      break
  }
}

const startReportWorker = async () => {
  const worker = subscribeQueue({
    callBack: ReportQueueJobHandler,
    config: {
      limiter: { max: 10, duration: 1000 }, // Rate limiting
      stalledInterval: 30000
    },
    oQueue: ReportQueue
  })
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

startReportWorker()
