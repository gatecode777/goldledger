'use client';

import { useState, useMemo } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { MoneyTransfer, PaymentType } from '@/lib/types';
import { CURRENCIES, convertCurrency } from '@/lib/currencies';

type SortKey = 'dateTime' | 'amount' | 'senderName' | 'receiverName' | 'netProfit' | 'status';

function getNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MoneyTransfersPage() {
  const {
    moneyTransfers,
    addMoneyTransfer,
    updateMoneyTransfer,
    deleteMoneyTransfer,
    globalCurrency,
    setGlobalCurrency,
    loading,
    error,
  } = useTransactions();
  const { showToast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('dateTime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MoneyTransfer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<MoneyTransfer | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    senderName: '',
    receiverName: '',
    amount: '',
    currency: globalCurrency,
    senderFeePercent: '0.1',
    receiverFeePercent: '0.05',
    paymentType: 'Cash' as PaymentType,
    transactionId: '',
    dateTime: getNow(),
    notes: '',
    status: 'completed' as 'completed' | 'pending' | 'cancelled',
  });

  function resetForm() {
    setFormData({
      senderName: '',
      receiverName: '',
      amount: '',
      currency: globalCurrency,
      senderFeePercent: '0.1',
      receiverFeePercent: '0.05',
      paymentType: 'Cash',
      transactionId: '',
      dateTime: getNow(),
      notes: '',
      status: 'completed',
    });
    setEditItem(null);
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(item: MoneyTransfer) {
    setEditItem(item);
    setFormData({
      senderName: item.senderName,
      receiverName: item.receiverName,
      amount: item.amount.toString(),
      currency: item.currency,
      senderFeePercent: item.senderFeePercent.toString(),
      receiverFeePercent: item.receiverFeePercent.toString(),
      paymentType: item.paymentType,
      transactionId: item.transactionId || '',
      dateTime: item.dateTime ? item.dateTime.slice(0, 16) : getNow(),
      notes: item.notes || '',
      status: item.status,
    });
    setShowForm(true);
  }

  // Calculated fee values from form
  const formAmount = parseFloat(formData.amount) || 0;
  const parsedSenderPercent = !isNaN(parseFloat(formData.senderFeePercent)) ? parseFloat(formData.senderFeePercent) : 0.1;
  const parsedReceiverPercent = !isNaN(parseFloat(formData.receiverFeePercent)) ? parseFloat(formData.receiverFeePercent) : 0.05;
  const formSenderFee = formAmount * (parsedSenderPercent / 100);
  const formReceiverFee = formAmount * (parsedReceiverPercent / 100);
  const formNetProfit = formSenderFee - formReceiverFee;
  const formDelivered = formAmount - formSenderFee - formReceiverFee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.senderName.trim()) { showToast('Sender name is required', 'error'); return; }
    if (!formData.receiverName.trim()) { showToast('Receiver name is required', 'error'); return; }
    if (formAmount <= 0) { showToast('Amount must be greater than zero', 'error'); return; }

    const payload = {
      senderName: formData.senderName.trim(),
      receiverName: formData.receiverName.trim(),
      amount: formAmount,
      currency: formData.currency,
      senderFeePercent: parsedSenderPercent,
      receiverFeePercent: parsedReceiverPercent,
      senderFee: formSenderFee,
      receiverFee: formReceiverFee,
      netProfit: formNetProfit,
      amountDelivered: formDelivered,
      paymentType: formData.paymentType,
      transactionId: formData.paymentType === 'RTGS' ? formData.transactionId.trim() : '',
      dateTime: formData.dateTime || new Date().toISOString(),
      notes: formData.notes.trim(),
      status: formData.status,
    };

    try {
      if (editItem) {
        await updateMoneyTransfer(editItem.id, payload);
        showToast('Transfer updated successfully', 'success');
      } else {
        await addMoneyTransfer(payload);
        showToast('Transfer recorded successfully', 'success');
      }
      setShowForm(false);
      resetForm();
    } catch {
      showToast('Failed to save transfer', 'error');
    }
  }

  async function confirmDelete(id: string) {
    try {
      await deleteMoneyTransfer(id);
      showToast('Transfer deleted', 'error');
    } catch {
      showToast('Failed to delete transfer', 'error');
    }
    setDeleteId(null);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const filtered = useMemo(() => {
    return moneyTransfers
      .filter(t => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (dateFrom && t.dateTime < dateFrom) return false;
        if (dateTo && t.dateTime > dateTo + 'T23:59:59') return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            t.senderName.toLowerCase().includes(q) ||
            t.receiverName.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            (t.transactionId && t.transactionId.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'dateTime') cmp = a.dateTime.localeCompare(b.dateTime);
        if (sortKey === 'amount') cmp = a.amount - b.amount;
        if (sortKey === 'senderName') cmp = a.senderName.localeCompare(b.senderName);
        if (sortKey === 'receiverName') cmp = a.receiverName.localeCompare(b.receiverName);
        if (sortKey === 'netProfit') cmp = a.netProfit - b.netProfit;
        if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [moneyTransfers, statusFilter, dateFrom, dateTo, search, sortKey, sortDir]);

  const hasFilters = search || statusFilter !== 'all' || dateFrom || dateTo;

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const totalAmount = filtered.reduce((s, t) => s + convertCurrency(t.amount, t.currency, globalCurrency), 0);
    const totalProfit = filtered.reduce((s, t) => s + convertCurrency(t.netProfit, t.currency, globalCurrency), 0);
    const totalDelivered = filtered.reduce((s, t) => s + convertCurrency(t.amountDelivered, t.currency, globalCurrency), 0);
    const totalSenderFee = filtered.reduce((s, t) => s + convertCurrency(t.senderFee, t.currency, globalCurrency), 0);
    const totalReceiverFee = filtered.reduce((s, t) => s + convertCurrency(t.receiverFee, t.currency, globalCurrency), 0);
    const pending = filtered.filter(t => t.status === 'pending').length;
    const completed = filtered.filter(t => t.status === 'completed').length;
    return { total, totalAmount, totalProfit, totalDelivered, totalSenderFee, totalReceiverFee, pending, completed };
  }, [filtered, globalCurrency]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  if (loading) {
    return (
      <div className="page-loading">
        <div className="page-spinner" />
        <p>Loading money transfers…</p>
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
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Money Transfer</h1>
          <p className="page-subtitle">
            {filtered.length} of {moneyTransfers.length} transfers · Total Volume: <strong>{formatCurrency(stats.totalAmount, globalCurrency)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="global-currency-badge" title="Change global display currency">
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
          <button type="button" className="btn btn-primary" onClick={openNewForm}>
            ➕ New Transfer
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="mt-stats-grid">
        <div className="mt-stat-card">
          <div className="mt-stat-icon">💰</div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Total Volume</span>
            <span className="mt-stat-value">{formatCurrency(stats.totalAmount, globalCurrency)}</span>
            <span className="mt-stat-sub">{stats.total} transfer{stats.total !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="mt-stat-card">
          <div className="mt-stat-icon">📤</div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Sender Fees Earned</span>
            <span className="mt-stat-value" style={{ color: '#15803d' }}>{formatCurrency(stats.totalSenderFee, globalCurrency)}</span>
            <span className="mt-stat-sub">0.1% commission collected</span>
          </div>
        </div>
        <div className="mt-stat-card">
          <div className="mt-stat-icon">📥</div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Receiver Fees Paid</span>
            <span className="mt-stat-value" style={{ color: '#dc2626' }}>{formatCurrency(stats.totalReceiverFee, globalCurrency)}</span>
            <span className="mt-stat-sub">0.05% delivery cost</span>
          </div>
        </div>
        <div className="mt-stat-card highlight">
          <div className="mt-stat-icon">📊</div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Net Profit</span>
            <span className="mt-stat-value" style={{ color: stats.totalProfit >= 0 ? '#15803d' : '#dc2626' }}>
              {stats.totalProfit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(stats.totalProfit), globalCurrency)}
            </span>
            <span className="mt-stat-sub">
              {stats.completed} completed · {stats.pending} pending
            </span>
          </div>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="filter-panel">
        <div className="filter-search-row">
          <div className="filter-search-wrap">
            <svg className="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search sender, receiver, notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="filter-clear-x" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        <div className="filter-controls-row">
          <div className="filter-group">
            <span className="filter-group-label">Status</span>
            <div className="type-pill-group">
              <button className={`type-pill ${statusFilter === 'all' ? 'type-pill-active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
              <button className={`type-pill ${statusFilter === 'completed' ? 'type-pill-active' : ''}`} onClick={() => setStatusFilter('completed')}>✅ Completed</button>
              <button className={`type-pill ${statusFilter === 'pending' ? 'type-pill-active' : ''}`} onClick={() => setStatusFilter('pending')}>⏳ Pending</button>
              <button className={`type-pill ${statusFilter === 'cancelled' ? 'type-pill-active' : ''}`} onClick={() => setStatusFilter('cancelled')}>❌ Cancelled</button>
            </div>
          </div>

          <div className="filter-sep" />

          <div className="filter-group">
            <span className="filter-group-label">From</span>
            <input type="date" className="filter-date-compact" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <span className="filter-group-label">To</span>
            <input type="date" className="filter-date-compact" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>

          {hasFilters && (
            <>
              <div className="filter-sep" />
              <button className="filter-reset-btn" onClick={() => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
                Reset
              </button>
            </>
          )}
        </div>

        {hasFilters && (
          <div className="filter-result-strip">
            <span className="filter-result-dot" />
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} of {moneyTransfers.length} transfers
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💸</div>
          <div className="empty-state-title">No money transfers found</div>
          <div className="empty-state-text">
            {hasFilters ? 'Try adjusting your filters.' : 'Record your first money transfer to get started.'}
          </div>
          {!hasFilters && (
            <button className="btn btn-primary" onClick={openNewForm}>➕ New Transfer</button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="tx-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('dateTime')}>Date <SortIcon k="dateTime" /></th>
                <th onClick={() => handleSort('senderName')}>Sender <SortIcon k="senderName" /></th>
                <th onClick={() => handleSort('receiverName')}>Receiver <SortIcon k="receiverName" /></th>
                <th onClick={() => handleSort('amount')}>Amount <SortIcon k="amount" /></th>
                <th>Sender Fee (0.1%)</th>
                <th>Receiver Fee (0.05%)</th>
                <th onClick={() => handleSort('netProfit')}>Net Profit <SortIcon k="netProfit" /></th>
                <th>Delivered</th>
                <th>Payment</th>
                <th onClick={() => handleSort('status')}>Status <SortIcon k="status" /></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(mt => (
                <tr key={mt.id} className="mt-row" onClick={() => setViewItem(mt)} style={{ cursor: 'pointer' }}>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    {formatDate(mt.dateTime)}
                  </td>
                  <td>
                    <div className="mt-party-cell">
                      <span className="mt-party-icon sender">📤</span>
                      <span className="mt-party-name">{mt.senderName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="mt-party-cell">
                      <span className="mt-party-icon receiver">📥</span>
                      <span className="mt-party-name">{mt.receiverName}</span>
                    </div>
                  </td>
                  <td className="font-bold">
                    <div>{formatCurrency(mt.amount, mt.currency)}</div>
                    {mt.currency !== globalCurrency && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>
                        ≈ {formatCurrency(convertCurrency(mt.amount, mt.currency, globalCurrency), globalCurrency)}
                      </div>
                    )}
                  </td>
                  <td style={{ color: '#15803d', fontWeight: 600 }}>
                    +{formatCurrency(mt.senderFee, mt.currency)}
                  </td>
                  <td style={{ color: '#dc2626', fontWeight: 600 }}>
                    −{formatCurrency(mt.receiverFee, mt.currency)}
                  </td>
                  <td>
                    <span className={`pnl-badge ${mt.netProfit >= 0 ? 'profit' : 'loss'}`}>
                      <span className="pnl-amount">
                        {mt.netProfit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(mt.netProfit), mt.currency)}
                      </span>
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {formatCurrency(mt.amountDelivered, mt.currency)}
                  </td>
                  <td>
                    <span className={`payment-badge ${mt.paymentType.toLowerCase()}`}>
                      {mt.paymentType === 'RTGS' ? '🏦 RTGS' : '💵 Cash'}
                    </span>
                    {mt.paymentType === 'RTGS' && mt.transactionId && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 3 }}>
                        #{mt.transactionId}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`mt-status-badge ${mt.status}`}>
                      {mt.status === 'completed' ? '✅' : mt.status === 'pending' ? '⏳' : '❌'} {mt.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell" onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEditForm(mt)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteId(mt.id)}
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

      {/* ── New / Edit Transfer Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <span className="modal-title">
                {editItem ? '✏️ Edit Transfer' : '💸 New Money Transfer'}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="mt-form-grid">
                  {/* Sender */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>📤</span> Sender Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Who is sending the money?"
                      value={formData.senderName}
                      onChange={e => setFormData(p => ({ ...p, senderName: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Receiver */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>📥</span> Receiver Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Who is receiving the money?"
                      value={formData.receiverName}
                      onChange={e => setFormData(p => ({ ...p, receiverName: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Amount */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>💰</span> Transfer Amount <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Currency */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>🌍</span> Currency
                    </label>
                    <select
                      className="form-input"
                      value={formData.currency}
                      onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.symbol} ({c.name})</option>
                      ))}
                    </select>
                  </div>

                  {/* Sender Fee % */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>📤</span> Sender Fee (%)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      step="0.01"
                      min="0"
                      value={formData.senderFeePercent}
                      onChange={e => setFormData(p => ({ ...p, senderFeePercent: e.target.value }))}
                    />
                    <div className="form-helper" style={{ color: '#15803d' }}>
                      Fee: +{formatCurrency(formSenderFee, formData.currency)}
                    </div>
                  </div>

                  {/* Receiver Fee % */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>📥</span> Receiver Fee (%)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      step="0.01"
                      min="0"
                      value={formData.receiverFeePercent}
                      onChange={e => setFormData(p => ({ ...p, receiverFeePercent: e.target.value }))}
                    />
                    <div className="form-helper" style={{ color: '#dc2626' }}>
                      Fee: −{formatCurrency(formReceiverFee, formData.currency)}
                    </div>
                  </div>

                  {/* Payment Type */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>💳</span> Payment Type
                    </label>
                    <select
                      className="form-input"
                      value={formData.paymentType}
                      onChange={e => setFormData(p => ({ ...p, paymentType: e.target.value as PaymentType }))}
                    >
                      <option value="Cash">💵 Cash</option>
                      <option value="RTGS">🏦 RTGS</option>
                    </select>
                  </div>

                  {/* RTGS Transaction ID */}
                  {formData.paymentType === 'RTGS' && (
                    <div className="form-group">
                      <label className="form-label">
                        <span>🔖</span> Transaction ID <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="RTGS reference number"
                        value={formData.transactionId}
                        onChange={e => setFormData(p => ({ ...p, transactionId: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* Date & Time */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>📅</span> Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={formData.dateTime}
                      onChange={e => setFormData(p => ({ ...p, dateTime: e.target.value }))}
                    />
                  </div>

                  {/* Status */}
                  <div className="form-group">
                    <label className="form-label">
                      <span>📋</span> Status
                    </label>
                    <select
                      className="form-input"
                      value={formData.status}
                      onChange={e => setFormData(p => ({ ...p, status: e.target.value as 'completed' | 'pending' | 'cancelled' }))}
                    >
                      <option value="completed">✅ Completed</option>
                      <option value="pending">⏳ Pending</option>
                      <option value="cancelled">❌ Cancelled</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">
                      <span>📝</span> Notes
                    </label>
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder="Optional notes about this transfer…"
                      value={formData.notes}
                      onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Live Calculation Preview */}
                {formAmount > 0 && (
                  <div className="mt-calc-preview">
                    <div className="mt-calc-title">Transfer Breakdown</div>
                    <div className="mt-calc-grid">
                      <div className="mt-calc-row">
                        <span>Original Amount</span>
                        <span className="font-bold">{formatCurrency(formAmount, formData.currency)}</span>
                      </div>
                      <div className="mt-calc-row" style={{ color: '#15803d' }}>
                        <span>Sender Fee ({formData.senderFeePercent}%)</span>
                        <span>+{formatCurrency(formSenderFee, formData.currency)}</span>
                      </div>
                      <div className="mt-calc-row" style={{ color: '#dc2626' }}>
                        <span>Receiver Fee ({formData.receiverFeePercent}%)</span>
                        <span>−{formatCurrency(formReceiverFee, formData.currency)}</span>
                      </div>
                      <div className="mt-calc-divider" />
                      <div className="mt-calc-row highlight">
                        <span>💰 Net Profit (Your Earning)</span>
                        <span style={{ color: formNetProfit >= 0 ? '#15803d' : '#dc2626', fontWeight: 800 }}>
                          {formNetProfit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(formNetProfit), formData.currency)}
                        </span>
                      </div>
                      <div className="mt-calc-row">
                        <span>📥 Amount Delivered to Receiver</span>
                        <span className="font-bold">{formatCurrency(formDelivered, formData.currency)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="modal-footer" style={{ paddingBottom: 0, paddingLeft: 0, paddingRight: 0 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    {editItem ? '💾 Update Transfer' : '💸 Record Transfer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── View Detail Modal ── */}
      {viewItem && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setViewItem(null); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <span className="modal-title">💸 Transfer Details</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mt-detail-grid">
                <div className="mt-detail-row">
                  <span className="mt-detail-label">📤 Sender</span>
                  <span className="mt-detail-value">{viewItem.senderName}</span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">📥 Receiver</span>
                  <span className="mt-detail-value">{viewItem.receiverName}</span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">💰 Amount</span>
                  <span className="mt-detail-value font-bold">{formatCurrency(viewItem.amount, viewItem.currency)}</span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">📤 Sender Fee ({viewItem.senderFeePercent}%)</span>
                  <span className="mt-detail-value" style={{ color: '#15803d' }}>+{formatCurrency(viewItem.senderFee, viewItem.currency)}</span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">📥 Receiver Fee ({viewItem.receiverFeePercent}%)</span>
                  <span className="mt-detail-value" style={{ color: '#dc2626' }}>−{formatCurrency(viewItem.receiverFee, viewItem.currency)}</span>
                </div>
                <div className="mt-detail-row highlight">
                  <span className="mt-detail-label">📊 Net Profit</span>
                  <span className="mt-detail-value" style={{ color: viewItem.netProfit >= 0 ? '#15803d' : '#dc2626', fontWeight: 800 }}>
                    {viewItem.netProfit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(viewItem.netProfit), viewItem.currency)}
                  </span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">📥 Delivered</span>
                  <span className="mt-detail-value font-bold">{formatCurrency(viewItem.amountDelivered, viewItem.currency)}</span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">💳 Payment</span>
                  <span className="mt-detail-value">
                    {viewItem.paymentType === 'RTGS' ? '🏦 RTGS' : '💵 Cash'}
                    {viewItem.transactionId && <span style={{ fontFamily: 'monospace', marginLeft: 8, fontSize: 12 }}>#{viewItem.transactionId}</span>}
                  </span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">📅 Date</span>
                  <span className="mt-detail-value">{formatDate(viewItem.dateTime)}</span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">📋 Status</span>
                  <span className="mt-detail-value">
                    <span className={`mt-status-badge ${viewItem.status}`}>
                      {viewItem.status === 'completed' ? '✅' : viewItem.status === 'pending' ? '⏳' : '❌'} {viewItem.status}
                    </span>
                  </span>
                </div>
                {viewItem.notes && (
                  <div className="mt-detail-row">
                    <span className="mt-detail-label">📝 Notes</span>
                    <span className="mt-detail-value">{viewItem.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { openEditForm(viewItem); setViewItem(null); }}>
                ✏️ Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteId && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">🗑️ Confirm Delete</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Are you sure you want to delete this money transfer? This action cannot be undone.
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

