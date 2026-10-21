'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction, TransactionType, Purity, WeightUnit, TransactionSource } from '@/lib/types';
import { CURRENCIES } from '@/lib/currencies';
import { useTransactions } from '@/context/TransactionContext';
import { useToast } from '@/components/Toast';
import { weightToGrams } from '@/lib/formatters';

interface TransactionFormProps {
  initialValues?: Partial<Transaction>;
  lowConfidenceFields?: string[];
  editId?: string;
  source?: TransactionSource;
  onCancel?: () => void;
  /** When true, renders the full tally-voucher layout (new transaction page).
   *  When false (default), renders a compact layout for modals / edit flows. */
  voucherMode?: boolean;
}

const PURITIES: { value: Purity; label: string; sub: string }[] = [
  { value: '24K', label: '24K', sub: '999' },
  { value: '22K', label: '22K', sub: '916' },
  { value: '21K', label: '21K', sub: '875' },
  { value: '18K', label: '18K', sub: '750' },
  { value: '14K', label: '14K', sub: '583' },
  { value: 'custom', label: 'Custom', sub: '…' },
];

const WEIGHT_UNITS: { value: WeightUnit; label: string; short: string }[] = [
  { value: 'gram',    label: 'Gram',      short: 'g'   },
  { value: 'tola',   label: 'Tola',       short: 'tola'},
  { value: 'troy_oz',label: 'Troy oz',    short: 'ozt' },
];

function getNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type SuccessPayload = {
  type: TransactionType;
  purity: Purity;
  customPurity: string;
  weightUnit: WeightUnit;
  currency: string;
  counterparty: string;
  marketRate: string;
  totalValue: number;
};

export default function TransactionForm({
  initialValues,
  lowConfidenceFields = [],
  editId,
  source = 'manual',
  onCancel,
  voucherMode = false,
}: TransactionFormProps) {
  const router = useRouter();
  const { addTransaction, updateTransaction, rateSettings } = useTransactions();
  const { showToast } = useToast();
  const counterpartyRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const referenceRate = rateSettings?.referenceRateUSD ?? 2355;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [type, setType]               = useState<TransactionType>(initialValues?.type ?? 'buy');
  const [goldPrice, setGoldPrice]     = useState(String(initialValues?.goldPricePerUnit ?? referenceRate));
  const [marketRate, setMarketRate]   = useState(String(initialValues?.marketRate ?? referenceRate));
  const [purity, setPurity]           = useState<Purity>(initialValues?.purity ?? '22K');
  const [customPurity, setCustomPurity] = useState(initialValues?.customPurity ?? '');
  const [weight, setWeight]           = useState(String(initialValues?.weight ?? ''));
  const [weightUnit, setWeightUnit]   = useState<WeightUnit>(initialValues?.weightUnit ?? 'gram');
  const [dateTime, setDateTime]       = useState(
    initialValues?.dateTime ? initialValues.dateTime.slice(0, 16) : getNow()
  );
  const [currency, setCurrency]       = useState(initialValues?.currency ?? 'USD');
  const [counterparty, setCounterparty] = useState(initialValues?.counterparty ?? '');
  const [notes, setNotes]             = useState(initialValues?.notes ?? '');
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [successPayload, setSuccessPayload] = useState<SuccessPayload | null>(null);

  // ── Sync reference rate ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialValues?.marketRate && rateSettings) {
      setMarketRate(String(rateSettings.referenceRateUSD));
    }
    if (!initialValues?.goldPricePerUnit && rateSettings) {
      setGoldPrice(String(rateSettings.referenceRateUSD));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateSettings?.referenceRateUSD]);

  // ── Auto-focus counterparty in voucher mode ──────────────────────────────────
  useEffect(() => {
    if (voucherMode && counterpartyRef.current) {
      counterpartyRef.current.focus();
    }
  }, [voucherMode]);

  // ── Keyboard shortcuts (B / S / Ctrl+Enter / Escape) ───────────────────────
  // Use a ref for successPayload so the keyboard handler never needs to
  // be re-registered when it changes — avoids unnecessary listener churn.
  const successPayloadRef = useRef(successPayload);
  useEffect(() => { successPayloadRef.current = successPayload; }, [successPayload]);

  const handleKeyboard = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    const isInput = tag === 'input' || tag === 'select' || tag === 'textarea';

    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }

    if (e.key === 'Escape' && !successPayloadRef.current) {
      if (onCancel) onCancel();
      else router.push('/transactions');
      return;
    }

    // B / S only when NOT inside an input
    if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 'b' || e.key === 'B') { setType('buy');  e.preventDefault(); }
      if (e.key === 's' || e.key === 'S') { setType('sell'); e.preventDefault(); }
    }
  }, [onCancel, router]);

  useEffect(() => {
    if (!voucherMode) return;
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [voucherMode, handleKeyboard]);

  // ── Computed values (memoized — only recomputed when specific inputs change) ──
  const isLowConf = useCallback((field: string) => lowConfidenceFields.includes(field), [lowConfidenceFields]);

  const totalValue = useMemo(() => {
    const p = parseFloat(goldPrice);
    const w = parseFloat(weight);
    if (isNaN(p) || isNaN(w) || p <= 0 || w <= 0) return null;
    return p * w;
  }, [goldPrice, weight]);

  const weightGrams = useMemo(() => {
    const w = parseFloat(weight);
    if (isNaN(w)) return null;
    return weightToGrams(w, weightUnit);
  }, [weight, weightUnit]);

  const currencyInfo = useMemo(
    () => CURRENCIES.find((c) => c.code === currency),
    [currency]
  );

  const unitShort = useMemo(
    () => WEIGHT_UNITS.find(u => u.value === weightUnit)?.short ?? weightUnit,
    [weightUnit]
  );

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!weight || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0)
      e.weight = 'Enter a positive weight';
    if (!goldPrice || isNaN(parseFloat(goldPrice)) || parseFloat(goldPrice) <= 0)
      e.goldPrice = 'Enter a positive price';
    if (!marketRate || isNaN(parseFloat(marketRate)) || parseFloat(marketRate) <= 0)
      e.marketRate = 'Enter a positive market rate';
    if (purity === 'custom' && !customPurity.trim())
      e.customPurity = 'Specify custom purity';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const txData = {
      type,
      goldPricePerUnit: parseFloat(goldPrice),
      marketRate: parseFloat(marketRate),
      purity,
      customPurity: purity === 'custom' ? customPurity : undefined,
      weight: parseFloat(weight),
      weightUnit,
      dateTime: new Date(dateTime).toISOString(),
      currency,
      counterparty: counterparty.trim(),
      notes: notes.trim(),
      source,
      totalValue: totalValue ?? 0,
      lowConfidenceFields: lowConfidenceFields.length > 0 ? lowConfidenceFields : undefined,
    };

    try {
      if (editId) {
        await updateTransaction(editId, txData);
        showToast('Transaction updated successfully', 'success');
        if (onCancel) onCancel();
        else router.push('/transactions');
      } else {
        await addTransaction(txData);
        showToast('Transaction recorded successfully', 'success');
        if (voucherMode) {
          // Show success state instead of redirecting
          setSuccessPayload({
            type,
            purity,
            customPurity,
            weightUnit,
            currency,
            counterparty,
            marketRate,
            totalValue: totalValue ?? 0,
          });
        } else {
          router.push('/transactions');
        }
      }
    } catch {
      showToast('Failed to save transaction. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── "New Similar" — keeps purity, unit, currency, counterparty, market rate ─
  function handleNewSimilar() {
    if (!successPayload) return;
    setType(successPayload.type);
    setPurity(successPayload.purity);
    setCustomPurity(successPayload.customPurity);
    setWeightUnit(successPayload.weightUnit);
    setCurrency(successPayload.currency);
    setCounterparty(successPayload.counterparty);
    setMarketRate(successPayload.marketRate);
    setGoldPrice(String(referenceRate));
    setWeight('');
    setNotes('');
    setDateTime(getNow());
    setErrors({});
    setSuccessPayload(null);
    setTimeout(() => counterpartyRef.current?.focus(), 50);
  }

  // ── "New Transaction" — full reset ──────────────────────────────────────────
  function handleNewTransaction() {
    setType('buy');
    setPurity('22K');
    setCustomPurity('');
    setWeightUnit('gram');
    setCurrency('USD');
    setCounterparty('');
    setMarketRate(String(referenceRate));
    setGoldPrice(String(referenceRate));
    setWeight('');
    setNotes('');
    setDateTime(getNow());
    setErrors({});
    setSuccessPayload(null);
    setTimeout(() => counterpartyRef.current?.focus(), 50);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── Voucher Mode Render ──────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  if (voucherMode) {
    // ── Success State ──────────────────────────────────────────────────────────
    if (successPayload) {
      return (
        <div className={`voucher-panel mode-${successPayload.type}`}>
          <div className="voucher-success">
            <div className="voucher-success-icon">
              {successPayload.type === 'buy' ? '🟢' : '🔴'}
            </div>
            <div className="voucher-success-title">
              {successPayload.type === 'buy' ? 'Buy' : 'Sell'} recorded!
            </div>
            <div className="voucher-success-sub">
              {currencyInfo?.symbol ?? currency}{' '}
              {successPayload.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' '}· {successPayload.purity === 'custom' ? successPayload.customPurity : successPayload.purity}
              {' '}· {successPayload.currency}
            </div>
            <div className="voucher-success-actions">
              <button
                type="button"
                className="btn btn-lg btn-success-primary"
                onClick={handleNewSimilar}
                autoFocus
              >
                ⚡ New Similar
                <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 4 }}>
                  (same {successPayload.purity}, {successPayload.currency})
                </span>
              </button>
              <button
                type="button"
                className="btn btn-lg btn-secondary"
                onClick={handleNewTransaction}
              >
                ✚ New Transaction
              </button>
              <button
                type="button"
                className="btn btn-lg btn-ghost"
                onClick={() => router.push('/transactions')}
              >
                📋 View Ledger
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Voucher Form ───────────────────────────────────────────────────────────
    return (
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        <div className={`voucher-panel mode-${type}`}>


          {/* ── Header: Buy/Sell toggle + Date ── */}
          <div className={`voucher-header mode-${type}`}>
            <div className="tx-type-switcher">
              <button
                type="button"
                className={`tx-type-btn ${type === 'buy' ? 'active-buy' : ''}`}
                onClick={() => setType('buy')}
                tabIndex={-1}
              >
                ▲ Buy
                <span className="kbd-hint">B</span>
              </button>
              <button
                type="button"
                className={`tx-type-btn ${type === 'sell' ? 'active-sell' : ''}`}
                onClick={() => setType('sell')}
                tabIndex={-1}
              >
                ▼ Sell
                <span className="kbd-hint">S</span>
              </button>
            </div>

            <div className="voucher-date-group">
              <span className="voucher-date-label">Date</span>
              <input
                type="datetime-local"
                className={`voucher-date-input ${isLowConf('dateTime') ? 'low-conf' : ''}`}
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                tabIndex={7}
              />
            </div>
          </div>

          <div className="voucher-body">

            {/* ── Section 1: Counterparty + Purity ── */}
            <div className="voucher-section">
              <div className="voucher-field-row">
                {/* Counterparty */}
                <div className="voucher-field">
                  <label className="voucher-label">
                    Counterparty / Dealer
                  </label>
                  <input
                    ref={counterpartyRef}
                    type="text"
                    className="voucher-input"
                    placeholder="e.g. Tanishq, Local Market, Dubai Gold Souk…"
                    value={counterparty}
                    onChange={(e) => setCounterparty(e.target.value)}
                    tabIndex={1}
                  />
                </div>

                {/* Currency */}
                <div className="voucher-field" style={{ maxWidth: 180 }}>
                  <label className="voucher-label">
                    Currency <span className="required">*</span>
                  </label>
                  <select
                    className="voucher-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    tabIndex={2}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.symbol}
                      </option>
                    ))}
                  </select>
                  {currencyInfo && (
                    <span className="voucher-hint">1 USD = {currencyInfo.rateToUSD} {currency}</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 2: Purity pills ── */}
            <div className="voucher-section">
              <div className="voucher-label" style={{ marginBottom: 10 }}>
                Purity / Karat <span className="required">*</span>
                {isLowConf('purity') && <span className="low-conf-tag">⚠ Low confidence</span>}
              </div>
              <div className="purity-pills">
                {PURITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`purity-pill ${purity === p.value ? 'active' : ''}`}
                    onClick={() => setPurity(p.value as Purity)}
                    tabIndex={-1}
                    title={p.value !== 'custom' ? `${p.label} = ${p.sub} fine` : 'Custom purity'}
                  >
                    {p.label}
                    {p.value !== 'custom' && (
                      <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.65, marginLeft: 3 }}>
                        {p.sub}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {purity === 'custom' && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    className="purity-custom-input"
                    placeholder='e.g. "20K" or "800 fine"'
                    value={customPurity}
                    onChange={(e) => setCustomPurity(e.target.value)}
                    autoFocus
                    tabIndex={3}
                  />
                  {errors.customPurity && (
                    <div className="voucher-error" style={{ marginTop: 4 }}>{errors.customPurity}</div>
                  )}
                </div>
              )}
            </div>

            {/* ── Section 3: Weight + Price + Market Rate ── */}
            <div className="voucher-section">
              <div className="voucher-field-row">

                {/* Weight */}
                <div className="voucher-field">
                  <label className="voucher-label">
                    Weight <span className="required">*</span>
                    {isLowConf('weight') && <span className="low-conf-tag">⚠</span>}
                  </label>
                  <input
                    type="number"
                    className={`voucher-input ${isLowConf('weight') ? 'low-conf' : ''} ${errors.weight ? 'has-error' : ''}`}
                    placeholder="0.000"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    step="0.001"
                    min="0"
                    tabIndex={4}
                    style={{ fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 600 }}
                  />
                  {errors.weight && <span className="voucher-error">{errors.weight}</span>}
                  {weightGrams !== null && weightUnit !== 'gram' && (
                    <span className="voucher-hint">≈ {weightGrams.toFixed(3)} g</span>
                  )}
                </div>

                {/* Weight unit tabs */}
                <div className="voucher-field w-auto" style={{ paddingTop: 22 }}>
                  <div className="unit-tabs">
                    {WEIGHT_UNITS.map((u) => (
                      <button
                        key={u.value}
                        type="button"
                        className={`unit-tab ${weightUnit === u.value ? 'active' : ''}`}
                        onClick={() => setWeightUnit(u.value)}
                        tabIndex={-1}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price per unit */}
                <div className="voucher-field">
                  <label className="voucher-label">
                    Price / {unitShort} <span className="required">*</span>
                    {isLowConf('goldPricePerUnit') && <span className="low-conf-tag">⚠</span>}
                  </label>
                  <input
                    type="number"
                    className={`voucher-input ${isLowConf('goldPricePerUnit') ? 'low-conf' : ''} ${errors.goldPrice ? 'has-error' : ''}`}
                    placeholder={`e.g. ${referenceRate}`}
                    value={goldPrice}
                    onChange={(e) => setGoldPrice(e.target.value)}
                    step="0.01"
                    min="0"
                    tabIndex={5}
                    style={{ fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 600 }}
                  />
                  {errors.goldPrice && <span className="voucher-error">{errors.goldPrice}</span>}
                  <span className="voucher-hint">{currency} per {unitShort}</span>
                </div>
              </div>
            </div>

            {/* ── Section 4: Notes + Advanced ── */}
            <div className="voucher-section">
              <div className="voucher-field-row" style={{ alignItems: 'flex-start' }}>
                {/* Notes */}
                <div className="voucher-field">
                  <label className="voucher-label">Notes</label>
                  <input
                    type="text"
                    className="voucher-input"
                    placeholder="Bill no., lot info, remarks…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    tabIndex={6}
                  />
                </div>

                {/* Advanced toggle: Market rate */}
                <div className="voucher-field w-auto" style={{ minWidth: 220 }}>
                  <button
                    type="button"
                    className={`advanced-toggle ${showAdvanced ? 'open' : ''}`}
                    onClick={() => setShowAdvanced(v => !v)}
                    tabIndex={-1}
                    style={{ marginBottom: 6, marginTop: 1 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                    Market Rate (USD)
                  </button>
                  {showAdvanced && (
                    <div>
                      <input
                        type="number"
                        className={`voucher-input ${isLowConf('marketRate') ? 'low-conf' : ''} ${errors.marketRate ? 'has-error' : ''}`}
                        placeholder="e.g. 2355.00"
                        value={marketRate}
                        onChange={(e) => setMarketRate(e.target.value)}
                        step="0.01"
                        min="0"
                        tabIndex={8}
                      />
                      {errors.marketRate && <span className="voucher-error">{errors.marketRate}</span>}
                      <span className="voucher-hint">USD/troy oz reference</span>
                    </div>
                  )}
                  {!showAdvanced && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 6 }}>
                      ${parseFloat(marketRate || '0').toLocaleString()} / ozt
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>{/* end voucher-body */}

          {/* ── Live Total Bar ── */}
          <div className={`tx-total-bar ${totalValue !== null ? `mode-${type}` : 'empty'}`}>
            <div className="tx-total-left">
              <div className={`tx-total-label ${totalValue !== null ? `mode-${type}` : ''}`}>
                {type === 'buy' ? '▲ BUYING' : '▼ SELLING'} · TOTAL
              </div>
              <div className={`tx-total-amount ${totalValue !== null ? `mode-${type}` : 'empty'}`}>
                {totalValue !== null
                  ? `${currencyInfo?.symbol ?? currency} ${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'Enter weight & price'
                }
              </div>
            </div>
            {totalValue !== null && (
              <div className="tx-total-right">
                <div>{parseFloat(weight || '0').toLocaleString()} {unitShort}</div>
                <div className="breakdown">
                  @ {currencyInfo?.symbol}{parseFloat(goldPrice || '0').toLocaleString()} / {unitShort}
                </div>
                {purity !== 'custom' && (
                  <div className="breakdown">
                    {purity} · {currency}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer / Submit ── */}
          <div className="voucher-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onCancel ? onCancel() : router.push('/transactions')}
              tabIndex={10}
            >
              Cancel <span style={{ fontSize: 10, opacity: 0.6 }}>Esc</span>
            </button>
            <button
              type="submit"
              className={`btn btn-lg btn-kbd ${type === 'buy' ? 'btn-submit-buy' : 'btn-submit-sell'}`}
              disabled={submitting}
              tabIndex={9}
            >
              {submitting
                ? '⏳ Saving…'
                : (
                  <>
                    {type === 'buy' ? '▲ Record BUY' : '▼ Record SELL'}
                    <span className="kbd">Ctrl+↵</span>
                  </>
                )
              }
            </button>
          </div>

        </div>
      </form>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── Compact / Modal Mode Render (edit modal, scan results, etc.) ─────────────
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Transaction Type */}
      <div className="form-group mb-6">
        <label className="form-label">Transaction Type <span className="required">*</span></label>
        <div className="type-toggle">
          <button type="button" className={`type-btn ${type === 'buy' ? 'active-buy' : ''}`} onClick={() => setType('buy')}>
            ▲ Buy
          </button>
          <button type="button" className={`type-btn ${type === 'sell' ? 'active-sell' : ''}`} onClick={() => setType('sell')}>
            ▼ Sell
          </button>
        </div>
      </div>

      <div className="form-grid">
        {/* Gold Price Per Unit */}
        <div className="form-group">
          <label className="form-label">
            Gold Price / {WEIGHT_UNITS.find((u) => u.value === weightUnit)?.short}
            {' '}<span className="required">*</span>
            {isLowConf('goldPricePerUnit') && <span className="confidence-low">⚠ Low confidence</span>}
          </label>
          <input
            type="number"
            className={`form-input ${isLowConf('goldPricePerUnit') ? 'low-confidence' : ''} ${errors.goldPrice ? 'border-danger' : ''}`}
            placeholder={`e.g. ${referenceRate}`}
            value={goldPrice}
            onChange={(e) => setGoldPrice(e.target.value)}
            step="0.01" min="0"
          />
          {errors.goldPrice && <span className="form-error">{errors.goldPrice}</span>}
          <span className="form-hint">In {currency} per {WEIGHT_UNITS.find((u) => u.value === weightUnit)?.label.toLowerCase()}</span>
        </div>

        {/* Market Rate */}
        <div className="form-group">
          <label className="form-label">
            Market Spot Rate (USD/troy oz)
            {isLowConf('marketRate') && <span className="confidence-low">⚠ Low confidence</span>}
          </label>
          <input
            type="number"
            className={`form-input ${isLowConf('marketRate') ? 'low-confidence' : ''} ${errors.marketRate ? 'border-danger' : ''}`}
            placeholder="e.g. 2355.00"
            value={marketRate}
            onChange={(e) => setMarketRate(e.target.value)}
            step="0.01" min="0"
          />
          {errors.marketRate && <span className="form-error">{errors.marketRate}</span>}
          <span className="form-hint">Used for USD reference tracking</span>
        </div>

        {/* Purity */}
        <div className="form-group">
          <label className="form-label">
            Purity / Karat <span className="required">*</span>
            {isLowConf('purity') && <span className="confidence-low">⚠ Low confidence</span>}
          </label>
          <select
            className={`form-select ${isLowConf('purity') ? 'low-confidence' : ''}`}
            value={purity}
            onChange={(e) => setPurity(e.target.value as Purity)}
          >
            {PURITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}{p.value !== 'custom' ? ` — ${p.sub} Fine` : '…'}</option>
            ))}
          </select>
          {purity === 'custom' && (
            <div style={{ marginTop: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder='e.g. "20K" or "800 fine"'
                value={customPurity}
                onChange={(e) => setCustomPurity(e.target.value)}
              />
              {errors.customPurity && <span className="form-error">{errors.customPurity}</span>}
            </div>
          )}
        </div>

        {/* Currency */}
        <div className="form-group">
          <label className="form-label">Currency <span className="required">*</span></label>
          <select className="form-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
            ))}
          </select>
          {currencyInfo && (
            <span className="form-hint">1 USD = {currencyInfo.rateToUSD} {currency}</span>
          )}
        </div>

        {/* Weight */}
        <div className="form-group">
          <label className="form-label">
            Weight <span className="required">*</span>
            {isLowConf('weight') && <span className="confidence-low">⚠ Low confidence</span>}
          </label>
          <div className="form-row">
            <input
              type="number"
              className={`form-input ${isLowConf('weight') ? 'low-confidence' : ''} ${errors.weight ? 'border-danger' : ''}`}
              placeholder="e.g. 10"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              step="0.001" min="0"
            />
            <select
              className="form-select"
              style={{ maxWidth: 140 }}
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
            >
              {WEIGHT_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          {errors.weight && <span className="form-error">{errors.weight}</span>}
          {weightGrams !== null && (
            <span className="form-hint">{weightGrams.toFixed(3)} grams</span>
          )}
        </div>

        {/* Date & Time */}
        <div className="form-group">
          <label className="form-label">
            Date & Time <span className="required">*</span>
            {isLowConf('dateTime') && <span className="confidence-low">⚠ Low confidence</span>}
          </label>
          <input
            type="datetime-local"
            className={`form-input ${isLowConf('dateTime') ? 'low-confidence' : ''}`}
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
          />
        </div>

        {/* Counterparty */}
        <div className="form-group">
          <label className="form-label">Counterparty / Dealer</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Dubai Gold Souk, Booth #12"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="form-group form-full">
          <label className="form-label">Notes</label>
          <textarea
            className="form-textarea"
            placeholder="Additional details about this transaction…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Total Preview */}
      {totalValue !== null && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          margin: '20px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Estimated Total Value
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 700, color: '#b45309', marginTop: 4 }}>
              {currencyInfo?.symbol ?? currency} {totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
            <div>{parseFloat(weight || '0').toLocaleString()} {weightUnit.replace('_', ' ')}</div>
            <div>@ {currencyInfo?.symbol}{parseFloat(goldPrice || '0').toLocaleString()} / {weightUnit.replace('_', ' ')}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
          {submitting ? '⏳ Saving…' : editId ? '✅ Update Transaction' : '✅ Record Transaction'}
        </button>
      </div>
    </form>
  );
}
