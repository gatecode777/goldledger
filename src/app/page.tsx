'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { CURRENCIES, convertToUSD, convertUSDTo, convertCurrency } from '@/lib/currencies';
import { formatCurrency, formatCardCurrency, formatDate, purityLabel, weightToGrams } from '@/lib/formatters';
import TrendChart from '@/components/TrendChart';
import {
  IconPlus,
  IconLedger,
  IconCalendar,
  IconCoins,
  IconScale,
  IconWallet,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconLandmark,
  IconBanknote,
  IconScan,
  IconEdit,
  IconUpload,
  IconAlert,
  IconGoldBar,
} from '@/components/Icons';

export default function DashboardPage() {
  const { transactions, rateSettings, loading, error, globalCurrency, setGlobalCurrency } = useTransactions();
  const [timeframe, setTimeframe] = useState<'7d' | '14d' | '30d' | 'all'>('14d');

  const todayDisplay = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const todayCompact = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const stats = useMemo(() => {
    const buys  = transactions.filter((t) => t.type === 'buy');
    const sells = transactions.filter((t) => t.type === 'sell');

    const totalBuyUSD  = buys.reduce((s, t)  => s + convertToUSD(t.totalValue, t.currency), 0);
    const totalSellUSD = sells.reduce((s, t) => s + convertToUSD(t.totalValue, t.currency), 0);
    const netUSD = totalBuyUSD - totalSellUSD;

    const totalBuyGlobal  = convertUSDTo(totalBuyUSD, globalCurrency);
    const totalSellGlobal = convertUSDTo(totalSellUSD, globalCurrency);
    const netGlobal       = totalBuyGlobal - totalSellGlobal;

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
    const importCount = transactions.filter((t) => t.source === 'import').length;
    const manualCount = transactions.filter(
      (t) => t.source === 'manual' || (!t.source || (t.source !== 'scan' && t.source !== 'import'))
    ).length;

    return {
      totalBuyUSD, totalSellUSD, netUSD,
      totalBuyGlobal, totalSellGlobal, netGlobal,
      totalWeightGrams,
      buyCount: buys.length, sellCount: sells.length,
      latestFiveTransactions, purityBreakdown,
      scanCount, manualCount, importCount,
    };
  }, [transactions, globalCurrency]);

  const referenceRate = rateSettings?.referenceRateUSD ?? 0;
  const referenceRateGlobal = convertUSDTo(referenceRate, globalCurrency);
  const goldValue = (stats.totalWeightGrams / 31.1035) * referenceRate;
  const goldValueGlobal = convertUSDTo(goldValue, globalCurrency);

  // Filtered transactions for Business Pulse
  const pulseTransactions = useMemo(() => {
    if (timeframe === 'all') return transactions;
    const days = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffTime = cutoff.getTime();
    const filtered = transactions.filter((t) => new Date(t.dateTime).getTime() >= cutoffTime);
    return filtered.length > 0 ? filtered : transactions;
  }, [transactions, timeframe]);

  const pulseBuy = useMemo(() => {
    const buys = pulseTransactions.filter((t) => t.type === 'buy');
    const totalUSD = buys.reduce((s, t) => s + convertToUSD(t.totalValue, t.currency), 0);
    return convertUSDTo(totalUSD, globalCurrency);
  }, [pulseTransactions, globalCurrency]);

  const pulseSell = useMemo(() => {
    const sells = pulseTransactions.filter((t) => t.type === 'sell');
    const totalUSD = sells.reduce((s, t) => s + convertToUSD(t.totalValue, t.currency), 0);
    return convertUSDTo(totalUSD, globalCurrency);
  }, [pulseTransactions, globalCurrency]);

  const pulseNet = pulseSell - pulseBuy;

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
        <div className="page-error-icon">
          <IconAlert size={32} />
        </div>
        <h2>Connection Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Owner&apos;s Daily Report</h1>
          <p className="page-subtitle">{todayDisplay}</p>
        </div>
        <div className="page-header-actions">
          <div className="global-currency-badge" title="Change global display currency across the app">
            <label htmlFor="dash-currency">Currency</label>
            <select
              id="dash-currency"
              className="global-currency-select"
              value={globalCurrency}
              onChange={(e) => setGlobalCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          <div className="header-date-badge" title="Report Date">
            <IconCalendar size={14} />
            <span>{todayCompact}</span>
          </div>

          <Link href="/transactions" className="btn btn-secondary">
            <IconLedger size={15} />
            <span>Transaction Log</span>
          </Link>

          <Link href="/transactions/new" className="btn btn-primary">
            <IconPlus size={15} />
            <span>New Transaction</span>
          </Link>
        </div>
      </div>

      {/* ── 6 Breathable Stat Cards (3x2 Balanced Grid) ── */}
      <div className="stat-grid">
        {/* Card 1: Portfolio Value */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Portfolio Value</span>
            <div className="stat-icon-badge" title="Estimated valuation at live reference rate">
              <IconWallet size={14} />
            </div>
          </div>
          <div className="stat-value" title={formatCurrency(goldValueGlobal, globalCurrency)}>
            {formatCurrency(goldValueGlobal, globalCurrency)}
          </div>
          <div className="stat-sub">Spot @ {formatCurrency(referenceRateGlobal, globalCurrency)} / troy oz</div>
        </div>

        {/* Card 2: Net Gold Held */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Net Gold Held</span>
            <div className="stat-icon-badge" title="Physical gold inventory balance">
              <IconGoldBar size={14} />
            </div>
          </div>
          <div
            className="stat-value"
            title={`${stats.totalWeightGrams >= 0 ? '' : '−'}${Math.abs(stats.totalWeightGrams).toFixed(2)} g`}
          >
            {stats.totalWeightGrams >= 0 ? '' : '−'}
            {Math.abs(stats.totalWeightGrams).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            <span className="stat-unit">g</span>
          </div>
          <div className="stat-sub">
            ≈ {(Math.abs(stats.totalWeightGrams) / 31.1035).toFixed(2)} troy oz inventory
          </div>
        </div>

        {/* Card 3: Net Position */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Net Position</span>
            <div className="stat-icon-badge" title="Buy minus Sell net cash flow">
              <IconScale size={14} />
            </div>
          </div>
          <div
            className="stat-value"
            title={`${stats.netGlobal >= 0 ? '+' : '−'}${formatCurrency(Math.abs(stats.netGlobal), globalCurrency)}`}
          >
            {stats.netGlobal >= 0 ? '+' : '−'}
            {formatCurrency(Math.abs(stats.netGlobal), globalCurrency)}
          </div>
          <div className="stat-sub">Buy minus sell trade balance</div>
        </div>

        {/* Card 4: Buy Volume */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Buy Volume</span>
            <div className="stat-icon-badge" title="Total gold purchases">
              <IconArrowDownLeft size={14} />
            </div>
          </div>
          <div className="stat-value" title={formatCurrency(stats.totalBuyGlobal, globalCurrency)}>
            {formatCurrency(stats.totalBuyGlobal, globalCurrency)}
          </div>
          <div className="stat-sub">{stats.buyCount} purchase order{stats.buyCount !== 1 ? 's' : ''} ({globalCurrency})</div>
        </div>

        {/* Card 5: Sell Volume */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Sell Volume</span>
            <div className="stat-icon-badge" title="Total gold sales">
              <IconArrowUpRight size={14} />
            </div>
          </div>
          <div className="stat-value" title={formatCurrency(stats.totalSellGlobal, globalCurrency)}>
            {formatCurrency(stats.totalSellGlobal, globalCurrency)}
          </div>
          <div className="stat-sub">{stats.sellCount} sale order{stats.sellCount !== 1 ? 's' : ''} ({globalCurrency})</div>
        </div>

        {/* Card 6: Total Transactions */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Transactions</span>
            <div className="stat-icon-badge" title="Total transactions logged">
              <IconCoins size={14} />
            </div>
          </div>
          <div className="stat-value">
            {transactions.length} <span className="stat-unit">Entries</span>
          </div>
          <div className="stat-sub">{stats.buyCount} buys · {stats.sellCount} sells</div>
        </div>
      </div>

      {/* ── Business Pulse & Breakdown Grid ── */}
      <div className="dashboard-analytics-grid">
        {/* Business Pulse Container */}
        <div className="pulse-card">
          <div className="pulse-header">
            <div className="pulse-title-wrap">
              <span className="pulse-title">Business Pulse</span>
              <span className="pulse-sub">Daily buy &amp; sell trade flow</span>
            </div>
            <div className="pulse-time-switcher">
              {(['7d', '14d', '30d', 'all'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`pulse-time-btn ${timeframe === t ? 'active' : ''}`}
                  onClick={() => setTimeframe(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="pulse-metrics-row">
            <div className="pulse-metric-box">
              <div className="pulse-metric-label">Gold Bought</div>
              <div className="pulse-metric-val">{formatCardCurrency(pulseBuy, globalCurrency)}</div>
            </div>
            <div className="pulse-metric-box positive">
              <div className="pulse-metric-label">Gold Sold</div>
              <div className="pulse-metric-val">{formatCardCurrency(pulseSell, globalCurrency)}</div>
            </div>
            <div className={`pulse-metric-box ${pulseNet >= 0 ? 'positive' : 'negative'}`}>
              <div className="pulse-metric-label">Net Cash Flow</div>
              <div className="pulse-metric-val">
                {pulseNet >= 0 ? '+' : '−'}{formatCardCurrency(Math.abs(pulseNet), globalCurrency)}
              </div>
            </div>
          </div>

          <div className="pulse-chart-wrap">
            <TrendChart transactions={pulseTransactions} currency={globalCurrency} />
          </div>
        </div>

        {/* Right Column: Purity & Source Breakdowns */}
        <div className="dashboard-side-col">
          {/* Purity breakdown */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">By Purity</span>
              <span className="card-header-meta">{Object.keys(stats.purityBreakdown).length} types</span>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {Object.entries(stats.purityBreakdown).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>
              ) : (
                Object.entries(stats.purityBreakdown).map(([p, count]) => (
                  <div key={p} className="breakdown-row">
                    <span className="purity-tag">{p}</span>
                    <div className="breakdown-bar-track">
                      <div
                        className="breakdown-bar-fill"
                        style={{ width: `${(count / transactions.length) * 100}%` }}
                      />
                    </div>
                    <span className="breakdown-count">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Source breakdown */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">By Entry Source</span>
              <span className="card-header-meta">{transactions.length} total</span>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              <div className="source-stat-grid">
                <Link
                  href="/transactions?source=manual"
                  className="source-stat-box"
                  title="Filter by Manual transactions"
                >
                  <div className="source-stat-count">{stats.manualCount}</div>
                  <div className="source-stat-label">
                    <IconEdit size={12} />
                    <span>Manual</span>
                  </div>
                </Link>

                <Link
                  href="/transactions?source=scan"
                  className="source-stat-box"
                  title="Filter by AI Scan transactions"
                >
                  <div className="source-stat-count">{stats.scanCount}</div>
                  <div className="source-stat-label">
                    <IconScan size={12} />
                    <span>AI Scan</span>
                  </div>
                </Link>

                <Link
                  href="/transactions?source=import"
                  className="source-stat-box"
                  title="Filter by Excel Import transactions"
                >
                  <div className="source-stat-count">{stats.importCount}</div>
                  <div className="source-stat-label">
                    <IconUpload size={12} />
                    <span>Excel</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Transactions</span>
          <Link href="/transactions" className="btn btn-ghost btn-sm">
            View All →
          </Link>
        </div>
        {stats.latestFiveTransactions.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">
              <IconLedger size={34} />
            </div>
            <div className="empty-state-title">No transactions yet</div>
            <div className="empty-state-text">Record your first gold transaction to see your recent activity here.</div>
            <Link href="/transactions/new" className="btn btn-primary">
              <IconPlus size={15} />
              <span>Add First Transaction</span>
            </Link>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Counterparty</th>
                  <th>Purity</th>
                  <th className="num-col">Weight</th>
                  <th className="num-col">Total Value</th>
                  <th>Payment</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {stats.latestFiveTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className={`tx-badge ${tx.type}`}>
                        {tx.type === 'buy' ? <IconArrowDownLeft size={11} /> : <IconArrowUpRight size={11} />}
                        <span>{tx.type}</span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(tx.dateTime)}</td>
                    <td style={{ fontWeight: 500 }}>
                      {tx.counterparty || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td><span className="purity-tag">{purityLabel(tx.purity, tx.customPurity)}</span></td>
                    <td className="num-col">{tx.weight} {tx.weightUnit.replace('_', ' ')}</td>
                    <td className="num-col font-bold">
                      <div>{formatCurrency(tx.totalValue, tx.currency)}</div>
                      {tx.currency !== globalCurrency && (
                        <div className="cell-sub">
                          ≈ {formatCurrency(convertCurrency(tx.totalValue, tx.currency, globalCurrency), globalCurrency)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`payment-badge ${(tx.paymentType || 'Cash').toLowerCase()}`}>
                        {tx.paymentType === 'RTGS' ? <IconLandmark size={11} /> : <IconBanknote size={11} />}
                        <span>{tx.paymentType === 'RTGS' ? 'RTGS' : 'Cash'}</span>
                      </span>
                      {tx.paymentType === 'RTGS' && tx.transactionId && (
                        <div className="cell-ref-id" title={`Transaction ID: ${tx.transactionId}`}>
                          #{tx.transactionId}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`source-badge ${tx.source}`}>
                        {tx.source === 'scan' ? <IconScan size={11} /> : tx.source === 'import' ? <IconUpload size={11} /> : <IconEdit size={11} />}
                        <span>{tx.source === 'import' ? 'excel' : tx.source}</span>
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
