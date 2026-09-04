export type TransactionType = 'buy' | 'sell';
export type Purity = '24K' | '22K' | '21K' | '18K' | '14K' | 'custom';
export type WeightUnit = 'gram' | 'troy_oz' | 'tola';
export type TransactionSource = 'manual' | 'scan';

export interface Transaction {
  id: string;
  type: TransactionType;
  goldPricePerUnit: number;     // price per weight unit in the transaction currency
  marketRate: number;           // market spot rate (USD per troy oz)
  purity: Purity;
  customPurity?: string;        // used when purity === 'custom'
  weight: number;
  weightUnit: WeightUnit;
  dateTime: string;             // ISO string
  currency: string;             // e.g. 'USD', 'AED', 'INR'
  counterparty: string;
  notes: string;
  source: TransactionSource;
  totalValue: number;           // goldPricePerUnit * weight
  // confidence flags — used for scan results
  lowConfidenceFields?: string[];
}

export interface GoldRateSettings {
  referenceRateUSD: number;     // USD per troy oz
  lastUpdated: string;          // ISO string
}

export interface AppState {
  transactions: Transaction[];
  rateSettings: GoldRateSettings;
}
