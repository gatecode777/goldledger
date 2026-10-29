export type TransactionType = 'buy' | 'sell';
export type Purity =
  | '24K 999'
  | '24K 995'
  | '24K 991';
export type WeightUnit = 'gram' | 'troy_oz' | 'tola';
export type TransactionSource = 'manual' | 'scan' | 'import';
export type CounterpartyType = 'buyer' | 'seller' | 'both';
export type PaymentType = 'Cash' | 'RTGS';

export interface Counterparty {
  id: string;
  name: string;
  type: CounterpartyType;
  defaultPrice: number;     // saved price per unit
  currency: string;         // e.g. 'USD', 'INR', 'AED'
  weightUnit?: WeightUnit;  // e.g. 'gram'
  phone?: string;
  notes?: string;
  lastUsedAt?: string;      // ISO string
  createdAt?: string;
  updatedAt?: string;
}

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
  paymentType?: PaymentType;    // 'Cash' | 'RTGS'
  transactionId?: string;       // Optional RTGS / bank transfer reference ID
  // confidence flags — used for scan results
  lowConfidenceFields?: string[];
}

export interface GoldRateSettings {
  referenceRateUSD: number;     // USD per troy oz
  lastUpdated: string;          // ISO string
}

export type TransferType = 'receive' | 'send' | 'both';
export type MoneyTransferStatus = 'completed' | 'pending' | 'cancelled';

export interface MoneyTransfer {
  id: string;
  transferType?: TransferType;  // 'receive' (sender gives money) | 'send' (we give receiver money) | 'both'
  senderName: string;
  receiverName: string;
  amount: number;               // original amount
  currency: string;             // currency of the transfer
  senderFeePercent: number;     // default 0.1 (%)
  receiverFeePercent: number;   // default 0.05 (%)
  senderFee: number;            // amount × senderFeePercent / 100
  receiverFee: number;          // amount × receiverFeePercent / 100
  netProfit: number;            // net profit / earning
  amountDelivered: number;      // net amount delivered or credited
  paymentType: PaymentType;
  transactionId?: string;       // RTGS reference
  dateTime: string;             // ISO string
  notes: string;
  status: MoneyTransferStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppState {
  transactions: Transaction[];
  rateSettings: GoldRateSettings;
  counterparties?: Counterparty[];
  moneyTransfers?: MoneyTransfer[];
}
