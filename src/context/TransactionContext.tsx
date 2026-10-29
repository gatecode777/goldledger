'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Transaction, GoldRateSettings, Counterparty, WeightUnit, MoneyTransfer } from '@/lib/types';
import { CURRENCY_MAP } from '@/lib/currencies';

interface TransactionContextValue {
  transactions: Transaction[];
  rateSettings: GoldRateSettings | null;
  counterparties: Counterparty[];
  moneyTransfers: MoneyTransfer[];
  globalCurrency: string;
  setGlobalCurrency: (currency: string) => void;
  loading: boolean;
  error: string | null;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateRateSettings: (settings: GoldRateSettings) => Promise<void>;
  importTransactions: (txs: Omit<Transaction, 'id'>[]) => Promise<number>;
  saveOrUpdateCounterparty: (name: string, type: 'buyer' | 'seller', price: number, currency: string, weightUnit?: WeightUnit) => Promise<void>;
  addCounterparty: (c: Omit<Counterparty, 'id'>) => Promise<Counterparty>;
  updateCounterparty: (id: string, c: Partial<Counterparty>) => Promise<void>;
  deleteCounterparty: (id: string) => Promise<void>;
  addMoneyTransfer: (mt: Omit<MoneyTransfer, 'id'>) => Promise<void>;
  updateMoneyTransfer: (id: string, mt: Partial<MoneyTransfer>) => Promise<void>;
  deleteMoneyTransfer: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [moneyTransfers, setMoneyTransfers] = useState<MoneyTransfer[]>([]);
  const [rateSettings, setRateSettings] = useState<GoldRateSettings | null>(null);
  const [globalCurrency, setGlobalCurrencyState] = useState<string>('USD');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved global currency preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('goldledger_global_currency');
      if (saved && CURRENCY_MAP[saved]) {
        setGlobalCurrencyState(saved);
      }
    }
  }, []);

  const setGlobalCurrency = useCallback((code: string) => {
    if (CURRENCY_MAP[code]) {
      setGlobalCurrencyState(code);
      if (typeof window !== 'undefined') {
        localStorage.setItem('goldledger_global_currency', code);
      }
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ts = Date.now();
      const [txRes, rateRes, partyRes, mtRes] = await Promise.all([
        fetch(`/api/transactions?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/rate-settings?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/counterparties?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/money-transfers?t=${ts}`, { cache: 'no-store' }),
      ]);

      if (!txRes.ok) throw new Error('Failed to load transactions');
      const txData = await txRes.json();
      setTransactions(txData);

      if (partyRes.ok) {
        const partyData = await partyRes.json();
        setCounterparties(partyData);
      }

      if (mtRes.ok) {
        const mtData = await mtRes.json();
        setMoneyTransfers(mtData);
      }

      if (rateRes.ok) {
        const rateData = await rateRes.json();
        setRateSettings(rateData);
      } else {
        // No rate settings yet — set a sensible default
        setRateSettings({ referenceRateUSD: 2355, lastUpdated: new Date().toISOString() });
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect to database. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Counterparty Management ─────────────────────────────────────────────────
  const saveOrUpdateCounterparty = useCallback(async (
    name: string,
    type: 'buyer' | 'seller',
    price: number,
    currency: string,
    weightUnit?: WeightUnit
  ) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    try {
      const res = await fetch('/api/counterparties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          type,
          defaultPrice: price,
          currency,
          weightUnit: weightUnit || 'gram',
        }),
      });
      if (res.ok) {
        const saved: Counterparty = await res.json();
        setCounterparties((prev) => {
          const idx = prev.findIndex((c) => c.name.toLowerCase() === saved.name.toLowerCase());
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = saved;
            return copy;
          }
          return [saved, ...prev];
        });
      }
    } catch (e) {
      console.error('Failed to auto-save counterparty:', e);
    }
  }, []);

  const addCounterparty = useCallback(async (c: Omit<Counterparty, 'id'>) => {
    const res = await fetch('/api/counterparties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add counterparty');
    }
    const created: Counterparty = await res.json();
    setCounterparties((prev) => {
      const idx = prev.findIndex((p) => p.name.toLowerCase() === created.name.toLowerCase());
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = created;
        return copy;
      }
      return [created, ...prev];
    });
    return created;
  }, []);

  const updateCounterparty = useCallback(async (id: string, c: Partial<Counterparty>) => {
    const res = await fetch(`/api/counterparties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update counterparty');
    }
    const updated: Counterparty = await res.json();
    setCounterparties((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const deleteCounterparty = useCallback(async (id: string) => {
    const res = await fetch(`/api/counterparties/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete counterparty');
    setCounterparties((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Transactions ────────────────────────────────────────────────────────────
  const addTransaction = useCallback(async (tx: Omit<Transaction, 'id'>) => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (!res.ok) throw new Error('Failed to create transaction');
    const created: Transaction = await res.json();
    setTransactions((prev) => [created, ...prev]);

    // Automatically store/update buyer or seller with their price
    if (tx.counterparty && tx.counterparty.trim()) {
      saveOrUpdateCounterparty(
        tx.counterparty,
        tx.type === 'buy' ? 'seller' : 'buyer',
        tx.goldPricePerUnit,
        tx.currency,
        tx.weightUnit
      );
    }
  }, [saveOrUpdateCounterparty]);

  const updateTransaction = useCallback(async (id: string, tx: Partial<Transaction>) => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    const updated: Transaction = await res.json();
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));

    if (tx.counterparty && tx.counterparty.trim() && tx.goldPricePerUnit && tx.type && tx.currency) {
      saveOrUpdateCounterparty(
        tx.counterparty,
        tx.type === 'buy' ? 'seller' : 'buyer',
        tx.goldPricePerUnit,
        tx.currency,
        tx.weightUnit
      );
    }
  }, [saveOrUpdateCounterparty]);

  const deleteTransaction = useCallback(async (id: string) => {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete transaction');
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateRateSettings = useCallback(async (settings: GoldRateSettings) => {
    const res = await fetch('/api/rate-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update rate settings');
    const updated: GoldRateSettings = await res.json();
    setRateSettings(updated);
  }, []);

  const importTransactions = useCallback(async (txs: Omit<Transaction, 'id'>[]) => {
    const res = await fetch('/api/transactions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: txs }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to import transactions');
    }
    const data = await res.json();
    if (data.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
      setTransactions((prev) => [...data.transactions, ...prev]);
    }
    await fetchAll();

    // Auto-register counterparties from import
    txs.forEach((t) => {
      if (t.counterparty && t.counterparty.trim()) {
        saveOrUpdateCounterparty(
          t.counterparty,
          t.type === 'buy' ? 'seller' : 'buyer',
          t.goldPricePerUnit,
          t.currency,
          t.weightUnit
        );
      }
    });

    return (data.count as number) || txs.length;
  }, [fetchAll, saveOrUpdateCounterparty]);

  // ── Gold Transfers ──────────────────────────────────────────────────────────
  const addMoneyTransfer = useCallback(async (mt: Omit<MoneyTransfer, 'id'>) => {
    const res = await fetch('/api/money-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mt),
    });
    if (!res.ok) throw new Error('Failed to create gold transfer');
    const created: MoneyTransfer = await res.json();
    setMoneyTransfers((prev) => [created, ...prev]);
  }, []);

  const updateMoneyTransfer = useCallback(async (id: string, mt: Partial<MoneyTransfer>) => {
    const res = await fetch(`/api/money-transfers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mt),
    });
    if (!res.ok) throw new Error('Failed to update gold transfer');
    const updated: MoneyTransfer = await res.json();
    setMoneyTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const deleteMoneyTransfer = useCallback(async (id: string) => {
    const res = await fetch(`/api/money-transfers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete gold transfer');
    setMoneyTransfers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<TransactionContextValue>(() => ({
    transactions,
    rateSettings,
    counterparties,
    moneyTransfers,
    globalCurrency,
    setGlobalCurrency,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateRateSettings,
    importTransactions,
    saveOrUpdateCounterparty,
    addCounterparty,
    updateCounterparty,
    deleteCounterparty,
    addMoneyTransfer,
    updateMoneyTransfer,
    deleteMoneyTransfer,
    refetch: fetchAll,
  }), [
    transactions, rateSettings, counterparties, moneyTransfers, globalCurrency, setGlobalCurrency, loading, error,
    addTransaction, updateTransaction, deleteTransaction, updateRateSettings, importTransactions,
    saveOrUpdateCounterparty, addCounterparty, updateCounterparty, deleteCounterparty,
    addMoneyTransfer, updateMoneyTransfer, deleteMoneyTransfer, fetchAll,
  ]);

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error('useTransactions must be used within TransactionProvider');
  return ctx;
}
