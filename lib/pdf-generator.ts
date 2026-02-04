
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

interface ExportData {
    employeeName: string
    employeeId: string
    startDate: Date
    endDate: Date
    segments: any[]
    totalArrear: number
}

export const generatePDF = ({ employeeName, employeeId, startDate, endDate, segments, totalArrear }: ExportData) => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    })

    // Header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('BBMB - Arrear Calculation Statement', 14, 15)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Employee: ${employeeName} (${employeeId})`, 14, 22)
    doc.text(`Period: ${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`, 14, 27)

    // Table Data Preparation
    const tableHead = [[
        { content: 'Period', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'DUE (Revised Pay)', colSpan: 5, styles: { halign: 'center', fillColor: [220, 230, 255] } },
        { content: 'DRAWN (Old Pay)', colSpan: 6, styles: { halign: 'center', fillColor: [255, 250, 220] } },
        { content: 'NET', colSpan: 3, styles: { halign: 'center', fillColor: [220, 255, 230] } }
    ], [
        // Due Subheaders
        'DA%', 'Basic', 'DA Amt', 'HRA', 'Total',
        // Drawn Subheaders
        'DA%', 'Basic', 'GP', 'IR', 'DA Amt', 'Total',
        // Net Subheaders
        'Diff', 'Dur', 'Net Payable'
    ]]

    const tableBody = segments.map((seg: any) => [
        `${format(new Date(seg.startDate), 'dd.MM.yy')} - ${format(new Date(seg.endDate), 'dd.MM.yy')}`,

        // Due
        `${seg.daPercentage}%`,
        seg.basicPay,
        seg.daRate,
        '-',
        seg.monthlyDueTotal,

        // Drawn
        `${seg.drawnDAPercentage}%`,
        seg.drawnBasicPay,
        seg.drawnGradePay,
        seg.drawnIR,
        seg.drawnDA,
        seg.drawnTotal,

        // Net
        (seg.monthlyDueTotal - seg.drawnTotal),
        seg.durationLabel,
        Math.round(seg.totalDue - seg.totalDrawn)
    ])

    // Footer Row
    tableBody.push([
        { content: 'TOTAL ARREAR PAYABLE', colSpan: 14, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `Rs. ${totalArrear.toLocaleString()}`, colSpan: 1, styles: { fontStyle: 'bold', fillColor: [200, 255, 200] } }
    ]);


    (doc as any).autoTable({
        head: tableHead,
        body: tableBody,
        startY: 35,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 1,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: [50, 50, 50],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 25 }, // Period
            1: { halign: 'right' }, // Due DA%
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' },

            6: { halign: 'right' }, // Drawn DA%
            7: { halign: 'right' },
            8: { halign: 'right' },
            9: { halign: 'right' },
            10: { halign: 'right' },
            11: { halign: 'right', fontStyle: 'bold' },

            12: { halign: 'right' },
            13: { halign: 'center' },
            14: { halign: 'right', fontStyle: 'bold' }
        }
    })

    doc.save(`Arrear_${employeeName}_${format(new Date(), 'yyyyMMdd')}.pdf`)
}
