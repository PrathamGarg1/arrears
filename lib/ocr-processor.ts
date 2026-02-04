import Tesseract from 'tesseract.js';
import { extractWithGemini, extractMultipleWithGemini, geminiToInternalFormat } from './gemini-ocr';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface OCRResult {
    text: string;
    confidence: number;
}

export interface ExtractedSheetData {
    metadata: {
        employeeName: string;
        employeeId: string;
        designation?: string;
        period: { start: Date; end: Date };
    };
    payEvents: Array<{
        date: Date;
        basicPay: number;
        gradePay?: number;
        daPercent: number;
        hra?: number;
        totalPay: number;
        type: 'PROMOTION' | 'INCREMENT' | 'REVISION' | 'NORMAL';
        confidence: number;
    }>;
    calculations: {
        totalDue: number;
        totalDrawn: number;
        netArrear: number;
        breakdowns: Array<{ period: string; amount: number }>;
    };
    rawOCRText: string;
    confidence: number;
}

// Legacy interface for backward compatibility
export interface ExtractedData {
    periods: Array<{ start: string; end: string }>;
    amounts: number[];
    daRates: number[];
    totals: number[];
    confidence: number;
}

// ============================================================================
// CORE OCR PROCESSING
// ============================================================================

export const processImage = async (imageFile: File, useGemini: boolean = true): Promise<OCRResult> => {
    try {
        // Try Gemini first if enabled and API key is available
        if (useGemini && process.env.GEMINI_API_KEY) {
            try {
                console.log('Using Gemini Vision API for OCR...');
                const geminiResult = await extractWithGemini(imageFile);
                return {
                    text: JSON.stringify(geminiResult),
                    confidence: geminiResult.confidence
                };
            } catch (geminiError) {
                console.warn('Gemini extraction failed, falling back to Tesseract:', geminiError);
                // Fall through to Tesseract
            }
        }

        // Fallback to Tesseract
        console.log('Using Tesseract.js for OCR...');
        const result = await Tesseract.recognize(imageFile, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            },
        });

        return {
            text: result.data.text,
            confidence: result.data.confidence / 100, // Normalize to 0-1
        };
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error('Failed to process image');
    }
};

export const processMultipleImages = async (imageFiles: File[], useGemini: boolean = true): Promise<OCRResult> => {
    // Try Gemini for multi-page processing if enabled
    if (useGemini && process.env.GEMINI_API_KEY) {
        try {
            console.log('Using Gemini Vision API for multi-page OCR...');
            const geminiResult = await extractMultipleWithGemini(imageFiles);
            return {
                text: JSON.stringify(geminiResult),
                confidence: geminiResult.confidence
            };
        } catch (geminiError) {
            console.warn('Gemini multi-page extraction failed, falling back to Tesseract:', geminiError);
            // Fall through to Tesseract
        }
    }

    // Fallback to Tesseract
    const results = await Promise.all(imageFiles.map(file => processImage(file, false)));

    const combinedText = results.map(r => r.text).join('\n\n--- PAGE BREAK ---\n\n');
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
        text: combinedText,
        confidence: avgConfidence,
    };
};

// ============================================================================
// ENHANCED DATA EXTRACTION
// ============================================================================

export const extractStructuredData = (ocrText: string): ExtractedSheetData => {
    // Check if this is Gemini JSON output
    try {
        const parsed = JSON.parse(ocrText);
        if (parsed.employeeInfo && parsed.payEvents) {
            // This is Gemini output, convert to internal format
            console.log('Processing Gemini-extracted data...');
            return geminiToInternalFormat(parsed);
        }
    } catch (e) {
        // Not JSON, proceed with Tesseract text parsing
        console.log('Processing Tesseract text output...');
    }

    // Tesseract fallback: parse unstructured text
    const metadata = extractMetadata(ocrText);
    const payEvents = extractPayEvents(ocrText);
    const calculations = extractCalculations(ocrText);

    // Calculate overall confidence based on data completeness
    const confidence = calculateExtractionConfidence(metadata, payEvents, calculations);

    return {
        metadata,
        payEvents,
        calculations,
        rawOCRText: ocrText,
        confidence,
    };
};

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

function extractMetadata(text: string): ExtractedSheetData['metadata'] {
    const lines = text.split('\n');

    // Extract employee name (usually in first few lines)
    const namePattern = /(?:Name|Employee)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
    const nameMatch = text.match(namePattern);
    const employeeName = nameMatch ? nameMatch[1].trim() : 'Unknown';

    // Extract employee ID
    const idPattern = /(?:ID|Employee\s*ID|Emp\s*ID)[\s:]+(\d+)/i;
    const idMatch = text.match(idPattern);
    const employeeId = idMatch ? idMatch[1] : 'UNKNOWN';

    // Extract designation
    const designationPattern = /(?:Designation|Post)[\s:]+([A-Za-z\s]+)/i;
    const designationMatch = text.match(designationPattern);
    const designation = designationMatch ? designationMatch[1].trim() : undefined;

    // Extract period (look for date ranges)
    const periodPattern = /(\d{2}[./-]\d{2}[./-]\d{2,4})\s*(?:to|-)\s*(\d{2}[./-]\d{2}[./-]\d{2,4})/i;
    const periodMatch = text.match(periodPattern);

    let period = {
        start: new Date('2016-01-01'),
        end: new Date('2024-01-01'),
    };

    if (periodMatch) {
        period = {
            start: parseFlexibleDate(periodMatch[1]),
            end: parseFlexibleDate(periodMatch[2]),
        };
    }

    return {
        employeeName,
        employeeId,
        designation,
        period,
    };
}

// ============================================================================
// PAY EVENTS EXTRACTION
// ============================================================================

function extractPayEvents(text: string): ExtractedSheetData['payEvents'] {
    const events: ExtractedSheetData['payEvents'] = [];
    const lines = text.split('\n');

    // Look for tabular data patterns
    // Typical format: Date | DA% | Basic | Grade Pay | HRA | Total
    const tableRowPattern = /(\d{2}[./-]\d{2}[./-]\d{2,4})\s+(\d{1,3})%?\s+(\d{3,6})\s+(\d{0,5})\s+(\d{0,6})/;

    for (const line of lines) {
        const match = line.match(tableRowPattern);
        if (match) {
            const date = parseFlexibleDate(match[1]);
            const daPercent = parseInt(match[2]);
            const basicPay = parseInt(match[3]);
            const gradePay = match[4] ? parseInt(match[4]) : undefined;
            const hra = match[5] ? parseInt(match[5]) : undefined;

            // Determine event type based on pay changes
            let type: 'PROMOTION' | 'INCREMENT' | 'REVISION' | 'NORMAL' = 'NORMAL';
            if (events.length > 0) {
                const prevEvent = events[events.length - 1];
                const payIncrease = basicPay - prevEvent.basicPay;

                if (payIncrease > 5000) type = 'PROMOTION';
                else if (payIncrease > 0) type = 'INCREMENT';
                else if (daPercent !== prevEvent.daPercent) type = 'REVISION';
            }

            events.push({
                date,
                basicPay,
                gradePay,
                daPercent,
                hra,
                totalPay: basicPay + (gradePay || 0) + (hra || 0),
                type,
                confidence: 0.8, // Base confidence for structured extraction
            });
        }
    }

    return events;
}

// ============================================================================
// CALCULATIONS EXTRACTION
// ============================================================================

function extractCalculations(text: string): ExtractedSheetData['calculations'] {
    // Extract total amounts from the sheet
    const totalDuePattern = /(?:Total\s*Due|Gross\s*Arrear)[\s:]+₹?\s*([\d,]+)/i;
    const totalDrawnPattern = /(?:Total\s*Drawn|Old\s*Pay)[\s:]+₹?\s*([\d,]+)/i;
    const netArrearPattern = /(?:Net\s*Arrear|Payable)[\s:]+₹?\s*([\d,]+)/i;

    const totalDueMatch = text.match(totalDuePattern);
    const totalDrawnMatch = text.match(totalDrawnPattern);
    const netArrearMatch = text.match(netArrearPattern);

    const totalDue = totalDueMatch ? parseAmount(totalDueMatch[1]) : 0;
    const totalDrawn = totalDrawnMatch ? parseAmount(totalDrawnMatch[1]) : 0;
    const netArrear = netArrearMatch ? parseAmount(netArrearMatch[1]) : totalDue - totalDrawn;

    // Extract period-wise breakdowns if available
    const breakdowns: Array<{ period: string; amount: number }> = [];
    const breakdownPattern = /(\d{2}[./-]\d{2}[./-]\d{2,4}\s*-\s*\d{2}[./-]\d{2}[./-]\d{2,4})[\s:]+₹?\s*([\d,]+)/g;

    let match;
    while ((match = breakdownPattern.exec(text)) !== null) {
        breakdowns.push({
            period: match[1],
            amount: parseAmount(match[2]),
        });
    }

    return {
        totalDue,
        totalDrawn,
        netArrear,
        breakdowns,
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseFlexibleDate(dateStr: string): Date {
    // Handle various date formats: dd.mm.yy, dd/mm/yyyy, dd-mm-yy
    const cleaned = dateStr.replace(/[./-]/g, '/');
    const parts = cleaned.split('/');

    if (parts.length === 3) {
        let [day, month, year] = parts.map(p => parseInt(p));

        // Handle 2-digit years
        if (year < 100) {
            year += year < 50 ? 2000 : 1900;
        }

        return new Date(year, month - 1, day);
    }

    return new Date();
}

function parseAmount(amountStr: string): number {
    return parseInt(amountStr.replace(/,/g, ''));
}

function calculateExtractionConfidence(
    metadata: ExtractedSheetData['metadata'],
    payEvents: ExtractedSheetData['payEvents'],
    calculations: ExtractedSheetData['calculations']
): number {
    let score = 0;
    let maxScore = 0;

    // Metadata completeness (30%)
    maxScore += 30;
    if (metadata.employeeName !== 'Unknown') score += 10;
    if (metadata.employeeId !== 'UNKNOWN') score += 10;
    if (metadata.designation) score += 10;

    // Pay events (40%)
    maxScore += 40;
    if (payEvents.length > 0) score += 20;
    if (payEvents.length >= 5) score += 10;
    if (payEvents.some(e => e.gradePay)) score += 10;

    // Calculations (30%)
    maxScore += 30;
    if (calculations.totalDue > 0) score += 10;
    if (calculations.totalDrawn > 0) score += 10;
    if (calculations.breakdowns.length > 0) score += 10;

    return score / maxScore;
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

export const extractCalculationData = (ocrText: string): ExtractedData => {
    const structured = extractStructuredData(ocrText);

    return {
        periods: structured.payEvents.map(e => ({
            start: e.date.toISOString().split('T')[0],
            end: e.date.toISOString().split('T')[0],
        })),
        amounts: structured.payEvents.map(e => e.totalPay),
        daRates: structured.payEvents.map(e => e.daPercent),
        totals: [structured.calculations.netArrear],
        confidence: structured.confidence,
    };
};

export const compareWithCalculation = (
    extractedData: ExtractedData,
    systemSegments: any[],
    systemTotal: number
): {
    matches: number;
    mismatches: number;
    accuracy: number;
    details: Array<{ field: string; extracted: any; system: any; match: boolean }>;
} => {
    const details: Array<{ field: string; extracted: any; system: any; match: boolean }> = [];
    let matches = 0;
    let mismatches = 0;

    // Compare total arrear
    if (extractedData.totals.length > 0) {
        const extractedTotal = extractedData.totals[extractedData.totals.length - 1];
        const tolerance = systemTotal * 0.02; // 2% tolerance
        const match = Math.abs(extractedTotal - systemTotal) <= tolerance;

        details.push({
            field: 'Total Arrear',
            extracted: extractedTotal,
            system: systemTotal,
            match,
        });

        if (match) matches++;
        else mismatches++;
    }

    // Compare number of periods
    const periodCountMatch = extractedData.periods.length === systemSegments.length;
    details.push({
        field: 'Number of Periods',
        extracted: extractedData.periods.length,
        system: systemSegments.length,
        match: periodCountMatch,
    });

    if (periodCountMatch) matches++;
    else mismatches++;

    // Compare DA rates
    const systemDARates = systemSegments.map(s => s.daPercentage);
    const uniqueSystemDA = [...new Set(systemDARates)];
    const uniqueExtractedDA = [...new Set(extractedData.daRates)];

    const daRateMatch = uniqueExtractedDA.some(rate => uniqueSystemDA.includes(rate));
    details.push({
        field: 'DA Rates Present',
        extracted: uniqueExtractedDA.join(', ') + '%',
        system: uniqueSystemDA.join(', ') + '%',
        match: daRateMatch,
    });

    if (daRateMatch) matches++;
    else mismatches++;

    const accuracy = (matches / (matches + mismatches)) * 100;

    return {
        matches,
        mismatches,
        accuracy,
        details,
    };
};
