export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  rateToUSD: number; // 1 USD = X units of this currency
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar',           symbol: '$',   rateToUSD: 1.0 },
  { code: 'AED', name: 'UAE Dirham',          symbol: 'د.إ', rateToUSD: 3.6725 },
  { code: 'SAR', name: 'Saudi Riyal',         symbol: '﷼',   rateToUSD: 3.75 },
  { code: 'INR', name: 'Indian Rupee',        symbol: '₹',   rateToUSD: 83.5 },
  { code: 'PKR', name: 'Pakistani Rupee',     symbol: '₨',   rateToUSD: 278.5 },
  { code: 'EUR', name: 'Euro',                symbol: '€',   rateToUSD: 0.92 },
  { code: 'GBP', name: 'British Pound',       symbol: '£',   rateToUSD: 0.79 },
  { code: 'CHF', name: 'Swiss Franc',         symbol: 'Fr',  rateToUSD: 0.90 },
  { code: 'JPY', name: 'Japanese Yen',        symbol: '¥',   rateToUSD: 154.5 },
  { code: 'CNY', name: 'Chinese Yuan',        symbol: '¥',   rateToUSD: 7.24 },
  { code: 'HKD', name: 'Hong Kong Dollar',    symbol: 'HK$', rateToUSD: 7.83 },
  { code: 'SGD', name: 'Singapore Dollar',    symbol: 'S$',  rateToUSD: 1.35 },
  { code: 'MYR', name: 'Malaysian Ringgit',   symbol: 'RM',  rateToUSD: 4.72 },
  { code: 'THB', name: 'Thai Baht',           symbol: '฿',   rateToUSD: 35.8 },
  { code: 'TRY', name: 'Turkish Lira',        symbol: '₺',   rateToUSD: 32.2 },
  { code: 'EGP', name: 'Egyptian Pound',      symbol: 'E£',  rateToUSD: 47.5 },
  { code: 'KWD', name: 'Kuwaiti Dinar',       symbol: 'KD',  rateToUSD: 0.307 },
  { code: 'QAR', name: 'Qatari Riyal',        symbol: 'QR',  rateToUSD: 3.64 },
  { code: 'BHD', name: 'Bahraini Dinar',      symbol: 'BD',  rateToUSD: 0.376 },
  { code: 'OMR', name: 'Omani Rial',          symbol: 'RO',  rateToUSD: 0.385 },
  { code: 'CAD', name: 'Canadian Dollar',     symbol: 'C$',  rateToUSD: 1.37 },
  { code: 'AUD', name: 'Australian Dollar',   symbol: 'A$',  rateToUSD: 1.54 },
  { code: 'ZAR', name: 'South African Rand',  symbol: 'R',   rateToUSD: 18.9 },
  { code: 'NGN', name: 'Nigerian Naira',      symbol: '₦',   rateToUSD: 1580.0 },
  { code: 'GHC', name: 'Ghanaian Cedi',       symbol: 'GH₵', rateToUSD: 15.2 },
  { code: 'BDT', name: 'Bangladeshi Taka',    symbol: '৳',   rateToUSD: 110.0 },
  { code: 'LKR', name: 'Sri Lankan Rupee',    symbol: 'Rs',  rateToUSD: 310.0 },
  { code: 'IDR', name: 'Indonesian Rupiah',   symbol: 'Rp',  rateToUSD: 15750.0 },
  { code: 'MXN', name: 'Mexican Peso',        symbol: '$',   rateToUSD: 17.15 },
  { code: 'BRL', name: 'Brazilian Real',      symbol: 'R$',  rateToUSD: 5.05 },
];

export const CURRENCY_MAP: Record<string, CurrencyInfo> = Object.fromEntries(
  CURRENCIES.map(c => [c.code, c])
);

export function convertUSDTo(amountUSD: number, targetCurrency: string): number {
  const info = CURRENCY_MAP[targetCurrency];
  if (!info) return amountUSD;
  return amountUSD * info.rateToUSD;
}

export function convertToUSD(amount: number, fromCurrency: string): number {
  const info = CURRENCY_MAP[fromCurrency];
  if (!info) return amount;
  return amount / info.rateToUSD;
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (!amount || isNaN(amount)) return 0;
  if (fromCurrency === toCurrency) return amount;
  const inUSD = convertToUSD(amount, fromCurrency);
  return convertUSDTo(inUSD, toCurrency);
}

export function formatConvertedPrice(val: number): string {
  if (isNaN(val) || val <= 0) return '';
  // If whole number, format without decimals
  if (Math.abs(val - Math.round(val)) < 0.0001) {
    return Math.round(val).toString();
  }
  // Otherwise round to 2 decimals
  return Number(val.toFixed(2)).toString();
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_MAP[code]?.symbol ?? code;
}
