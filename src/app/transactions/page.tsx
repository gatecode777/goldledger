'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useTransactions } from '@/context/TransactionContext';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, purityLabel } from '@/lib/formatters';
import { Transaction, Purity } from '@/lib/types';
import TransactionForm from '@/components/TransactionForm';
import { exportTransactionsToExcel } from '@/lib/excel';
import ExcelImportModal from '@/components/ExcelImportModal';
import { CURRENCIES, convertUSDTo, convertCurrency } from '@/lib/currencies';
import {
  calculateTransactionPnL,
  calculateCounterpartySummary,
  calculateAllCounterpartiesBreakdown,
  CounterpartyPnLSummary,
} from '@/lib/pnl';

const PURITY_OPTIONS: Purity[] = ['24K 999', '24K 995', '24K 991'];

type SortKey = 'dateTime' | 'type' | 'totalValue' | 'purity' | 'currency' | 'counterparty' | 'pnl';

export default function TransactionsPage() {
  const {
    transactions,
    counterparties,
    deleteTransaction,
    loading,
    error,
    refetch,
    rateSettings,
    globalCurrency,
    setGlobalCurrency,
  } = useTransactions();
  const { showToast } = useToast();

  // Filters
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [partyFilter, setPartyFilter] = useState('all');
  const [currFilter,  setCurrFilter]  = useState('all');
  const [purFilter,   setPurFilter]   = useState('all');
  const [payFilter,   setPayFilter]   = useState('all');
  const [srcFilter,   setSrcFilter]   = useState('all');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');

  // Counterparty Ranking Modal
  const [showRankingModal, setShowRankingModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const src = params.get('source');
      if (src && ['manual', 'scan', 'import'].includes(src)) {
        setSrcFilter(src);
      }
      const party = params.get('party') || params.get('counterparty');
      if (party) {
        setPartyFilter(party);
      }
    }
  }, []);

  // Sort
  const [sortKey, setSortKey]   = useState<SortKey>('dateTime');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');

  // Edit modal
  const [editTx, setEditTx]       = useState<Transaction | null>(null);
  // Delete confirm
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  // Excel import modal
  const [isImportOpen, setIsImportOpen] = useState(false);

  function handleExportExcel(exportAll = false) {
    const listToExport = exportAll || !hasFilters ? transactions : filtered;
    if (listToExport.length === 0) {
      showToast('No transactions to export', 'error');
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = (exportAll || !hasFilters)
      ? `gold_transactions_all_${dateStr}.xlsx`
      : `gold_transactions_filtered_${dateStr}.xlsx`;
    exportTransactionsToExcel(listToExport, filename);
    showToast(`Exported ${listToExport.length} transactions to Excel!`, 'success');
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  async function confirmDelete(id: string) {
    try {
      await deleteTransaction(id);
      showToast('Transaction deleted', 'error');
    } catch {
      showToast('Failed to delete transaction', 'error');
    }
    setDeleteId(null);
  }

  const currencies = useMemo(() =>
    Array.from(new Set(transactions.map(t => t.currency))).sort(),
  [transactions]);

  const counterpartyOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      const name = (t.counterparty || '').trim();
      if (name) set.add(name);
    });
    counterparties.forEach(c => {
      const name = (c.name || '').trim();
      if (name) set.add(name);
    });

    return Array.from(set).sort().map(name => {
      const foundParty = counterparties.find(c => c.name.toLowerCase() === name.toLowerCase());
      let role = foundParty ? foundParty.type : '';
      if (!role) {
        const partyTxs = transactions.filter(t => (t.counterparty || '').trim().toLowerCase() === name.toLowerCase());
        const hasBuy = partyTxs.some(t => t.type === 'buy');
        const hasSell = partyTxs.some(t => t.type === 'sell');
        if (hasBuy && hasSell) role = 'both';
        else if (hasBuy) role = 'buyer';
        else if (hasSell) role = 'seller';
      }
      return { name, role };
    });
  }, [transactions, counterparties]);

  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (partyFilter !== 'all' && (t.counterparty || '').trim().toLowerCase() !== partyFilter.trim().toLowerCase()) return false;
        if (currFilter !== 'all' && t.currency !== currFilter) return false;
        if (purFilter  !== 'all' && purityLabel(t.purity, t.customPurity) !== purFilter) return false;
        if (payFilter  !== 'all' && (t.paymentType || 'Cash') !== payFilter) return false;
        if (srcFilter  !== 'all' && t.source !== srcFilter) return false;
        if (dateFrom && t.dateTime < dateFrom) return false;
        if (dateTo   && t.dateTime > dateTo + 'T23:59:59') return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            t.counterparty.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            t.currency.toLowerCase().includes(q) ||
            (t.paymentType && t.paymentType.toLowerCase().includes(q)) ||
            (t.transactionId && t.transactionId.toLowerCase().includes(q)) ||
            purityLabel(t.purity, t.customPurity).toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'dateTime')   cmp = a.dateTime.localeCompare(b.dateTime);
        if (sortKey === 'type')       cmp = a.type.localeCompare(b.type);
        if (sortKey === 'totalValue') cmp = a.totalValue - b.totalValue;
        if (sortKey === 'purity')     cmp = a.purity.localeCompare(b.purity);
        if (sortKey === 'currency')   cmp = a.currency.localeCompare(b.currency);
        if (sortKey === 'counterparty') cmp = (a.counterparty || '').localeCompare(b.counterparty || '');
        if (sortKey === 'pnl') {
          const pnlA = calculateTransactionPnL(a, globalCurrency).pnlGlobal;
          const pnlB = calculateTransactionPnL(b, globalCurrency).pnlGlobal;
          cmp = pnlA - pnlB;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [transactions, typeFilter, partyFilter, currFilter, purFilter, payFilter, srcFilter, dateFrom, dateTo, search, sortKey, sortDir, globalCurrency]);

  function clearFilters() {
    setSearch(''); setTypeFilter('all'); setPartyFilter('all'); setCurrFilter('all');
    setPurFilter('all'); setPayFilter('all'); setSrcFilter('all'); setDateFrom(''); setDateTo('');
  }

  const filteredTotalInGlobal = useMemo(() => {
    return filtered.reduce((sum, tx) => sum + convertCurrency(tx.totalValue, tx.currency, globalCurrency), 0);
  }, [filtered, globalCurrency]);

  const activePnLSummary = useMemo(() => {
    return calculateCounterpartySummary(
      filtered,
      globalCurrency,
      partyFilter !== 'all' ? partyFilter : undefined
    );
  }, [filtered, globalCurrency, partyFilter]);

  const counterpartiesRanking = useMemo(() => {
    return calculateAllCounterpartiesBreakdown(transactions, globalCurrency);
  }, [transactions, globalCurrency]);

  const hasFilters = search || typeFilter !== 'all' || partyFilter !== 'all' || currFilter !== 'all' ||
    purFilter !== 'all' || payFilter !== 'all' || srcFilter !== 'all' || dateFrom || dateTo;

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  if (loading) {
    return (
      <div className="page-loading">
        <div className="page-spinner" />
        <p>Loading transactions…</p>
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
          <h1 className="page-title">Transaction Log</h1>
          <p className="page-subtitle">
            {filtered.length} of {transactions.length} transactions · Filtered Total: <strong>{formatCurrency(filteredTotalInGlobal, globalCurrency)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="global-currency-badge" title="Change global display currency across entire project">
            <label>Currency:</label>
            <select
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

          <button
            type="button"
            className="btn-excel-export"
            onClick={() => handleExportExcel(false)}
            title={hasFilters ? `Export ${filtered.length} filtered transactions to Excel` : `Export all ${transactions.length} transactions to Excel`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Excel {hasFilters ? `(${filtered.length})` : ''}
          </button>

          <button
            type="button"
            className="btn-excel-import"
            onClick={() => setIsImportOpen(true)}
            title="Import transactions from an Excel file (.xlsx, .xls)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import Excel
          </button>

          <Link href="/transactions/new" className="btn btn-primary">
            ➕ New Transaction
          </Link>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="filter-panel">

        {/* Row 1: Search */}
        <div className="filter-search-row">
          <div className="filter-search-wrap">
            <svg className="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search counterparty, notes, currency…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="filter-clear-x" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        {/* Row 2: Filter controls */}
        <div className="filter-controls-row">

          {/* Type pills */}
          <div className="filter-group">
            <span className="filter-group-label">Type</span>
            <div className="type-pill-group">
              <button className={`type-pill ${typeFilter === 'all'  ? 'type-pill-active'  : ''}`} onClick={() => setTypeFilter('all')}>All</button>
              <button className={`type-pill ${typeFilter === 'buy'  ? 'type-pill-buy'   : ''}`} onClick={() => setTypeFilter('buy')}>📈 Buy</button>
              <button className={`type-pill ${typeFilter === 'sell' ? 'type-pill-sell'  : ''}`} onClick={() => setTypeFilter('sell')}>📉 Sell</button>
            </div>
          </div>

          <div className="filter-sep" />

          {/* Buyer / Seller (Counterparty) Filter */}
          <div className="filter-group">
            <span className="filter-group-label">Buyer / Seller</span>
            <select
              className="filter-select-compact"
              value={partyFilter}
              onChange={e => setPartyFilter(e.target.value)}
              style={{ minWidth: 155 }}
            >
              <option value="all">All Parties ({counterpartyOptions.length})</option>
              {counterpartyOptions.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.role ? `(${p.role})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-sep" />

          {/* Currency */}
          <div className="filter-group">
            <span className="filter-group-label">Currency</span>
            <select className="filter-select-compact" value={currFilter} onChange={e => setCurrFilter(e.target.value)}>
              <option value="all">All</option>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Purity */}
          <div className="filter-group">
            <span className="filter-group-label">Purity</span>
            <select className="filter-select-compact" value={purFilter} onChange={e => setPurFilter(e.target.value)}>
              <option value="all">All</option>
              {PURITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Payment */}
          <div className="filter-group">
            <span className="filter-group-label">Payment</span>
            <select className="filter-select-compact" value={payFilter} onChange={e => setPayFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="Cash">Cash</option>
              <option value="RTGS">RTGS</option>
            </select>
          </div>

          {/* Source */}
          <div className="filter-group">
            <span className="filter-group-label">Source</span>
            <select className="filter-select-compact" value={srcFilter} onChange={e => setSrcFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="scan">AI Scan</option>
              <option value="import">Excel Import</option>
            </select>
          </div>

          <div className="filter-sep" />

          {/* Date range */}
          <div className="filter-group">
            <span className="filter-group-label">From</span>
            <input type="date" className="filter-date-compact" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <span className="filter-group-label">To</span>
            <input type="date" className="filter-date-compact" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>

          {/* Reset */}
          {hasFilters && (
            <>
              <div className="filter-sep" />
              <button className="filter-reset-btn" onClick={clearFilters}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
                Reset
              </button>
            </>
          )}
        </div>

        {/* Active result count strip */}
        {hasFilters && (
          <div className="filter-result-strip">
            <span className="filter-result-dot" />
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} of {transactions.length} transactions
            {partyFilter !== 'all' && (
              <span style={{ marginLeft: 8, fontWeight: 700 }}>· Filtered by Buyer/Seller: {partyFilter}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Counterparty Profit & Loss Analytics Overview ── */}
      {partyFilter !== 'all' ? (
        <div className="counterparty-pnl-card">
          <div className="counterparty-pnl-header">
            <div className="counterparty-title-wrap">
              <span className="counterparty-name">
                <span>👤</span>
                <span>{partyFilter}</span>
              </span>
              <span
                className={`counterparty-role-tag ${
                  activePnLSummary.buyCount > 0 && activePnLSummary.sellCount > 0
                    ? 'both'
                    : activePnLSummary.buyCount > 0
                    ? 'buyer'
                    : 'seller'
                }`}
              >
                {activePnLSummary.buyCount > 0 && activePnLSummary.sellCount > 0
                  ? '🔄 Trading Partner (Buy & Sell)'
                  : activePnLSummary.buyCount > 0
                  ? '📈 Buyer'
                  : '📉 Seller'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {activePnLSummary.totalTransactions} record{activePnLSummary.totalTransactions !== 1 ? 's' : ''} with this party
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPartyFilter('all')}
              style={{ fontSize: 12 }}
            >
              ✕ Show All Buyers & Sellers
            </button>
          </div>

          <div className="counterparty-summary-grid">
            {/* 1. Net Profit / Loss */}
            <div className={`counterparty-metric-item hero-metric ${!activePnLSummary.isProfit ? 'is-loss' : ''}`}>
              <span className="counterparty-metric-label">
                {activePnLSummary.isProfit ? '🟢 Net Profit' : '🔴 Net Loss'}
              </span>
              <span
                className="counterparty-metric-value"
                style={{ color: activePnLSummary.isProfit ? '#15803d' : '#dc2626' }}
              >
                {activePnLSummary.totalPnLGlobal >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(activePnLSummary.totalPnLGlobal), globalCurrency)}
              </span>
              <span className="counterparty-metric-sub">
                <strong>{activePnLSummary.pnlPercent >= 0 ? '+' : ''}{activePnLSummary.pnlPercent.toFixed(2)}%</strong> vs Market Spot
              </span>
            </div>

            {/* 2. Total Purchases (Buy Volume) */}
            <div className="counterparty-metric-item">
              <span className="counterparty-metric-label">📈 Total Bought</span>
              <span className="counterparty-metric-value">
                {formatCurrency(activePnLSummary.totalBuyValueGlobal, globalCurrency)}
              </span>
              <span className="counterparty-metric-sub">
                {activePnLSummary.totalBuyWeightGrams.toFixed(2)} g
                {activePnLSummary.totalBuyWeightGrams > 0 && (
                  <span> · Avg {formatCurrency(activePnLSummary.avgBuyPricePerGramGlobal, globalCurrency)}/g</span>
                )}
              </span>
            </div>

            {/* 3. Total Sales (Sell Volume) */}
            <div className="counterparty-metric-item">
              <span className="counterparty-metric-label">📉 Total Sold</span>
              <span className="counterparty-metric-value">
                {formatCurrency(activePnLSummary.totalSellValueGlobal, globalCurrency)}
              </span>
              <span className="counterparty-metric-sub">
                {activePnLSummary.totalSellWeightGrams.toFixed(2)} g
                {activePnLSummary.totalSellWeightGrams > 0 && (
                  <span> · Avg {formatCurrency(activePnLSummary.avgSellPricePerGramGlobal, globalCurrency)}/g</span>
                )}
              </span>
            </div>

            {/* 4. Net Position (Gold & Cash) */}
            <div className="counterparty-metric-item">
              <span className="counterparty-metric-label">⚖️ Net Balance</span>
              <span className="counterparty-metric-value" style={{ fontSize: 18 }}>
                {activePnLSummary.netWeightGrams >= 0 ? '+' : '−'}
                {Math.abs(activePnLSummary.netWeightGrams).toFixed(2)} g
              </span>
              <span className="counterparty-metric-sub">
                Cash Flow: {activePnLSummary.netCashFlowGlobal >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(activePnLSummary.netCashFlowGlobal), globalCurrency)}
              </span>
            </div>

            {/* 5. Spread Margin (if roundtrip exists) */}
            {activePnLSummary.matchedGrams > 0 && (
              <div className="counterparty-metric-item">
                <span className="counterparty-metric-label">🏷️ Trading Spread</span>
                <span
                  className="counterparty-metric-value"
                  style={{
                    color: activePnLSummary.spreadPerGramGlobal >= 0 ? '#15803d' : '#dc2626',
                    fontSize: 18,
                  }}
                >
                  {activePnLSummary.spreadPerGramGlobal >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(activePnLSummary.spreadPerGramGlobal), globalCurrency)}/g
                </span>
                <span className="counterparty-metric-sub">
                  Matched on {activePnLSummary.matchedGrams.toFixed(2)} g
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* General P&L Strip when viewing all */
        <div className="pnl-strip-container">
          <div className="pnl-strip-stats">
            <div className="pnl-strip-stat">
              <span className="pnl-strip-stat-label">Records:</span>
              <span className="pnl-strip-stat-val">{filtered.length}</span>
            </div>
            <div className="pnl-strip-stat">
              <span className="pnl-strip-stat-label">Total Volume:</span>
              <span className="pnl-strip-stat-val">{formatCurrency(filteredTotalInGlobal, globalCurrency)}</span>
            </div>
            <div className="pnl-strip-stat">
              <span className="pnl-strip-stat-label">Net Profit / Loss:</span>
              <span className={`pnl-strip-stat-val ${activePnLSummary.isProfit ? 'profit' : 'loss'}`}>
                {activePnLSummary.totalPnLGlobal >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(activePnLSummary.totalPnLGlobal), globalCurrency)}
                {' '}({activePnLSummary.pnlPercent >= 0 ? '+' : ''}{activePnLSummary.pnlPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="pnl-strip-stat">
              <span className="pnl-strip-stat-label">Net Gold:</span>
              <span className="pnl-strip-stat-val">
                {activePnLSummary.netWeightGrams >= 0 ? '+' : '−'}{Math.abs(activePnLSummary.netWeightGrams).toFixed(2)} g
              </span>
            </div>
          </div>

          <button
            type="button"
            className="pnl-breakdown-btn"
            onClick={() => setShowRankingModal(true)}
            title="View profit & loss ranking across all buyers & sellers"
          >
            <span>📊</span>
            <span>View All Buyers & Sellers P&L ({counterpartyOptions.length})</span>
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No transactions found</div>
          <div className="empty-state-text">
            {hasFilters ? 'Try adjusting your filters.' : 'Record your first transaction to get started.'}
          </div>
          {!hasFilters && (
            <Link href="/transactions/new" className="btn btn-primary">➕ Add Transaction</Link>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="tx-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('type')}>Type <SortIcon k="type" /></th>
                <th onClick={() => handleSort('dateTime')}>Date <SortIcon k="dateTime" /></th>
                <th onClick={() => handleSort('purity')}>Purity <SortIcon k="purity" /></th>
                <th>Weight</th>
                <th onClick={() => handleSort('totalValue')}>Total Value <SortIcon k="totalValue" /></th>
                <th onClick={() => handleSort('pnl')} title="Click to sort by Profit / Loss">Profit / Loss <SortIcon k="pnl" /></th>
                <th onClick={() => handleSort('currency')}>Currency <SortIcon k="currency" /></th>
                <th>Payment</th>
                <th>Rate (USD)</th>
                <th onClick={() => handleSort('counterparty')}>Counterparty <SortIcon k="counterparty" /></th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id}>
                  <td>
                    <span className={`tx-badge ${tx.type}`}>
                      {tx.type === 'buy' ? '📈' : '📉'} {tx.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    {formatDate(tx.dateTime)}
                  </td>
                  <td><span className="purity-tag">{purityLabel(tx.purity, tx.customPurity)}</span></td>
                  <td>{tx.weight} {tx.weightUnit.replace('_', ' ')}</td>
                  <td className="font-bold">
                    <div>{formatCurrency(tx.totalValue, tx.currency)}</div>
                    {tx.currency !== globalCurrency && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>
                        ≈ {formatCurrency(convertCurrency(tx.totalValue, tx.currency, globalCurrency), globalCurrency)}
                      </div>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const txPnL = calculateTransactionPnL(tx, globalCurrency);
                      return (
                        <div
                          className={`pnl-badge ${txPnL.pnlGlobal > 0 ? 'profit' : txPnL.pnlGlobal < 0 ? 'loss' : 'neutral'}`}
                          title={`${tx.type === 'buy' ? 'Buy Acquisition' : 'Sale'}: Total ${formatCurrency(txPnL.actualTotalGlobal, globalCurrency)} vs Benchmark ${formatCurrency(txPnL.benchmarkGlobal, globalCurrency)}`}
                        >
                          <span className="pnl-amount">
                            {txPnL.pnlGlobal >= 0 ? '+' : '−'}
                            {formatCurrency(Math.abs(txPnL.pnlGlobal), globalCurrency)}
                          </span>
                          <span className="pnl-percent">
                            {txPnL.pnlPercent >= 0 ? '+' : ''}{txPnL.pnlPercent.toFixed(1)}% {tx.type === 'buy' ? 'disc' : 'gain'}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{tx.currency}</td>
                  <td>
                    <span className={`payment-badge ${(tx.paymentType || 'Cash').toLowerCase()}`}>
                      {tx.paymentType === 'RTGS' ? '🏦 RTGS' : '💵 Cash'}
                    </span>
                    {tx.paymentType === 'RTGS' && tx.transactionId && (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                          marginTop: 3,
                          letterSpacing: '0.02em',
                        }}
                        title={`Transaction ID: ${tx.transactionId}`}
                      >
                        #{tx.transactionId}
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    <div>${tx.marketRate.toLocaleString()}</div>
                    {globalCurrency !== 'USD' && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ≈ {formatCurrency(convertUSDTo(tx.marketRate, globalCurrency), globalCurrency)}
                      </div>
                    )}
                  </td>
                  <td style={{ maxWidth: 170 }}>
                    {tx.counterparty ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setPartyFilter(tx.counterparty)}
                        style={{
                          padding: '3px 8px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: partyFilter.toLowerCase() === tx.counterparty.toLowerCase() ? 'var(--gold-600)' : 'var(--text-primary)',
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderRadius: 4,
                          background: partyFilter.toLowerCase() === tx.counterparty.toLowerCase() ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                        }}
                        title={`Click to filter all transactions and see P&L for ${tx.counterparty}`}
                      >
                        👤 {tx.counterparty}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`source-badge ${tx.source}`}>
                      {tx.source === 'scan' ? '🤖' : tx.source === 'import' ? '📊' : '✍️'} {tx.source === 'import' ? 'excel' : tx.source}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        id={`edit-${tx.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditTx(tx)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        id={`delete-${tx.id}`}
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteId(tx.id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Counterparty Ranking Modal */}
      {showRankingModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRankingModal(false); }}>
          <div className="modal" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">📊 Buyers & Sellers Profit & Loss Ranking</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Complete P&L breakdown by counterparty in {globalCurrency}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRankingModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="pnl-ranking-table">
                  <thead>
                    <tr>
                      <th>Counterparty</th>
                      <th>Deals</th>
                      <th>Bought (Volume)</th>
                      <th>Sold (Volume)</th>
                      <th>Net Position</th>
                      <th>Total P&L</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterpartiesRanking.map(item => (
                      <tr key={item.counterparty} onClick={() => {
                        setPartyFilter(item.counterparty);
                        setShowRankingModal(false);
                      }}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>👤</span>
                            <span>{item.counterparty}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {item.buyCount > 0 && item.sellCount > 0 ? 'Buyer & Seller' :
                             item.buyCount > 0 ? 'Buyer' : 'Seller'}
                          </div>
                        </td>
                        <td>{item.totalTransactions}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{formatCurrency(item.totalBuyValueGlobal, globalCurrency)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.totalBuyWeightGrams.toFixed(2)} g</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{formatCurrency(item.totalSellValueGlobal, globalCurrency)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.totalSellWeightGrams.toFixed(2)} g</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: item.netWeightGrams >= 0 ? '#15803d' : '#dc2626' }}>
                            {item.netWeightGrams >= 0 ? '+' : '−'}{Math.abs(item.netWeightGrams).toFixed(2)} g
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Cash: {item.netCashFlowGlobal >= 0 ? '+' : '−'}{formatCurrency(Math.abs(item.netCashFlowGlobal), globalCurrency)}
                          </div>
                        </td>
                        <td>
                          <div className={`pnl-badge ${item.isProfit ? 'profit' : 'loss'}`}>
                            <span className="pnl-amount">
                              {item.totalPnLGlobal >= 0 ? '+' : '−'}
                              {formatCurrency(Math.abs(item.totalPnLGlobal), globalCurrency)}
                            </span>
                            <span className="pnl-percent">
                              {item.pnlPercent >= 0 ? '+' : ''}{item.pnlPercent.toFixed(1)}% margin
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPartyFilter(item.counterparty);
                              setShowRankingModal(false);
                            }}
                          >
                            Filter Deals →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRankingModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTx && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditTx(null); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">✏️ Edit Transaction</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditTx(null)}>✕</button>
            </div>
            <div className="modal-body">
              <TransactionForm
                initialValues={editTx}
                editId={editTx.id}
                source={editTx.source}
                onCancel={() => setEditTx(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">🗑️ Confirm Delete</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Are you sure you want to delete this transaction? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => confirmDelete(deleteId)}>
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={() => refetch()}
        referenceRateUSD={rateSettings?.referenceRateUSD}
        defaultCurrency={globalCurrency}
      />
    </>
  );
}
