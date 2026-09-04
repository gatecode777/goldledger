'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Transaction, GoldRateSettings } from '@/lib/types';

interface TransactionContextValue {
  transactions: Transaction[];
  rateSettings: GoldRateSettings | null;
  loading: boolean;
  error: string | null;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateRateSettings: (settings: GoldRateSettings) => Promise<void>;
  refetch: () => Promise<void>;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rateSettings, setRateSettings] = useState<GoldRateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, rateRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/rate-settings'),
      ]);

      if (!txRes.ok) throw new Error('Failed to load transactions');
      const txData = await txRes.json();
      setTransactions(txData);

      if (rateRes.ok) {
        const rateData = await rateRes.json();
        setRateSettings(rateData);
      } else {
        // No rate settings yet — set a sensible default (user must save one)
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

  const addTransaction = useCallback(async (tx: Omit<Transaction, 'id'>) => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (!res.ok) throw new Error('Failed to create transaction');
    const created: Transaction = await res.json();
    setTransactions((prev) => [created, ...prev]);
  }, []);

  const updateTransaction = useCallback(async (id: string, tx: Partial<Transaction>) => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    const updated: Transaction = await res.json();
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

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

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        rateSettings,
        loading,
        error,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        updateRateSettings,
        refetch: fetchAll,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error('useTransactions must be used within TransactionProvider');
  return ctx;
}
