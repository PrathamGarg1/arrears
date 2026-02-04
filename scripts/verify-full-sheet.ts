
import { calculateArrears } from '../lib/calculation-engine'
import { format } from 'date-fns'

// DA RATES (Updated with July 2021 correction)
const daRates = [
    // REVISED (7th CPC)
    { effectiveDate: new Date('2016-01-01'), percentage: 0, type: 'REVISED' as const },
    { effectiveDate: new Date('2016-07-01'), percentage: 2, type: 'REVISED' as const },
    { effectiveDate: new Date('2017-01-01'), percentage: 4, type: 'REVISED' as const },
    { effectiveDate: new Date('2017-07-01'), percentage: 5, type: 'REVISED' as const },
    { effectiveDate: new Date('2018-01-01'), percentage: 7, type: 'REVISED' as const },
    { effectiveDate: new Date('2018-07-01'), percentage: 9, type: 'REVISED' as const },
    { effectiveDate: new Date('2019-01-01'), percentage: 12, type: 'REVISED' as const },
    { effectiveDate: new Date('2019-07-01'), percentage: 17, type: 'REVISED' as const },
    { effectiveDate: new Date('2020-01-01'), percentage: 17, type: 'REVISED' as const },
    { effectiveDate: new Date('2020-07-01'), percentage: 17, type: 'REVISED' as const },
    { effectiveDate: new Date('2021-01-01'), percentage: 17, type: 'REVISED' as const },
    { effectiveDate: new Date('2021-07-01'), percentage: 31, type: 'REVISED' as const }, // Corrected

    // PRE-REVISED (6th CPC)
    { effectiveDate: new Date('2016-01-01'), percentage: 125, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2016-07-01'), percentage: 132, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2017-01-01'), percentage: 136, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2017-07-01'), percentage: 139, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2018-01-01'), percentage: 142, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2018-07-01'), percentage: 148, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2019-01-01'), percentage: 154, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2019-07-01'), percentage: 164, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2020-01-01'), percentage: 164, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2020-07-01'), percentage: 164, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2021-01-01'), percentage: 164, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2021-07-01'), percentage: 196, type: 'PRE_REVISED' as const } // Corrected
]

// PAY EVENTS (Inputs only on change)
const payEvents = [
    // Jan 2016 Initial
    { date: new Date('2016-01-01'), type: 'INITIAL', basicPay: 49500, drawnBasicPay: 14680, drawnGradePay: 4300, drawnIR: 949 },

    // June 2016 Change
    { date: new Date('2016-06-23'), type: 'CHANGE', basicPay: 50700, drawnBasicPay: 14680, drawnGradePay: 4700, drawnIR: 969 },

    // Jan 2017 Increment (Missing in previous run)
    { date: new Date('2017-01-01'), type: 'CHANGE', basicPay: 53800, drawnBasicPay: 15850, drawnGradePay: 4700, drawnIR: 1028 },

    // Jan 2018 Increment (Missing in previous run)
    { date: new Date('2018-01-01'), type: 'CHANGE', basicPay: 55400, drawnBasicPay: 16470, drawnGradePay: 4700, drawnIR: 1059 },

    // May 2018 Change
    { date: new Date('2018-05-05'), type: 'CHANGE', basicPay: 57200, drawnBasicPay: 17110, drawnGradePay: 5350, drawnIR: 1123 },

    // May 2019 Change
    { date: new Date('2019-05-01'), type: 'CHANGE', basicPay: 58900, drawnBasicPay: 17790, drawnGradePay: 5350, drawnIR: 1157 },

    // May 2020 Change
    { date: new Date('2020-05-01'), type: 'CHANGE', basicPay: 60700, drawnBasicPay: 18490, drawnGradePay: 5350, drawnIR: 1192 },

    // May 2021 Change
    { date: new Date('2021-05-01'), type: 'CHANGE', basicPay: 62500, drawnBasicPay: 19210, drawnGradePay: 5350, drawnIR: 1228 }
]

const result = calculateArrears({
    startDate: new Date('2016-01-01'),
    endDate: new Date('2021-06-30'),
    payEvents,
    daRates
})

console.log('=== FULL SHEET VERIFICATION ===\n')

let totalArrear = 0
result.forEach((seg, idx) => {
    const diff = seg.totalDue - seg.totalDrawn
    totalArrear += diff

    // Format for readability
    const range = `${format(seg.startDate, 'dd.MM.yy')} to ${format(seg.endDate, 'dd.MM.yy')}`
    console.log(`[${range}] Duration: ${seg.durationLabel.padEnd(4)} | Diff: ${diff}`)
})

console.log(`\n=== TOTAL ARREAR PAYABLE: ₹${totalArrear.toLocaleString()} ===`)
console.log(`Expected from Sheet: ₹310,442`)
console.log(`Exact Match? ${totalArrear === 310442 ? '✅ YES' : '❌ NO'}`)
