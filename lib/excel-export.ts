import * as XLSX from 'xlsx';

/**
 * Calculate year-wise arrear breakdown from pay events
 */
export function calculateYearWiseSummary(payEvents: any[]): {
    yearlyBreakdown: Array<{ year: number; totalArrear: number; periodCount: number }>;
    grandTotal: number;
} {
    const yearMap = new Map<number, { totalArrear: number; periodCount: number }>();

    payEvents.forEach(event => {
        const year = event.date?.getFullYear?.() || new Date().getFullYear();
        const arrear = event.netArrear || 0;

        if (!yearMap.has(year)) {
            yearMap.set(year, { totalArrear: 0, periodCount: 0 });
        }

        const yearData = yearMap.get(year)!;
        yearData.totalArrear += arrear;
        yearData.periodCount += 1;
    });

    const yearlyBreakdown = Array.from(yearMap.entries())
        .map(([year, data]) => ({
            year,
            totalArrear: data.totalArrear,
            periodCount: data.periodCount
        }))
        .sort((a, b) => a.year - b.year);

    const grandTotal = yearlyBreakdown.reduce((sum, item) => sum + item.totalArrear, 0);

    return { yearlyBreakdown, grandTotal };
}

/**
 * Export extracted calculation data to Excel
 */
export function exportToExcel(data: {
    employeeInfo: { name?: string; employeeName?: string; employeeId: string; designation?: string };
    payEvents: any[];
    calculations: { totalDue: number; totalDrawn: number; netArrear: number };
    yearWiseSummary?: { yearlyBreakdown: any[]; grandTotal: number };
}): void {
    const workbook = XLSX.utils.book_new();

    // Get employee name from either field
    const employeeName = data.employeeInfo.name || data.employeeInfo.employeeName || 'Unknown';

    // Sheet 1: Summary
    const summaryData = [
        ['BBMB Arrear Calculation - Extracted Data'],
        [],
        ['Employee Information'],
        ['Name', employeeName],
        ['Employee ID', data.employeeInfo.employeeId],
        ['Designation', data.employeeInfo.designation || 'N/A'],
        [],
        ['Overall Totals'],
        ['Total Due (7th CPC)', data.calculations.totalDue],
        ['Total Drawn (6th CPC)', data.calculations.totalDrawn],
        ['Net Arrear', data.calculations.netArrear],
    ];

    if (data.yearWiseSummary) {
        summaryData.push([]);
        summaryData.push(['Year-wise Total Amount to be Reimbursed']);
        summaryData.push(['Year', 'Total Arrear', 'Number of Periods']);
        data.yearWiseSummary.yearlyBreakdown.forEach(item => {
            summaryData.push([item.year, item.totalArrear, item.periodCount]);
        });
        summaryData.push([]);
        summaryData.push(['Grand Total', data.yearWiseSummary.grandTotal, '']);
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Sheet 2: Detailed Calculations
    const detailsData = [
        [
            'Period Start',
            'Period End',
            'Days',
            '6th CPC Basic',
            '6th CPC Grade Pay',
            '6th CPC DA%',
            '6th CPC DA Amount',
            '6th CPC HRA',
            '6th CPC Total (Drawn)',
            '7th CPC Basic',
            '7th CPC DA%',
            '7th CPC DA Amount',
            '7th CPC HRA',
            '7th CPC Total (Due)',
            'Net Arrear',
            'Event Type'
        ]
    ];

    data.payEvents.forEach(event => {
        const sixthCPC = event.sixthCPC || {};
        const seventhCPC = event.seventhCPC || {};

        detailsData.push([
            event.date?.toLocaleDateString?.('en-GB') || 'N/A',
            event.periodEnd?.toLocaleDateString?.('en-GB') || 'N/A',
            event.days || '',
            sixthCPC.basicPay || 0,
            sixthCPC.gradePay || '',
            sixthCPC.daPercent || 0,
            sixthCPC.daAmount || '',
            sixthCPC.hra || '',
            sixthCPC.total || 0,
            seventhCPC.basicPay || 0,
            seventhCPC.daPercent || 0,
            seventhCPC.daAmount || '',
            seventhCPC.hra || '',
            seventhCPC.total || 0,
            event.netArrear || 0,
            event.type || 'NORMAL'
        ]);
    });

    const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);

    // Set column widths
    detailsSheet['!cols'] = [
        { wch: 12 }, // Period Start
        { wch: 12 }, // Period End
        { wch: 6 },  // Days
        { wch: 12 }, // 6th CPC Basic
        { wch: 12 }, // 6th CPC Grade Pay
        { wch: 10 }, // 6th CPC DA%
        { wch: 12 }, // 6th CPC DA Amount
        { wch: 10 }, // 6th CPC HRA
        { wch: 15 }, // 6th CPC Total
        { wch: 12 }, // 7th CPC Basic
        { wch: 10 }, // 7th CPC DA%
        { wch: 12 }, // 7th CPC DA Amount
        { wch: 10 }, // 7th CPC HRA
        { wch: 15 }, // 7th CPC Total
        { wch: 12 }, // Net Arrear
        { wch: 12 }  // Event Type
    ];

    XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Detailed Calculations');

    // Generate filename with employee ID and date
    const filename = `BBMB_Arrear_${data.employeeInfo.employeeId}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Download the file
    XLSX.writeFile(workbook, filename);
}
