
import { calculateArrears } from '../lib/calculation-engine'

// MOCK DATA matching the image's "Jan to May" and "June" split
const mockPayEvents = [
    {
        date: new Date('2016-01-01'),
        type: 'INITIAL',
        basicPay: 49500, // Due BP
        drawnBasicPay: 14680,
        drawnGradePay: 4300,
        drawnIR: 949
    },
    {
        date: new Date('2016-06-23'),
        type: 'PROMOTION', // or just change
        basicPay: 50700,
        drawnBasicPay: 14680, // Same Drawn BP?
        drawnGradePay: 4700,  // GP Increased?
        drawnIR: 969          // IR Changed?
    }
]

const mockDARates = [
    { effectiveDate: new Date('2016-01-01'), percentage: 0, type: 'REVISED' as const },
    { effectiveDate: new Date('2016-07-01'), percentage: 2, type: 'REVISED' as const },
    { effectiveDate: new Date('2016-01-01'), percentage: 125, type: 'PRE_REVISED' as const },
    { effectiveDate: new Date('2016-07-01'), percentage: 132, type: 'PRE_REVISED' as const }
]

const result = calculateArrears({
    startDate: new Date('2016-01-01'),
    endDate: new Date('2016-08-31'),
    payEvents: mockPayEvents,
    daRates: mockDARates
})

console.log(JSON.stringify(result, null, 2))
