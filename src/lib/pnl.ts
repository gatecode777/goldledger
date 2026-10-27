import { Transaction } from './types';
import { weightToGrams } from './formatters';
import { convertCurrency, convertUSDTo } from './currencies';

export interface TransactionPnL {
  /** Transaction P&L in global currency */
  pnlGlobal: number;
  /** P&L Percentage vs spot/market benchmark */
  pnlPercent: number;
  /** Actual total paid or received converted to global currency */
  actualTotalGlobal: number;
  /** Benchmark spot total value in global currency */
  benchmarkGlobal: number;
  /** Weight in grams */
  weightGrams: number;
  /** Is profit (>= 0) */
  isProfit: boolean;
}

export interface CounterpartyPnLSummary {
  counterparty: string;
  totalTransactions: number;
  buyCount: number;
  sellCount: number;

  // Buys
  totalBuyValueGlobal: number;
  totalBuyWeightGrams: number;
  avgBuyPricePerGramGlobal: number;

  // Sells
  totalSellValueGlobal: number;
  totalSellWeightGrams: number;
  avgSellPricePerGramGlobal: number;

  // Position
  netWeightGrams: number;
  netCashFlowGlobal: number;

  // P&L metrics
  totalPnLGlobal: number;
  pnlPercent: number;
  isProfit: boolean;

  // Spread
  spreadPerGramGlobal: number;
  matchedGrams: number;
}

/**
 * Calculates profit/loss for a single transaction against its spot/market rate.
 * - BUY: Bought below market spot = Discount Gain (+); Bought above spot = Premium Loss (-).
 * - SELL: Sold above market spot = Markup Profit (+); Sold below spot = Loss (-).
 */
export function calculateTransactionPnL(tx: Transaction, globalCurrency: string): TransactionPnL {
  const weightGrams = weightToGrams(tx.weight, tx.weightUnit);
  const weightOz = weightGrams / 31.1035;
  const actualTotalGlobal = convertCurrency(tx.totalValue, tx.currency, globalCurrency);
  const spotRateGlobalPerOz = convertUSDTo(tx.marketRate, globalCurrency);
  const benchmarkGlobal = weightOz * spotRateGlobalPerOz;

  let pnlGlobal = 0;
  let pnlPercent = 0;

  if (tx.type === 'buy') {
    // Acquired benchmarkGlobal worth of gold for actualTotalGlobal
    pnlGlobal = benchmarkGlobal - actualTotalGlobal;
    pnlPercent = actualTotalGlobal > 0 ? (pnlGlobal / actualTotalGlobal) * 100 : 0;
  } else {
    // Sold benchmarkGlobal worth of gold and received actualTotalGlobal
    pnlGlobal = actualTotalGlobal - benchmarkGlobal;
    pnlPercent = benchmarkGlobal > 0 ? (pnlGlobal / benchmarkGlobal) * 100 : 0;
  }

  return {
    pnlGlobal,
    pnlPercent,
    actualTotalGlobal,
    benchmarkGlobal,
    weightGrams,
    isProfit: pnlGlobal >= 0,
  };
}

/**
 * Calculates aggregated P&L and volume summary for a set of transactions
 * (optionally filtered by a single counterparty).
 */
export function calculateCounterpartySummary(
  transactions: Transaction[],
  globalCurrency: string,
  counterpartyName?: string
): CounterpartyPnLSummary {
  const partyTxs = counterpartyName
    ? transactions.filter((t) => (t.counterparty || '').trim().toLowerCase() === counterpartyName.trim().toLowerCase())
    : transactions;

  const buys = partyTxs.filter((t) => t.type === 'buy');
  const sells = partyTxs.filter((t) => t.type === 'sell');

  let totalBuyValueGlobal = 0;
  let totalBuyWeightGrams = 0;
  for (const b of buys) {
    totalBuyValueGlobal += convertCurrency(b.totalValue, b.currency, globalCurrency);
    totalBuyWeightGrams += weightToGrams(b.weight, b.weightUnit);
  }

  let totalSellValueGlobal = 0;
  let totalSellWeightGrams = 0;
  for (const s of sells) {
    totalSellValueGlobal += convertCurrency(s.totalValue, s.currency, globalCurrency);
    totalSellWeightGrams += weightToGrams(s.weight, s.weightUnit);
  }

  const avgBuyPricePerGramGlobal = totalBuyWeightGrams > 0 ? totalBuyValueGlobal / totalBuyWeightGrams : 0;
  const avgSellPricePerGramGlobal = totalSellWeightGrams > 0 ? totalSellValueGlobal / totalSellWeightGrams : 0;

  const netWeightGrams = totalBuyWeightGrams - totalSellWeightGrams;
  const netCashFlowGlobal = totalSellValueGlobal - totalBuyValueGlobal;

  let totalPnLGlobal = 0;
  let totalBenchmarkGlobal = 0;

  for (const tx of partyTxs) {
    const res = calculateTransactionPnL(tx, globalCurrency);
    totalPnLGlobal += res.pnlGlobal;
    totalBenchmarkGlobal += res.benchmarkGlobal;
  }

  const pnlPercent = totalBenchmarkGlobal > 0 ? (totalPnLGlobal / totalBenchmarkGlobal) * 100 : 0;
  const matchedGrams = Math.min(totalBuyWeightGrams, totalSellWeightGrams);
  const spreadPerGramGlobal =
    totalBuyWeightGrams > 0 && totalSellWeightGrams > 0 ? avgSellPricePerGramGlobal - avgBuyPricePerGramGlobal : 0;

  return {
    counterparty: counterpartyName || 'All Records',
    totalTransactions: partyTxs.length,
    buyCount: buys.length,
    sellCount: sells.length,
    totalBuyValueGlobal,
    totalBuyWeightGrams,
    avgBuyPricePerGramGlobal,
    totalSellValueGlobal,
    totalSellWeightGrams,
    avgSellPricePerGramGlobal,
    netWeightGrams,
    netCashFlowGlobal,
    totalPnLGlobal,
    pnlPercent,
    isProfit: totalPnLGlobal >= 0,
    spreadPerGramGlobal,
    matchedGrams,
  };
}

/**
 * Groups all transactions by counterparty and computes individual P&L summaries,
 * ordered by total P&L descending (most profitable partners first).
 */
export function calculateAllCounterpartiesBreakdown(
  transactions: Transaction[],
  globalCurrency: string
): CounterpartyPnLSummary[] {
  const partyNames = Array.from(
    new Set(transactions.map((t) => (t.counterparty || '').trim()).filter(Boolean))
  );

  return partyNames
    .map((name) => calculateCounterpartySummary(transactions, globalCurrency, name))
    .sort((a, b) => b.totalPnLGlobal - a.totalPnLGlobal);
}

