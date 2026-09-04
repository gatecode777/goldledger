'use client';

import { useState } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/formatters';
import { CURRENCIES } from '@/lib/currencies';

export default function SettingsPage() {
  const { rateSettings, updateRateSettings, transactions, loading } = useTransactions();
  const { showToast } = useToast();

  const [rateInput, setRateInput] = useState(String(rateSettings?.referenceRateUSD ?? ''));
  const [showClear, setShowClear] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveRate() {
    const v = parseFloat(rateInput);
    if (isNaN(v) || v <= 0) {
      showToast('Please enter a valid positive rate', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateRateSettings({ referenceRateUSD: v, lastUpdated: new Date().toISOString() });
      showToast(`Reference rate updated to $${v.toLocaleString()}/troy oz`, 'success');
    } catch {
      showToast('Failed to save rate. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const rate = parseFloat(rateInput) || rateSettings?.referenceRateUSD || 0;

  // Show equivalent rates in other currencies
  const conversionExamples = [
    { code: 'AED', unit: 'gram' },
    { code: 'INR', unit: 'gram' },
    { code: 'SAR', unit: 'tola' },
    { code: 'GBP', unit: 'troy oz' },
    { code: 'EUR', unit: 'troy oz' },
  ];

  function rateInCurrency(targetCode: string, per: string): string {
    const info = CURRENCIES.find((c) => c.code === targetCode);
    if (!info) return '—';
    let usdPer: number;
    if (per === 'gram')      usdPer = rate / 31.1035;
    else if (per === 'tola') usdPer = (rate / 31.1035) * 11.6638;
    else                     usdPer = rate;
    const converted = usdPer * info.rateToUSD;
    return `${info.symbol} ${converted.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="page-spinner" />
        <p>Loading settings…</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gold Rate Settings</h1>
          <p className="page-subtitle">
            Set the day&apos;s reference rate — saved to database and used to pre-fill new transactions
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Main settings */}
        <div>
          {/* Reference Rate */}
          <div className="settings-section">
            <div className="settings-section-title">📊 Reference Gold Rate</div>

            <div style={{ padding: '24px 22px' }}>
              <div style={{ marginBottom: 20 }}>
                <label className="form-label">
                  Spot Rate (USD per troy ounce)
                </label>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{
                      position: 'absolute', left: 14, top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-gold)', fontWeight: 700,
                    }}>$</span>
                    <input
                      id="rate-input"
                      type="number"
                      className="form-input"
                      style={{ paddingLeft: 28 }}
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      step="0.01"
                      min="0"
                      placeholder="e.g. 2355.00"
                    />
                  </div>
                  <button className="btn btn-primary" onClick={saveRate} disabled={saving}>
                    {saving ? '⏳ Saving…' : '💾 Save Rate'}
                  </button>
                </div>
                {rateSettings?.lastUpdated && (
                  <div className="form-hint" style={{ marginTop: 6 }}>
                    Last updated: {formatDate(rateSettings.lastUpdated)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Currency conversions */}
          <div className="settings-section">
            <div className="settings-section-title">💱 Equivalent Rates (live preview)</div>
            {conversionExamples.map(({ code, unit }) => (
              <div key={`${code}-${unit}`} className="settings-row">
                <div>
                  <div className="settings-row-label">{code} per {unit}</div>
                  <div className="settings-row-desc">
                    {CURRENCIES.find((c) => c.code === code)?.name}
                  </div>
                </div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-gold)' }}>
                  {rateInCurrency(code, unit)}
                </div>
              </div>
            ))}
          </div>

          {/* Danger zone */}
          <div className="settings-section" style={{ borderColor: 'rgba(248,113,113,0.2)' }}>
            <div className="settings-section-title" style={{ color: 'var(--text-danger)' }}>
              ⚠️ Danger Zone
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Delete All Transactions</div>
                <div className="settings-row-desc">
                  Permanently removes all {transactions.length} transactions from the database. This cannot be undone.
                </div>
              </div>
              <button
                id="reset-data-btn"
                className="btn btn-danger"
                onClick={() => setShowClear(true)}
              >
                🗑️ Delete All
              </button>
            </div>
          </div>
        </div>

        {/* Side info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current rate card */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Active Reference Rate
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 40, fontWeight: 800, color: '#b45309' }}>
                ${rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                USD per troy ounce (999 fine)
              </div>
              <div className="divider" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'left' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Per gram (24K)</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${(rate / 31.1035).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Per tola (24K)</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${((rate / 31.1035) * 11.6638).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>22K per gram</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${((rate / 31.1035) * 0.9167).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>18K per gram</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${((rate / 31.1035) * 0.75).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📋 Database Stats</span>
            </div>
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total transactions</span>
                <span style={{ fontWeight: 700, color: 'var(--text-gold)' }}>{transactions.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manual entries</span>
                <span style={{ fontWeight: 600 }}>{transactions.filter((t) => t.source === 'manual').length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>AI scan entries</span>
                <span style={{ fontWeight: 600 }}>{transactions.filter((t) => t.source === 'scan').length}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <div className="card-body" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 13, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>
                💡 How Rate Is Used
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                This rate pre-fills the &ldquo;Market Rate&rdquo; field in new transactions and drives the estimated portfolio value on the dashboard. It is persisted to the database — set it each day.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {showClear && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowClear(false); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">🗑️ Delete All Transactions</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowClear(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                This will permanently delete all{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                </strong>{' '}
                from the MongoDB database. <strong>This cannot be undone.</strong>
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClear(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  // Delete all transactions one by one via API
                  // In production, add a bulk-delete endpoint
                  for (const tx of transactions) {
                    await fetch(`/api/transactions/${tx.id}`, { method: 'DELETE' });
                  }
                  showToast('All transactions deleted from database', 'error');
                  setShowClear(false);
                  window.location.reload();
                }}
              >
                🗑️ Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
