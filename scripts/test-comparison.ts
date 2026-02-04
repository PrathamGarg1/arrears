
import { calculateArrears } from '../lib/calculation-engine'

// Exact Scenario from Image
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
        type: 'CHANGE',
        basicPay: 50700,
        drawnBasicPay: 14680, // Drawn BP Same
        drawnGradePay: 4700,  // GP Changed (Drawn side)
        drawnIR: 969          // IR Changed
    }
]

const mockDARates = [
    // Revised
    { effectiveDate: new Date('2016-01-01'), percentage: 0, type: 'REVISED' as const },
    { effectiveDate: new Date('2016-07-01'), percentage: 2, type: 'REVISED' as const },
    // Pre-Revised
    { effectiveDate: new Date('2016-01-01'), percentage: 125, type: 'PRE_REVISED' as const },
    // 01.07.2016 is 132%
    { effectiveDate: new Date('2016-07-01'), percentage: 132, type: 'PRE_REVISED' as const }
]

const result = calculateArrears({
    startDate: new Date('2016-01-01'),
    endDate: new Date('2016-06-30'), // Test Jan to June per image
    payEvents: mockPayEvents,
    daRates: mockDARates
})

console.log(JSON.stringify(result, null, 2))
