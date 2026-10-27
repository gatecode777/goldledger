'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/formatters';
import { CURRENCIES, getCurrencySymbol } from '@/lib/currencies';
import type { CountryGoldRate, LiveRatesResponse } from '@/app/api/live-rates/route';

export default function SettingsPage() {
  const {
    rateSettings,
    updateRateSettings,
    transactions,
    loading,
    globalCurrency,
    setGlobalCurrency,
  } = useTransactions();
  const { showToast } = useToast();

  const [rateInput, setRateInput] = useState(String(rateSettings?.referenceRateUSD ?? ''));
  const [showClear, setShowClear] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Live International Gold Rates State ─────────────────────────────────────
  const [liveData, setLiveData] = useState<LiveRatesResponse | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<'all' | 'gram' | 'oz'>('all');

  const fetchLiveRates = useCallback(async (refresh = false) => {
    if (refresh) setLiveRefreshing(true);
    else setLiveLoading(true);
    setLiveError(null);

    try {
      const res = await fetch(`/api/live-rates${refresh ? '?refresh=true' : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveRatesResponse = await res.json();
      setLiveData(data);
      if (refresh) {
        showToast('Live international gold rates updated!', 'success');
      }
    } catch (err: any) {
      console.error('[Settings] Failed to fetch live gold rates:', err);
      setLiveError(err?.message || 'Failed to fetch live rates');
      if (refresh) {
        showToast('Could not refresh live rates. Using cached data.', 'error');
      }
    } finally {
      setLiveLoading(false);
      setLiveRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchLiveRates(false);
  }, [fetchLiveRates]);

  async function applyLiveUSDRate(spotRateUSD: number) {
    const formatted = spotRateUSD.toFixed(2);
    setRateInput(formatted);
    setSaving(true);
    try {
      await updateRateSettings({
        referenceRateUSD: parseFloat(formatted),
        lastUpdated: new Date().toISOString(),
      });
      showToast(`Applied live spot rate ($${parseFloat(formatted).toLocaleString()}/oz) to Reference Rate!`, 'success');
    } catch {
      showToast('Failed to save rate to settings', 'error');
    } finally {
      setSaving(false);
    }
  }

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
            Live international market rates and reference rate configuration for new transactions
          </p>
        </div>
        <div className="global-currency-badge" title="Change global display currency across entire project">
          <label>Display Currency:</label>
          <select
            className="global-currency-select"
            value={globalCurrency}
            onChange={(e) => {
              setGlobalCurrency(e.target.value);
              showToast(`Global currency changed to ${e.target.value}`, 'success');
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 1. Live International Gold Rates Section (Full Width) ── */}
      <div className="live-rates-section">
        <div className="live-rates-header">
          <div className="live-rates-title-group">
            <span className="live-rates-title">
              🌍 Live International Gold Rates
            </span>
            <span className="live-status-pill">
              <span className="live-pulse-dot" />
              {liveRefreshing ? 'Fetching Live Rates…' : 'Free Live API Connected'}
            </span>
            {liveData?.timestamp && (
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Synced: {new Date(liveData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                {liveData.source ? ` · ${liveData.source}` : ''}
              </span>
            )}
            {liveError && (
              <span style={{ fontSize: 11.5, color: 'var(--text-danger)' }}>
                ⚠ {liveError}
              </span>
            )}
          </div>

          <div className="live-rates-actions">
            {/* Unit Filter Switcher */}
            <div className="type-pill-group" style={{ display: 'inline-flex' }}>
              <button
                type="button"
                className={`type-pill ${unitFilter === 'all' ? 'type-pill-active' : ''}`}
                onClick={() => setUnitFilter('all')}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
              >
                All Metrics
              </button>
              <button
                type="button"
                className={`type-pill ${unitFilter === 'gram' ? 'type-pill-active' : ''}`}
                onClick={() => setUnitFilter('gram')}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
              >
                Per Gram (24K)
              </button>
              <button
                type="button"
                className={`type-pill ${unitFilter === 'oz' ? 'type-pill-active' : ''}`}
                onClick={() => setUnitFilter('oz')}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
              >
                Per Troy Oz
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fetchLiveRates(true)}
              disabled={liveRefreshing || liveLoading}
              style={{ fontSize: 12, padding: '5px 12px' }}
              title="Fetch fresh real-time spot gold rates from free API"
            >
              <span style={{
                display: 'inline-block',
                transform: liveRefreshing ? 'rotate(360deg)' : 'none',
                transition: liveRefreshing ? 'transform 1s linear infinite' : 'none',
              }}>
                🔄
              </span>
              {liveRefreshing ? 'Refreshing…' : 'Refresh Rates'}
            </button>
          </div>
        </div>

        {/* Live Rates Country Cards Grid */}
        <div className="live-rates-grid">
          {liveLoading && !liveData ? (
            // Skeleton shimmer loaders
            Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className="live-rate-card" style={{ opacity: 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ width: 120, height: 18, background: '#e5e7eb', borderRadius: 4 }} />
                  <div style={{ width: 50, height: 18, background: '#e5e7eb', borderRadius: 4 }} />
                </div>
                <div style={{ height: 48, background: '#f3f4f6', borderRadius: 4, marginBottom: 12 }} />
                <div style={{ height: 60, background: '#f9fafb', borderRadius: 4 }} />
              </div>
            ))
          ) : (
            liveData?.countries.map((c: CountryGoldRate) => {
              const isUSD = c.code === 'USD';
              const isGlobalSelected = globalCurrency === c.code;

              return (
                <div
                  key={c.code}
                  className={`live-rate-card ${isUSD ? 'highlighted' : ''}`}
                  style={{
                    borderColor: isGlobalSelected ? 'var(--gold-400)' : undefined,
                    boxShadow: isGlobalSelected ? '0 0 0 1px var(--gold-400)' : undefined,
                  }}
                >
                  {/* Card Header */}
                  <div className="live-card-header">
                    <div className="live-card-country">
                      <span className="live-country-flag" role="img" aria-label={c.country}>
                        {c.flag}
                      </span>
                      <div className="live-country-info">
                        <span className="live-country-name">
                          {c.country}
                          {isGlobalSelected && (
                            <span style={{ fontSize: 10, color: 'var(--text-gold)', fontWeight: 700, marginLeft: 6 }}>
                              (Active Currency)
                            </span>
                          )}
                        </span>
                        <span className="live-country-fx">
                          {isUSD
                            ? 'Base Global Benchmark'
                            : `1 USD ≈ ${c.exchangeRateToUSD < 2 ? c.exchangeRateToUSD.toFixed(4) : c.exchangeRateToUSD.toFixed(2)} ${c.code}`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="live-currency-pill"
                      onClick={() => {
                        setGlobalCurrency(c.code);
                        showToast(`Display currency changed to ${c.code}`, 'success');
                      }}
                      title={`Click to set ${c.code} as display currency across app`}
                      style={{ cursor: 'pointer', border: 'none' }}
                    >
                      {c.code} ({c.symbol})
                    </button>
                  </div>

                  {/* Primary Hero Rate */}
                  <div className="live-card-hero-rate">
                    <div>
                      <div className="live-hero-label">
                        {unitFilter === 'oz' ? '24K Spot (Troy Ounce)' : '24K 999 (Per Gram)'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {unitFilter === 'oz' ? '31.1035 grams' : 'Pure Gold · 99.9%'}
                      </div>
                    </div>
                    <div className="live-hero-price">
                      {c.symbol}{' '}
                      {unitFilter === 'oz'
                        ? c.pricePerTroyOz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : c.pricePerGram999.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Purity & Unit Breakdown Chips */}
                  <div className="live-card-variants">
                    {unitFilter !== 'oz' && (
                      <>
                        <div className="live-variant-item">
                          <div className="live-variant-title">24K 995 (per gram)</div>
                          <div className="live-variant-value">
                            {c.symbol} {c.pricePerGram995.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="live-variant-item">
                          <div className="live-variant-title">24K 991 (per gram)</div>
                          <div className="live-variant-value">
                            {c.symbol} {c.pricePerGram991.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </>
                    )}

                    {unitFilter !== 'gram' && (
                      <div className={`live-variant-item ${unitFilter === 'oz' ? 'full-width' : ''}`}>
                        <div className="live-variant-title">Per Troy Ounce (oz)</div>
                        <div className="live-variant-value">
                          {c.symbol} {c.pricePerTroyOz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}

                    {(c.code === 'INR' || c.code === 'AED') && (
                      <div className="live-variant-item">
                        <div className="live-variant-title">Per Tola (11.66g)</div>
                        <div className="live-variant-value">
                          {c.symbol} {c.pricePerTola999.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}

                    {c.code === 'HKD' && c.pricePerTael999 && (
                      <div className="live-variant-item">
                        <div className="live-variant-title">Per Tael (37.43g)</div>
                        <div className="live-variant-value">
                          {c.symbol} {c.pricePerTael999.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="live-card-footer">
                    <span className="live-card-bench">
                      {c.code === 'INR' && '🇮🇳 MCX / Bullion Benchmark'}
                      {c.code === 'AED' && '🇦🇪 Dubai Gold Souk TT Bar'}
                      {c.code === 'ZAR' && '🇿🇦 Rand Refinery Benchmark'}
                      {c.code === 'USD' && '🇺🇸 NYMEX / COMEX Gold Spot'}
                      {c.code === 'HKD' && '🇭🇰 CGSE HK Benchmark'}
                      {c.code === 'EUR' && '🇪🇺 European LBMA Gold'}
                      {c.code === 'CNY' && '🇨🇳 Shanghai Gold Exchange (SGE)'}
                    </span>

                    {isUSD && (
                      <button
                        type="button"
                        className="live-apply-rate-btn"
                        onClick={() => applyLiveUSDRate(c.pricePerTroyOz)}
                        title="Copy this live spot rate to the Reference Gold Rate setting"
                      >
                        ⚡ Use as Reference Rate
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 2. Reference Rate & Configuration Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Main settings column */}
        <div>
          {/* Reference Rate Setting */}
          <div className="settings-section">
            <div className="settings-section-title">📊 Active Reference Gold Rate</div>

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
                    Last saved: {formatDate(rateSettings.lastUpdated)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Global Display Currency Setting */}
          <div className="settings-section" style={{ marginBottom: 20 }}>
            <div className="settings-section-title">🌐 Global Display Currency</div>
            <div style={{ padding: '20px 22px' }}>
              <label className="form-label">
                Default Currency for Dashboard, Transaction Log, and Pre-filled Forms
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <select
                  className="form-select"
                  style={{ maxWidth: 320, fontWeight: 600 }}
                  value={globalCurrency}
                  onChange={(e) => {
                    setGlobalCurrency(e.target.value);
                    showToast(`Global currency updated to ${e.target.value}`, 'success');
                  }}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.symbol} ({c.name})
                    </option>
                  ))}
                </select>
                <span className="form-hint" style={{ marginTop: 0 }}>
                  Symbol: <strong>{getCurrencySymbol(globalCurrency)}</strong>
                </span>
              </div>
              <div className="form-hint" style={{ marginTop: 8 }}>
                Changing this preference immediately converts totals on the Dashboard and Transaction Log, and defaults new vouchers to this currency.
              </div>
            </div>
          </div>

          {/* Equivalent Rates (live preview) */}
          <div className="settings-section">
            <div className="settings-section-title">💱 Saved Reference Rate Equivalents (live preview)</div>
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

        {/* Side info column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current saved rate card */}
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
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>24K 999 per gram</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${(rate / 31.1035).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>24K 995 per gram</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${((rate / 31.1035) * (995 / 999)).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>24K 991 per gram</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${((rate / 31.1035) * (991 / 999)).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Per tola (24K 999)</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${((rate / 31.1035) * 11.6638).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Database Stats Card */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>AI scan entries</span>
                <span style={{ fontWeight: 600 }}>{transactions.filter((t) => t.source === 'scan').length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Excel import entries</span>
                <span style={{ fontWeight: 600 }}>{transactions.filter((t) => t.source === 'import').length}</span>
              </div>
            </div>
          </div>

          {/* How Rate Is Used Card */}
          <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <div className="card-body" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 13, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>
                💡 How Live Rates Work
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Live gold rates are streamed from free financial feeds (Gold-API real-time spot & Open-ER FX). You can monitor international markets across <strong>India, South Africa, UAE, USA, Hong Kong, Europe, and China</strong>, and click <strong>&ldquo;Use as Reference Rate&rdquo;</strong> anytime to lock today&apos;s spot price into your ledger.
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
