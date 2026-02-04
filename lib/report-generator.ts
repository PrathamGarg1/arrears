import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ComprehensiveReportData {
    employeeName: string;
    employeeId: string;
    startDate: Date;
    endDate: Date;
    segments: any[];
    totalArrear: number;
    status: string;
    verificationResult?: {
        ocrConfidence: number;
        extractedData: any;
        comparison: {
            accuracy: number;
            matches: number;
            mismatches: number;
            details: Array<{ field: string; extracted: any; system: any; match: boolean }>;
        };
    };
    uploadedImages?: string[]; // Base64 encoded images
}

export const generateComprehensiveReport = (data: ComprehensiveReportData) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    let yPos = 15;

    // ===== HEADER =====
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('BBMB ARREAR VERIFICATION REPORT', 105, yPos, { align: 'center' });

    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 105, yPos, { align: 'center' });

    yPos += 15;

    // ===== EMPLOYEE DETAILS =====
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Information', 14, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${data.employeeName}`, 14, yPos);
    yPos += 5;
    doc.text(`ID: ${data.employeeId}`, 14, yPos);
    yPos += 5;
    doc.text(`Period: ${format(data.startDate, 'dd MMM yyyy')} to ${format(data.endDate, 'dd MMM yyyy')}`, 14, yPos);
    yPos += 5;
    doc.text(`Status: ${data.status}`, 14, yPos);
    yPos += 10;

    // ===== VERIFICATION SUMMARY (if available) =====
    if (data.verificationResult) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Verification Summary', 14, yPos);
        yPos += 7;

        const accuracy = data.verificationResult.comparison.accuracy;
        const color = accuracy >= 80 ? [34, 197, 94] : accuracy >= 60 ? [234, 179, 8] : [239, 68, 68];

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`OCR Confidence: ${(data.verificationResult.ocrConfidence * 100).toFixed(1)}%`, 14, yPos);
        yPos += 5;

        doc.setTextColor(color[0], color[1], color[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(`Overall Accuracy: ${accuracy.toFixed(1)}%`, 14, yPos);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        yPos += 5;

        doc.text(`Matches: ${data.verificationResult.comparison.matches} | Mismatches: ${data.verificationResult.comparison.mismatches}`, 14, yPos);
        yPos += 10;

        // Verification Details Table
        if (data.verificationResult.comparison.details.length > 0) {
            const detailsData = data.verificationResult.comparison.details.map(d => [
                d.field,
                String(d.extracted),
                String(d.system),
                d.match ? '✓ Match' : '✗ Mismatch'
            ]);

            (doc as any).autoTable({
                head: [['Field', 'Extracted Value', 'System Value', 'Status']],
                body: detailsData,
                startY: yPos,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [59, 130, 246] },
                columnStyles: {
                    3: {
                        cellWidth: 25,
                        fontStyle: 'bold'
                    }
                },
                didParseCell: function (data: any) {
                    if (data.column.index === 3 && data.cell.section === 'body') {
                        if (data.cell.raw.includes('Match')) {
                            data.cell.styles.textColor = [34, 197, 94];
                        } else {
                            data.cell.styles.textColor = [239, 68, 68];
                        }
                    }
                }
            });

            yPos = (doc as any).lastAutoTable.finalY + 10;
        }
    }

    // ===== CALCULATION SUMMARY =====
    if (yPos > 240) {
        doc.addPage();
        yPos = 15;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Calculation Summary', 14, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Segments: ${data.segments.length}`, 14, yPos);
    yPos += 5;
    doc.text(`Total Arrear Payable: ₹${data.totalArrear.toLocaleString()}`, 14, yPos);
    yPos += 10;

    // ===== DETAILED CALCULATION TABLE =====
    const calcHeaders = [
        'Period',
        'DA%',
        'Basic',
        'Total Due',
        'Total Drawn',
        'Net Arrear'
    ];

    const calcData = data.segments.map(seg => [
        `${format(new Date(seg.startDate), 'dd.MM.yy')} - ${format(new Date(seg.endDate), 'dd.MM.yy')}`,
        `${seg.daPercentage}%`,
        seg.basicPay,
        seg.monthlyDueTotal,
        seg.drawnTotal,
        Math.round(seg.totalDue - seg.totalDrawn)
    ]);

    (doc as any).autoTable({
        head: [calcHeaders],
        body: calcData,
        startY: yPos,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
            0: { cellWidth: 35 },
            5: { fontStyle: 'bold' }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ===== FOOTER =====
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
            `Page ${i} of ${pageCount}`,
            105,
            290,
            { align: 'center' }
        );
        doc.text(
            'BBMB Arrear Calculation System - Confidential',
            105,
            285,
            { align: 'center' }
        );
    }

    // Save the PDF
    doc.save(`Verification_Report_${data.employeeName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

// ============================================================================
// ENHANCED VERIFICATION REPORT
// ============================================================================

import type { ExtractedSheetData } from './ocr-processor';
import type { CalculationComparison } from './calculation-engine';

interface VerificationReportData {
    requestId: string;
    extractedData: ExtractedSheetData;
    comparison: CalculationComparison;
    images: string[];
}

export const generateVerificationReport = async (data: VerificationReportData) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    let yPos = 15;

    // ===== HEADER =====
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('OCR VERIFICATION REPORT', 105, yPos, { align: 'center' });

    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 105, yPos, { align: 'center' });
    doc.text(`Request ID: ${data.requestId}`, 105, yPos + 5, { align: 'center' });

    yPos += 18;

    // ===== EXECUTIVE SUMMARY =====
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 14, yPos);
    yPos += 8;

    const accuracy = data.comparison.overallAccuracy;
    const color: [number, number, number] = accuracy >= 90 ? [34, 197, 94] : accuracy >= 70 ? [234, 179, 8] : [239, 68, 68];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Employee: ${data.extractedData.metadata.employeeName} (${data.extractedData.metadata.employeeId})`, 14, yPos);
    yPos += 5;
    doc.text(`Period: ${format(data.extractedData.metadata.period.start, 'dd MMM yyyy')} - ${format(data.extractedData.metadata.period.end, 'dd MMM yyyy')}`, 14, yPos);
    yPos += 5;
    doc.text(`Images Processed: ${data.images.length}`, 14, yPos);
    yPos += 5;
    doc.text(`Extraction Confidence: ${Math.round(data.extractedData.confidence * 100)}%`, 14, yPos);
    yPos += 7;

    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Overall Accuracy: ${Math.round(accuracy)}%`, 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Match Rate: ${Math.round(data.comparison.matchPercentage)}%`, 14, yPos);
    yPos += 5;
    doc.text(`Discrepancies Found: ${data.comparison.discrepancies.length}`, 14, yPos);
    yPos += 12;

    // ===== EXTRACTED DATA REVIEW =====
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Extracted Pay Events', 14, yPos);
    yPos += 8;

    const payEventsData = data.extractedData.payEvents.map(event => [
        format(event.date, 'dd.MM.yyyy'),
        event.type,
        `₹${event.basicPay.toLocaleString()}`,
        event.gradePay ? `₹${event.gradePay.toLocaleString()}` : '-',
        `${event.daPercent}%`,
        `${Math.round(event.confidence * 100)}%`
    ]);

    (doc as any).autoTable({
        head: [['Date', 'Type', 'Basic Pay', 'Grade Pay', 'DA%', 'Confidence']],
        body: payEventsData,
        startY: yPos,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [99, 102, 241] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;

    // ===== CALCULATION COMPARISON =====
    if (yPos > 240) {
        doc.addPage();
        yPos = 15;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Calculation Comparison', 14, yPos);
    yPos += 8;

    const systemTotalDue = data.comparison.systemResult.reduce((sum, seg) => sum + seg.totalDue, 0);
    const systemTotalDrawn = data.comparison.systemResult.reduce((sum, seg) => sum + seg.totalDrawn, 0);
    const systemNetArrear = systemTotalDue - systemTotalDrawn;

    const comparisonData = [
        ['Total Due', `₹${systemTotalDue.toLocaleString()}`, `₹${data.comparison.sheetCalculations.totalDue.toLocaleString()}`, `₹${Math.abs(systemTotalDue - data.comparison.sheetCalculations.totalDue).toLocaleString()}`],
        ['Total Drawn', `₹${systemTotalDrawn.toLocaleString()}`, `₹${data.comparison.sheetCalculations.totalDrawn.toLocaleString()}`, `₹${Math.abs(systemTotalDrawn - data.comparison.sheetCalculations.totalDrawn).toLocaleString()}`],
        ['Net Arrear', `₹${systemNetArrear.toLocaleString()}`, `₹${data.comparison.sheetCalculations.netArrear.toLocaleString()}`, `₹${Math.abs(systemNetArrear - data.comparison.sheetCalculations.netArrear).toLocaleString()}`],
    ];

    (doc as any).autoTable({
        head: [['Field', 'System Calculation', 'Sheet Value', 'Difference']],
        body: comparisonData,
        startY: yPos,
        theme: 'striped',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [99, 102, 241] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;

    // ===== DISCREPANCY ANALYSIS =====
    if (data.comparison.discrepancies.length > 0) {
        if (yPos > 220) {
            doc.addPage();
            yPos = 15;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Discrepancy Analysis', 14, yPos);
        yPos += 8;

        data.comparison.discrepancies.forEach((disc, index) => {
            if (yPos > 260) {
                doc.addPage();
                yPos = 15;
            }

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${disc.field} (${disc.period})`, 14, yPos);
            yPos += 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Difference: ₹${Math.abs(disc.difference).toLocaleString()} (${disc.percentDiff > 0 ? '+' : ''}${disc.percentDiff.toFixed(2)}%)`, 20, yPos);
            yPos += 5;
            doc.text(`System: ₹${disc.systemValue.toLocaleString()} | Sheet: ₹${disc.sheetValue.toLocaleString()}`, 20, yPos);
            yPos += 5;

            doc.setFont('helvetica', 'italic');
            doc.text('Possible Reasons:', 20, yPos);
            yPos += 4;
            disc.possibleReasons.forEach(reason => {
                doc.text(`• ${reason}`, 25, yPos);
                yPos += 4;
            });
            yPos += 4;
        });
    } else {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(34, 197, 94);
        doc.text('✓ No discrepancies found. All calculations match within acceptable tolerance.', 14, yPos);
        doc.setTextColor(0, 0, 0);
    }

    // ===== FOOTER =====
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
            `Page ${i} of ${pageCount}`,
            105,
            290,
            { align: 'center' }
        );
        doc.text(
            'BBMB OCR Verification System - Confidential',
            105,
            285,
            { align: 'center' }
        );
    }

    // Save the PDF
    doc.save(`OCR_Verification_${data.extractedData.metadata.employeeId}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
