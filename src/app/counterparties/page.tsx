'use client';

import React, { useState, useMemo } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { Counterparty, CounterpartyType, WeightUnit } from '@/lib/types';
import { CURRENCIES, getCurrencySymbol } from '@/lib/currencies';
import { formatCurrency } from '@/lib/formatters';
import { useToast } from '@/components/Toast';
import {
  IconPlus,
  IconSearch,
  IconX,
  IconEdit,
  IconTrash,
  IconUsers,
  IconArrowDownLeft,
  IconArrowUpRight,
} from '@/components/Icons';

export default function CounterpartiesPage() {
  const {
    counterparties,
    addCounterparty,
    updateCounterparty,
    deleteCounterparty,
    deleteCounterparties,
    globalCurrency,
    loading,
  } = useTransactions();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'buyer' | 'seller' | 'both'>('all');

  // Multiple selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Counterparty | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CounterpartyType>('buyer');
  const [formPrice, setFormPrice] = useState('');
  const [formCurrency, setFormCurrency] = useState(globalCurrency || 'USD');
  const [formUnit, setFormUnit] = useState<WeightUnit>('gram');
  const [formNotes, setFormNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Single Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return counterparties
      .filter((c) => {
        if (typeFilter !== 'all') {
          if (typeFilter === 'both' && c.type !== 'both') return false;
          if (typeFilter === 'buyer' && c.type !== 'buyer' && c.type !== 'both') return false;
          if (typeFilter === 'seller' && c.type !== 'seller' && c.type !== 'both') return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            (c.notes && c.notes.toLowerCase().includes(q)) ||
            c.currency.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [counterparties, typeFilter, search]);

  const counts = useMemo(() => {
    const buyers = counterparties.filter((c) => c.type === 'buyer' || c.type === 'both').length;
    const sellers = counterparties.filter((c) => c.type === 'seller' || c.type === 'both').length;
    return { all: counterparties.length, buyers, sellers };
  }, [counterparties]);

  function openAddModal() {
    setEditingParty(null);
    setFormName('');
    setFormType('buyer');
    setFormPrice('');
    setFormCurrency(globalCurrency || 'USD');
    setFormUnit('gram');
    setFormNotes('');
    setFormErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(party: Counterparty) {
    setEditingParty(party);
    setFormName(party.name);
    setFormType(party.type);
    setFormPrice(String(party.defaultPrice || ''));
    setFormCurrency(party.currency || globalCurrency || 'USD');
    setFormUnit(party.weightUnit || 'gram');
    setFormNotes(party.notes || '');
    setFormErrors({});
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formName.trim()) errors.name = 'Name is required';
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) errors.price = 'Enter a valid price (0 or higher)';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (editingParty) {
        await updateCounterparty(editingParty.id, {
          name: formName.trim(),
          type: formType,
          defaultPrice: priceNum,
          currency: formCurrency,
          weightUnit: formUnit,
          notes: formNotes.trim(),
        });
        showToast(`Updated ${formName}`, 'success');
      } else {
        await addCounterparty({
          name: formName.trim(),
          type: formType,
          defaultPrice: priceNum,
          currency: formCurrency,
          weightUnit: formUnit,
          notes: formNotes.trim(),
        });
        showToast(`Added ${formName}`, 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmSingleDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteCounterparty(deleteTarget.id);
      showToast(`Deleted ${deleteTarget.name}`, 'success');
      setDeleteTarget(null);
    } catch {
      showToast('Failed to delete counterparty', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const isIndeterminate = !allVisibleSelected && filtered.some((c) => selectedIds.has(c.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.add(c.id));
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
      await deleteCounterparties(idsArray);
      showToast(`Deleted ${idsArray.length} record${idsArray.length !== 1 ? 's' : ''}`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
    } catch {
      showToast('Failed to delete records', 'error');
    } finally {
      setIsDeletingBulk(false);
    }
  }

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Buyers &amp; Sellers</h1>
          <p className="page-subtitle">
            Manage your customer and dealer directory, saved pricing, and quick trade defaults
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <IconPlus size={15} />
            <span>Add Buyer / Seller</span>
          </button>
        </div>
      </div>

      {/* ── Summary Counters (3-Column Grid matching Dashboard) ── */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Directory</span>
            <div className="stat-icon-badge">
              <IconUsers size={14} />
            </div>
          </div>
          <div className="stat-value">{counts.all}</div>
          <div className="stat-sub">Registered counterparties</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Buyers</span>
            <div className="stat-icon-badge">
              <IconArrowDownLeft size={14} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#0369a1' }}>{counts.buyers}</div>
          <div className="stat-sub">Sell-to customers</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Sellers / Dealers</span>
            <div className="stat-icon-badge">
              <IconArrowUpRight size={14} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--gold-600)' }}>{counts.sellers}</div>
          <div className="stat-sub">Buy-from dealers</div>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="filter-panel" style={{ marginBottom: 20 }}>
        <div className="filter-search-row">
          <div className="filter-search-wrap">
            <IconSearch size={15} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by name, notes, or currency…"
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
          <div className="filter-group">
            <span className="filter-group-label">Role</span>
            <div className="type-pill-group">
              <button
                type="button"
                className={`type-pill ${typeFilter === 'all' ? 'type-pill-active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                All ({counts.all})
              </button>
              <button
                type="button"
                className={`type-pill ${typeFilter === 'buyer' ? 'type-pill-active' : ''}`}
                onClick={() => setTypeFilter('buyer')}
              >
                Buyers ({counts.buyers})
              </button>
              <button
                type="button"
                className={`type-pill ${typeFilter === 'seller' ? 'type-pill-active' : ''}`}
                onClick={() => setTypeFilter('seller')}
              >
                Sellers ({counts.sellers})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Directory Table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Contact Directory</span>
          <span className="card-header-meta">
            Showing {filtered.length} of {counterparties.length}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading directory…
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 20px' }}>
            <div className="empty-state-icon">
              <IconUsers size={34} />
            </div>
            <div className="empty-state-title">
              {counterparties.length === 0 ? 'No buyers or sellers yet' : 'No matching records found'}
            </div>
            <div className="empty-state-text">
              {counterparties.length === 0
                ? 'When you record transactions with a buyer or seller, they are automatically saved here with their rate.'
                : 'Try adjusting your search query or role filter.'}
            </div>
            {counterparties.length === 0 && (
              <button type="button" className="btn btn-primary" onClick={openAddModal}>
                <IconPlus size={15} />
                <span>Add First Buyer / Seller</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
              <div className="bulk-action-bar" style={{ margin: '14px 16px' }}>
                <div className="bulk-action-info">
                  <span className="bulk-action-count">{selectedIds.size}</span>
                  <span>
                    {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
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
                      onClick={() => setSelectedIds(new Set(filtered.map((c) => c.id)))}
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

            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
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
                        aria-label="Select all buyers and sellers"
                      />
                    </th>
                    <th>Name</th>
                    <th>Role</th>
                    <th className="num-col">Saved Price</th>
                    <th>Currency</th>
                    <th>Notes</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((party) => (
                    <tr key={party.id} className={selectedIds.has(party.id) ? 'row-selected' : ''}>
                      <td className="table-checkbox-cell" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="table-checkbox"
                          checked={selectedIds.has(party.id)}
                          onChange={() => toggleSelect(party.id)}
                          aria-label={`Select ${party.name}`}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            className="party-avatar"
                            style={{
                              background:
                                party.type === 'seller'
                                  ? '#fef3c7'
                                  : party.type === 'buyer'
                                  ? '#eff6ff'
                                  : '#f5f5f4',
                              color:
                                party.type === 'seller'
                                  ? '#b45309'
                                  : party.type === 'buyer'
                                  ? '#0369a1'
                                  : '#44403c',
                              borderColor:
                                party.type === 'seller'
                                  ? '#fde68a'
                                  : party.type === 'buyer'
                                  ? '#bfdbfe'
                                  : '#e7e5e4',
                            }}
                          >
                            {party.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{party.name}</div>
                            {party.lastUsedAt && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Last active: {new Date(party.lastUsedAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className="role-pill"
                          style={{
                            background:
                              party.type === 'seller'
                                ? '#fffbeb'
                                : party.type === 'buyer'
                                ? '#eff6ff'
                                : '#f5f5f4',
                            color:
                              party.type === 'seller'
                                ? '#b45309'
                                : party.type === 'buyer'
                                ? '#0369a1'
                                : '#44403c',
                            borderColor:
                              party.type === 'seller'
                                ? '#fde68a'
                                : party.type === 'buyer'
                                ? '#bfdbfe'
                                : '#d6d3d1',
                          }}
                        >
                          {party.type === 'both' ? 'Buyer & Seller' : party.type}
                        </span>
                      </td>

                      <td className="num-col">
                        <div style={{ fontWeight: 700, color: 'var(--gold-600)', fontSize: 14 }}>
                          {formatCurrency(party.defaultPrice, party.currency)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          per {party.weightUnit || 'gram'}
                        </div>
                      </td>

                      <td>
                        <span className="purity-tag">
                          {party.currency} ({getCurrencySymbol(party.currency)})
                        </span>
                      </td>

                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {party.notes ? (
                          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{party.notes}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon-only"
                            onClick={() => openEditModal(party)}
                            title="Edit contact"
                            aria-label={`Edit ${party.name}`}
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-icon-only"
                            onClick={() => setDeleteTarget({ id: party.id, name: party.name })}
                            disabled={deletingId === party.id}
                            title="Delete contact"
                            aria-label={`Delete ${party.name}`}
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
      </div>

      {/* ── Add / Edit Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingParty ? `Edit ${editingParty.name}` : 'Add Buyer / Seller'}
              </h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <IconX size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">
                    Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Tanishq, Local Dealer, John Doe"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    autoFocus
                  />
                  {formErrors.name && <span className="form-error">{formErrors.name}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Role / Category <span className="required">*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <button
                      type="button"
                      className={`type-pill ${formType === 'buyer' ? 'type-pill-active' : ''}`}
                      onClick={() => setFormType('buyer')}
                      style={{ padding: '8px 4px', textAlign: 'center', border: '1px solid var(--border)' }}
                    >
                      Buyer
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${formType === 'seller' ? 'type-pill-active' : ''}`}
                      onClick={() => setFormType('seller')}
                      style={{ padding: '8px 4px', textAlign: 'center', border: '1px solid var(--border)' }}
                    >
                      Seller
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${formType === 'both' ? 'type-pill-active' : ''}`}
                      onClick={() => setFormType('both')}
                      style={{ padding: '8px 4px', textAlign: 'center', border: '1px solid var(--border)' }}
                    >
                      Both
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">
                      Default Price <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="e.g. 7500"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                    />
                    {formErrors.price && <span className="form-error">{formErrors.price}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Currency <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value)}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select
                      className="form-select"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value as WeightUnit)}
                    >
                      <option value="gram">Gram</option>
                      <option value="tola">Tola</option>
                      <option value="troy_oz">Troy oz</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Payment terms, bank details, delivery location…"
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingParty ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Delete Confirm Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !deletingId) setDeleteTarget(null); }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">Confirm Delete</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!!deletingId} onClick={() => setDeleteTarget(null)} aria-label="Close modal">
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong> from your directory? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" disabled={!!deletingId} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" disabled={!!deletingId} onClick={confirmSingleDelete}>
                <IconTrash size={14} />
                <span>{deletingId ? 'Deleting…' : 'Delete'}</span>
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
                Delete {selectedIds.size} Contact{selectedIds.size !== 1 ? 's' : ''}
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
                  {selectedIds.size} selected record{selectedIds.size !== 1 ? 's' : ''}
                </strong>{' '}
                from your buyers &amp; sellers directory? This action cannot be undone.
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
