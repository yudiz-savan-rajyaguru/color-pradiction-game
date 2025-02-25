// Object for all Default cred
const defaultVar = {
  REPORT_QUEUE_CONCURRENCY: process.env.REPORT_QUEUE_CONCURRENCY || 1,
  XP_QUEUE_CONCURRENCY: process.env.XP_QUEUE_CONCURRENCY || 1,
  EVENT_QUEUE_CONCURRENCY: process.env.EVENT_QUEUE_CONCURRENCY || 1,
  EVENT_TEMPLATE_QUEUE_CONCURRENCY: process.env.EVENT_TEMPLATE_QUEUE_CONCURRENCY || 50,
  EVENT_PRICE_CHANGE_HISTORY_QUEUE_CONCURRENCY: process.env.EVENT_PRICE_CHANGE_HISTORY_QUEUE_CONCURRENCY || 50,
  BUY_ORDER_QUEUE_CONCURRENCY: process.env.BUY_ORDER_QUEUE_CONCURRENCY || 1,
  SELL_ORDER_QUEUE_CONCURRENCY: process.env.SELL_ORDER_QUEUE_CONCURRENCY || 1,
  PAGINATION_LIMIT: parseInt(process.env.PAGINATION_LIMIT || 500),
  PORT: process.env.PORT || 1338,
  FRONTEND_HOST_URL: process.env.FRONTEND_HOST_URL,
  BACKEND_URL: process.env.BACKEND_URL,
  LOGIN_HARD_LIMIT_ADMIN: 10, // Login limit for admin
  LOGIN_HARD_LIMIT: 5, // 0 = unlimited
  S3FIRSTDEPOSITREPORT: process.env.S3_FIRSTDEPOSIT_REPORT_PATH || 'report/firstDeposit/',
  s3TransactionReport: process.env.s3TransactionReport || 'report/transactionReport/',

  CRON_AUTH_TOKEN: process.env.CRON_AUTH_TOKEN || '',
  DISABLE_ADMIN_ROUTES: process.env.DISABLE_ADMIN_ROUTES === 'true',
  THRESHOLD_RATE_LIMIT: process.env.THRESHOLD_RATE_LIMIT || 5,

  s3UserSegmentReport: process.env.s3UserSegmentReport || 'report/userSegments/',

  OTP_LENGTH: process.env.OTP_LENGTH || 4,
  CACHE_1: 10, // 10 seconds
  CACHE_2: 60, // 1 minute
  CACHE_3: 3600, // 1 hour
  CACHE_4: 86400, // 1 day
  CACHE_5: 864000, // 10 days
  CACHE_6: 21600, // 6 Hours
  CACHE_7: 300, // 5 minute
  CACHE_8: 600, // 10 minute
  CACHE_9: 5, // 5 seconds,
  CACHE_10: 1800, // 30 minute
  CACHE_11: 30, // 30 seconds
  CACHE_12: 120, // 2 minute

  DB_SQL_MIN_POOLSIZE: process.env.DB_SQL_MIN_POOLSIZE || 10,
  DB_SQL_MAX_POOLSIZE: process.env.DB_SQL_MAX_POOLSIZE || 85,

  ADMINS_DB_POOLSIZE: process.env.ADMINS_DB_POOLSIZE || 10,
  USERS_DB_POOLSIZE: process.env.USERS_DB_POOLSIZE || 10,
  GAMES_DB_POOLSIZE: process.env.GAMES_DB_POOLSIZE || 10,
  NOTIFICATIONS_DB_POOLSIZE: process.env.NOTIFICATIONS_DB_POOLSIZE || 10,
  STATISTICS_DB_POOLSIZE: process.env.STATISTICS_DB_POOLSIZE || 10,
  MATCH_DB_POOLSIZE: process.env.MATCH_DB_POOLSIZE || 10,

  JWT_SECRET: process.env.JWT_SECRET || 'aAbBcC@test_123',
  JWT_SECRET_USER: process.env.JWT_SECRET_USER || 'aAbBcC@test_123_User', // JWT secret for user
  JWT_VALIDITY: process.env.JWT_VALIDITY || '2d',
  REFRESH_TOKEN_VALIDITY: process.env.REFRESH_TOKEN_VALIDITY || '30d', // Refresh token validity
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'aAbBcC@test_123', // Refresh token secret
  S3_BUCKET_URL: process.env.S3_BUCKET_URL || 'https://predi-images.s3.ap-south-1.amazonaws.com',
  S3PAYOUTOPTION: process.env.S3_PAYOUT_OPTION_PATH || 'payout-options/',
  S3PAYMENTOPTION: process.env.S3_PAYMENT_OPTIONS_PATH || 'payment-option/',

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef', // Encryption key
  IV_VALUE: process.env.IV_VALUE || 'abcdef9876543210abcdef9876543210', // IV value

  S3EMAILTEMPLATES: process.env.S3_EMAIL_TEMPLATES_PATH || 'email-templates/',
  s3SideBackground: process.env.S3_SIDE_BACKGROUND_PATH || 'side-background/',
  S3_USER_PROFILE_PATH: process.env.S3_USER_PROFILE_PATH || 'Users/profile',
  S3_STREAK_IMAGE_PATH: process.env.S3_STREAK_IMAGE_PATH || 'streak/',
  S3BANNERS: process.env.S3_BANNERS_PATH || 'banners/',
  ALLOWDISKUSE: process.env.MONGODB_ALLOW_DISK_USE || false,
  DEFAULT_OTP: process.env.DEFAULT_OTP || '1234',

  PRIVATE_KEY: `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDUH3YJ9lSOPsof/8qyHKPG1kuAQXNLEWE4bd+VLBgbEitOwm9+
TLpzcnzweaiVfr9NIoaEydxP4ZlJF/h/7fhOuazSQRld429/k+ZzyfmpDkGIPbgK
OndPdy0AuWZoiEMXKQvSbtmbCN0isWlquW1vU7FnSJi4Dm1LbgpnL6FLgwIDAQAB
AoGBAIbHaq/PxVAQU0tbssXS7rkDJjva2k/DPjuljF9zAeoJdFz5q+/a/skl4H7H
PjemrhRrsH8k54gV9th7k5htcswhjs+beqAAS2gbkfM2gyE1py3eMW+9o7B+iurd
anml/SQburJEOqHnavIH33IfqDL21ikNo++3CIfMobKcGbhRAkEA/MrF8V4JEhWH
RYp5dl4Ykeu6+yP71Yg1ZWAqRRBzU+Mvei4I2zO/wjYiBmSY/1R++bBRLV+uybfO
eAXzq49xSQJBANbQkaSTcQfMxXB/YmADBWSxzNuxeUqhkKvUlmrC9r6tMcPDjgkw
I02bPsrkZVWtb1JUvwF2sK9j1ZFsmwXXYmsCQC3BLe6wDIg/aUqG89Ee2ueeeSt3
qd9OVgvRShVSEu2+ExvUNTonta+bSLFLh/2+93SOG0NRLDvKjw5eVWpZ/jECQQC1
bWxEun5RXyI2NHAqtQJ+HCjwOAFABhrA9Yig3M83FeIc+/HfUrfOWNr800++v/9w
YsD7hHoPd9sturNniJTHAkAY27gpCsXkQ4mBYNMmyW7SvP0u7D4J39CpM1vLBInM
SSMOg2rBkjg7SFp1Y+xtRNv6V/fYLQq2ohILPu1KkHIf
-----END RSA PRIVATE KEY-----`,
  PUBLIC_KEY: `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDUH3YJ9lSOPsof/8qyHKPG1kuA
QXNLEWE4bd+VLBgbEitOwm9+TLpzcnzweaiVfr9NIoaEydxP4ZlJF/h/7fhOuazS
QRld429/k+ZzyfmpDkGIPbgKOndPdy0AuWZoiEMXKQvSbtmbCN0isWlquW1vU7Fn
SJi4Dm1LbgpnL6FLgwIDAQAB
-----END PUBLIC KEY-----`,
  // ENTITY_SPORTS_URL: process.env.ENTITY_SPORTS_URL || 'https://entity-sports-api-dev.fantasywl.in',
  // ENTITY_SPORTS_TOKEN: process.env.ENTITY_SPORTS_TOKEN || '',

  DIGIO_BASE_URL: process.env.DIGIO_BASE_URL || '',
  DIGIO_CLIENT_ID: process.env.DIGIO_CLIENT_ID || '',
  DIGIO_SECRET: process.env.DIGIO_SECRET || '',
  DIGIO_WORKFLOW_NAME: process.env.DIGIO_WORKFLOW_NAME || '',
  FUNCTIONALITY: {
    USER_KYC_VISIBLE: true
  },
  ALLOW_BANK_UPDATE: (process.env.ALLOW_BANK_UPDATE === 'true'), // this flag is for admin allow to user to update bank details or not.
  TRIAL_USER_NUMBER: process.env.TRIAL_USER_NUMBER || '9414549184',
  NEWS_LETTER_COUNT: process.env.NEWS_LETTER_COUNT || 3,
  AUTO_OUTCOME_THRESHOLD: process.env.AUTO_OUTCOME_THRESHOLD || 3,
  CUSTOM_DEEP_LINK_ENABLED: process.env.CUSTOM_DEEP_LINK_ENABLED || '0',
  DEEP_LINK_URL: process.env.DEEP_LINK_URL || 'https://opinioslab-deeplink.lc.webdevprojects.cloud'
}
module.exports = defaultVar
