import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface ExcelExportData {
    employeeName: string;
    employeeId: string;
    startDate: Date;
    endDate: Date;
    segments: any[];
    totalArrear: number;
    status: string;
}

export const generateExcel = ({
    employeeName,
    employeeId,
    startDate,
    endDate,
    segments,
    totalArrear,
    status
}: ExcelExportData) => {
    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // ===== SHEET 1: SUMMARY =====
    const summaryData = [
        ['BBMB ARREAR CALCULATION SUMMARY'],
        [],
        ['Employee Name', employeeName],
        ['Employee ID', employeeId],
        ['Period Start', format(startDate, 'dd MMM yyyy')],
        ['Period End', format(endDate, 'dd MMM yyyy')],
        ['Status', status],
        [],
        ['Total Arrear Payable', `₹${totalArrear.toLocaleString()}`],
        [],
        ['Generated On', format(new Date(), 'dd MMM yyyy HH:mm')]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

    // Style summary sheet
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 30 }];

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // ===== SHEET 2: CALCULATION GRID =====
    const gridHeaders = [
        'Period',
        'Duration',
        // DUE (Revised)
        'DA%',
        'Basic Pay',
        'DA Amount',
        'HRA',
        'Total Due',
        // DRAWN (Old)
        'DA%',
        'Basic Pay',
        'Grade Pay',
        'IR',
        'DA Amount',
        'Total Drawn',
        // NET
        'Monthly Diff',
        'Net Payable'
    ];

    const gridData = segments.map(seg => [
        `${format(new Date(seg.startDate), 'dd.MM.yy')} - ${format(new Date(seg.endDate), 'dd.MM.yy')}`,
        seg.durationLabel,
        // DUE
        `${seg.daPercentage}%`,
        seg.basicPay,
        seg.daRate,
        '-',
        seg.monthlyDueTotal,
        // DRAWN
        `${seg.drawnDAPercentage}%`,
        seg.drawnBasicPay,
        seg.drawnGradePay,
        seg.drawnIR,
        seg.drawnDA,
        seg.drawnTotal,
        // NET
        seg.monthlyDueTotal - seg.drawnTotal,
        Math.round(seg.totalDue - seg.totalDrawn)
    ]);

    // Add header and data
    const wsGrid = XLSX.utils.aoa_to_sheet([
        ['BBMB ARREAR CALCULATION GRID'],
        [`Employee: ${employeeName} (${employeeId})`],
        [`Period: ${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`],
        [],
        gridHeaders,
        ...gridData,
        [],
        ['', '', '', '', '', '', '', '', '', '', '', '', 'TOTAL ARREAR PAYABLE:', `₹${totalArrear.toLocaleString()}`]
    ]);

    // Set column widths
    wsGrid['!cols'] = [
        { wch: 20 }, // Period
        { wch: 10 }, // Duration
        { wch: 8 },  // DA%
        { wch: 12 }, // Basic
        { wch: 12 }, // DA Amt
        { wch: 8 },  // HRA
        { wch: 12 }, // Total Due
        { wch: 8 },  // DA%
        { wch: 12 }, // Basic
        { wch: 12 }, // GP
        { wch: 8 },  // IR
        { wch: 12 }, // DA Amt
        { wch: 12 }, // Total Drawn
        { wch: 12 }, // Monthly Diff
        { wch: 14 }  // Net Payable
    ];

    XLSX.utils.book_append_sheet(wb, wsGrid, 'Calculation Grid');

    // ===== SHEET 3: PAY EVENTS =====
    const eventsHeaders = [
        'Event Date',
        'Due Basic Pay',
        'Drawn Basic Pay',
        'Drawn Grade Pay',
        'Drawn IR'
    ];

    // Extract unique pay events from segments
    const uniqueEvents = new Map();
    segments.forEach(seg => {
        const key = format(new Date(seg.startDate), 'yyyy-MM-dd');
        if (!uniqueEvents.has(key)) {
            uniqueEvents.set(key, {
                date: format(new Date(seg.startDate), 'dd MMM yyyy'),
                dueBasic: seg.basicPay,
                drawnBasic: seg.drawnBasicPay,
                drawnGP: seg.drawnGradePay,
                drawnIR: seg.drawnIR
            });
        }
    });

    const eventsData = Array.from(uniqueEvents.values()).map(e => [
        e.date,
        e.dueBasic,
        e.drawnBasic,
        e.drawnGP,
        e.drawnIR
    ]);

    const wsEvents = XLSX.utils.aoa_to_sheet([
        ['PAY EVENTS'],
        [],
        eventsHeaders,
        ...eventsData
    ]);

    wsEvents['!cols'] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, wsEvents, 'Pay Events');

    // Generate Excel file
    XLSX.writeFile(wb, `Arrear_${employeeName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
};
