const { handleCatchError } = require('../../helper/utilities.services')
const ReportModel = require('./model')

const aReportSeeder = [
  {
    eType: 'U',
    oTotalUser: {
      nTotalUsers: 0,
      // nTotalEmailVerifiedUsers: 0,
      nTotalPhoneVerifiedUsers: 0
    },
    oRegisterUser: {
      nToday: 0,
      nYesterday: 0,
      nLastWeek: 0,
      nLastMonth: 0,
      nLastYear: 0,
      aPlatformWiseUser: [
        {
          eTitle: 'O',
          nValue: 0
        },
        {
          eTitle: 'I',
          nValue: 0
        },
        {
          eTitle: 'W',
          nValue: 0
        },
        {
          eTitle: 'A',
          nValue: 0
        }
      ]
    },
    oLoginUser: {
      nToday: 0,
      nYesterday: 0,
      nLastWeek: 0,
      nLastMonth: 0,
      nLastYear: 0
    },
    oDeposit: {
      nTotalWinnings: 0,
      nTotalDeposits: 0,
      nTotalPendingDeposits: 0,
      nTotalSuccessDeposits: 0,
      nTotalCancelledDeposits: 0,
      nTotalRejectedDeposits: 0,
      aDeposits: [
        {
          eTitle: 'ADMIN',
          nValue: 0
        },
        {
          eTitle: 'RAZORPAY_UPI',
          nValue: 0
        },
        {
          eTitle: 'RAZORPAY',
          nValue: 0
        }
      ]
    },
    oWithdraw: {
      aSuccessWithdrawals: [
        {
          eTitle: 'RAZORPAY',
          nValue: 0
        },
        {
          eTitle: 'ADMIN',
          nValue: 0
        }
      ],
      aPendingWithdrawals: [],
      nTotalWithdrawals: 0
    },
    oTds: {
      nTotalTds: 0,
      nTotalActiveTds: 0,
      nTotalPendingTds: 0
    },
    oBonusExpire: {
      nTotal: 0,
      nToday: 0,
      nYesterday: 0,
      nLastWeek: 0,
      nLastMonth: 0,
      nLastYear: 0
    },
    oUserBonus: {
      nTotal: 0,
      nToday: 0,
      nYesterday: 0,
      nLastWeek: 0,
      nLastMonth: 0,
      nLastYear: 0
    },
    aParticipants: [
      {
        eCategory: 'C',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'S',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'IPO',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'GT',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'CR',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'N',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      }
    ],
    aWins: [
      {
        eCategory: 'C',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'S',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'CR',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'IPO',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'GT',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'N',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      }
    ],
    aWinReturn: [
      {
        eCategory: 'C',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'S',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'CR',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'IPO',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'GT',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'N',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      }
    ],
    aPlayReturn: [
      {
        eCategory: 'C',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'S',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'CR',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'IPO',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'GT',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'N',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      }
    ],
    aPlayed: [
      {
        eCategory: 'C',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'S',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'CR',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'IPO',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'GT',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'N',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      }
    ],
    aCreatorBonus: [
      {
        eCategory: 'C',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'S',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'CR',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'IPO',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'GT',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'N',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      }
    ],
    aCreatorBonusReturn: [
      {
        eCategory: 'C',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'S',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'CR',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'IPO',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'GT',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'N',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      }
    ],
    aAppDownload: [
      {
        ePlatform: 'A',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        ePlatform: 'I',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      }
    ],
    oApplicableTax: {
      aCategoryTax: [
        {
          eTransactionType: 'DEPOSIT_TAX',
          nTotal: 0,
          nToday: 0,
          nYesterday: 0,
          nLastWeek: 0,
          nLastMonth: 0,
          nLastYear: 0
        },
        {
          eTransactionType: 'WITHDRAW_TAX',
          nTotal: 0,
          nToday: 0,
          nYesterday: 0,
          nLastWeek: 0,
          nLastMonth: 0,
          nLastYear: 0
        }
        // {
        //   eTransactionType: 'CONTEST_JOIN_TAX',
        //   nTotal: 0,
        //   nToday: 0,
        //   nYesterday: 0,
        //   nLastWeek: 0,
        //   nLastMonth: 0,
        //   nLastYear: 0
        // }
      ]
      // aContestJoinTax: [
      //   {
      //     eCategory: 'C',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'S',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'CR',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'IPO',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'GT',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'N',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   }
      // ]
    }
  },
  {
    eType: 'B',
    oTotalUser: {
      nTotalUsers: 0,
      // nTotalEmailVerifiedUsers: 0,
      nTotalPhoneVerifiedUsers: 0
    },
    oRegisterUser: {
      nToday: 0,
      nYesterday: 0,
      nLastWeek: 0,
      nLastMonth: 0,
      nLastYear: 0,
      aPlatformWiseUser: [
        {
          eTitle: 'O',
          nValue: 0
        },
        {
          eTitle: 'I',
          nValue: 0
        },
        {
          eTitle: 'W',
          nValue: 0
        },
        {
          eTitle: 'A',
          nValue: 0
        }
      ]
    },
    oLoginUser: {
      nToday: 0,
      nYesterday: 0,
      nLastWeek: 0,
      nLastMonth: 0,
      nLastYear: 0
    },
    oDeposit: {
      nTotalWinnings: 0,
      nTotalDeposits: 0,
      nTotalPendingDeposits: 0,
      nTotalSuccessDeposits: 0,
      nTotalCancelledDeposits: 0,
      nTotalRejectedDeposits: 0,
      aDeposits: [
        {
          eTitle: 'ADMIN',
          nValue: 0
        },
        {
          eTitle: 'RAZORPAY_UPI',
          nValue: 0
        },
        {
          eTitle: 'RAZORPAY',
          nValue: 0
        }
      ]
    },
    oWithdraw: {
      aSuccessWithdrawals: [
        {
          eTitle: 'RAZORPAY',
          nValue: 0
        },
        {
          eTitle: 'RAZORPAY_UPI',
          nValue: 0
        },
        {
          eTitle: 'ADMIN',
          nValue: 0
        }
      ],
      aPendingWithdrawals: [],
      nTotalWithdrawals: 0
    },
    oTds: {
      nTotalTds: 0,
      nTotalActiveTds: 0,
      nTotalPendingTds: 0
    },
    oBonusExpire: {
      nTotal: 0,
      nToday: 0,
      nYesterday: 0,
      nLastWeek: 0,
      nLastMonth: 0,
      nLastYear: 0
    },
    oUserBonus: {
      nTotal: 0,
      nToday: 0,
      nYesterday: 0,
      nLastWeek: 0,
      nLastMonth: 0,
      nLastYear: 0
    },
    aParticipants: [
      {
        eCategory: 'C',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'S',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'IPO',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'GT',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'CR',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'N',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      }
    ],
    aWins: [
      {
        eCategory: 'C',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'S',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'CR',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'IPO',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'GT',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'N',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      }
    ],
    aWinReturn: [
      {
        eCategory: 'C',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'S',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'CR',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'IPO',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'GT',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'N',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      }
    ],
    aPlayReturn: [
      {
        eCategory: 'C',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'S',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'CR',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'IPO',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'GT',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'N',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      }
    ],
    aPlayed: [
      {
        eCategory: 'C',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'S',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'CR',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'IPO',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'GT',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      },
      {
        eCategory: 'N',
        nTotalCash: 0,
        nTotalBonus: 0,
        nTodayCash: 0,
        nTodayBonus: 0,
        nYesterCash: 0,
        nYesterBonus: 0,
        nWeekCash: 0,
        nWeekBonus: 0,
        nMonthCash: 0,
        nMonthBonus: 0,
        nYearCash: 0,
        nYearBonus: 0
      }
    ],
    aCreatorBonus: [
      {
        eCategory: 'C',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'S',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'CR',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'IPO',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'GT',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'N',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      }
    ],
    aCreatorBonusReturn: [
      {
        eCategory: 'C',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'S',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'CR',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'IPO',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'GT',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        eCategory: 'N',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      }
    ],
    aAppDownload: [
      {
        ePlatform: 'A',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      },
      {
        ePlatform: 'I',
        nTotal: 0,
        nToday: 0,
        nYesterday: 0,
        nLastWeek: 0,
        nLastMonth: 0,
        nLastYear: 0
      }
    ],
    oApplicableTax: {
      aCategoryTax: [
        {
          eTransactionType: 'DEPOSIT_TAX',
          nTotal: 0,
          nToday: 0,
          nYesterday: 0,
          nLastWeek: 0,
          nLastMonth: 0,
          nLastYear: 0
        },
        {
          eTransactionType: 'WITHDRAW_TAX',
          nTotal: 0,
          nToday: 0,
          nYesterday: 0,
          nLastWeek: 0,
          nLastMonth: 0,
          nLastYear: 0
        }
        // {
        //   eTransactionType: 'CONTEST_JOIN_TAX',
        //   nTotal: 0,
        //   nToday: 0,
        //   nYesterday: 0,
        //   nLastWeek: 0,
        //   nLastMonth: 0,
        //   nLastYear: 0
        // }
      ]
      // aContestJoinTax: [
      //   {
      //     eCategory: 'C',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'S',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'CR',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'IPO',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'GT',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   },
      //   {
      //     eCategory: 'N',
      //     nTotal: 0,
      //     nToday: 0,
      //     nYesterday: 0,
      //     nLastWeek: 0,
      //     nLastMonth: 0,
      //     nLastYear: 0
      //   }
      // ]
    }
  }
]

async function loadSeed() {
  try {
    await ReportModel.insertMany(aReportSeeder)
    console.log('Seed loaded successfully')
  } catch (error) {
    handleCatchError(error)
  }
}
loadSeed()
