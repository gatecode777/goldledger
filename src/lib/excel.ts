import * as XLSX from 'xlsx';
import { Transaction, TransactionType, Purity, WeightUnit } from '@/lib/types';

export interface ParsedRowResult {
  rowNumber: number;
  status: 'valid' | 'error';
  data?: Omit<Transaction, 'id'>;
  raw: Record<string, any>;
  errors: string[];
}

export interface ParseSummary {
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: ParsedRowResult[];
  validTransactions: Omit<Transaction, 'id'>[];
}

// ── Export Transactions to Excel ─────────────────────────────────────────────
export function exportTransactionsToExcel(
  transactions: Transaction[],
  filename?: string
) {
  const exportData = transactions.map((tx) => ({
    'Date & Time': tx.dateTime ? tx.dateTime.replace('T', ' ').slice(0, 16) : '',
    'Type': tx.type.toUpperCase(),
    'Purity': tx.purity === 'custom' && tx.customPurity ? `${tx.customPurity} (Custom)` : tx.purity,
    'Weight': tx.weight,
    'Unit': tx.weightUnit,
    'Price Per Unit': tx.goldPricePerUnit,
    'Currency': tx.currency,
    'Total Value': tx.totalValue,
    'Spot Rate (USD/oz)': tx.marketRate,
    'Counterparty / Dealer': tx.counterparty || '',
    'Source': tx.source || 'manual',
    'Notes': tx.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Auto-fit column widths
  const colWidths = Object.keys(exportData[0] || {}).map((key) => {
    let maxLen = key.length;
    for (const row of exportData) {
      const val = String((row as any)[key] ?? '');
      if (val.length > maxLen) maxLen = Math.min(val.length, 40);
    }
    return { wch: Math.max(maxLen + 3, 10) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

  const nowStr = new Date().toISOString().slice(0, 10);
  const finalName = filename || `gold_transactions_${nowStr}.xlsx`;
  XLSX.writeFile(workbook, finalName);
}

// ── Download Sample Template ────────────────────────────────────────────────
export function downloadSampleExcelTemplate() {
  const sampleRows = [
    {
      'Date & Time': '2026-10-21 10:30',
      'Type': 'BUY',
      'Purity': '24K',
      'Custom Purity': '',
      'Weight': 10,
      'Unit': 'gram',
      'Price Per Unit': 85.50,
      'Currency': 'USD',
      'Spot Rate (USD/oz)': 2650.00,
      'Counterparty / Dealer': 'Dubai Gold Souk',
      'Notes': '999.9 Fine Minted Bar',
    },
    {
      'Date & Time': '2026-10-21 12:15',
      'Type': 'SELL',
      'Purity': '22K',
      'Custom Purity': '',
      'Weight': 25.5,
      'Unit': 'gram',
      'Price Per Unit': 7250,
      'Currency': 'INR',
      'Spot Rate (USD/oz)': 2650.00,
      'Counterparty / Dealer': 'Tanishq Jewellers',
      'Notes': 'Old jewelry liquidation',
    },
    {
      'Date & Time': '2026-10-21 15:45',
      'Type': 'BUY',
      'Purity': '24K',
      'Custom Purity': '',
      'Weight': 1,
      'Unit': 'tola',
      'Price Per Unit': 3420,
      'Currency': 'AED',
      'Spot Rate (USD/oz)': 2650.00,
      'Counterparty / Dealer': 'Emirates Gold Refinery',
      'Notes': '1 Tola TT Bar',
    },
    {
      'Date & Time': '2026-10-21 16:30',
      'Type': 'BUY',
      'Purity': 'custom',
      'Custom Purity': '20K 833',
      'Weight': 15.0,
      'Unit': 'gram',
      'Price Per Unit': 68.20,
      'Currency': 'USD',
      'Spot Rate (USD/oz)': 2650.00,
      'Counterparty / Dealer': 'Local Bullion Exchange',
      'Notes': 'Custom antique lot',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  ws['!cols'] = [
    { wch: 18 }, // Date & Time
    { wch: 10 }, // Type
    { wch: 10 }, // Purity
    { wch: 15 }, // Custom Purity
    { wch: 10 }, // Weight
    { wch: 10 }, // Unit
    { wch: 15 }, // Price Per Unit
    { wch: 10 }, // Currency
    { wch: 20 }, // Spot Rate
    { wch: 26 }, // Counterparty
    { wch: 28 }, // Notes
  ];

  // Instructions reference sheet
  const refRows = [
    { Column: 'Date & Time', Required: 'No (Defaults to now)', 'Allowed Values / Examples': 'YYYY-MM-DD HH:mm or YYYY-MM-DD' },
    { Column: 'Type', Required: 'Yes', 'Allowed Values / Examples': 'BUY or SELL' },
    { Column: 'Purity', Required: 'Yes', 'Allowed Values / Examples': '24K, 22K, 21K, 18K, 14K, or custom' },
    { Column: 'Custom Purity', Required: 'Only if Purity is custom', 'Allowed Values / Examples': 'e.g. 20K, 850 fine' },
    { Column: 'Weight', Required: 'Yes', 'Allowed Values / Examples': 'Positive number (e.g. 10.5)' },
    { Column: 'Unit', Required: 'Yes', 'Allowed Values / Examples': 'gram, tola, or troy_oz' },
    { Column: 'Price Per Unit', Required: 'Yes', 'Allowed Values / Examples': 'Gold price per weight unit (e.g. 85.50)' },
    { Column: 'Currency', Required: 'No (Defaults to USD)', 'Allowed Values / Examples': 'USD, INR, AED, EUR, GBP, SAR, etc.' },
    { Column: 'Spot Rate (USD/oz)', Required: 'No (Defaults to $2355)', 'Allowed Values / Examples': 'Reference spot price (e.g. 2650)' },
    { Column: 'Counterparty / Dealer', Required: 'No', 'Allowed Values / Examples': 'Buyer/seller name or shop' },
    { Column: 'Notes', Required: 'No', 'Allowed Values / Examples': 'Invoice #, remarks, or batch notes' },
  ];
  const wsRef = XLSX.utils.json_to_sheet(refRows);
  wsRef['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 45 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.utils.book_append_sheet(wb, wsRef, 'Reference Guide');

  XLSX.writeFile(wb, 'gold_transactions_template.xlsx');
}

// ── Normalize Column Keys ────────────────────────────────────────────────────
function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findValue(row: Record<string, any>, candidates: string[]): any {
  for (const c of candidates) {
    const norm = normalizeKey(c);
    for (const [k, v] of Object.entries(row)) {
      if (normalizeKey(k) === norm && v !== undefined && v !== null && v !== '') {
        return v;
      }
    }
  }
  return undefined;
}

// ── Parse Date from String or Serial ─────────────────────────────────────────
function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const fractionalDay = val - Math.floor(val);
    const totalSeconds = Math.floor(fractionalDay * 86400);
    const date = new Date((utcValue + totalSeconds) * 1000);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Try standard date parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();

    // Check DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10) - 1;
      const y = parseInt(ddmmyyyy[3], 10);
      const hh = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0;
      const mm = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 0;
      const ss = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 0;
      const dt = new Date(y, m, d, hh, mm, ss);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
  }
  return new Date().toISOString();
}

// ── Normalize Purity ────────────────────────────────────────────────────────
function normalizePurity(val: any): { purity: Purity; customPurity?: string } {
  if (!val) return { purity: '24K' };
  const str = String(val).trim().toUpperCase();

  if (str.includes('24') || str.includes('999')) return { purity: '24K' };
  if (str.includes('22') || str.includes('916')) return { purity: '22K' };
  if (str.includes('21') || str.includes('875')) return { purity: '21K' };
  if (str.includes('18') || str.includes('750')) return { purity: '18K' };
  if (str.includes('14') || str.includes('583') || str.includes('585')) return { purity: '14K' };

  return { purity: 'custom', customPurity: String(val).trim() };
}

// ── Normalize Weight Unit ───────────────────────────────────────────────────
function normalizeWeightUnit(val: any): WeightUnit {
  if (!val) return 'gram';
  const str = String(val).trim().toLowerCase();
  if (str.startsWith('tol') || str === 'tl') return 'tola';
  if (str.includes('oz') || str.includes('ounce')) return 'troy_oz';
  return 'gram';
}

// ── Normalize Type ──────────────────────────────────────────────────────────
function normalizeType(val: any): TransactionType | null {
  if (!val) return null;
  const str = String(val).trim().toLowerCase();
  if (str === 'buy' || str === 'b' || str === 'purchase' || str === 'in' || str === '+') return 'buy';
  if (str === 'sell' || str === 's' || str === 'sale' || str === 'out' || str === '-') return 'sell';
  return null;
}

// ── Parse Excel File (ArrayBuffer or File) ───────────────────────────────────
export async function parseExcelTransactions(
  file: File,
  referenceRateUSD: number = 2355,
  defaultCurrency: string = 'USD'
): Promise<ParseSummary> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded Excel file has no worksheets.');
  }

  const ws = wb.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('No data rows found in the uploaded file.');
  }

  const results: ParsedRowResult[] = [];
  const validTransactions: Omit<Transaction, 'id'>[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-indexed header is row 1
    const errors: string[] = [];

    // Type
    const rawType = findValue(row, ['type', 'transactiontype', 'buysell', 'action']);
    const type = normalizeType(rawType);
    if (!type) {
      errors.push(`Invalid or missing Type "${rawType || ''}" (must be BUY or SELL)`);
    }

    // Weight
    const rawWeight = findValue(row, ['weight', 'qty', 'quantity', 'grams', 'amount']);
    const weightNum = parseFloat(String(rawWeight).replace(/,/g, ''));
    if (isNaN(weightNum) || weightNum <= 0) {
      errors.push(`Invalid Weight "${rawWeight || ''}" (must be positive number)`);
    }

    // Unit
    const rawUnit = findValue(row, ['unit', 'weightunit', 'uom']);
    const weightUnit = normalizeWeightUnit(rawUnit);

    // Price
    const rawPrice = findValue(row, ['priceperunit', 'goldpriceperunit', 'price', 'rate', 'unitprice', 'goldprice']);
    const priceNum = parseFloat(String(rawPrice).replace(/,/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push(`Invalid Price "${rawPrice || ''}" (must be positive number)`);
    }

    // Purity
    const rawPurity = findValue(row, ['purity', 'karat', 'carat']);
    const rawCustomPurity = findValue(row, ['custompurity', 'customkarat']);
    const purityObj = normalizePurity(rawPurity);
    const purity: Purity = purityObj.purity;
    const customPurity = rawCustomPurity ? String(rawCustomPurity).trim() : purityObj.customPurity;

    if (purity === 'custom' && !customPurity) {
      errors.push('Purity is set to "custom" but no custom purity specification was provided');
    }

    // Currency
    const rawCurrency = findValue(row, ['currency', 'curr']);
    const currency = rawCurrency ? String(rawCurrency).trim().toUpperCase() : defaultCurrency;

    // Spot Rate
    const rawSpot = findValue(row, ['spotrate', 'spotrateusdoz', 'marketrate', 'marketrateusd', 'spotprice']);
    const spotNum = rawSpot ? parseFloat(String(rawSpot).replace(/,/g, '')) : referenceRateUSD;
    const marketRate = !isNaN(spotNum) && spotNum > 0 ? spotNum : referenceRateUSD;

    // Date
    const rawDate = findValue(row, ['date', 'datetime', 'dateandtime', 'time']);
    const dateTime = parseExcelDate(rawDate);

    // Counterparty & Notes
    const counterparty = String(findValue(row, ['counterparty', 'counterpartydealer', 'dealer', 'party', 'customer', 'vendor']) || '').trim();
    const notes = String(findValue(row, ['notes', 'note', 'remarks', 'description']) || '').trim();

    // Total Value
    const rawTotal = findValue(row, ['totalvalue', 'total', 'totalamount']);
    const totalNum = rawTotal ? parseFloat(String(rawTotal).replace(/,/g, '')) : (weightNum * priceNum);
    const totalValue = !isNaN(totalNum) && totalNum > 0 ? totalNum : (weightNum * priceNum || 0);

    if (errors.length === 0 && type && weightNum > 0 && priceNum > 0) {
      const validTx: Omit<Transaction, 'id'> = {
        type,
        goldPricePerUnit: priceNum,
        marketRate,
        purity,
        customPurity: purity === 'custom' ? customPurity : undefined,
        weight: weightNum,
        weightUnit,
        dateTime,
        currency,
        counterparty,
        notes,
        source: 'import',
        totalValue,
      };

      validTransactions.push(validTx);
      results.push({
        rowNumber,
        status: 'valid',
        data: validTx,
        raw: row,
        errors: [],
      });
    } else {
      results.push({
        rowNumber,
        status: 'error',
        raw: row,
        errors,
      });
    }
  });

  return {
    totalRows: rawRows.length,
    validCount: validTransactions.length,
    errorCount: results.filter(r => r.status === 'error').length,
    rows: results,
    validTransactions,
  };
}
