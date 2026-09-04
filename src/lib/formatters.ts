import { WeightUnit } from './types';
import { CURRENCY_MAP } from './currencies';

export function formatCurrency(amount: number, currencyCode: string): string {
  const info = CURRENCY_MAP[currencyCode];
  const symbol = info?.symbol ?? currencyCode;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

export function formatWeight(weight: number, unit: WeightUnit): string {
  const unitLabels: Record<WeightUnit, string> = {
    gram: 'g',
    troy_oz: 'troy oz',
    tola: 'tola',
  };
  return `${weight} ${unitLabels[unit]}`;
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatShortDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

export function purityLabel(purity: string, customPurity?: string): string {
  if (purity === 'custom' && customPurity) return customPurity;
  return purity;
}

export function weightToGrams(weight: number, unit: WeightUnit): number {
  switch (unit) {
    case 'gram': return weight;
    case 'troy_oz': return weight * 31.1035;
    case 'tola': return weight * 11.6638;
  }
}

// Convert grams of gold to a USD value, given gold price per troy oz
export function goldValueUSD(weightGrams: number, pricePerTroyOzUSD: number): number {
  return (weightGrams / 31.1035) * pricePerTroyOzUSD;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
