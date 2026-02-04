import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    console.log('Gemini API key found:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');

    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    console.log(`Processing ${files.length} images with Gemini...`);

    // Process all images
    const results = await Promise.all(files.map(file => processImageWithGemini(file)));

    // Merge results for multi-page documents
    const merged = mergeResults(results);

    return NextResponse.json(merged);

  } catch (error) {
    console.error('Gemini API error:', error);
    console.error('Error details:', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process images' },
      { status: 500 }
    );
  }
}

async function processImageWithGemini(file: File) {
  // Use gemini-2.0-flash for v1 API (fast, supports image input)
  // Available models: gemini-2.5-flash, gemini-2.0-flash, gemini-2.5-pro
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Convert File to ArrayBuffer then to base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const prompt = `You are analyzing a BBMB (Bhakra Beas Management Board) arrear calculation sheet. This is a COMPLEX TABULAR DOCUMENT that shows period-wise pay calculations comparing 6th CPC (old pay - what was drawn) vs 7th CPC (new pay - what is due).

**CRITICAL: UNDERSTAND THE TABLE STRUCTURE**

The table has ROWS for different time periods and COLUMNS for different pay components. Each row represents a period (e.g., "01.01.2016 to 31.01.2016") and shows:

**COLUMNS YOU WILL SEE:**
1. Period/Date columns (From date, To date, or combined "From-To")
2. Days in period
3. 6th CPC (OLD PAY - DRAWN) columns:
   - Basic Pay (6th CPC)
   - Grade Pay
   - DA % (old rate)
   - DA Amount (old)
   - HRA (old)
   - **Total Drawn** (6th CPC total)
4. 7th CPC (NEW PAY - DUE) columns:
   - Basic Pay (7th CPC) - usually higher
   - DA % (new rate)
   - DA Amount (new)
   - HRA (new)
   - **Total Due** (7th CPC total)
5. Net Arrear (Due - Drawn for that period)

**YOUR TASK:**

Extract EVERY ROW from the table. For each period/row, you must extract:
- The period dates (from and to)
- The 6th CPC Basic Pay (smaller amount, what was drawn)
- The 7th CPC Basic Pay (larger amount, what is due)
- Grade Pay (if present)
- DA percentages (both old and new if different)
- **Total Drawn** for that period
- **Total Due** for that period
- **Net Arrear** for that period

**EMPLOYEE INFORMATION:**
Extract from the top of the document:
- Employee Name
- Employee ID/Number
- Designation/Post

**IMPORTANT RULES:**
1. Extract EVERY SINGLE ROW - if there are 30 periods, extract all 30
2. For each row, you MUST extract BOTH the "Drawn" (6th CPC) and "Due" (7th CPC) amounts
3. The "Drawn" amount is usually in columns labeled "6th CPC", "Old Pay", or "Drawn"
4. The "Due" amount is usually in columns labeled "7th CPC", "Revised Pay", or "Due"
5. Remove all currency symbols (₹) and commas from numbers
6. Dates should be in DD.MM.YYYY format
7. If a cell is empty, use null

**OUTPUT FORMAT:**

Return ONLY valid JSON (no markdown, no code blocks) in this EXACT structure:

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
      "periodStart": "DD.MM.YYYY",
      "periodEnd": "DD.MM.YYYY",
      "days": number or null,
      "sixthCPC": {
        "basicPay": number,
        "gradePay": number or null,
        "daPercent": number,
        "daAmount": number or null,
        "hra": number or null,
        "total": number
      },
      "seventhCPC": {
        "basicPay": number,
        "daPercent": number,
        "daAmount": number or null,
        "hra": number or null,
        "total": number
      },
      "netArrear": number,
      "eventType": "NORMAL|INCREMENT|PROMOTION|REVISION"
    }
  ],
  "calculations": {
    "totalDue": number,
    "totalDrawn": number,
    "netArrear": number
  },
  "confidence": number (0.0 to 1.0)
}

**EXAMPLE:**
If you see a row like:
| 01.01.2016 | 31.01.2016 | 31 | 55500 | 4200 | 119% | 66045 | 8325 | 134070 | 60199 | 125% | 75249 | 9030 | 144478 | 10408 |

You should extract:
{
  "periodStart": "01.01.2016",
  "periodEnd": "31.01.2016",
  "days": 31,
  "sixthCPC": {
    "basicPay": 55500,
    "gradePay": 4200,
    "daPercent": 119,
    "daAmount": 66045,
    "hra": 8325,
    "total": 134070
  },
  "seventhCPC": {
    "basicPay": 60199,
    "daPercent": 125,
    "daAmount": 75249,
    "hra": 9030,
    "total": 144478
  },
  "netArrear": 10408,
  "eventType": "NORMAL"
}

**CRITICAL:** Extract ALL rows, not just a sample!`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: file.type,
        data: base64
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

  const extractedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  return extractedData;
}

function mergeResults(results: any[]) {
  if (results.length === 1) {
    return results[0];
  }

  // Merge strategy: Use first page for metadata, combine all pay events, use last page for totals
  const merged = {
    employeeInfo: results[0].employeeInfo,
    period: results[0].period,
    payEvents: results.flatMap((r: any) => r.payEvents),
    calculations: results[results.length - 1].calculations,
    confidence: results.reduce((sum: number, r: any) => sum + r.confidence, 0) / results.length
  };

  // Remove duplicate pay events (same date)
  const uniqueEvents = new Map();
  merged.payEvents.forEach((event: any) => {
    uniqueEvents.set(event.date, event);
  });
  merged.payEvents = Array.from(uniqueEvents.values());

  return merged;
}
