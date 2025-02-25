const redisKey = {}

redisKey.getPortfolioKey = ({ eHistoryStatus, iUserId }) => `OT:PORTFOLIO:${eHistoryStatus}:${iUserId}`
redisKey.getPortfolioCardAndCountKey = ({ eHistoryStatus, iUserId }) => `OT:PORTFOLIO:CARD:${eHistoryStatus}:${iUserId}`
module.exports = redisKey
