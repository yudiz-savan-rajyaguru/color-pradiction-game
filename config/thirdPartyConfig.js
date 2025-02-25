const thirdPartyCred = {

  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || 'your aws access key',
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || 'your aws secretAccessKey',
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
  AWS_BUCKET_ENDPOINT: process.env.AWS_BUCKET_ENDPOINT,

  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'yudiz-color-prediction-media',
  S3_BUCKET_URL: process.env.S3_BUCKET_URL || 'https://yudiz-color-prediction-media.s3.ap-south-1.amazonaws.com/',
  S3_BUCKET_KYC_URL: process.env.S3_BUCKET_KYC_URL || '',
  S3_KYC_PAN: process.env.S3_KYC_PAN_PATH || 'kyc/pan/',
  S3_KYC_AADHAAR: process.env.S3_KYC_AADHAAR_PATH || 'kyc/aadhaar/',
  S3_KYC_BUCKET_NAME: process.env.S3_KYC_BUCKET_NAME || 'predi-kyc',
  S3_COMPLAINT: process.env.S3_COMPLAINTS_PATH || 'complaint/',

  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBbVb54ZxgNwG-c3ImBDBRS2OZrlVO_23s',
  GOOGLE_CLIENT_ID_W: process.env.GOOGLE_CLIENT_ID_W || '218538323308-p1bf5od94pbdfna1rstq3s1kea8gpgfr.apps.googleusercontent.com',
  CLOUD_STORAGE_PROVIDER: process.env.CLOUD_STORAGE_PROVIDER || 'AWS',
  SENTRY_DSN: process.env.SENTRY_DSN || 'https://public@sentry.example.com/',
  SMTP_FROM: process.env.SMTP_FROM || 'fwl47576@gmail.com',
  OTP_PROVIDER: process.env.OTP_PROVIDER || 'TEST',
  TEST_OTP: process.env.TEST_OTP || 123456,

  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID || 'eleven-wicket',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'yudiz-color-prediction-media',

  AZURE_ACCOUNT_NAME: process.env.AZURE_ACCOUNT_NAME || 'color-predictionwl',
  AZURE_ACCOUNT_KEY: process.env.AZURE_ACCOUNT_KEY || '',
  AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME || 'yudiz-color-prediction-media',

  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID,
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,

  KYC_DIRECT_VALIDATE: process.env.KYC_DIRECT_VALIDATE ? JSON.parse(process.env.KYC_DIRECT_VALIDATE) : false,
  KYC_CASHFREE_VERIFICATION: process.env.KYC_CASHFREE_VERIFICATION ? JSON.parse(process.env.KYC_CASHFREE_VERIFICATION) : false,
  CASHFREE_VERIFICATION_URL: process.env.CASHFREE_VERIFICATION_URL || 'https://sandbox.cashfree.com/verification',
  CASHFREE_CLIENTID: process.env.CASHFREE_CLIENTID,
  CASHFREE_CLIENTSECRET: process.env.CASHFREE_CLIENTSECRET,
  CASHFREE_AADHAAR_VERIFY_PATH: 'offline-aadhaar/verify',
  CASHFREE_AADHAAR_SENDOTP_PATH: 'offline-aadhaar/otp',
  CASHFREE_PAN_VERIFY_PATH: 'pan',

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5aa',
  RAZORPAY_SECRET: process.env.RAZORPAY_SECRET || 'f4d8a0f3e1b1d7c4e5e6e5e6',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'razorpay_webhook_secret',

  COINBASE_WEBHOOK_SECRET: process.env.COINBASE_WEBHOOK_SECRET || 'e4812b73-4934-433c-8da3-1bc7349bd3a7',
  COINBASE_API_KEY: process.env.COINBASE_API_KEY || 'f7814cad-9674-4672-a238-e29fabd89fb7',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
}
module.exports = thirdPartyCred
