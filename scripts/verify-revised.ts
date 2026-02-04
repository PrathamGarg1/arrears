
import { calculateArrears } from '../lib/calculation-engine'
import { format } from 'date-fns'

// DATA for Verification
// Period: 01.07.2021 (When rate changed)

const payEvents = [
    // Event covering the period of change
    { date: new Date('2021-05-01'), type: 'CHANGE', basicPay: 62500, drawnBasicPay: 19210, drawnGradePay: 5350, drawnIR: 1228 }
]

const daRates = [
    // REVISED
    { effectiveDate: new Date('2021-01-01'), percentage: 17, type: 'REVISED' as const },
    { effectiveDate: new Date('2021-07-01'), percentage: 31, type: 'REVISED' as const }, // UPDATED

    // PRE-REVISED
    { effectiveDate: new Date('2021-01-01'), percentage: 164, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2021-07-01'), percentage: 196, type: 'PRE_REVISED' as const } // UPDATED
]

const result = calculateArrears({
    startDate: new Date('2021-06-01'), // Check June (Old Rate) and July (New Rate)
    endDate: new Date('2021-07-31'),
    payEvents,
    daRates
})

console.log('=== VERIFICATION OF UPDATED DA RATES ===\n')

result.forEach((seg, idx) => {
    console.log(`${idx + 1}. ${format(seg.startDate, 'dd.MM.yy')} to ${format(seg.endDate, 'dd.MM.yy')}`)
    console.log(`   Due DA: ${seg.daPercentage}%`)
    console.log(`   Drawn DA: ${seg.drawnDAPercentage}%`)
    console.log(`   Total Due: ${seg.monthlyDueTotal}`)
    console.log(`   Total Drawn: ${seg.drawnTotal}`)
    console.log('')
})
