
import { addDays, differenceInDays, endOfMonth, format, isAfter, isBefore, isSameDay, startOfMonth, subDays } from 'date-fns'

interface PayEvent {
    date: Date
    basicPay: number
    type: string
    drawnBasicPay?: number
    drawnGradePay?: number
    drawnIR?: number
}

interface DARate {
    effectiveDate: Date
    percentage: number
    type?: 'REVISED' | 'PRE_REVISED'
}

interface Segment {
    startDate: Date
    endDate: Date
    days: number

    // Due
    basicPay: number
    daRate: number
    daPercentage: number
    monthlyDueTotal: number // Added for Display

    // Drawn
    drawnBasicPay: number
    drawnGradePay: number
    drawnIR: number
    drawnDA: number
    drawnDAPercentage: number
    drawnTotal: number // This is the Monthly Total usually

    totalDue: number
    totalDrawn: number

    durationLabel: string // "5 M" or "22 D"
}

interface CalculationRequest {
    startDate: Date
    endDate: Date
    payEvents: PayEvent[]
    daRates: DARate[]
}

export function calculateArrears(req: CalculationRequest): Segment[] {
    const { startDate, endDate, payEvents, daRates } = req

    const revisedDARates = daRates.filter(d => d.type !== 'PRE_REVISED')
    const preRevisedDARates = daRates.filter(d => d.type === 'PRE_REVISED')

    // 1. Identify Critical Dates
    const boundaries = new Set<string>()
    boundaries.add(format(startDate, 'yyyy-MM-dd'))
    boundaries.add(format(addDays(endDate, 1), 'yyyy-MM-dd'))

    // 1st of every month
    let iter = startOfMonth(startDate)
    if (isBefore(iter, startDate)) iter = startOfMonth(addDays(iter, 35))
    while (isBefore(iter, addDays(endDate, 1))) {
        boundaries.add(format(iter, 'yyyy-MM-dd'))
        iter = addDays(endOfMonth(iter), 1)
    }

    // Pay Events
    payEvents.forEach(e => {
        if (isAfter(e.date, startDate) && isBefore(e.date, addDays(endDate, 1))) {
            boundaries.add(format(e.date, 'yyyy-MM-dd'))
        }
    })

    // DA Changes
    daRates.forEach(d => {
        if (isAfter(d.effectiveDate, startDate) && isBefore(d.effectiveDate, addDays(endDate, 1))) {
            boundaries.add(format(d.effectiveDate, 'yyyy-MM-dd'))
        }
    })

    const sortedDates = Array.from(boundaries).sort().map(d => new Date(d))
    const segments: Segment[] = []

    for (let i = 0; i < sortedDates.length - 1; i++) {
        const segStart = sortedDates[i]
        const segEnd = subDays(sortedDates[i + 1], 1)

        // Find active Pay Event
        const activePayEvent = payEvents
            .filter(e => isBefore(e.date, addDays(segStart, 1)))
            .sort((a, b) => b.date.getTime() - a.date.getTime())[0]

        const basicPay = activePayEvent ? activePayEvent.basicPay : 0
        const drawnBP = activePayEvent?.drawnBasicPay || 0
        const drawnGP = activePayEvent?.drawnGradePay || 0
        const drawnIR = activePayEvent?.drawnIR || 0

        // Find DA Rates
        const activeRevDA = revisedDARates
            .filter(d => isBefore(d.effectiveDate, addDays(segStart, 1)))
            .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime())[0]
        const revDAPct = activeRevDA ? activeRevDA.percentage : 0

        const activePreRevDA = preRevisedDARates
            .filter(d => isBefore(d.effectiveDate, addDays(segStart, 1)))
            .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime())[0]
        const preRevDAPct = activePreRevDA ? activePreRevDA.percentage : 0

        const daysInSeg = differenceInDays(segEnd, segStart) + 1
        // Used for denominator
        const daysInMonth = differenceInDays(endOfMonth(segStart), startOfMonth(segStart)) + 1

        // CALCULATION LOGIC (30-day basis)
        const isFullMonth = isSameDay(startOfMonth(segStart), segStart) && isSameDay(endOfMonth(segEnd), segEnd)

        // 1. DUE
        const monthlyDueDA = Math.round(basicPay * (revDAPct / 100))
        const monthlyTotalDue = basicPay + monthlyDueDA

        // 2. DRAWN
        const drawnForDA = drawnBP + drawnGP + drawnIR
        const monthlyDrawnDA = Math.round(drawnForDA * (preRevDAPct / 100))
        const monthlyTotalDrawn = drawnBP + drawnGP + drawnIR + monthlyDrawnDA

        // Pro-Rata
        let segmentDue, segmentDrawn, durationLabel

        if (isFullMonth) {
            segmentDue = monthlyTotalDue
            segmentDrawn = monthlyTotalDrawn
            durationLabel = "1 M"
        } else {
            // Use Actual Days in Month for denominator (matches Reference Sheet logic for May 2018)
            segmentDue = Math.round(monthlyTotalDue * (daysInSeg / daysInMonth))
            segmentDrawn = Math.round(monthlyTotalDrawn * (daysInSeg / daysInMonth))
            durationLabel = `${daysInSeg} D`
        }

        segments.push({
            startDate: segStart,
            endDate: segEnd,
            days: daysInSeg,

            basicPay,
            daRate: monthlyDueDA,
            daPercentage: revDAPct,
            monthlyDueTotal: monthlyTotalDue,

            drawnBasicPay: drawnBP,
            drawnGradePay: drawnGP,
            drawnIR: drawnIR,
            drawnDA: monthlyDrawnDA,
            drawnDAPercentage: preRevDAPct,
            drawnTotal: monthlyTotalDrawn, // Monthly Rate

            totalDue: segmentDue, // Pro-rated
            totalDrawn: segmentDrawn, // Pro-rated

            durationLabel
        })
    }

    return segments
}

// ============================================================================
// CALCULATION COMPARISON FOR OCR VERIFICATION
// ============================================================================

export interface CalculationDiscrepancy {
    field: string
    period: string
    systemValue: number
    sheetValue: number
    difference: number
    percentDiff: number
    possibleReasons: string[]
}

export interface CalculationComparison {
    systemResult: Segment[]
    sheetCalculations: {
        totalDue: number
        totalDrawn: number
        netArrear: number
    }
    discrepancies: CalculationDiscrepancy[]
    overallAccuracy: number
    matchPercentage: number
}

export function compareCalculations(
    systemSegments: Segment[],
    sheetData: {
        totalDue: number
        totalDrawn: number
        netArrear: number
        breakdowns?: Array<{ period: string; amount: number }>
    }
): CalculationComparison {
    const discrepancies: CalculationDiscrepancy[] = []

    // Calculate system totals
    const systemTotalDue = systemSegments.reduce((sum, seg) => sum + seg.totalDue, 0)
    const systemTotalDrawn = systemSegments.reduce((sum, seg) => sum + seg.totalDrawn, 0)
    const systemNetArrear = systemTotalDue - systemTotalDrawn

    // Compare Total Due
    const dueDiff = Math.abs(systemTotalDue - sheetData.totalDue)
    if (dueDiff > systemTotalDue * 0.01) { // 1% tolerance
        const possibleReasons = []
        if (dueDiff > 1000) possibleReasons.push('Missing pay events or incorrect basic pay')
        if (dueDiff % 100 < 10) possibleReasons.push('Possible rounding difference')
        possibleReasons.push('Different DA rate applied')

        discrepancies.push({
            field: 'Total Due',
            period: 'Overall',
            systemValue: systemTotalDue,
            sheetValue: sheetData.totalDue,
            difference: systemTotalDue - sheetData.totalDue,
            percentDiff: ((systemTotalDue - sheetData.totalDue) / sheetData.totalDue) * 100,
            possibleReasons,
        })
    }

    // Compare Total Drawn
    const drawnDiff = Math.abs(systemTotalDrawn - sheetData.totalDrawn)
    if (drawnDiff > systemTotalDrawn * 0.01) {
        const possibleReasons = []
        if (drawnDiff > 1000) possibleReasons.push('Incorrect drawn basic pay or grade pay')
        possibleReasons.push('Different pre-revised DA rate')
        possibleReasons.push('Missing interim relief component')

        discrepancies.push({
            field: 'Total Drawn',
            period: 'Overall',
            systemValue: systemTotalDrawn,
            sheetValue: sheetData.totalDrawn,
            difference: systemTotalDrawn - sheetData.totalDrawn,
            percentDiff: ((systemTotalDrawn - sheetData.totalDrawn) / sheetData.totalDrawn) * 100,
            possibleReasons,
        })
    }

    // Compare Net Arrear
    const arrearDiff = Math.abs(systemNetArrear - sheetData.netArrear)
    if (arrearDiff > systemNetArrear * 0.01) {
        discrepancies.push({
            field: 'Net Arrear',
            period: 'Overall',
            systemValue: systemNetArrear,
            sheetValue: sheetData.netArrear,
            difference: systemNetArrear - sheetData.netArrear,
            percentDiff: ((systemNetArrear - sheetData.netArrear) / sheetData.netArrear) * 100,
            possibleReasons: ['Cascading effect from Due/Drawn differences'],
        })
    }

    // Period-wise comparison if breakdowns available
    if (sheetData.breakdowns && sheetData.breakdowns.length > 0) {
        sheetData.breakdowns.forEach((breakdown, index) => {
            if (index < systemSegments.length) {
                const seg = systemSegments[index]
                const segArrear = seg.totalDue - seg.totalDrawn
                const diff = Math.abs(segArrear - breakdown.amount)

                if (diff > segArrear * 0.02) { // 2% tolerance for segments
                    discrepancies.push({
                        field: 'Period Arrear',
                        period: breakdown.period,
                        systemValue: segArrear,
                        sheetValue: breakdown.amount,
                        difference: segArrear - breakdown.amount,
                        percentDiff: ((segArrear - breakdown.amount) / breakdown.amount) * 100,
                        possibleReasons: ['Period-specific calculation error', 'Different pro-rata logic'],
                    })
                }
            }
        })
    }

    // Calculate overall accuracy
    const totalFields = 3 + (sheetData.breakdowns?.length || 0)
    const matchingFields = totalFields - discrepancies.length
    const matchPercentage = (matchingFields / totalFields) * 100

    // Accuracy based on magnitude of errors
    const totalSystemValue = systemTotalDue + systemTotalDrawn + systemNetArrear
    const totalError = discrepancies.reduce((sum, d) => sum + Math.abs(d.difference), 0)
    const overallAccuracy = Math.max(0, 100 - (totalError / totalSystemValue) * 100)

    return {
        systemResult: systemSegments,
        sheetCalculations: sheetData,
        discrepancies,
        overallAccuracy,
        matchPercentage,
    }
}
