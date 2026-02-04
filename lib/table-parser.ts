// ============================================================================
// TABLE PARSER - Advanced table detection and cell extraction
// ============================================================================

export interface TableCell {
    row: number;
    col: number;
    value: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
}

export interface ParsedTable {
    headers: string[];
    rows: string[][];
    cells: TableCell[];
    confidence: number;
}

/**
 * Detects and parses tabular data from OCR text
 * Uses heuristics to identify grid structures and extract cell values
 */
export function parseTable(ocrText: string): ParsedTable {
    const lines = ocrText.split('\n').filter(line => line.trim().length > 0);

    // Step 1: Identify header row (usually contains keywords like Date, DA%, Basic, etc.)
    const headerKeywords = ['date', 'da', 'basic', 'grade', 'pay', 'hra', 'total', 'arrear'];
    let headerIndex = -1;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].toLowerCase();
        const matchCount = headerKeywords.filter(keyword => line.includes(keyword)).length;

        if (matchCount >= 3) {
            headerIndex = i;
            headers = extractColumnsFromLine(lines[i]);
            break;
        }
    }

    if (headerIndex === -1) {
        // Fallback: assume standard arrear calculation columns
        headers = ['Date', 'DA%', 'Basic Pay', 'Grade Pay', 'HRA', 'Total', 'Arrear'];
    }

    // Step 2: Extract data rows (everything after header)
    const dataLines = lines.slice(headerIndex + 1);
    const rows: string[][] = [];
    const cells: TableCell[] = [];

    for (let rowIdx = 0; rowIdx < dataLines.length; rowIdx++) {
        const line = dataLines[rowIdx];

        // Skip lines that look like separators or footers
        if (isSeparatorLine(line) || isFooterLine(line)) continue;

        const rowCells = extractColumnsFromLine(line);

        // Only include rows with reasonable number of columns
        if (rowCells.length >= headers.length - 2 && rowCells.length <= headers.length + 2) {
            rows.push(rowCells);

            // Create cell objects
            rowCells.forEach((value, colIdx) => {
                cells.push({
                    row: rowIdx,
                    col: colIdx,
                    value,
                    confidence: calculateCellConfidence(value, headers[colIdx]),
                });
            });
        }
    }

    // Calculate overall table confidence
    const avgCellConfidence = cells.length > 0
        ? cells.reduce((sum, cell) => sum + cell.confidence, 0) / cells.length
        : 0;

    return {
        headers,
        rows,
        cells,
        confidence: avgCellConfidence,
    };
}

/**
 * Extracts column values from a single line of text
 * Uses whitespace and pattern matching to identify cell boundaries
 */
function extractColumnsFromLine(line: string): string[] {
    // Strategy 1: Split by multiple spaces (common in OCR output)
    const spaceSplit = line.split(/\s{2,}/).map(s => s.trim()).filter(s => s.length > 0);

    if (spaceSplit.length >= 3) {
        return spaceSplit;
    }

    // Strategy 2: Split by tabs
    const tabSplit = line.split('\t').map(s => s.trim()).filter(s => s.length > 0);

    if (tabSplit.length >= 3) {
        return tabSplit;
    }

    // Strategy 3: Pattern-based extraction (dates, percentages, numbers)
    const patterns = [
        /\d{2}[./-]\d{2}[./-]\d{2,4}/,  // Dates
        /\d{1,3}%/,                      // Percentages
        /\d{3,6}/,                       // Numbers (pay amounts)
    ];

    const extracted: string[] = [];
    let remaining = line;

    for (const pattern of patterns) {
        const match = remaining.match(pattern);
        if (match) {
            extracted.push(match[0]);
            remaining = remaining.replace(match[0], '').trim();
        }
    }

    return extracted.length > 0 ? extracted : [line];
}

/**
 * Determines if a line is a table separator (e.g., "---" or "===")
 */
function isSeparatorLine(line: string): boolean {
    const cleaned = line.replace(/\s/g, '');
    return /^[-=_|+]{3,}$/.test(cleaned);
}

/**
 * Determines if a line is a footer (e.g., "Total:", "Grand Total:")
 */
function isFooterLine(line: string): boolean {
    const lower = line.toLowerCase();
    return lower.includes('total') || lower.includes('grand') || lower.includes('sum');
}

/**
 * Calculates confidence score for a cell based on expected data type
 */
function calculateCellConfidence(value: string, expectedHeader?: string): number {
    if (!expectedHeader) return 0.5;

    const header = expectedHeader.toLowerCase();
    let confidence = 0.5;

    // Date column
    if (header.includes('date')) {
        confidence = /\d{2}[./-]\d{2}[./-]\d{2,4}/.test(value) ? 0.9 : 0.3;
    }
    // Percentage column
    else if (header.includes('da') || header.includes('%')) {
        confidence = /\d{1,3}%?/.test(value) ? 0.9 : 0.3;
    }
    // Numeric column
    else if (header.includes('pay') || header.includes('hra') || header.includes('total')) {
        confidence = /^\d{1,6}$/.test(value.replace(/,/g, '')) ? 0.9 : 0.3;
    }
    // Text column
    else {
        confidence = value.length > 0 ? 0.7 : 0.2;
    }

    return confidence;
}

/**
 * Finds a specific column value by header name
 */
export function findColumnValue(table: ParsedTable, rowIndex: number, columnName: string): string | null {
    const colIndex = table.headers.findIndex(h =>
        h.toLowerCase().includes(columnName.toLowerCase())
    );

    if (colIndex === -1 || rowIndex >= table.rows.length) {
        return null;
    }

    return table.rows[rowIndex][colIndex] || null;
}

/**
 * Extracts all values from a specific column
 */
export function getColumnValues(table: ParsedTable, columnName: string): string[] {
    const colIndex = table.headers.findIndex(h =>
        h.toLowerCase().includes(columnName.toLowerCase())
    );

    if (colIndex === -1) {
        return [];
    }

    return table.rows.map(row => row[colIndex] || '').filter(v => v.length > 0);
}

/**
 * Validates table structure and returns quality metrics
 */
export function validateTable(table: ParsedTable): {
    isValid: boolean;
    issues: string[];
    quality: number;
} {
    const issues: string[] = [];
    let qualityScore = 100;

    // Check if we have headers
    if (table.headers.length === 0) {
        issues.push('No headers detected');
        qualityScore -= 30;
    }

    // Check if we have data rows
    if (table.rows.length === 0) {
        issues.push('No data rows detected');
        qualityScore -= 40;
    }

    // Check for consistent column count
    const columnCounts = table.rows.map(row => row.length);
    const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
    const inconsistentRows = columnCounts.filter(count => Math.abs(count - avgColumns) > 2).length;

    if (inconsistentRows > table.rows.length * 0.3) {
        issues.push('Inconsistent column counts across rows');
        qualityScore -= 20;
    }

    // Check overall confidence
    if (table.confidence < 0.5) {
        issues.push('Low OCR confidence');
        qualityScore -= 10;
    }

    return {
        isValid: issues.length === 0,
        issues,
        quality: Math.max(0, qualityScore) / 100,
    };
}
