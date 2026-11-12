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
} from '@/lib/pnl';
import {
  IconPlus,
  IconSearch,
  IconX,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconLandmark,
  IconBanknote,
  IconScan,
  IconUpload,
  IconDownload,
  IconEdit,
  IconTrash,
  IconBarChart,
  IconUsers,
  IconAlert,
  IconLedger,
} from '@/components/Icons';

const PURITY_OPTIONS: Purity[] = ['24K 999', '24K 995', '24K 991'];

type SortKey = 'dateTime' | 'type' | 'totalValue' | 'purity' | 'currency' | 'counterparty' | 'pnl';

export default function TransactionsPage() {
  const {
    transactions,
    counterparties,
    deleteTransaction,
    deleteTransactions,
    loading,
    error,
    refetch,
    rateSettings,
    globalCurrency,
    setGlobalCurrency,
  } = useTransactions();
  const { showToast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [partyFilter, setPartyFilter] = useState('all');
  const [currFilter, setCurrFilter] = useState('all');
  const [purFilter, setPurFilter] = useState('all');
  const [payFilter, setPayFilter] = useState('all');
  const [srcFilter, setSrcFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Multiple selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

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
  const [sortKey, setSortKey] = useState<SortKey>('dateTime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  function handleExportExcel(exportAll = false) {
    const listToExport = exportAll || !hasFilters ? transactions : filtered;
    if (listToExport.length === 0) {
      showToast('No transactions to export', 'error');
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename =
      exportAll || !hasFilters
        ? `gold_transactions_all_${dateStr}.xlsx`
        : `gold_transactions_filtered_${dateStr}.xlsx`;
    exportTransactionsToExcel(listToExport, filename);
    showToast(`Exported ${listToExport.length} transactions to Excel!`, 'success');
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
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

  const currencies = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.currency))).sort(),
    [transactions]
  );

  const counterpartyOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      const name = (t.counterparty || '').trim();
      if (name) set.add(name);
    });
    counterparties.forEach((c) => {
      const name = (c.name || '').trim();
      if (name) set.add(name);
    });

    return Array.from(set)
      .sort()
      .map((name) => {
        const foundParty = counterparties.find((c) => c.name.toLowerCase() === name.toLowerCase());
        let role = foundParty ? foundParty.type : '';
        if (!role) {
          const partyTxs = transactions.filter(
            (t) => (t.counterparty || '').trim().toLowerCase() === name.toLowerCase()
          );
          const hasBuy = partyTxs.some((t) => t.type === 'buy');
          const hasSell = partyTxs.some((t) => t.type === 'sell');
          if (hasBuy && hasSell) role = 'both';
          else if (hasBuy) role = 'buyer';
          else if (hasSell) role = 'seller';
        }
        return { name, role };
      });
  }, [transactions, counterparties]);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (
          partyFilter !== 'all' &&
          (t.counterparty || '').trim().toLowerCase() !== partyFilter.trim().toLowerCase()
        )
          return false;
        if (currFilter !== 'all' && t.currency !== currFilter) return false;
        if (purFilter !== 'all' && purityLabel(t.purity, t.customPurity) !== purFilter) return false;
        if (payFilter !== 'all' && (t.paymentType || 'Cash') !== payFilter) return false;
        if (srcFilter !== 'all' && t.source !== srcFilter) return false;
        if (dateFrom && t.dateTime < dateFrom) return false;
        if (dateTo && t.dateTime > dateTo + 'T23:59:59') return false;
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
        if (sortKey === 'dateTime') cmp = a.dateTime.localeCompare(b.dateTime);
        if (sortKey === 'type') cmp = a.type.localeCompare(b.type);
        if (sortKey === 'totalValue') cmp = a.totalValue - b.totalValue;
        if (sortKey === 'purity') cmp = a.purity.localeCompare(b.purity);
        if (sortKey === 'currency') cmp = a.currency.localeCompare(b.currency);
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
    setSearch('');
    setTypeFilter('all');
    setPartyFilter('all');
    setCurrFilter('all');
    setPurFilter('all');
    setPayFilter('all');
    setSrcFilter('all');
    setDateFrom('');
    setDateTo('');
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

  const hasFilters =
    search ||
    typeFilter !== 'all' ||
    partyFilter !== 'all' ||
    currFilter !== 'all' ||
    purFilter !== 'all' ||
    payFilter !== 'all' ||
    srcFilter !== 'all' ||
    dateFrom ||
    dateTo;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((tx) => selectedIds.has(tx.id));
  const isIndeterminate = !allVisibleSelected && filtered.some((tx) => selectedIds.has(tx.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((tx) => next.delete(tx.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((tx) => next.add(tx.id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setIsDeletingBulk(true);
    try {
      const idsArray = Array.from(selectedIds);
      await deleteTransactions(idsArray);
      showToast(`Deleted ${idsArray.length} transaction${idsArray.length !== 1 ? 's' : ''}`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
    } catch {
      showToast('Failed to delete transactions', 'error');
    } finally {
      setIsDeletingBulk(false);
    }
  }

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Transaction Log</h1>
          <p className="page-subtitle">
            {filtered.length} of {transactions.length} transactions · Filtered Total{' '}
            <strong>{formatCurrency(filteredTotalInGlobal, globalCurrency)}</strong>
          </p>
        </div>
        <div className="page-header-actions">
          <div className="global-currency-badge" title="Change global display currency">
            <label htmlFor="tx-currency">Currency</label>
            <select
              id="tx-currency"
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
            title={
              hasFilters
                ? `Export ${filtered.length} filtered transactions to Excel`
                : `Export all ${transactions.length} transactions to Excel`
            }
          >
            <IconDownload size={14} />
            <span>Export Excel {hasFilters ? `(${filtered.length})` : ''}</span>
          </button>

          <button
            type="button"
            className="btn-excel-import"
            onClick={() => setIsImportOpen(true)}
            title="Import transactions from an Excel file (.xlsx, .xls)"
          >
            <IconUpload size={14} />
            <span>Import Excel</span>
          </button>

          <Link href="/transactions/new" className="btn btn-primary">
            <IconPlus size={15} />
            <span>New Transaction</span>
          </Link>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="filter-panel">
        <div className="filter-search-row">
          <div className="filter-search-wrap">
            <IconSearch size={15} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search counterparty, notes, currency, or reference ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="filter-clear-x" onClick={() => setSearch('')} aria-label="Clear search">
                <IconX size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="filter-controls-row">
          {/* Type pills */}
          <div className="filter-group">
            <span className="filter-group-label">Type</span>
            <div className="type-pill-group">
              <button
                type="button"
                className={`type-pill ${typeFilter === 'all' ? 'type-pill-active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`type-pill ${typeFilter === 'buy' ? 'type-pill-buy' : ''}`}
                onClick={() => setTypeFilter('buy')}
              >
                Buy
              </button>
              <button
                type="button"
                className={`type-pill ${typeFilter === 'sell' ? 'type-pill-sell' : ''}`}
                onClick={() => setTypeFilter('sell')}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Buyer / Seller Filter */}
          <div className="filter-group">
            <span className="filter-group-label">Buyer / Seller</span>
            <select
              className="filter-select-compact"
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              style={{ minWidth: 155 }}
            >
              <option value="all">All Parties ({counterpartyOptions.length})</option>
              {counterpartyOptions.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.role ? `(${p.role})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div className="filter-group">
            <span className="filter-group-label">Currency</span>
            <select className="filter-select-compact" value={currFilter} onChange={(e) => setCurrFilter(e.target.value)}>
              <option value="all">All</option>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Purity */}
          <div className="filter-group">
            <span className="filter-group-label">Purity</span>
            <select className="filter-select-compact" value={purFilter} onChange={(e) => setPurFilter(e.target.value)}>
              <option value="all">All</option>
              {PURITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Payment */}
          <div className="filter-group">
            <span className="filter-group-label">Payment</span>
            <select className="filter-select-compact" value={payFilter} onChange={(e) => setPayFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="Cash">Cash</option>
              <option value="RTGS">RTGS</option>
            </select>
          </div>

          {/* Source */}
          <div className="filter-group">
            <span className="filter-group-label">Source</span>
            <select className="filter-select-compact" value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="scan">AI Scan</option>
              <option value="import">Excel Import</option>
            </select>
          </div>

          {/* Date range */}
          <div className="filter-group">
            <span className="filter-group-label">From</span>
            <input type="date" className="filter-date-compact" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <span className="filter-group-label">To</span>
            <input type="date" className="filter-date-compact" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          {hasFilters && (
            <button type="button" className="filter-reset-btn" onClick={clearFilters} style={{ alignSelf: 'flex-end' }}>
              <IconX size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {hasFilters && (
          <div className="filter-result-strip">
            <span className="filter-result-dot" />
            <span>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} of {transactions.length} transactions
              {partyFilter !== 'all' && (
                <span style={{ marginLeft: 8, fontWeight: 700 }}>· Party: {partyFilter}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Counterparty P&L Overview or General Strip ── */}
      {partyFilter !== 'all' ? (
        <div className="counterparty-pnl-card">
          <div className="counterparty-pnl-header">
            <div className="counterparty-title-wrap">
              <span className="counterparty-name">
                <IconUsers size={16} />
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
                  ? 'Trading Partner (Buy & Sell)'
                  : activePnLSummary.buyCount > 0
                  ? 'Buyer'
                  : 'Seller'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {activePnLSummary.totalTransactions} record{activePnLSummary.totalTransactions !== 1 ? 's' : ''}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPartyFilter('all')}
            >
              <IconX size={12} />
              <span>Show All Buyers &amp; Sellers</span>
            </button>
          </div>

          <div className="counterparty-summary-grid">
            <div className={`counterparty-metric-item hero-metric ${!activePnLSummary.isProfit ? 'is-loss' : ''}`}>
              <span className="counterparty-metric-label">
                {activePnLSummary.isProfit ? 'Net Profit' : 'Net Loss'}
              </span>
              <span
                className="counterparty-metric-value"
                style={{ color: activePnLSummary.isProfit ? '#15803d' : '#b91c1c' }}
              >
                {activePnLSummary.totalPnLGlobal >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(activePnLSummary.totalPnLGlobal), globalCurrency)}
              </span>
              <span className="counterparty-metric-sub">
                <strong>
                  {activePnLSummary.pnlPercent >= 0 ? '+' : ''}
                  {activePnLSummary.pnlPercent.toFixed(2)}%
                </strong>{' '}
                vs Market Spot
              </span>
            </div>

            <div className="counterparty-metric-item">
              <span className="counterparty-metric-label">Total Bought</span>
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

            <div className="counterparty-metric-item">
              <span className="counterparty-metric-label">Total Sold</span>
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

            <div className="counterparty-metric-item">
              <span className="counterparty-metric-label">Net Balance</span>
              <span className="counterparty-metric-value" style={{ fontSize: 18 }}>
                {activePnLSummary.netWeightGrams >= 0 ? '+' : '−'}
                {Math.abs(activePnLSummary.netWeightGrams).toFixed(2)} g
              </span>
              <span className="counterparty-metric-sub">
                Cash Flow: {activePnLSummary.netCashFlowGlobal >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(activePnLSummary.netCashFlowGlobal), globalCurrency)}
              </span>
            </div>

            {activePnLSummary.matchedGrams > 0 && (
              <div className="counterparty-metric-item">
                <span className="counterparty-metric-label">Trading Spread</span>
                <span
                  className="counterparty-metric-value"
                  style={{
                    color: activePnLSummary.spreadPerGramGlobal >= 0 ? '#15803d' : '#b91c1c',
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
        <div className="pnl-strip-container">
          <div className="pnl-strip-stats">
            <div className="pnl-strip-stat">
              <span className="pnl-strip-stat-label">Records</span>
              <span className="pnl-strip-stat-val">{filtered.length}</span>
            </div>
            <div className="pnl-strip-stat">
              <span className="pnl-strip-stat-label">Total Volume</span>
              <span className="pnl-strip-stat-val">{formatCurrency(filteredTotalInGlobal, globalCurrency)}</span>
            </div>
            <div className="pnl-strip-stat">
              <span className="pnl-strip-stat-label">Net Profit / Loss</span>
              <span className={`pnl-strip-stat-val ${activePnLSummary.isProfit ? 'profit' : 'loss'}`}>
                {activePnLSummary.totalPnLGlobal >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(activePnLSummary.totalPnLGlobal), globalCurrency)} (
                {activePnLSummary.pnlPercent >= 0 ? '+' : ''}
                {activePnLSummary.pnlPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="pnl-strip-stat">
              <span className="pnl-strip-stat-label">Net Gold</span>
              <span className="pnl-strip-stat-val">
                {activePnLSummary.netWeightGrams >= 0 ? '+' : '−'}
                {Math.abs(activePnLSummary.netWeightGrams).toFixed(2)} g
              </span>
            </div>
          </div>

          <button
            type="button"
            className="pnl-breakdown-btn"
            onClick={() => setShowRankingModal(true)}
            title="View profit & loss ranking across all buyers & sellers"
          >
            <IconBarChart size={14} />
            <span>Buyers &amp; Sellers P&amp;L ({counterpartyOptions.length})</span>
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconLedger size={34} />
          </div>
          <div className="empty-state-title">No transactions found</div>
          <div className="empty-state-text">
            {hasFilters ? 'Try adjusting your filters to see matching records.' : 'Record your first gold transaction to get started.'}
          </div>
          {!hasFilters && (
            <Link href="/transactions/new" className="btn btn-primary">
              <IconPlus size={15} />
              <span>Add Transaction</span>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="bulk-action-bar">
              <div className="bulk-action-info">
                <span className="bulk-action-count">{selectedIds.size}</span>
                <span>
                  {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
                  {filtered.length > selectedIds.size && (
                    <span style={{ color: '#78716c', fontWeight: 500, fontSize: 12 }}>
                      {' '}
                      (of {filtered.length} filtered)
                    </span>
                  )}
                </span>
              </div>
              <div className="bulk-action-btns">
                {filtered.length > selectedIds.size && (
                  <button
                    type="button"
                    className="btn-bulk-clear"
                    onClick={() => setSelectedIds(new Set(filtered.map((t) => t.id)))}
                  >
                    Select All ({filtered.length})
                  </button>
                )}
                <button type="button" className="btn-bulk-clear" onClick={clearSelection}>
                  Clear Selection
                </button>
                <button type="button" className="btn-bulk-delete" onClick={() => setShowBulkDeleteModal(true)}>
                  <IconTrash size={13} />
                  <span>Delete Selected ({selectedIds.size})</span>
                </button>
              </div>
            </div>
          )}

          <div className="table-wrapper">
            <table className="tx-table">
              <thead>
                <tr>
                  <th className="table-checkbox-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Select all transactions"
                    />
                  </th>
                  <th onClick={() => handleSort('type')}>Type <SortIcon k="type" /></th>
                  <th onClick={() => handleSort('dateTime')}>Date <SortIcon k="dateTime" /></th>
                  <th onClick={() => handleSort('purity')}>Purity <SortIcon k="purity" /></th>
                  <th className="num-col">Weight</th>
                  <th className="num-col" onClick={() => handleSort('totalValue')}>Total Value <SortIcon k="totalValue" /></th>
                  <th onClick={() => handleSort('pnl')} title="Click to sort by Profit / Loss">Profit / Loss <SortIcon k="pnl" /></th>
                  <th onClick={() => handleSort('currency')}>Currency <SortIcon k="currency" /></th>
                  <th>Payment</th>
                  <th className="num-col">Rate (USD)</th>
                  <th onClick={() => handleSort('counterparty')}>Counterparty <SortIcon k="counterparty" /></th>
                  <th>Source</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id} className={selectedIds.has(tx.id) ? 'row-selected' : ''}>
                    <td className="table-checkbox-cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="table-checkbox"
                        checked={selectedIds.has(tx.id)}
                        onChange={() => toggleSelect(tx.id)}
                        aria-label={`Select transaction ${tx.id}`}
                      />
                    </td>
                    <td>
                      <span className={`tx-badge ${tx.type}`}>
                        {tx.type === 'buy' ? <IconArrowDownLeft size={11} /> : <IconArrowUpRight size={11} />}
                        <span>{tx.type}</span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{formatDate(tx.dateTime)}</td>
                    <td>
                      <span className="purity-tag">{purityLabel(tx.purity, tx.customPurity)}</span>
                    </td>
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
                              {txPnL.pnlPercent >= 0 ? '+' : ''}
                              {txPnL.pnlPercent.toFixed(1)}% {tx.type === 'buy' ? 'disc' : 'gain'}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{tx.currency}</td>
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
                    <td className="num-col" style={{ color: 'var(--text-secondary)' }}>
                      <div>${tx.marketRate.toLocaleString()}</div>
                      {globalCurrency !== 'USD' && (
                        <div className="cell-sub">
                          ≈ {formatCurrency(convertUSDTo(tx.marketRate, globalCurrency), globalCurrency)}
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth: 170 }}>
                      {tx.counterparty ? (
                        <button
                          type="button"
                          className="counterparty-link-btn"
                          onClick={() => setPartyFilter(tx.counterparty)}
                          style={{
                            color:
                              partyFilter.toLowerCase() === tx.counterparty.toLowerCase()
                                ? 'var(--gold-600)'
                                : 'var(--text-primary)',
                            background:
                              partyFilter.toLowerCase() === tx.counterparty.toLowerCase()
                                ? 'rgba(217, 119, 6, 0.1)'
                                : 'transparent',
                          }}
                          title={`Filter transactions and P&L for ${tx.counterparty}`}
                        >
                          {tx.counterparty}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`source-badge ${tx.source}`}>
                        {tx.source === 'scan' ? <IconScan size={11} /> : tx.source === 'import' ? <IconUpload size={11} /> : <IconEdit size={11} />}
                        <span>{tx.source === 'import' ? 'excel' : tx.source}</span>
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          id={`edit-${tx.id}`}
                          className="btn btn-ghost btn-icon-only"
                          onClick={() => setEditTx(tx)}
                          title="Edit transaction"
                          aria-label="Edit transaction"
                        >
                          <IconEdit size={14} />
                        </button>
                        <button
                          type="button"
                          id={`delete-${tx.id}`}
                          className="btn btn-danger btn-icon-only"
                          onClick={() => setDeleteId(tx.id)}
                          title="Delete transaction"
                          aria-label="Delete transaction"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Counterparty Ranking Modal */}
      {showRankingModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRankingModal(false); }}>
          <div className="modal" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">Buyers &amp; Sellers Profit &amp; Loss Ranking</span>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  Complete P&amp;L breakdown by counterparty in {globalCurrency}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRankingModal(false)} aria-label="Close modal">
                <IconX size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="pnl-ranking-table">
                  <thead>
                    <tr>
                      <th>Counterparty</th>
                      <th className="num-col">Deals</th>
                      <th className="num-col">Bought (Volume)</th>
                      <th className="num-col">Sold (Volume)</th>
                      <th className="num-col">Net Position</th>
                      <th>Total P&amp;L</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterpartiesRanking.map((item) => (
                      <tr
                        key={item.counterparty}
                        onClick={() => {
                          setPartyFilter(item.counterparty);
                          setShowRankingModal(false);
                        }}
                      >
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.counterparty}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {item.buyCount > 0 && item.sellCount > 0
                              ? 'Buyer & Seller'
                              : item.buyCount > 0
                              ? 'Buyer'
                              : 'Seller'}
                          </div>
                        </td>
                        <td className="num-col">{item.totalTransactions}</td>
                        <td className="num-col">
                          <div style={{ fontWeight: 600 }}>{formatCurrency(item.totalBuyValueGlobal, globalCurrency)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.totalBuyWeightGrams.toFixed(2)} g</div>
                        </td>
                        <td className="num-col">
                          <div style={{ fontWeight: 600 }}>{formatCurrency(item.totalSellValueGlobal, globalCurrency)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.totalSellWeightGrams.toFixed(2)} g</div>
                        </td>
                        <td className="num-col">
                          <div style={{ fontWeight: 600, color: item.netWeightGrams >= 0 ? '#15803d' : '#b91c1c' }}>
                            {item.netWeightGrams >= 0 ? '+' : '−'}
                            {Math.abs(item.netWeightGrams).toFixed(2)} g
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Cash: {item.netCashFlowGlobal >= 0 ? '+' : '−'}
                            {formatCurrency(Math.abs(item.netCashFlowGlobal), globalCurrency)}
                          </div>
                        </td>
                        <td>
                          <div className={`pnl-badge ${item.isProfit ? 'profit' : 'loss'}`}>
                            <span className="pnl-amount">
                              {item.totalPnLGlobal >= 0 ? '+' : '−'}
                              {formatCurrency(Math.abs(item.totalPnLGlobal), globalCurrency)}
                            </span>
                            <span className="pnl-percent">
                              {item.pnlPercent >= 0 ? '+' : ''}
                              {item.pnlPercent.toFixed(1)}% margin
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11.5, padding: '4px 10px' }}
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
              <button type="button" className="btn btn-secondary" onClick={() => setShowRankingModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTx && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditTx(null); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Edit Transaction</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditTx(null)} aria-label="Close modal">
                <IconX size={16} />
              </button>
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
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeleteId(null); }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">Confirm Delete</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)} aria-label="Close modal">
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Are you sure you want to delete this transaction? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => confirmDelete(deleteId)}>
                <IconTrash size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {showBulkDeleteModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingBulk) setShowBulkDeleteModal(false);
          }}
        >
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">
                Delete {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={isDeletingBulk}
                onClick={() => setShowBulkDeleteModal(false)}
                aria-label="Close modal"
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                Are you sure you want to delete the{' '}
                <strong>
                  {selectedIds.size} selected transaction{selectedIds.size !== 1 ? 's' : ''}
                </strong>
                ? This action is permanent and cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isDeletingBulk}
                onClick={() => setShowBulkDeleteModal(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" disabled={isDeletingBulk} onClick={handleBulkDelete}>
                <IconTrash size={14} />
                <span>{isDeletingBulk ? 'Deleting…' : `Yes, Delete (${selectedIds.size})`}</span>
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
