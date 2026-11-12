'use client';

import { useState, useMemo } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { MoneyTransfer, PaymentType, TransferType } from '@/lib/types';
import { CURRENCIES, convertCurrency } from '@/lib/currencies';
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconTransfer,
  IconPlus,
  IconSearch,
  IconX,
  IconCheck,
  IconClock,
  IconEdit,
  IconTrash,
  IconWallet,
  IconCoins,
  IconBarChart,
  IconLandmark,
  IconBanknote,
  IconAlert,
} from '@/components/Icons';

type SortKey = 'dateTime' | 'amount' | 'senderName' | 'receiverName' | 'netProfit' | 'status' | 'transferType';

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
    deleteMoneyTransfers,
    globalCurrency,
    setGlobalCurrency,
    loading,
    error,
  } = useTransactions();
  const { showToast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'receive' | 'send' | 'both'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Multiple selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

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
    transferType: 'receive' as TransferType,
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

  function resetForm(targetType: TransferType = 'receive') {
    setFormData({
      transferType: targetType,
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

  function openNewForm(defaultType: TransferType = 'receive') {
    resetForm(defaultType);
    setShowForm(true);
  }

  function openEditForm(item: MoneyTransfer) {
    setEditItem(item);
    const inferredType: TransferType =
      item.transferType ||
      (item.senderName && !item.receiverName ? 'receive' :
       !item.senderName && item.receiverName ? 'send' : 'both');

    setFormData({
      transferType: inferredType,
      senderName: item.senderName || '',
      receiverName: item.receiverName || '',
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

  let formSenderFee = 0;
  let formReceiverFee = 0;
  let formNetProfit = 0;
  let formDelivered = formAmount;

  if (formData.transferType === 'receive') {
    formSenderFee = formAmount * (parsedSenderPercent / 100);
    formReceiverFee = 0;
    formNetProfit = formSenderFee;
    formDelivered = formAmount - formSenderFee;
  } else if (formData.transferType === 'send') {
    formSenderFee = 0;
    formReceiverFee = formAmount * (parsedReceiverPercent / 100);
    formNetProfit = -formReceiverFee;
    formDelivered = formAmount - formReceiverFee;
  } else {
    formSenderFee = formAmount * (parsedSenderPercent / 100);
    formReceiverFee = formAmount * (parsedReceiverPercent / 100);
    formNetProfit = formSenderFee - formReceiverFee;
    formDelivered = formAmount - formSenderFee - formReceiverFee;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formAmount <= 0) {
      showToast('Amount must be greater than zero', 'error');
      return;
    }

    if (formData.transferType === 'receive' && !formData.senderName.trim()) {
      showToast('Sender name is required for receiving money', 'error');
      return;
    }
    if (formData.transferType === 'send' && !formData.receiverName.trim()) {
      showToast('Receiver name is required for sending money', 'error');
      return;
    }
    if (formData.transferType === 'both') {
      if (!formData.senderName.trim()) {
        showToast('Sender name is required', 'error');
        return;
      }
      if (!formData.receiverName.trim()) {
        showToast('Receiver name is required', 'error');
        return;
      }
    }

    const payload = {
      transferType: formData.transferType,
      senderName: formData.transferType === 'send' ? '' : formData.senderName.trim(),
      receiverName: formData.transferType === 'receive' ? '' : formData.receiverName.trim(),
      amount: formAmount,
      currency: formData.currency,
      senderFeePercent: formData.transferType === 'send' ? 0 : parsedSenderPercent,
      receiverFeePercent: formData.transferType === 'receive' ? 0 : parsedReceiverPercent,
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
        showToast(
          formData.transferType === 'receive'
            ? `Recorded receipt of ${formatCurrency(formAmount, formData.currency)} from ${formData.senderName}`
            : formData.transferType === 'send'
            ? `Recorded disbursement of ${formatCurrency(formAmount, formData.currency)} to ${formData.receiverName}`
            : `Recorded transfer from ${formData.senderName} to ${formData.receiverName}`,
          'success'
        );
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
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    return moneyTransfers
      .filter((t) => {
        const itemType =
          t.transferType ||
          (t.senderName && !t.receiverName ? 'receive' : !t.senderName && t.receiverName ? 'send' : 'both');
        if (typeFilter !== 'all' && itemType !== typeFilter) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (dateFrom && t.dateTime < dateFrom) return false;
        if (dateTo && t.dateTime > dateTo + 'T23:59:59') return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            (t.senderName && t.senderName.toLowerCase().includes(q)) ||
            (t.receiverName && t.receiverName.toLowerCase().includes(q)) ||
            (t.notes && t.notes.toLowerCase().includes(q)) ||
            (t.transactionId && t.transactionId.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'dateTime') cmp = a.dateTime.localeCompare(b.dateTime);
        if (sortKey === 'amount') cmp = a.amount - b.amount;
        if (sortKey === 'senderName') cmp = (a.senderName || '').localeCompare(b.senderName || '');
        if (sortKey === 'receiverName') cmp = (a.receiverName || '').localeCompare(b.receiverName || '');
        if (sortKey === 'netProfit') cmp = a.netProfit - b.netProfit;
        if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
        if (sortKey === 'transferType') {
          const typeA = a.transferType || 'both';
          const typeB = b.transferType || 'both';
          cmp = typeA.localeCompare(typeB);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [moneyTransfers, typeFilter, statusFilter, dateFrom, dateTo, search, sortKey, sortDir]);

  const hasFilters = search || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalAmount = filtered.reduce((s, t) => s + convertCurrency(t.amount, t.currency, globalCurrency), 0);
    const totalProfit = filtered.reduce((s, t) => s + convertCurrency(t.netProfit, t.currency, globalCurrency), 0);
    const totalDelivered = filtered.reduce((s, t) => s + convertCurrency(t.amountDelivered, t.currency, globalCurrency), 0);
    const totalSenderFee = filtered.reduce((s, t) => s + convertCurrency(t.senderFee, t.currency, globalCurrency), 0);
    const totalReceiverFee = filtered.reduce((s, t) => s + convertCurrency(t.receiverFee, t.currency, globalCurrency), 0);
    const receiveCount = filtered.filter((t) => (t.transferType || (t.senderName && !t.receiverName ? 'receive' : 'both')) === 'receive').length;
    const sendCount = filtered.filter((t) => (t.transferType || (!t.senderName && t.receiverName ? 'send' : 'both')) === 'send').length;
    const pending = filtered.filter((t) => t.status === 'pending').length;
    const completed = filtered.filter((t) => t.status === 'completed').length;

    let totalReceived = 0;
    let totalSent = 0;
    filtered.forEach((t) => {
      if (statusFilter !== 'cancelled' && t.status === 'cancelled') return;
      const itemType: TransferType =
        t.transferType || (t.senderName && !t.receiverName ? 'receive' : !t.senderName && t.receiverName ? 'send' : 'both');
      const amt = convertCurrency(t.amount, t.currency, globalCurrency);

      if (itemType === 'receive') {
        totalReceived += amt;
      } else if (itemType === 'send') {
        totalSent += amt;
      } else {
        totalReceived += amt;
        totalSent += amt;
      }
    });
    const remainingAmount = totalReceived - totalSent;

    return {
      total,
      totalAmount,
      totalProfit,
      totalDelivered,
      totalSenderFee,
      totalReceiverFee,
      receiveCount,
      sendCount,
      pending,
      completed,
      totalReceived,
      totalSent,
      remainingAmount,
    };
  }, [filtered, globalCurrency, statusFilter]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((mt) => selectedIds.has(mt.id));
  const isIndeterminate = !allVisibleSelected && filtered.some((mt) => selectedIds.has(mt.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((mt) => next.delete(mt.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((mt) => next.add(mt.id));
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
      await deleteMoneyTransfers(idsArray);
      showToast(`Deleted ${idsArray.length} gold transfer${idsArray.length !== 1 ? 's' : ''}`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
    } catch {
      showToast('Failed to delete gold transfers', 'error');
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
        <p>Loading gold transfers…</p>
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
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gold Transfer</h1>
          <p className="page-subtitle">
            {filtered.length} of {moneyTransfers.length} transfers · Volume{' '}
            <strong>{formatCurrency(stats.totalAmount, globalCurrency)}</strong>
          </p>
        </div>
        <div className="page-header-actions">
          <div className="global-currency-badge" title="Change global display currency">
            <label htmlFor="mt-currency">Currency</label>
            <select
              id="mt-currency"
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
            className="btn btn-secondary"
            onClick={() => openNewForm('receive')}
            title="Record money received from customer/sender (0.1% fee)"
          >
            <IconArrowDownLeft size={14} />
            <span>Receive</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openNewForm('send')}
            title="Record money given to receiver (0.05% fee)"
          >
            <IconArrowUpRight size={14} />
            <span>Send</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openNewForm('both')}
            title="Record direct transfer from sender to receiver"
          >
            <IconPlus size={15} />
            <span>New Transfer</span>
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="mt-stats-grid">
        <div className="mt-stat-card balance">
          <div className="stat-icon-badge" title="Remaining transfer balance">
            <IconWallet size={14} />
          </div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Total Amount</span>
            <span
              className="mt-stat-value"
              style={{ color: stats.remainingAmount >= 0 ? '#0369a1' : '#b91c1c' }}
              title={`Received: ${formatCurrency(stats.totalReceived, globalCurrency)} · Sent: ${formatCurrency(stats.totalSent, globalCurrency)}`}
            >
              {stats.remainingAmount >= 0 ? '' : '−'}
              {formatCurrency(Math.abs(stats.remainingAmount), globalCurrency)}
            </span>
            <span className="mt-stat-sub">Remaining balance</span>
          </div>
        </div>

        <div className="mt-stat-card">
          <div className="stat-icon-badge" title="Total transfer volume">
            <IconCoins size={14} />
          </div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Total Volume</span>
            <span className="mt-stat-value">{formatCurrency(stats.totalAmount, globalCurrency)}</span>
            <span className="mt-stat-sub">
              {stats.receiveCount > 0 && `${stats.receiveCount} received · `}
              {stats.sendCount > 0 && `${stats.sendCount} sent · `}
              {stats.total} total
            </span>
          </div>
        </div>

        <div className="mt-stat-card">
          <div className="stat-icon-badge" title="Sender fees earned">
            <IconArrowDownLeft size={14} />
          </div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Sender Fees Earned</span>
            <span className="mt-stat-value" style={{ color: '#15803d' }}>
              {formatCurrency(stats.totalSenderFee, globalCurrency)}
            </span>
            <span className="mt-stat-sub">0.1% collected (Cash In)</span>
          </div>
        </div>

        <div className="mt-stat-card">
          <div className="stat-icon-badge" title="Receiver fees paid">
            <IconArrowUpRight size={14} />
          </div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Receiver Fees Paid</span>
            <span className="mt-stat-value" style={{ color: '#b91c1c' }}>
              {formatCurrency(stats.totalReceiverFee, globalCurrency)}
            </span>
            <span className="mt-stat-sub">0.05% charge (Cash Out)</span>
          </div>
        </div>

        <div className="mt-stat-card highlight">
          <div className="stat-icon-badge" title="Net profit margin">
            <IconBarChart size={14} />
          </div>
          <div className="mt-stat-content">
            <span className="mt-stat-label">Net Profit</span>
            <span
              className="mt-stat-value"
              style={{ color: stats.totalProfit >= 0 ? '#15803d' : '#b91c1c' }}
            >
              {stats.totalProfit >= 0 ? '+' : '−'}
              {formatCurrency(Math.abs(stats.totalProfit), globalCurrency)}
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
            <IconSearch size={15} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search sender, receiver, notes, or reference ID…"
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
          {/* Direction / Type filter */}
          <div className="filter-group">
            <span className="filter-group-label">Direction</span>
            <div className="type-pill-group">
              <button type="button" className={`type-pill ${typeFilter === 'all' ? 'type-pill-active' : ''}`} onClick={() => setTypeFilter('all')}>
                All
              </button>
              <button type="button" className={`type-pill ${typeFilter === 'receive' ? 'type-pill-active' : ''}`} onClick={() => setTypeFilter('receive')}>
                Receive
              </button>
              <button type="button" className={`type-pill ${typeFilter === 'send' ? 'type-pill-active' : ''}`} onClick={() => setTypeFilter('send')}>
                Send
              </button>
              <button type="button" className={`type-pill ${typeFilter === 'both' ? 'type-pill-active' : ''}`} onClick={() => setTypeFilter('both')}>
                Direct
              </button>
            </div>
          </div>

          <div className="filter-sep" />

          {/* Status filter */}
          <div className="filter-group">
            <span className="filter-group-label">Status</span>
            <div className="type-pill-group">
              <button type="button" className={`type-pill ${statusFilter === 'all' ? 'type-pill-active' : ''}`} onClick={() => setStatusFilter('all')}>
                All
              </button>
              <button type="button" className={`type-pill ${statusFilter === 'completed' ? 'type-pill-active' : ''}`} onClick={() => setStatusFilter('completed')}>
                Completed
              </button>
              <button type="button" className={`type-pill ${statusFilter === 'pending' ? 'type-pill-active' : ''}`} onClick={() => setStatusFilter('pending')}>
                Pending
              </button>
              <button type="button" className={`type-pill ${statusFilter === 'cancelled' ? 'type-pill-active' : ''}`} onClick={() => setStatusFilter('cancelled')}>
                Cancelled
              </button>
            </div>
          </div>

          <div className="filter-sep" />

          <div className="filter-group">
            <span className="filter-group-label">From</span>
            <input type="date" className="filter-date-compact" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <span className="filter-group-label">To</span>
            <input type="date" className="filter-date-compact" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          {hasFilters && (
            <>
              <div className="filter-sep" />
              <button
                type="button"
                className="filter-reset-btn"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                <IconX size={12} />
                <span>Reset</span>
              </button>
            </>
          )}
        </div>

        {hasFilters && (
          <div className="filter-result-strip">
            <span className="filter-result-dot" />
            <span>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} of {moneyTransfers.length} transfers
            </span>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconTransfer size={34} />
          </div>
          <div className="empty-state-title">No gold transfers found</div>
          <div className="empty-state-text">
            {hasFilters ? 'Try adjusting your filters to see more transfers.' : 'Record your first gold transfer to get started.'}
          </div>
          {!hasFilters && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => openNewForm('receive')}>
                <IconArrowDownLeft size={14} />
                <span>Receive Money</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => openNewForm('send')}>
                <IconArrowUpRight size={14} />
                <span>Send Money</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={() => openNewForm('both')}>
                <IconTransfer size={14} />
                <span>Direct Transfer</span>
              </button>
            </div>
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
                  {selectedIds.size} transfer{selectedIds.size !== 1 ? 's' : ''} selected
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
                      aria-label="Select all gold transfers"
                    />
                  </th>
                  <th onClick={() => handleSort('transferType')}>Direction <SortIcon k="transferType" /></th>
                  <th onClick={() => handleSort('dateTime')}>Date <SortIcon k="dateTime" /></th>
                  <th onClick={() => handleSort('senderName')}>Sender <SortIcon k="senderName" /></th>
                  <th onClick={() => handleSort('receiverName')}>Receiver <SortIcon k="receiverName" /></th>
                  <th className="num-col" onClick={() => handleSort('amount')}>Amount <SortIcon k="amount" /></th>
                  <th className="num-col">Sender Fee</th>
                  <th className="num-col">Receiver Fee</th>
                  <th onClick={() => handleSort('netProfit')}>Net Profit <SortIcon k="netProfit" /></th>
                  <th className="num-col">Delivered / Net</th>
                  <th>Payment</th>
                  <th onClick={() => handleSort('status')}>Status <SortIcon k="status" /></th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((mt) => {
                  const itemType: TransferType =
                    mt.transferType ||
                    (mt.senderName && !mt.receiverName ? 'receive' : !mt.senderName && mt.receiverName ? 'send' : 'both');

                  return (
                    <tr
                      key={mt.id}
                      className={`mt-row ${selectedIds.has(mt.id) ? 'row-selected' : ''}`}
                      onClick={() => setViewItem(mt)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="table-checkbox-cell" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="table-checkbox"
                          checked={selectedIds.has(mt.id)}
                          onChange={() => toggleSelect(mt.id)}
                          aria-label={`Select transfer ${mt.id}`}
                        />
                      </td>
                      <td>
                        <span className={`mt-type-badge ${itemType}`}>
                          {itemType === 'receive' ? (
                            <IconArrowDownLeft size={11} />
                          ) : itemType === 'send' ? (
                            <IconArrowUpRight size={11} />
                          ) : (
                            <IconTransfer size={11} />
                          )}
                          <span>{itemType === 'receive' ? 'Receive' : itemType === 'send' ? 'Send' : 'Transfer'}</span>
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{formatDate(mt.dateTime)}</td>
                      <td>
                        {mt.senderName ? (
                          <span className="mt-party-name">{mt.senderName}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {mt.receiverName ? (
                          <span className="mt-party-name">{mt.receiverName}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="num-col font-bold">
                        <div>{formatCurrency(mt.amount, mt.currency)}</div>
                        {mt.currency !== globalCurrency && (
                          <div className="cell-sub">
                            ≈ {formatCurrency(convertCurrency(mt.amount, mt.currency, globalCurrency), globalCurrency)}
                          </div>
                        )}
                      </td>
                      <td className="num-col" style={{ color: mt.senderFee > 0 ? '#15803d' : 'var(--text-muted)', fontWeight: 600 }}>
                        {mt.senderFee > 0 ? `+${formatCurrency(mt.senderFee, mt.currency)}` : '—'}
                      </td>
                      <td className="num-col" style={{ color: mt.receiverFee > 0 ? '#b91c1c' : 'var(--text-muted)', fontWeight: 600 }}>
                        {mt.receiverFee > 0 ? `−${formatCurrency(mt.receiverFee, mt.currency)}` : '—'}
                      </td>
                      <td>
                        <span className={`pnl-badge ${mt.netProfit > 0 ? 'profit' : mt.netProfit < 0 ? 'loss' : 'neutral'}`}>
                          <span className="pnl-amount">
                            {mt.netProfit >= 0 ? '+' : '−'}
                            {formatCurrency(Math.abs(mt.netProfit), mt.currency)}
                          </span>
                        </span>
                      </td>
                      <td className="num-col" style={{ fontWeight: 600 }}>{formatCurrency(mt.amountDelivered, mt.currency)}</td>
                      <td>
                        <span className={`payment-badge ${mt.paymentType.toLowerCase()}`}>
                          {mt.paymentType === 'RTGS' ? <IconLandmark size={11} /> : <IconBanknote size={11} />}
                          <span>{mt.paymentType}</span>
                        </span>
                        {mt.paymentType === 'RTGS' && mt.transactionId && (
                          <div className="cell-ref-id">#{mt.transactionId}</div>
                        )}
                      </td>
                      <td>
                        <span className={`mt-status-badge ${mt.status}`}>
                          {mt.status === 'completed' ? (
                            <IconCheck size={11} />
                          ) : mt.status === 'pending' ? (
                            <IconClock size={11} />
                          ) : (
                            <IconX size={11} />
                          )}
                          <span>{mt.status}</span>
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell" style={{ justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon-only"
                            onClick={() => openEditForm(mt)}
                            title="Edit transfer"
                            aria-label="Edit transfer"
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-icon-only"
                            onClick={() => setDeleteId(mt.id)}
                            title="Delete transfer"
                            aria-label="Delete transfer"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── New / Edit Transfer Modal ── */}
      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              resetForm();
            }
          }}
        >
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Gold Transfer' : 'New Gold Transfer'}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                aria-label="Close modal"
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              {/* Transfer Direction Toggle */}
              <div className="mt-mode-selector">
                <button
                  type="button"
                  className={`mt-mode-btn ${formData.transferType === 'receive' ? 'active receive' : ''}`}
                  onClick={() =>
                    setFormData((p) => ({
                      ...p,
                      transferType: 'receive',
                      senderFeePercent: p.senderFeePercent === '0' ? '0.1' : p.senderFeePercent,
                    }))
                  }
                >
                  <IconArrowDownLeft size={14} />
                  <span>Receive Money</span>
                </button>
                <button
                  type="button"
                  className={`mt-mode-btn ${formData.transferType === 'send' ? 'active send' : ''}`}
                  onClick={() =>
                    setFormData((p) => ({
                      ...p,
                      transferType: 'send',
                      receiverFeePercent: p.receiverFeePercent === '0' ? '0.05' : p.receiverFeePercent,
                    }))
                  }
                >
                  <IconArrowUpRight size={14} />
                  <span>Send Money</span>
                </button>
                <button
                  type="button"
                  className={`mt-mode-btn ${formData.transferType === 'both' ? 'active both' : ''}`}
                  onClick={() =>
                    setFormData((p) => ({
                      ...p,
                      transferType: 'both',
                      senderFeePercent: p.senderFeePercent === '0' ? '0.1' : p.senderFeePercent,
                      receiverFeePercent: p.receiverFeePercent === '0' ? '0.05' : p.receiverFeePercent,
                    }))
                  }
                >
                  <IconTransfer size={14} />
                  <span>Direct Transfer</span>
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mt-form-grid">
                  {(formData.transferType === 'receive' || formData.transferType === 'both') && (
                    <div className="form-group" style={{ gridColumn: formData.transferType === 'receive' ? '1 / -1' : undefined }}>
                      <label className="form-label">
                        Sender Name <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Who is giving the money?"
                        value={formData.senderName}
                        onChange={(e) => setFormData((p) => ({ ...p, senderName: e.target.value }))}
                        required
                        autoFocus
                      />
                    </div>
                  )}

                  {(formData.transferType === 'send' || formData.transferType === 'both') && (
                    <div className="form-group" style={{ gridColumn: formData.transferType === 'send' ? '1 / -1' : undefined }}>
                      <label className="form-label">
                        Receiver Name <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Who is receiving the money?"
                        value={formData.receiverName}
                        onChange={(e) => setFormData((p) => ({ ...p, receiverName: e.target.value }))}
                        required
                        autoFocus={formData.transferType === 'send'}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">
                      Transfer Amount <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Currency</label>
                    <select
                      className="form-select"
                      value={formData.currency}
                      onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.symbol} ({c.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(formData.transferType === 'receive' || formData.transferType === 'both') && (
                    <div className="form-group" style={{ gridColumn: formData.transferType === 'receive' ? '1 / -1' : undefined }}>
                      <label className="form-label">
                        Sender Fee (%) <span className="form-hint" style={{ fontWeight: 400 }}>— We charge</span>
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        step="0.01"
                        min="0"
                        value={formData.senderFeePercent}
                        onChange={(e) => setFormData((p) => ({ ...p, senderFeePercent: e.target.value }))}
                      />
                      <div className="form-helper" style={{ color: '#15803d' }}>
                        Fee Collected: +{formatCurrency(formSenderFee, formData.currency)}
                      </div>
                    </div>
                  )}

                  {(formData.transferType === 'send' || formData.transferType === 'both') && (
                    <div className="form-group" style={{ gridColumn: formData.transferType === 'send' ? '1 / -1' : undefined }}>
                      <label className="form-label">
                        Receiver Fee (%) <span className="form-hint" style={{ fontWeight: 400 }}>— Receiver takes</span>
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        step="0.01"
                        min="0"
                        value={formData.receiverFeePercent}
                        onChange={(e) => setFormData((p) => ({ ...p, receiverFeePercent: e.target.value }))}
                      />
                      <div className="form-helper" style={{ color: '#b91c1c' }}>
                        Receiver Charge: −{formatCurrency(formReceiverFee, formData.currency)}
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={formData.paymentType}
                      onChange={(e) => setFormData((p) => ({ ...p, paymentType: e.target.value as PaymentType }))}
                    >
                      <option value="Cash">Cash</option>
                      <option value="RTGS">RTGS</option>
                    </select>
                  </div>

                  {formData.paymentType === 'RTGS' && (
                    <div className="form-group">
                      <label className="form-label">
                        Transaction ID <span className="form-hint" style={{ fontWeight: 400 }}>(optional)</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="RTGS reference number"
                        value={formData.transactionId}
                        onChange={(e) => setFormData((p) => ({ ...p, transactionId: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={formData.dateTime}
                      onChange={(e) => setFormData((p) => ({ ...p, dateTime: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as 'completed' | 'pending' | 'cancelled' }))}
                    >
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      placeholder="Optional notes about this transfer…"
                      value={formData.notes}
                      onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Live Calculation Preview */}
                {formAmount > 0 && (
                  <div className="mt-calc-preview">
                    <div className="mt-calc-title">
                      {formData.transferType === 'receive'
                        ? 'Receipt Summary (From Sender)'
                        : formData.transferType === 'send'
                        ? 'Disbursement Summary (To Receiver)'
                        : 'Transfer Summary (Sender to Receiver)'}
                    </div>
                    <div className="mt-calc-grid">
                      <div className="mt-calc-row">
                        <span>Principal Amount</span>
                        <span className="font-bold">{formatCurrency(formAmount, formData.currency)}</span>
                      </div>

                      {formData.transferType !== 'send' && (
                        <div className="mt-calc-row" style={{ color: '#15803d' }}>
                          <span>Sender Fee ({formData.senderFeePercent}%)</span>
                          <span>+{formatCurrency(formSenderFee, formData.currency)}</span>
                        </div>
                      )}

                      {formData.transferType !== 'receive' && (
                        <div className="mt-calc-row" style={{ color: '#b91c1c' }}>
                          <span>Receiver Fee ({formData.receiverFeePercent}%)</span>
                          <span>−{formatCurrency(formReceiverFee, formData.currency)}</span>
                        </div>
                      )}

                      <div className="mt-calc-divider" />

                      {formData.transferType === 'receive' ? (
                        <>
                          <div className="mt-calc-row highlight">
                            <span>Your Earning (Fee Collected)</span>
                            <span style={{ color: '#15803d', fontWeight: 700 }}>
                              +{formatCurrency(formSenderFee, formData.currency)}
                            </span>
                          </div>
                          <div className="mt-calc-row">
                            <span>Net Deposit Credited</span>
                            <span className="font-bold">{formatCurrency(formDelivered, formData.currency)}</span>
                          </div>
                        </>
                      ) : formData.transferType === 'send' ? (
                        <>
                          <div className="mt-calc-row highlight">
                            <span>Fee Incurred (Receiver Charge)</span>
                            <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                              −{formatCurrency(formReceiverFee, formData.currency)}
                            </span>
                          </div>
                          <div className="mt-calc-row">
                            <span>Net Paid to Receiver</span>
                            <span className="font-bold">{formatCurrency(formDelivered, formData.currency)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mt-calc-row highlight">
                            <span>Net Profit (Spread Margin)</span>
                            <span style={{ color: formNetProfit >= 0 ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                              {formNetProfit >= 0 ? '+' : '−'}
                              {formatCurrency(Math.abs(formNetProfit), formData.currency)}
                            </span>
                          </div>
                          <div className="mt-calc-row">
                            <span>Amount Delivered to Receiver</span>
                            <span className="font-bold">{formatCurrency(formDelivered, formData.currency)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="modal-footer" style={{ margin: '20px -26px -22px', padding: '16px 26px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editItem
                      ? 'Save Changes'
                      : formData.transferType === 'receive'
                      ? 'Record Receipt'
                      : formData.transferType === 'send'
                      ? 'Record Disbursement'
                      : 'Record Transfer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── View Detail Modal ── */}
      {viewItem && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewItem(null); }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <span className="modal-title">Transfer Details</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewItem(null)} aria-label="Close modal">
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="mt-detail-grid">
                <div className="mt-detail-row">
                  <span className="mt-detail-label">Direction</span>
                  <span className="mt-detail-value">
                    <span className={`mt-type-badge ${viewItem.transferType || 'both'}`}>
                      {(viewItem.transferType || 'both') === 'receive'
                        ? 'Receive (Sender Gives)'
                        : (viewItem.transferType || 'both') === 'send'
                        ? 'Send (To Receiver)'
                        : 'Direct Transfer'}
                    </span>
                  </span>
                </div>
                {viewItem.senderName && (
                  <div className="mt-detail-row">
                    <span className="mt-detail-label">Sender</span>
                    <span className="mt-detail-value">{viewItem.senderName}</span>
                  </div>
                )}
                {viewItem.receiverName && (
                  <div className="mt-detail-row">
                    <span className="mt-detail-label">Receiver</span>
                    <span className="mt-detail-value">{viewItem.receiverName}</span>
                  </div>
                )}
                <div className="mt-detail-row">
                  <span className="mt-detail-label">Principal Amount</span>
                  <span className="mt-detail-value font-bold">{formatCurrency(viewItem.amount, viewItem.currency)}</span>
                </div>
                {viewItem.senderFee > 0 && (
                  <div className="mt-detail-row">
                    <span className="mt-detail-label">Sender Fee ({viewItem.senderFeePercent}%)</span>
                    <span className="mt-detail-value" style={{ color: '#15803d' }}>
                      +{formatCurrency(viewItem.senderFee, viewItem.currency)}
                    </span>
                  </div>
                )}
                {viewItem.receiverFee > 0 && (
                  <div className="mt-detail-row">
                    <span className="mt-detail-label">Receiver Fee ({viewItem.receiverFeePercent}%)</span>
                    <span className="mt-detail-value" style={{ color: '#b91c1c' }}>
                      −{formatCurrency(viewItem.receiverFee, viewItem.currency)}
                    </span>
                  </div>
                )}
                <div className="mt-detail-row highlight">
                  <span className="mt-detail-label">Net Profit / Margin</span>
                  <span
                    className="mt-detail-value"
                    style={{ color: viewItem.netProfit >= 0 ? '#15803d' : '#b91c1c', fontWeight: 700 }}
                  >
                    {viewItem.netProfit >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(viewItem.netProfit), viewItem.currency)}
                  </span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">Delivered / Net</span>
                  <span className="mt-detail-value font-bold">{formatCurrency(viewItem.amountDelivered, viewItem.currency)}</span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">Payment</span>
                  <span className="mt-detail-value">
                    {viewItem.paymentType}
                    {viewItem.transactionId && <span className="cell-ref-id" style={{ display: 'inline', marginLeft: 8 }}>#{viewItem.transactionId}</span>}
                  </span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">Date</span>
                  <span className="mt-detail-value">{formatDate(viewItem.dateTime)}</span>
                </div>
                <div className="mt-detail-row">
                  <span className="mt-detail-label">Status</span>
                  <span className="mt-detail-value">
                    <span className={`mt-status-badge ${viewItem.status}`}>{viewItem.status}</span>
                  </span>
                </div>
                {viewItem.notes && (
                  <div className="mt-detail-row">
                    <span className="mt-detail-label">Notes</span>
                    <span className="mt-detail-value">{viewItem.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  openEditForm(viewItem);
                  setViewItem(null);
                }}
              >
                <IconEdit size={14} />
                <span>Edit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
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
                Are you sure you want to delete this gold transfer? This action cannot be undone.
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

      {/* ── Bulk Delete Confirm Modal ── */}
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
                Delete {selectedIds.size} Transfer{selectedIds.size !== 1 ? 's' : ''}
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
                Are you sure you want to permanently delete the{' '}
                <strong>
                  {selectedIds.size} selected transfer{selectedIds.size !== 1 ? 's' : ''}
                </strong>
                ? This action cannot be undone.
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
    </>
  );
}
