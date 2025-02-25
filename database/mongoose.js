const mongoose = require('mongoose')
const { handleCatchError } = require('../helper/utilities.services')

const config = require('../config/config')
const AdminsDBConnect = connection(config.OT_ADMIN_DB_URL, parseInt(config.ADMINS_DB_POOLSIZE), 'Admins')
const UsersDBConnect = connection(config.OT_USER_DB_URL, parseInt(config.USERS_DB_POOLSIZE), 'Users')
const GamesDBConnect = connection(config.OT_GAME_DB_URL, parseInt(config.GAMES_DB_POOLSIZE), 'Games')
const NotificationsDBConnect = connection(config.OT_NOTIFICATION_DB_URL, parseInt(config.NOTIFICATIONS_DB_POOLSIZE), 'Notifications')
const StatisticsDBConnect = connection(config.OT_STATISTICS_DB_URL, parseInt(config.STATISTICS_DB_POOLSIZE), 'Statistics')

function connection(DB_URL, maxPoolSize = 10, DB) {
  try {
    const dbConfig = { readPreference: 'secondaryPreferred', maxPoolSize }

    const conn = mongoose.createConnection(DB_URL, dbConfig)
    conn.on('connected', () => console.log(`Connected to ${DB} database.`))
    return conn
  } catch (error) {
    console.log('error', error)
    handleCatchError(error)
  }
}
// mongoose.set('debug', true)
module.exports = {
  AdminsDBConnect,
  UsersDBConnect,
  GamesDBConnect,
  NotificationsDBConnect,
  StatisticsDBConnect
}
