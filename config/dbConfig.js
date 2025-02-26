const dbVar = {

  ADMIN_DB_URL: process.env.ADMIN_DB_URL || 'mongodb://localhost:27017/ol_admins',
  USER_DB_URL: process.env.USER_DB_URL || 'mongodb://localhost:27017/ol_users',
  GAME_DB_URL: process.env.GAME_DB_URL || 'mongodb://localhost:27017/ol_games',
  NOTIFICATION_DB_URL: process.env.NOTIFICATION_DB_URL || 'mongodb://localhost:27017/ol_notifications',
  STATISTICS_DB_URL: process.env.STATISTICS_DB_URL || 'mongodb://localhost:27017/ol_statistics',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_USERNAME: process.env.REDIS_USERNAME || 'default',
  REDIS_CONNECTION_STRING: process.env.REDIS_CONNECTION_STRING || 'redis://localhost:6379',
  REDIS_DB: process.env.REDIS_DB || 3,

  // SQL Database configuration variables
  DB_SQL_NAME: process.env.DB_SQL_NAME || 'test',
  DB_SQL_USER: process.env.DB_SQL_USER || 'root',
  DB_SQL_PASSWORD: process.env.DB_SQL_PASSWORD || '',
  DB_SQL_HOST: process.env.DB_SQL_HOST || '127.0.0.1',
  DB_SQL_PORT: process.env.DB_SQL_PORT || 3306,
  DB_SQL_HOST_REPLICA: process.env.DB_SQL_HOST_REPLICA || process.env.DB_SQL_HOST || '127.0.0.1',
  DB_SQL_DIALECT: process.env.DB_SQL_DIALECT || 'mysql',

  username: process.env.DB_SQL_USER || 'root',
  password: process.env.DB_SQL_PASSWORD || 'root',
  database: process.env.DB_SQL_NAME || 'test',
  host: process.env.DB_SQL_HOST || '127.0.0.1',
  port: process.env.DB_SQL_PORT || 3306,
  dialect: process.env.DB_SQL_DIALECT || 'mysql',

  ADMIN_LOGIN_AUTHENTICATION: process.env.ADMIN_LOGIN_AUTHENTICATION || 'password' // Admin login authentication method
}

module.exports = dbVar
