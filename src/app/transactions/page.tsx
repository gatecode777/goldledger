'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTransactions } from '@/context/TransactionContext';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, purityLabel } from '@/lib/formatters';
import { Transaction } from '@/lib/types';
import TransactionForm from '@/components/TransactionForm';

type SortKey = 'dateTime' | 'type' | 'totalValue' | 'purity' | 'currency';

export default function TransactionsPage() {
  const { transactions, deleteTransaction, loading, error } = useTransactions();
  const { showToast } = useToast();

  // Filters
  const [search,      setSearch]     = useState('');
  const [typeFilter,  setTypeFilter] = useState('all');
  const [currFilter,  setCurrFilter] = useState('all');
  const [purFilter,   setPurFilter]  = useState('all');
  const [srcFilter,   setSrcFilter]  = useState('all');
  const [dateFrom,    setDateFrom]   = useState('');
  const [dateTo,      setDateTo]     = useState('');

  // Sort
  const [sortKey, setSortKey]   = useState<SortKey>('dateTime');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');

  // Edit modal
  const [editTx, setEditTx]       = useState<Transaction | null>(null);
  // Delete confirm
  const [deleteId, setDeleteId]   = useState<string | null>(null);

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

  const purities = useMemo(() =>
    Array.from(new Set(transactions.map(t => purityLabel(t.purity, t.customPurity)))).sort(),
  [transactions]);

  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (currFilter !== 'all' && t.currency !== currFilter) return false;
        if (purFilter  !== 'all' && purityLabel(t.purity, t.customPurity) !== purFilter) return false;
        if (srcFilter  !== 'all' && t.source !== srcFilter) return false;
        if (dateFrom && t.dateTime < dateFrom) return false;
        if (dateTo   && t.dateTime > dateTo + 'T23:59:59') return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            t.counterparty.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            t.currency.toLowerCase().includes(q) ||
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
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [transactions, typeFilter, currFilter, purFilter, srcFilter, dateFrom, dateTo, search, sortKey, sortDir]);

  function clearFilters() {
    setSearch(''); setTypeFilter('all'); setCurrFilter('all');
    setPurFilter('all'); setSrcFilter('all'); setDateFrom(''); setDateTo('');
  }

  const hasFilters = search || typeFilter !== 'all' || currFilter !== 'all' ||
    purFilter !== 'all' || srcFilter !== 'all' || dateFrom || dateTo;

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
            {filtered.length} of {transactions.length} transactions
          </p>
        </div>
        <Link href="/transactions/new" className="btn btn-primary">
          ➕ New Transaction
        </Link>
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
              {purities.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Source */}
          <div className="filter-group">
            <span className="filter-group-label">Source</span>
            <select className="filter-select-compact" value={srcFilter} onChange={e => setSrcFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="scan">AI Scan</option>
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
          </div>
        )}
      </div>


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
                <th onClick={() => handleSort('currency')}>Currency <SortIcon k="currency" /></th>
                <th>Rate (USD)</th>
                <th>Counterparty</th>
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
                  <td className="font-bold">{formatCurrency(tx.totalValue, tx.currency)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{tx.currency}</td>
                  <td style={{ color: 'var(--text-muted)' }}>${tx.marketRate.toLocaleString()}</td>
                  <td style={{ maxWidth: 160 }}>
                    <div className="truncate" style={{ maxWidth: 160, color: 'var(--text-secondary)', fontSize: 12 }}>
                      {tx.counterparty || '—'}
                    </div>
                  </td>
                  <td>
                    <span className={`source-badge ${tx.source}`}>
                      {tx.source === 'scan' ? '🤖' : '✍️'} {tx.source}
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
    </>
  );
}
