'use client';

import React, { useState, useMemo } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { Counterparty, CounterpartyType, WeightUnit } from '@/lib/types';
import { CURRENCIES, getCurrencySymbol } from '@/lib/currencies';
import { formatCurrency } from '@/lib/formatters';
import { useToast } from '@/components/Toast';

export default function CounterpartiesPage() {
  const { counterparties, addCounterparty, updateCounterparty, deleteCounterparty, globalCurrency, loading } = useTransactions();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'buyer' | 'seller' | 'both'>('all');

  // Modal State
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

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtered counterparties
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
        showToast(`Updated ${formName}!`, 'success');
      } else {
        await addCounterparty({
          name: formName.trim(),
          type: formType,
          defaultPrice: priceNum,
          currency: formCurrency,
          weightUnit: formUnit,
          notes: formNotes.trim(),
        });
        showToast(`Added ${formName}!`, 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteCounterparty(id);
      showToast(`Deleted ${name}`, 'success');
    } catch {
      showToast('Failed to delete counterparty', 'error');
    } finally {
      setDeletingId(null);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-primary" onClick={openAddModal}>
            ➕ Add Buyer / Seller
          </button>
        </div>
      </div>

      {/* ── Summary Counters ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-label">Total Directory</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{counts.all}</div>
          <div className="stat-sub">Registered parties</div>
        </div>

        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-label">Buyers</div>
          <div className="stat-value" style={{ fontSize: 24, color: '#0369a1' }}>{counts.buyers}</div>
          <div className="stat-sub">Sell-to customers</div>
        </div>

        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-label">Sellers / Dealers</div>
          <div className="stat-value" style={{ fontSize: 24, color: 'var(--gold-600)' }}>{counts.sellers}</div>
          <div className="stat-sub">Buy-from sources</div>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="filter-panel" style={{ marginBottom: 20 }}>
        <div className="filter-search-row">
          <div className="filter-search-wrap">
            <svg className="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by name, notes, currency…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="filter-clear-x" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        <div className="filter-controls-row">
          <div className="filter-group">
            <span className="filter-group-label">Role</span>
            <div className="type-pill-group">
              <button
                className={`type-pill ${typeFilter === 'all' ? 'type-pill-active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                All ({counts.all})
              </button>
              <button
                className={`type-pill ${typeFilter === 'buyer' ? 'type-pill-active' : ''}`}
                onClick={() => setTypeFilter('buyer')}
              >
                Buyers ({counts.buyers})
              </button>
              <button
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
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">👥 Contact Directory</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {filtered.length} of {counterparties.length}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading directory…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>👥</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: 'var(--text-primary)' }}>
              {counterparties.length === 0 ? 'No buyers or sellers yet' : 'No matching records found'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 440, margin: '4px auto 16px' }}>
              {counterparties.length === 0
                ? 'When you create transactions with a buyer or seller, they will be automatically saved here with their price. You can also add them manually.'
                : 'Try adjusting your search query or role filter.'}
            </p>
            {counterparties.length === 0 && (
              <button className="btn btn-primary" onClick={openAddModal}>
                ➕ Add First Buyer / Seller
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Saved Price</th>
                  <th>Currency</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((party) => (
                  <tr key={party.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 'var(--radius-sm)',
                          background: party.type === 'seller' ? '#fef3c7' : party.type === 'buyer' ? '#e0f2fe' : '#f3f4f6',
                          color: party.type === 'seller' ? '#b45309' : party.type === 'buyer' ? '#0369a1' : '#4b5563',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                        }}>
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
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        borderRadius: 'var(--radius-sm)',
                        background: party.type === 'seller' ? '#fef3c7' : party.type === 'buyer' ? '#e0f2fe' : '#f3e8ff',
                        color: party.type === 'seller' ? '#b45309' : party.type === 'buyer' ? '#0369a1' : '#7e22ce',
                        border: `1px solid ${party.type === 'seller' ? '#fde68a' : party.type === 'buyer' ? '#bae6fd' : '#e9d5ff'}`,
                      }}>
                        {party.type === 'both' ? 'Buyer & Seller' : party.type}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--gold-600)', fontSize: 14 }}>
                        {formatCurrency(party.defaultPrice, party.currency)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        per {party.weightUnit || 'g'}
                      </div>
                    </td>

                    <td>
                      <span className="purity-tag" style={{ fontSize: 11 }}>
                        {party.currency} ({getCurrencySymbol(party.currency)})
                      </span>
                    </td>

                    <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {party.notes ? (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{party.notes}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => openEditModal(party)}
                          title="Edit name, price, role"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 12, color: '#dc2626' }}
                          onClick={() => handleDelete(party.id, party.name)}
                          disabled={deletingId === party.id}
                          title="Delete counterparty"
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
      </div>

      {/* ── Add / Edit Modal ── */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingParty ? `✏️ Edit: ${editingParty.name}` : '➕ Add Buyer / Seller'}
              </h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Name */}
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

                {/* Role / Type */}
                <div className="form-group">
                  <label className="form-label">Role / Category <span className="required">*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <button
                      type="button"
                      className={`type-pill ${formType === 'buyer' ? 'type-pill-active' : ''}`}
                      onClick={() => setFormType('buyer')}
                      style={{ padding: '8px 4px', textAlign: 'center' }}
                    >
                      Buyer
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${formType === 'seller' ? 'type-pill-active' : ''}`}
                      onClick={() => setFormType('seller')}
                      style={{ padding: '8px 4px', textAlign: 'center' }}
                    >
                      Seller / Dealer
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${formType === 'both' ? 'type-pill-active' : ''}`}
                      onClick={() => setFormType('both')}
                      style={{ padding: '8px 4px', textAlign: 'center' }}
                    >
                      Both
                    </button>
                  </div>
                </div>

                {/* Default Price + Currency + Unit */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Default Price <span className="required">*</span></label>
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
                    <label className="form-label">Currency <span className="required">*</span></label>
                    <select
                      className="form-select"
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value)}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
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

                {/* Notes */}
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : editingParty ? 'Save Changes' : 'Add Buyer / Seller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
