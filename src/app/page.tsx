'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { convertToUSD } from '@/lib/currencies';
import { formatCurrency, formatDate, purityLabel, weightToGrams } from '@/lib/formatters';
import TrendChart from '@/components/TrendChart';

export default function DashboardPage() {
  const { transactions, rateSettings, loading, error } = useTransactions();

  const stats = useMemo(() => {
    const buys  = transactions.filter((t) => t.type === 'buy');
    const sells = transactions.filter((t) => t.type === 'sell');

    const totalBuyUSD  = buys.reduce((s, t)  => s + convertToUSD(t.totalValue, t.currency), 0);
    const totalSellUSD = sells.reduce((s, t) => s + convertToUSD(t.totalValue, t.currency), 0);
    const netUSD = totalBuyUSD - totalSellUSD;

    const totalWeightGrams = transactions.reduce((s, t) => {
      const g = weightToGrams(t.weight, t.weightUnit);
      return t.type === 'buy' ? s + g : s - g;
    }, 0);

    const latestFiveTransactions = [...transactions]
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
      .slice(0, 5);

    const purityBreakdown = transactions.reduce((acc: Record<string, number>, t) => {
      const key = purityLabel(t.purity, t.customPurity);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const scanCount   = transactions.filter((t) => t.source === 'scan').length;
    const manualCount = transactions.filter((t) => t.source === 'manual').length;

    return {
      totalBuyUSD, totalSellUSD, netUSD,
      totalWeightGrams,
      buyCount: buys.length, sellCount: sells.length,
      latestFiveTransactions, purityBreakdown,
      scanCount, manualCount,
    };
  }, [transactions]);

  const referenceRate = rateSettings?.referenceRateUSD ?? 0;
  const goldValue = (stats.totalWeightGrams / 31.1035) * referenceRate;

  if (loading) {
    return (
      <div className="page-loading">
        <div className="page-spinner" />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-error">
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2>Connection Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Live overview of your gold transaction portfolio
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/transactions/new" className="btn btn-primary">
            ➕ New Transaction
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card gold">
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value gold">{transactions.length}</div>
          <div className="stat-sub">{stats.buyCount} buys · {stats.sellCount} sells</div>
          <div className="stat-icon">📋</div>
        </div>

        <div className="stat-card green">
          <div className="stat-label">Total Buy Volume</div>
          <div className="stat-value green">
            ${stats.totalBuyUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-sub">USD equivalent</div>
          <div className="stat-icon">📈</div>
        </div>

        <div className="stat-card red">
          <div className="stat-label">Total Sell Volume</div>
          <div className="stat-value red">
            ${stats.totalSellUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-sub">USD equivalent</div>
          <div className="stat-icon">📉</div>
        </div>

        <div className={`stat-card ${stats.netUSD >= 0 ? 'green' : 'red'}`}>
          <div className="stat-label">Net Position (USD)</div>
          <div className={`stat-value ${stats.netUSD >= 0 ? 'green' : 'red'}`} style={{ color: stats.netUSD >= 0 ? '#16a34a' : '#dc2626' }}>
            {stats.netUSD >= 0 ? '+' : ''}${Math.abs(stats.netUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-sub">Buy − Sell</div>
          <div className="stat-icon">⚖️</div>
        </div>

        <div className="stat-card blue">
          <div className="stat-label">Net Gold Weight</div>
          <div className="stat-value" style={{ color: '#2563eb', fontSize: 22 }}>
            {stats.totalWeightGrams >= 0 ? '' : '−'}
            {Math.abs(stats.totalWeightGrams).toFixed(2)} g
          </div>
          <div className="stat-sub">
            ≈ {(Math.abs(stats.totalWeightGrams) / 31.1035).toFixed(3)} troy oz
          </div>
          <div className="stat-icon">⚖️</div>
        </div>

        <div className="stat-card purple">
          <div className="stat-label">Est. Portfolio Value</div>
          <div className="stat-value" style={{ color: '#9333ea', fontSize: 22 }}>
            ${goldValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-sub">@ ${referenceRate}/troy oz</div>
          <div className="stat-icon">💰</div>
        </div>
      </div>

      {/* Chart and breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>
        {/* Trend Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📈 Volume Trend</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>USD equivalent, by day</span>
          </div>
          <div className="card-body">
            <TrendChart transactions={transactions} />
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Purity breakdown */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">💎 By Purity</span>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {Object.entries(stats.purityBreakdown).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data</div>
              ) : (
                Object.entries(stats.purityBreakdown).map(([p, count]) => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span className="purity-tag">{p}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, margin: '0 10px' }}>
                      <div style={{
                        height: '100%',
                        width: `${(count / transactions.length) * 100}%`,
                        background: 'linear-gradient(90deg, var(--gold-400), var(--gold-600))',
                        borderRadius: 3,
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Source breakdown */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔍 By Source</span>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: '#eff6ff', borderRadius: 'var(--radius-md)', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{stats.manualCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manual</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: '#faf5ff', borderRadius: 'var(--radius-md)', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#9333ea' }}>{stats.scanCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI Scan</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🕐 Recent Transactions</span>
          <Link href="/transactions" className="btn btn-ghost btn-sm">
            View All →
          </Link>
        </div>
        {stats.latestFiveTransactions.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No transactions yet</div>
            <div className="empty-state-text">Record your first gold transaction to see it here.</div>
            <Link href="/transactions/new" className="btn btn-primary">➕ Add First Transaction</Link>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Purity</th>
                  <th>Weight</th>
                  <th>Total Value</th>
                  <th>Currency</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {stats.latestFiveTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className={`tx-badge ${tx.type}`}>
                        {tx.type === 'buy' ? '📈' : '📉'} {tx.type}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(tx.dateTime)}</td>
                    <td><span className="purity-tag">{purityLabel(tx.purity, tx.customPurity)}</span></td>
                    <td>{tx.weight} {tx.weightUnit.replace('_', ' ')}</td>
                    <td className="font-bold">{formatCurrency(tx.totalValue, tx.currency)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{tx.currency}</td>
                    <td>
                      <span className={`source-badge ${tx.source}`}>
                        {tx.source === 'scan' ? '🤖' : '✍️'} {tx.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
