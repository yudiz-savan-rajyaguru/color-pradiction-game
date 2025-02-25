// @ts-check
const eChartProviders = {
  value: ['TV'],
  description: { TV: 'Trading View' },
  default: 'TV',
  map: {
    TRADING_VIEW: 'TV'
  }
}
const enums = {
  eLeaderBoard: {
    value: ['EP', 'W', 'I'],
    description: { EP: 'Event Participant', W: 'Winning', I: 'Investment' },
    map: {
      EVENT_PARTICIPANT: 'EP',
      WINNING: 'W',
      INVESTMENT: 'I'
    }
  },
  eLeaderBoardType: {
    value: ['G', 'ES'],
    description: { G: 'Global', ES: 'Event Specific' },
    map: {
      GLOBAL: 'G',
      EVENT_SPECIFIC: 'ES'
    }
  },
  eSearchType: {
    value: ['ORDER', 'PASSBOOK'],
    description: { ORDER: 'Order', PASSBOOK: 'Passbook' },
    map: {
      ORDER: 'ORDER',
      PASSBOOK: 'PASSBOOK'
    }
  },
  eTab: {
    value: ['AC', 'RE', 'WI'],
    description: { AC: 'Account', RE: 'Rewards', WI: 'Withdraw' },
    map: {
      ACCOUNT: 'AC',
      REWARDS: 'RE',
      WITHDRAW: 'WI'
    }
  },
  eThresholdChangeType: {
    value: ['R', 'F', 'P'],
    description: { R: 'Range', F: 'Fixed', P: 'Percentage' },
    map: {
      RANGE: 'R',
      FIXED: 'F',
      PERCENTAGE: 'P'
    },
    default: 'R'
  },
  eAmountType: {
    value: ['P', 'F'],
    description: { P: 'Percentage', F: 'Fixed' },
    map: {
      PERCENTAGE: 'P',
      FIXED: 'F'
    },
    default: 'F'
  },
  eComparisonType: {
    value: ['GT', 'LT'],
    description: { GT: 'Greater', LT: 'Less' },
    map: {
      GREATER_THEN: 'GT',
      LESS_THEN: 'LT'
    },
    default: 'GT'
  },
  eDigioEvents: {
    kyc_request: 'kyc_request',
    'kyc.request.created': 'kyc.request.created',
    'kyc.request.approved': 'kyc.request.approved'
  },
  eDirections: {
    value: ['UP', 'DOWN'],
    map: {
      UP: 'UP',
      DOWN: 'DOWN'
    }
  },
  eSocketEvents: {
    ORDER_UPDATE: 'ORDER_UPDATE',
    PLACE_ORDER: 'PLACE_ORDER',
    CANCEL_ORDER: 'CANCEL_ORDER',
    ORDER_BOOK_UPDATE: 'ORDER_BOOK_UPDATE',
    PRICE_UPDATE_BY_EVENT: 'PRICE_UPDATE_BY_EVENT',
    EVENT_STATUS_UPDATE: 'EVENT_STATUS_UPDATE',
    EVENT_START: 'EVENT_START',
    EVENT_UPDATES: 'EVENT_UPDATES',
    PAUSE_TRADING: 'PAUSE_TRADING',
    START_TRADING: 'START_TRADING',
    MESSAGE: 'MESSAGE',
    LIVE_UPDATES: 'LIVE_UPDATES',
    ADMIN_UPDATES: 'ADMIN_UPDATES',
    MSG_UPDATES: 'MSG_UPDATES',
    EVENT_TRADING_STATUS_UPDATE: 'EVENT_TRADING_STATUS_UPDATE'
  },
  eIncomingSocketEvents: {
    SUBSCRIBE_EVENT_UPDATES: 'SUBSCRIBE_EVENT_UPDATES',
    SUBSCRIBE_PORTFOLIO_UPDATES: 'SUBSCRIBE_PORTFOLIO_UPDATES',
    SUBSCRIBE_MSG_UPDATES: 'SUBSCRIBE_MSG_UPDATES',
    SUBSCRIBE_ADMIN_EVENT_UPDATES: 'SUBSCRIBE_ADMIN_EVENT_UPDATES',
    SUBSCRIBE_ADMIN_MSG_UPDATES: 'SUBSCRIBE_ADMIN_MSG_UPDATES'
  },
  eSocketRoomPrefix: {
    ADMIN_UPDATES: 'ADMIN_UPDATES'
  },
  eEventQueueStatus: {
    CREATE_AUTO_EVENT: 'CREATE_AUTO_EVENT',
    SCHEDULE_PRICE_CHANGE_HISTORY: 'SCHEDULE_PRICE_CHANGE_HISTORY',
    SET_ADMIN_ORDER: 'SET_ADMIN_ORDER',
    ACTIVE_EVENT: 'ACTIVE_EVENT',
    INACTIVE_EVENT: 'INACTIVE_EVENT',
    PAUSE_TRADING: 'PAUSE_TRADING',
    PENDING_OUTCOME: 'PENDING_OUTCOME',
    SUSPEND_EVENT: 'SUSPEND_EVENT',
    START_TRADING: 'START_TRADING',
    COMPLETE_EVENT: 'COMPLETE_EVENT',
    SET_EVENT_PRICE: 'SET_EVENT_PRICE',
    DECLARE_MANUAL_OUTCOME: 'DECLARE_MANUAL_OUTCOME'
  },
  xpQueueStatus: {
    SET_XP: 'SET_XP'
  },
  reportQueueStatus: {
    SET_REPORT: 'SET_REPORT',
    SET_GLOBAL_LEADERBOARD_REMOVE_REDIS_KEY: 'SET_GLOBAL_LEADERBOARD_REMOVE_REDIS_KEY'
  },
  eQueueNames: {
    EVENT_QUEUE: 'EVENT_QUEUE',
    EVENT_TEMPLATE_QUEUE: 'EVENT_TEMPLATE_QUEUE',
    EVENT_PRICE_CHANGE_HISTORY_QUEUE: 'EVENT_PRICE_CHANGE_HISTORY_QUEUE',
    XP_QUEUE: 'XP_QUEUE',
    REPORT_QUEUE: 'REPORT_QUEUE',
    BUY_ORDER_QUEUE: 'BUY_ORDER_QUEUE',
    SELL_ORDER_QUEUE: 'SELL_ORDER_QUEUE'
  },
  ePriceType: {
    value: ['R', 'B'],
    description: { R: 'Real Money', B: 'Bonus Money' },
    map: {
      REAL_MONEY: 'R',
      BONUS: 'B'
    },
    default: 'R'
  },
  eHistoryStatus: {
    value: ['LIVE', 'CLOSED'],
    description: { LIVE: 'Live', CLOSED: 'Closed' },
    map: {
      LIVE: 'LIVE',
      CLOSED: 'CLOSED'
    }
  },
  eEventStatus: {
    value: ['p', 'a', 'c', 'd', 's', 'su', 'po'],
    description: { p: 'Pending', a: 'Active', c: 'Completed', d: 'Deleted', s: 'Started', su: 'Suspend', po: 'Pending Outcome' },
    map: {
      ACTIVE: 'a',
      INACTIVE: 'i',
      COMPLETED: 'c',
      DELETED: 'd',
      PENDING: 'p',
      STARTED: 's',
      SUSPEND: 'su',
      PENDING_OUTCOME: 'po'
    },
    default: 'p'
  },
  eMatchingAlgo: {
    value: ['OPOM', 'OPDM', 'SPOM'],
    description: {
      OPOM: 'Opposite Pattern - ( Yes to No, No to Yes ) with BUY -> BUY',
      OPDM: 'Opposite Pattern Dynamic Matching - ( Yes to No, No to Yes ) with BUY -> [BUY, SALE] or SALE -> [BUY, SALE]',
      SPOM: 'Same Pattern - ( Yes to Yes, No to No ) with BUY -> BUY'
    },
    map: {
      OPPOSITE_PATTERN_OPPOSITE_MATCHING: 'OPOM',
      OPPOSITE_PATTERN_DYNAMIC_MATCHING: 'OPDM',
      SAME_PATTERN_OPPOSITE_MATCHING: 'SPOM'
    },
    displayMap: [
      { key: 'OPOM', value: 'Opposite Pattern Opposite Matching' },
      { key: 'OPDM', value: 'Opposite Pattern Dynamic Matching' },
      { key: 'SPOM', value: 'Same Pattern Opposite Matching' }
    ],
    default: 'SPOM'
  },
  userType: {
    value: ['U', 'B'],
    description: { U: 'User', B: 'Bot' },
    default: 'U',
    map: {
      USER: 'U',
      ADMIN: 'B'
    }
  },
  appPlatform: {
    value: ['A', 'I', 'W'],
    description: { A: 'Android', I: 'iOS', W: 'Web' },
    map: {
      ANDROID: 'A',
      IOS: 'I',
      WEB: 'W'
    }
  },
  bidType: {
    value: ['BUY', 'SELL'],
    description: { BUY: 'Buy', SELL: 'Sell' },
    default: 'BUY',
    map: {
      BUY: 'BUY',
      SELL: 'SELL'
    }
  },
  symbolType: {
    value: ['YES', 'NO'],
    description: { YES: 'Yes', NO: 'No' },
    default: 'YES',
    map: {
      YES: 'YES',
      NO: 'NO'
    }
  },
  orderType: {
    value: ['MARKET', 'LIMIT'],
    description: { MARKET: 'Market', LIMIT: 'Limit' },
    default: 'MARKET',
    map: {
      MARKET: 'MARKET',
      LIMIT: 'LIMIT'
    }
  },
  orderStatus: {
    value: ['PENDING', 'MATCHED', 'CANCEL', 'CANCELLED', 'PARTIALLY_FILLED', 'SETTLED'],
    description: { PENDING: 'Pending', MATCHED: 'Matched', CANCEL: 'Cancel', PARTIALLY_FILLED: 'Partially Filled', SETTLED: 'for order settlement in partial order', CANCELLED: 'cancelled by the admin at the end of event' },
    default: 'PENDING',
    map: {
      PENDING: 'PENDING',
      MATCHED: 'MATCHED',
      CANCEL: 'CANCEL',
      CANCELLED: 'CANCELLED',
      PARTIALLY_FILLED: 'PARTIALLY_FILLED',
      SETTLED: 'SETTLED'
    }
  },
  tdsStatus: ['P', 'A'], // pending active
  transactionType: {
    value: ['Bonus', 'Refer-Bonus', 'Deposit', 'Withdraw', 'Bonus-Expire', 'Opening', 'TDS', 'Withdraw-Return', 'Play-OT', 'Win-OT', 'Play-Return-OT', 'User-Streak', 'Deactivate-User'],
    map: {
      BONUS: 'Bonus',
      REFER_BONUS: 'Refer-Bonus',
      DEPOSIT: 'Deposit',
      WITHDRAW: 'Withdraw',
      PLAY: 'Play',
      BONUS_EXPIRE: 'Bonus-Expire',
      PLAY_RETURN: 'Play-Return',
      WIN_RETURN: 'Win-Return',
      OPENING: 'Opening',
      CREATOR_BONUS: 'Creator-Bonus',
      TDS: 'TDS',
      WITHDRAW_RETURN: 'Withdraw-Return',
      CASHBACK_CONTEST: 'Cashback-Contest',
      CASHBACK_RETURN: 'Cashback-Return',
      PLAY_OT: 'Play-OT',
      WIN_OT: 'Win-OT',
      PLAY_RETURN_OT: 'Play-Return-OT',
      USER_STREAK: 'User-Streak',
      DEACTIVATE_USER: 'Deactivate-User'
    }
  },
  passbookType: {
    value: ['Cr', 'Dr'],
    map: {
      CR: 'Cr',
      DR: 'Dr'
    }
  },
  filterReportKeys: ['USER_REPORT', 'PARTICIPANT_REPORT', 'WIN_REPORT', 'WIN_RETURN_REPORT', 'PLAY_REPORT', 'PLAY_RETURN_REPORT', 'CREATOR_BONUS_REPORT', 'CREATOR_BONUS_RETURN_REPORT', 'APP_DOWNLOAD_REPORT', 'TAX_REPORT'],
  category: ['CRICKET', 'FOOTBALL', 'KABADDI', 'BASEBALL', 'BASKETBALL', 'HOCKEY', 'CSGO', 'LOL', 'DOTA2', 'HANDBALL', 'NFL'], // Available sports categories
  redirection: ['REFER_AND_EARN', 'CONTEST', 'PROFILE', 'HOME', 'SLB', 'TRANSACTION'],
  platform: ['A', 'I', 'W', 'O', 'AD'], // A = Android, I = iOS, W = Web, O = Other, AD = Admin // Available platforms
  eStatus: {
    value: ['Y', 'N'],
    description: { Y: 'Active', N: 'Inactive' },
    default: 'Y',
    map: {
      ACTIVE: 'Y',
      INACTIVE: 'N'
    }
  },
  // status: ['Y', 'N'], // Active (Yes), Inactive (No)
  passbookStatus: ['P', 'CMP', 'C', 'R'],
  bankProvider: ['ADMIN'],
  adminLogTypes: ['L', 'PC', 'RP'], // L = Login, PC = Password Change, RP = ResetPassword
  adminStatus: ['Y', 'B', 'D'], // Active (Yes), Blocked (Blocked), Deleted (Deleted)
  adminType: ['SUPER', 'SUB'], // Super Admin, Sub Admin

  adminLogKeys: ['D', 'W', 'P', 'KYC', 'BD', 'SUB', 'AD', 'AW', 'PC', 'L', 'PB', 'M', 'ML', 'CR', 'S', 'SLB', 'LB', 'CF', 'MP', 'PL', 'PLC', 'UPU', 'T', 'USR', 'EXT', 'SG', 'AFE', 'TAX', 'AFP', 'AFW', 'ABD', 'OT', 'IP', 'AT', 'RF', 'NL', 'ER'], // D = DEPOSIT, W = WITHDRAW, P = PROFILE, BD = BANK DETAILS, SA = SUBADMIN, AD = ADMIN DEPOSIT, AW = ADMIN WITHDRAW, PC = PROMOCODE, L = LEAGUE, PB = PRIZE BREAKUP, M = MATCH, ML = MATCHLEAGUE, CR = COMMON RULE, S = SETTINGS, SL= SERIES LEADERBOARD, LLB = LOAD LEADERBOARD,PL = PROFILE LEVEL,PLC = PROFILE LEVEL CRITERIA, T = TOURNAMENT, USR  = USER STREAK REWARD, EXT = EXPERT TEAM, SG = SEGMENT, AFE = Affiliate Event, AFP = Affiliate Profile, AFW = Affiliate Withdraw, ABD = Affiliate Bank Details,IP=network access, AT = Automation template, ER = Event Rule // Different log keys for admin actions
  adminLogKeys1: ['D', 'W', 'P', 'KYC', 'BD', 'SUB', 'AD', 'AW', 'PC', 'M', 'CR', 'S', 'LB', 'CF', 'MP', 'PL', 'PLC', 'USR', 'SG', 'AFE', 'TAX', 'AFP', 'AFW', 'ABD', 'OT', 'IP', 'AT', 'RF', 'NL', 'ER'],
  commonRule: ['RB', 'RCB', 'RR', 'DB', 'BOC', 'AC', 'LCG', 'BB', 'NUJD', 'FLJ', 'KYCM', 'KYCWL', 'KYCDOC', 'AKYC', 'XPS'], // BOC = BUY_ORDER_COMMISSION RB = REGISTER_BONUS, RCB = REFER_CODE_BONUS, RR = REGISTER_REFER, DB = DEPOSIT_BONUS, AC = ADMIN_COMMISSION, LCG = LEAGUE_CREATOR_GST, BB=BIRTDAY_BONUS, NUJD = NEW_USER_JOINING_BONUS, FLJ = FREE_LEAGUE_JOINING, KYCM = KYC_MANDATORY, KYCWL = KYC_WITHDRAW_LIMIT, KYCDOC = DOCUMENTS_REQUIRED_FOR_KYC, AKYC = AUTO_KYC, XPS= XP Setting,RF =Rss Feed, NL = News Letter
  ruleType: ['C', 'B', 'D', 'W', 'XP'], // C = CASH, B = BONUS, D = DEPOSIT, W = WITHDRAW, XP = XP
  rewardOn: ['REGISTER', 'FIRST_DEPOSIT', 'FIRST_LEAGUE_JOIN', 'FIRST_PAID_LEAGUE_JOIN'],
  kycDocs: ['A', 'P'], // A = AdharCard, P = PanCard

  adminPay: ['PAY'], // Payment action

  adminPermissionType: ['R', 'W', 'N'], // Read (R), Write (W), None (N) - Access Rights

  adminPermission: [
    // Various admin permission modules
    'OT_ORDER',
    'SUPPORT_CHAT',
    'REPORT',
    'OT_EVENT',
    'OT_CATEGORY',
    'TEST',
    'USERS_PERSONAL_INFO',
    'SUBADMIN',
    'PERMISSION',
    'ADMIN_ROLE',
    'BANNER',
    'CMS',
    'RULE',
    'EMAIL_TEMPLATES',
    'KYC',
    'LEAGUE',
    'MAINTENANCE',
    'MATCH',
    'NOTIFICATION',
    'PUSHNOTIFICATION',
    'PASSBOOK',
    'SYSTEM_USERS',
    'PROMO',
    'SERIES_LEADERBOARD',
    'SETTING',
    'SPORT',
    'BANKDETAILS',
    'USERS',
    'STATISTICS',
    'BALANCE',
    'DEPOSIT',
    'USERLEAGUE',
    'TDS',
    'USERTEAM',
    'WITHDRAW',
    'VERSION',
    'APILOGS',
    'PROFILE_LEVEL',
    'CRICKET',
    'FOOTBALL',
    'BASKETBALL',
    'BASEBALL',
    'HOCKEY',
    'HANDBALL',
    'KABADDI',
    'CSGO',
    'LOL',
    'DOTA2',
    'CUSTOMIZATION',
    'SEGMENTS',
    'USER-SEGMENTS',
    'NFL',
    'AFFILIATE',
    'OT_XP_RULE',
    'PAYMENT_OPTION',
    'DASHBOARD',
    'STREAK',
    'NETACCESS',
    'COMPLAINT',
    'NEWSLETTER',
    'RSSFEED',
    'LEADERBOARD'
  ],

  moduleName: [
    // Permission modules in the application
    'COMMON-RULES',
    'CONTENT',
    'EMAIL-TEMPLATE',
    'FEEDBACKS/COMPLAINTS',
    'LEADERSHIP-BOARD',
    'NOTIFICATIONS',
    'OFFERS',
    'PAYMENT-GATEWAYS',
    'PAYOUT-GATEWAYS',
    'POPUP-ADS-MANAGEMENT',
    'PROMO-CODES',
    'SETTINGS',
    'SLIDERS',
    'SPORTS',
    'VERSIONS',
    'USER',
    'DROPPED-USERS',
    'DELETED-USERS',
    'SYSTEM-USERS',
    'KYC-VERIFICATION',
    'TRANSACTIONS',
    'WITHDRAWALS',
    'DEPOSITS',
    'PUSH-NOTIFICATIONS',
    'TDS-MANAGEMENT',
    'FILTER-CATEGORIES',
    'CRICKET-MATCH-MANAGEMENT',
    'CATEGORY-TEMPLATES',
    'SUB-ADMIN-ROLES',
    'SUB-ADMINS',
    'ADMIN-LOGS',
    'KYC'
  ],
  complainStatus: ['P', 'I', 'D', 'R'], // Pending In-Progress Declined Resolved
  complaintsStatus: ['P', 'I', 'D', 'R'], // Pending, In-Progress, Declined, Resolved
  issueType: ['C', 'F'], // C = Complaints, F = Feedbacks // earlier it was used as complaint and feedback route is same.
  complaintType: ['KYC', 'PAYMENT', 'MATCH', 'OTHER', 'DEPOSIT', 'WITHDRAW'],
  imageFormat: [
    // Supported image formats
    { extension: 'jpeg', type: 'image/jpeg' },
    { extension: 'jpg', type: 'image/jpeg' },
    { extension: 'png', type: 'image/png' },
    { extension: 'gif', type: 'image/gif' },
    { extension: 'svg', type: 'image/svg+xml' },
    { extension: 'heic', type: 'image/heic' },
    { extension: 'heif', type: 'image/heif' }
  ],
  eDocumentContentType: {
    value: ['image/jpeg', 'image/png', 'application/pdf'],
    description: { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/gif': 'GIF', 'image/svg+xml': 'SVG', 'image/heic': 'HEIC', 'image/heif': 'HEIF' },
    map: {
      JPEG: 'image/jpeg',
      PNG: 'image/png',
      PDF: 'application/pdf'
    }
  },
  eDocumentType: {
    value: ['i', 'p'],
    description: { i: 'Image', p: 'PDF' },
    map: {
      IMAGE: 'i',
      PDF: 'p'
    },
    default: 'i'
  },
  otpType: ['E', 'M'], // Email | Mobile
  otpAuth: ['L', 'F', 'V', 'R'], // Register | ForgotPass | Verification | Login
  amountType: ['C', 'B'], // Cash | Bonus
  permissionModule: ['MATCH', 'USER', 'SETTINGS', 'SUB-ADMIN', 'OTHER', 'OPINION-TRADING'], // Permission modules for admin panel

  // add infra issuer

  status: ['Y', 'N'], // Active (Yes), Inactive (No)
  versionType: ['A', 'I'], // A = Android, I = iOS
  cssTypes: ['COMMON', 'CONDITION'],
  bannerType: ['S', 'L'], // S = SCREEN, l = lINK
  bannerScreen: ['D', 'C', 'SUB', 'E', 'S'], // D = DEPOSIT C = CATEGORY SUB = SUB_CATEGORY E = EVENT S= SHARE
  bannerPlace: ['H'], // D = DEPOSIT H = HOME
  bannerPlatform: ['W', 'A', 'I', 'O'], // I = IOS, A = ANDROID, W = WEB, O = Other
  notificationStatus: [0, 1],
  notificationTopic: ['All', 'Web', 'IOS', 'Android'],
  notificationMessageKeys: [
    'PLAY_RETURN',
    'MATCH_TIPS',
    'LINEUPS',
    'MATCH_START',
    'MATCH_AVAILABLE',
    'WIN',
    'WITHDRAWAL_SUCCESSFULL',
    'WITHDRAWAL_FAILED',
    'KYC_FAILED',
    'KYC_APPROVED',
    'MATCH_CANCEL',
    'BONUS_CREDIT',
    'BONUS_EXPIRED',
    'CASHBACK',
    'REFER_BONUS',
    'REGISTER_BONUS',
    'REGISTER_REFER_BONUS',
    'MATCH_TIPS',
    'WITHDRAW',
    'KYC',
    'PROMOTIONS',
    'NONE',
    'BUY_LIMIT',
    'BOOK_PROFIT',
    'SELL_LIMIT',
    'STOP_LOSS',
    'EVENT_OUTCOME',
    'BROADCAST'
  ],
  notificationPlatform: ['A', 'I', 'W', 'ALL', 'All'], // A = Android, I = iOS, W = Web, ALL = ALL
  notificationGroups: ['MATCH', 'PAYMENT', 'PROMOTIONS', 'OTHER', 'BROADCAST'],
  oPushNotificationTypes: {
    bonus_Added: 'bonus_added',
    kyc_Approved: 'kyc_approved',
    kyc_Rejected: 'kyc_rejected',
    referral: 'referral',
    withdrawal: 'withdrawal',
    buy_Limit_Order: 'buy_limit_order',
    sell_Limit_Order: 'sell_limit_order',
    stop_Loss_Trigger: 'stop_loss_trigger',
    book_Profit_Trigger: 'book_profit_trigger',
    event_outcome: 'event_outcome',
    default: 'default'
  },
  settingValueType: ['F', 'R'], // F = Fixed, R = Range
  settingCategory: ['APP', 'ADMIN', 'PAYMENT', 'MATCH'],
  oSettingValueType: {
    Deposit: 'R',
    Withdraw: 'R',
    UserDepositRateLimitTimeFrame: 'R',
    BonusExpireDays: 'F',
    PCF: 'R',
    PUBC: 'R',
    PCS: 'R',
    TDS: 'R',
    CREATOR_BONUS: 'F',
    UserWithdrawRateLimitTimeFrame: 'R',
    WITHDRAW_REJECT: 'F',
    FIX_DEPOSIT2: 'F',
    FIX_DEPOSIT3: 'F',
    MEGA_CONTEST: 'F',
    withdrawPermission: 'R',
    DepositFees: 'F',
    WithdrawFees: 'F',
    SUBADMIN_BLOCK_MANAGE: 'F',
    APPLICATIONS: 'F',
    APPLICATIONS_POPUP: 'F',
    FD: 'F',
    DEPOSIT_TAX: 'F',
    WITHDRAW_TAX: 'F',
    CONTEST_JOIN_TAX: 'F'
  },
  reportsKeys: ['TU', 'RU', 'LU', 'TUT', 'W', 'BE', 'UB', 'TDS', 'DR', 'IC'], // DR = Dropped registration
  aTaxTransactions: ['DEPOSIT_TAX', 'WITHDRAW_TAX'], // drop for OT 'CONTEST_JOIN_TAX'
  eUserType: ['U', 'B', 'CB'],
  userGender: ['M', 'F', 'O'],
  socialType: ['G', 'F', 'A', 'T'],
  userStatus: ['Y', 'N', 'D'],
  referStatus: ['P', 'S'], // P = Pending , S = Success
  utmSource: ['facebook', 'instagram', 'twitter', 'linkedin', 'google', 'pinterest', 'youtube', 'email', 'whatsapp', 'sms', 'quora', 'reddit', 'tiktok'],
  smsProvider: ['MSG91'],
  paymentStatus: ['P', 'S', 'C', 'R'], // P = pending, S = success, C = cancelled, R = refunded
  paymentGetaways: ['ADMIN', 'RAZORPAY'], // Available payout options

  commonType: ['A', 'L'], // Avatar, Logo
  kycStatus: ['P', 'A', 'R', 'N'], // P = Pending, A = Accepted, R = Rejected, N = Not uploaded
  reasonsForDeleteAccount: ['Not satisfied with the service', 'No longer interested', 'Privacy Concerns', 'Facing Technical issues', 'other'],
  contestKeys: ['PCF', 'PCS', 'PUBC'], // ['PCF' = private contest fees, 'PCS' = Public contest size, 'PUBC' = Public contest fees
  withdrawPaymentGetaways: ['BANK', 'UPI', 'RAZORPAY'],
  payoutStatus: ['P', 'S', 'C', 'R', 'I', 'B', 'H', 'D', 'F', 'RE', 'V'], // P = pending, S = success, C = cancelled, R = refunded, I = Initiated, B = Blocked, H = Held, D = Denied, F Failed, RE return,V = Verified
  bankStatus: ['P', 'A', 'R', 'N'], // P = Pending, A = Accepted, R = Rejected, N = Not uploaded
  eThreadStatus: ['A', 'C'], // A = Active, C = Closed
  eMessageUserType: ['U', 'A'], // U = User, A = Admin
  kycVerifiedStatus: ['p', 's', 'c', 'r'], // p = Pending, s = Started, c = Completed , r = Rejected
  paymentOptionsKey: ['RAZORPAY', 'COINBASE'],
  payoutOptionType: ['INSTANT', 'STD'],
  payoutOptionKey: ['BANK', 'UPI'], // Keys of payout options
  categoryTransactionType: ['Win', 'Play', 'Play-Return', 'Win-Return', 'Creator-Bonus', 'TDS', 'Cashback-Contest', 'Cashback-Return', 'Creator-Bonus-Return', 'Loyalty-Point'],
  streakAmountType: ['C', 'B', 'E'], // C = Cash, B = Bonus, E = Extra
  transactionLogType: ['D', 'W', 'AFW'], // D = Deposit , W = Withdraw, AFW = Affiliate Withdraw
  eOrderActionTypes: {
    value: ['BUY', 'SELL', 'CANCEL', 'TRIGGER_UPDATE'],
    map: {
      BUY: 'BUY',
      SELL: 'SELL',
      CANCEL: 'CANCEL',
      TRIGGER_UPDATE: 'TRIGGER_UPDATE'
    }
  },
  eSupportedStockExchange: {
    value: ['NASDAQ', 'NSE'],
    map: {
      NASDAQ: 'NASDAQ',
      NSE: 'NSE'
    },
    oConfig: {
      NASDAQ: {
        bIsChartEnabled: true,
        oExchangeTime: {
          oFrom: {
            nHours: 9,
            nMinutes: 15
          },
          oTo: {
            nHours: 15,
            nMinutes: 30
          }
        }
      },
      NSE: {
        bIsChartEnabled: true,
        oExchangeTime: {
          oFrom: {
            nHours: 9,
            nMinutes: 15
          },
          oTo: {
            nHours: 15,
            nMinutes: 30
          }
        }
      }
    }
  },
  eStockDataProvider: {
    value: ['TD'],
    description: { TD: 'Twelve Data' },
    map: {
      TD: 'TD'
    },
    config: {
      TD: {
        API_URL: 'https://api.twelvedata.com'
      }
    }
  },
  eChartProviders,
  eTheme: {
    value: ['L', 'D'],
    description: { L: 'Light', D: 'Dark' },
    map: {
      LIGHT: 'L',
      DARK: 'D'
    },
    default: 'L'
  },
  notificationMessageTypes: ['BROADCAST', 'AUTOMATED'],
  fileSize: 5 * 1024 * 1024,
  ipType: ['IPv6', 'IPv4'],
  supportFileFormate: ['text/csv', 'text/tab-separated-values', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'],
  promocodeTypes: ['DEPOSIT'],
  rssFeedProvider: ['HINDUSTANTIMES', 'TIMESOFINDIA'],
  eDistributionType: {
    map: {
      WIN: 'win',
      REFUND: 'refund'
    }
  },
  oCryptoTemplate: {
    aQuestionVars: ['#sSymbol', '#nExpectedPrice', '#dEndTime', '#eComparisonType', '#sCurrency'],
    aQuestionConfig: [
      {
        sVariable: '#sSymbol',
        sReplacedValue: 'sName',
        sDescription: 'Current price of Bitcoin'
      },
      {
        sVariable: '#dEndTime',
        sReplacedValue: 'dEndDate',
        sDescription: 'Target time for prediction'
      },
      {
        sVariable: '#nExpectedPrice',
        sReplacedValue: 'nExpectedPrice',
        sDescription: 'Expected price of Bitcoin'
      },
      {
        sVariable: '#eComparisonType',
        sReplacedValue: 'eComparisonType',
        sDescription: 'Type of comparison(more or less)'
      },
      {
        sVariable: '#sCurrency',
        sReplacedValue: 'sCurrency',
        sDescription: 'Currency type'
      }
    ]
  },
  oStockTemplate: {
    aQuestionVars: ['#sSymbol', '#nExpectedPrice', '#dEndTime', '#eComparisonType', '#sCurrency'],
    aQuestionConfig: [
      {
        sVariable: '#sSymbol',
        sReplacedValue: 'sName',
        sDescription: 'Current price of Bitcoin'
      },
      {
        sVariable: '#dEndTime',
        sReplacedValue: 'dEndDate',
        sDescription: 'Target time for prediction'
      },
      {
        sVariable: '#nExpectedPrice',
        sReplacedValue: 'nExpectedPrice',
        sDescription: 'Expected price of Bitcoin'
      },
      {
        sVariable: '#eComparisonType',
        sReplacedValue: 'eComparisonType',
        sDescription: 'Type of comparison(more or less)'
      },
      {
        sVariable: '#sCurrency',
        sReplacedValue: 'sCurrency',
        sDescription: 'Currency type'
      }
    ]
  },
  oYoutubeTemplate: {
    aQuestionVars: ['#title', '#count', '#type', '#enddatetime'],
    aQuestionConfig: [
      {
        sVariable: '#title',
        sReplacedValue: 'VIDEO_TITLE',
        sDescription: 'Title of video'
      },
      {
        sVariable: '#count',
        sReplacedValue: 'COUNT',
        sDescription: 'Target Count'
      },
      {
        sVariable: '#type',
        sReplacedValue: 'TYPE',
        sDescription: 'Type of outcome parameter'
      },
      {
        sVariable: '#enddatetime',
        sReplacedValue: 'END_DATE_TIME',
        sDescription: 'End date or time'
      }
    ]
  },
  eEventActionType: {
    value: ['p', 's'],
    description: { p: 'Pause Trading', s: 'Start Trading' },
    map: {
      PAUSE: 'p',
      START: 's'
    }
  },
  ePriceInterval: {
    value: ['5m', '15m', '30m', '1h', '1d', '1w', '1mo'],
    map: {
      '5_MIN': '5m',
      '15_MIN': '15m',
      '30_MIN': '30m',
      '1_HOUR': '1h',
      '1_DAY': '1d',
      '1_WEEK': '1w',
      '1_MONTH': '1mo'
    },
    oSize: {
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '1d': 24,
      '1w': 7,
      '1mo': 30
    },
    oTime: {
      '5m': 1 * 60000,
      '15m': 1 * 60000,
      '30m': 1 * 60000,
      '1h': 1 * 60000,
      '1d': 60 * 60000,
      '1w': 24 * 60000,
      '1mo': 24 * 60000
    }
  },
  eLinkType: {
    value: ['REFER', 'EVENT_SHARE'],
    map: {
      REFER: 'REFER',
      EVENT_SHARE: 'EVENT_SHARE'
    }
  }
}

module.exports = enums
