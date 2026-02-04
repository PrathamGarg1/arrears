// ============================================================================
// GEMINI VISION API - Intelligent Document Understanding
// ============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface GeminiExtractedData {
    employeeInfo: {
        name: string;
        employeeId: string;
        designation?: string;
    };
    period: {
        startDate: string;
        endDate: string;
    };
    payEvents: Array<{
        date: string;
        basicPay: number;
        gradePay?: number;
        daPercent: number;
        hra?: number;
        eventType: 'NORMAL' | 'INCREMENT' | 'PROMOTION' | 'REVISION';
    }>;
    calculations: {
        totalDue: number;
        totalDrawn: number;
        netArrear: number;
        periodBreakdowns?: Array<{
            period: string;
            due: number;
            drawn: number;
            arrear: number;
        }>;
    };
    confidence: number;
}

/**
 * Uses Gemini Vision API to extract structured data from arrear calculation sheets
 * This provides much higher accuracy than Tesseract.js for complex tabular documents
 */
export async function extractWithGemini(imageFile: File): Promise<GeminiExtractedData> {
    try {
        // Convert File to base64
        const base64Image = await fileToBase64(imageFile);

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are analyzing a government arrear calculation sheet from BBMB (Bhakra Beas Management Board). This document contains detailed pay calculations for an employee.

CRITICAL INSTRUCTIONS:
1. This is a TABULAR document with rows and columns
2. Extract ALL data from the table systematically
3. Pay special attention to dates, amounts, and percentages
4. The table typically has these columns: Date, DA%, Basic Pay, Grade Pay, HRA, Total Due, Total Drawn, Arrear

EXTRACT THE FOLLOWING DATA:

**Employee Information:**
- Employee Name (usually at top of document)
- Employee ID/Number
- Designation/Post (if mentioned)

**Period:**
- Start Date (first date in calculation period)
- End Date (last date in calculation period)

**Pay Events Table:**
For EACH ROW in the table, extract:
- Date (format: DD.MM.YYYY or DD/MM/YYYY)
- Basic Pay (7th CPC revised pay)
- Grade Pay (6th CPC, if present)
- DA Percentage (Dearness Allowance %)
- HRA (House Rent Allowance, if present)
- Event Type: Determine if this is:
  * "PROMOTION" - if there's a large jump in basic pay (>5000)
  * "INCREMENT" - if there's a small increase in basic pay
  * "REVISION" - if only DA% changes
  * "NORMAL" - otherwise

**Calculations:**
- Total Due (sum of all "Due" amounts or "7th CPC" amounts)
- Total Drawn (sum of all "Drawn" amounts or "6th CPC" amounts)
- Net Arrear (Total Due - Total Drawn)
- If there are period-wise breakdowns, extract each period with its amounts

**IMPORTANT:**
- Extract EVERY row from the table, not just a sample
- If a cell is empty or unclear, use null
- For dates, maintain the exact format you see
- For amounts, extract only numbers (remove ₹ or commas)
- Be precise with percentages

Return the data in this EXACT JSON format:
{
  "employeeInfo": {
    "name": "string",
    "employeeId": "string",
    "designation": "string or null"
  },
  "period": {
    "startDate": "DD.MM.YYYY",
    "endDate": "DD.MM.YYYY"
  },
  "payEvents": [
    {
      "date": "DD.MM.YYYY",
      "basicPay": number,
      "gradePay": number or null,
      "daPercent": number,
      "hra": number or null,
      "eventType": "NORMAL|INCREMENT|PROMOTION|REVISION"
    }
  ],
  "calculations": {
    "totalDue": number,
    "totalDrawn": number,
    "netArrear": number,
    "periodBreakdowns": [
      {
        "period": "string",
        "due": number,
        "drawn": number,
        "arrear": number
      }
    ] or null
  },
  "confidence": number (0.0 to 1.0, your confidence in this extraction)
}`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: imageFile.type,
                    data: base64Image
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // Extract JSON from response (Gemini sometimes wraps it in markdown)
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse Gemini response as JSON');
        }

        const extractedData: GeminiExtractedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);

        return extractedData;

    } catch (error) {
        console.error('Gemini extraction error:', error);
        throw new Error(`Failed to extract data with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Process multiple images with Gemini
 */
export async function extractMultipleWithGemini(imageFiles: File[]): Promise<GeminiExtractedData> {
    // For multi-page documents, we'll process each page and merge the results
    const results = await Promise.all(imageFiles.map(file => extractWithGemini(file)));

    // Merge strategy: Use first page for metadata, combine all pay events, use last page for totals
    const merged: GeminiExtractedData = {
        employeeInfo: results[0].employeeInfo,
        period: results[0].period,
        payEvents: results.flatMap(r => r.payEvents),
        calculations: results[results.length - 1].calculations, // Last page usually has totals
        confidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    };

    // Remove duplicate pay events (same date)
    const uniqueEvents = new Map();
    merged.payEvents.forEach(event => {
        uniqueEvents.set(event.date, event);
    });
    merged.payEvents = Array.from(uniqueEvents.values());

    return merged;
}

/**
 * Convert File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Convert Gemini extracted data to our internal ExtractedSheetData format
 */
export function geminiToInternalFormat(geminiData: GeminiExtractedData): any {
    return {
        metadata: {
            employeeName: geminiData.employeeInfo.name,
            employeeId: geminiData.employeeInfo.employeeId,
            designation: geminiData.employeeInfo.designation,
            period: {
                start: parseDate(geminiData.period.startDate),
                end: parseDate(geminiData.period.endDate)
            }
        },
        payEvents: geminiData.payEvents.map(event => ({
            date: parseDate(event.date),
            basicPay: event.basicPay,
            gradePay: event.gradePay,
            daPercent: event.daPercent,
            hra: event.hra,
            totalPay: event.basicPay + (event.gradePay || 0) + (event.hra || 0),
            type: event.eventType,
            confidence: geminiData.confidence
        })),
        calculations: {
            totalDue: geminiData.calculations.totalDue,
            totalDrawn: geminiData.calculations.totalDrawn,
            netArrear: geminiData.calculations.netArrear,
            breakdowns: geminiData.calculations.periodBreakdowns || []
        },
        rawOCRText: JSON.stringify(geminiData, null, 2),
        confidence: geminiData.confidence
    };
}

function parseDate(dateStr: string): Date {
    // Handle DD.MM.YYYY or DD/MM/YYYY format
    const parts = dateStr.split(/[./-]/);
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
        let year = parseInt(parts[2]);

        // Handle 2-digit years
        if (year < 100) {
            year += year < 50 ? 2000 : 1900;
        }

        return new Date(year, month, day);
    }
    return new Date();
}
