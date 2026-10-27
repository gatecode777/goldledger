'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TransactionForm from '@/components/TransactionForm';
import { Transaction, TransactionType, Purity, WeightUnit, PaymentType } from '@/lib/types';
import { useTransactions } from '@/context/TransactionContext';
import { useToast } from '@/components/Toast';
import { CURRENCIES, convertCurrency } from '@/lib/currencies';
import { formatCurrency } from '@/lib/formatters';

type ScanState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface ScannedItem {
  id: string;
  type: TransactionType;
  paymentType?: PaymentType;
  transactionId?: string;
  weight: number;
  weightUnit: WeightUnit;
  purity: Purity;
  customPurity?: string;
  goldPricePerUnit: number;
  currency: string;
  counterparty: string;
  notes: string;
  dateTime: string;
  totalValue: number;
  lowConfidenceFields?: string[];
}

const PURITIES: { value: Purity; label: string }[] = [
  { value: '24K 999', label: '24K (999)' },
  { value: '24K 995', label: '24K (995)' },
  { value: '24K 991', label: '24K (991)' },
];

const WEIGHT_UNITS: { value: WeightUnit; label: string }[] = [
  { value: 'gram', label: 'Gram (g)' },
  { value: 'tola', label: 'Tola' },
  { value: 'troy_oz', label: 'Troy oz' },
];

export default function ScanPage() {
  const router = useRouter();
  const { importTransactions, rateSettings, globalCurrency } = useTransactions();
  const { showToast } = useToast();

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scanned results
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [viewMode, setViewMode] = useState<'batch' | 'voucher'>('batch');

  const defaultRefRate = rateSettings?.referenceRateUSD ?? 2355;

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (JPG, PNG, WEBP, HEIC).');
      setScanState('error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File too large. Please use an image under 10 MB.');
      setScanState('error');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setFileName(file.name);

    setScanState('uploading');
    setErrorMsg('');
    setItems([]);

    const formData = new FormData();
    formData.append('image', file);

    try {
      setScanState('processing');
      const res = await fetch('/api/scan', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? `Server error (${res.status})`);
      }

      const rawList: any[] = json.transactions || (json.data ? [json.data] : []);
      if (rawList.length === 0) {
        throw new Error('No transactions could be detected from the image.');
      }

      const parsedItems: ScannedItem[] = rawList.map((t: any, idx: number) => {
        const weight = Number(t.weight) || 0;
        const price = Number(t.goldPricePerUnit) || defaultRefRate;
        return {
          id: `scan-${Date.now()}-${idx}`,
          type: t.type === 'sell' ? 'sell' : 'buy',
          weight,
          weightUnit: t.weightUnit || 'gram',
          purity: (['24K 999', '24K 995', '24K 991'].includes(t.purity) ? t.purity : '24K 999'),
          customPurity: t.customPurity || '',
          goldPricePerUnit: price,
          currency: t.currency || globalCurrency || 'USD',
          counterparty: t.counterparty || '',
          notes: t.notes || '',
          dateTime: t.dateTime || new Date().toISOString(),
          totalValue: Number(t.totalValue) || (weight * price),
          lowConfidenceFields: t.lowConfidenceFields || [],
        };
      });

      setItems(parsedItems);
      setViewMode(parsedItems.length > 1 ? 'batch' : 'voucher');
      setScanState('done');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unknown error occurred while scanning.');
      setScanState('error');
    }
  }, [defaultRefRate]);

  // Drop handlers
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const resetScan = () => {
    setScanState('idle');
    setPreview(null);
    setFileName('');
    setItems([]);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  // Row update handlers
  function updateItem(id: string, updates: Partial<ScannedItem>) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if ('weight' in updates || 'goldPricePerUnit' in updates) {
          updated.totalValue = (updated.weight || 0) * (updated.goldPricePerUnit || 0);
        }
        return updated;
      })
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function addItem() {
    const newItem: ScannedItem = {
      id: `scan-${Date.now()}-${items.length}`,
      type: 'buy',
      weight: 1,
      weightUnit: 'gram',
      purity: '24K 999',
      goldPricePerUnit: defaultRefRate,
      currency: 'USD',
      counterparty: '',
      notes: '',
      dateTime: new Date().toISOString(),
      totalValue: defaultRefRate,
    };
    setItems((prev) => [...prev, newItem]);
  }

  // Save all to database
  async function handleSaveAll() {
    if (items.length === 0) return;

    // Validate that weight & price are positive
    for (let i = 0; i < items.length; i++) {
      if (!items[i].weight || items[i].weight <= 0) {
        showToast(`Row #${i + 1} has an invalid or zero weight.`, 'error');
        return;
      }
      if (!items[i].goldPricePerUnit || items[i].goldPricePerUnit <= 0) {
        showToast(`Row #${i + 1} has an invalid or zero price.`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Omit<Transaction, 'id'>[] = items.map((item) => ({
        type: item.type,
        goldPricePerUnit: item.goldPricePerUnit,
        marketRate: defaultRefRate,
        purity: item.purity,
        customPurity: undefined,
        weight: item.weight,
        weightUnit: item.weightUnit,
        dateTime: item.dateTime || new Date().toISOString(),
        currency: item.currency,
        counterparty: item.counterparty.trim(),
        paymentType: item.paymentType || 'Cash',
        transactionId: item.transactionId ? item.transactionId.trim() : undefined,
        notes: item.notes.trim(),
        source: 'scan',
        totalValue: item.weight * item.goldPricePerUnit,
      }));

      const count = await importTransactions(payload);
      showToast(`Successfully saved ${count} transactions from AI scan!`, 'success');
      router.push('/transactions');
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to save transactions', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Aggregate totals
  const totalWeight = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0),
    [items]
  );
  const totalValueSum = useMemo(
    () => items.reduce((sum, item) => sum + (item.totalValue || 0), 0),
    [items]
  );

  // ════════════════════════════════════════════════════════════════════════════
  // ── Done State: Display Extracted Transactions ──────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  if (scanState === 'done' && items.length > 0) {
    // If only 1 transaction and user chose single voucher mode
    if (items.length === 1 && viewMode === 'voucher') {
      const single = items[0];
      return (
        <div className="voucher-page">
          <div className="page-header" style={{ marginBottom: 20 }}>
            <div>
              <h1 className="page-title">AI Scan Result</h1>
              <p className="page-subtitle">Review the extracted transaction, then record to ledger</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setViewMode('batch')} className="btn btn-secondary">
                📋 Table View
              </button>
              <button onClick={resetScan} className="btn btn-ghost">
                🔄 Scan Another
              </button>
              <Link href="/transactions" className="btn btn-ghost">
                ← Ledger
              </Link>
            </div>
          </div>

          <div className="scan-result-preview" style={{ marginBottom: 20 }}>
            <div className="scan-result-header">
              <span style={{ fontSize: 22 }}>🤖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e' }}>
                  AI Extraction Complete — {fileName}
                </div>
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                  Single transaction detected. Verify and save below.
                </div>
              </div>
              {preview && (
                <img
                  src={preview}
                  alt="Scanned slip"
                  style={{
                    width: 70,
                    height: 55,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid #fde68a',
                  }}
                />
              )}
            </div>
          </div>

          <TransactionForm
            source="scan"
            voucherMode
            initialValues={{
              type: single.type,
              weight: single.weight,
              weightUnit: single.weightUnit,
              purity: single.purity,
              customPurity: single.customPurity,
              goldPricePerUnit: single.goldPricePerUnit,
              currency: single.currency,
              counterparty: single.counterparty,
              paymentType: single.paymentType || 'Cash',
              transactionId: single.transactionId,
              notes: single.notes,
              dateTime: single.dateTime,
              totalValue: single.totalValue,
            }}
            lowConfidenceFields={single.lowConfidenceFields}
          />
        </div>
      );
    }

    // ── Multi-Item Batch Review Table ──────────────────────────────────────────
    return (
      <div className="voucher-page" style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>AI Scan Result</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: '#dcfce7',
                  color: '#15803d',
                }}
              >
                {items.length} {items.length === 1 ? 'Transaction' : 'Transactions'} Extracted
              </span>
            </h1>
            <p className="page-subtitle">
              Review and edit any extracted values from your image below before saving
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {items.length === 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewMode('voucher')}
              >
                🧾 Voucher Mode
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveAll}
              disabled={saving || items.length === 0}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              }}
            >
              {saving ? '⏳ Saving to Ledger…' : `💾 Save All (${items.length}) to Ledger`}
            </button>
            <button onClick={resetScan} className="btn btn-secondary">
              🔄 Scan Another
            </button>
            <Link href="/transactions" className="btn btn-ghost">
              ← Ledger
            </Link>
          </div>
        </div>

        {/* Thumbnail Preview Banner */}
        <div className="scan-result-preview" style={{ marginBottom: 20 }}>
          <div className="scan-result-header">
            <span style={{ fontSize: 24 }}>✨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e' }}>
                Handwritten / Slip Detection Successful — {fileName}
              </div>
              <div style={{ fontSize: 12, color: '#b45309', marginTop: 3 }}>
                AI extracted {items.length} gold transaction entries. Check purity and price before recording.
              </div>
            </div>
            {preview && (
              <a href={preview} target="_blank" rel="noreferrer" title="Click to view full image">
                <img
                  src={preview}
                  alt="Scanned slip"
                  style={{
                    width: 80,
                    height: 60,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1.5px solid #fde68a',
                    cursor: 'pointer',
                  }}
                />
              </a>
            )}
          </div>
        </div>

        {/* Batch Editable Table Card */}
        <div className="scan-batch-card">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Extracted Transaction Entries
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addItem}
              style={{ fontSize: 12 }}
            >
              ➕ Add Entry
            </button>
          </div>

          <div className="table-wrapper" style={{ overflowX: 'auto', border: 'none', borderRadius: 0 }}>
            <table className="scan-batch-table">
              <thead>
                <tr>
                  <th style={{ width: 45, textAlign: 'center' }}>#</th>
                  <th style={{ width: 100 }}>Type</th>
                  <th style={{ width: 110 }}>Weight</th>
                  <th style={{ width: 105 }}>Unit</th>
                  <th style={{ width: 125 }}>Purity</th>
                  <th style={{ width: 125 }}>Price / Unit</th>
                  <th style={{ width: 100 }}>Currency</th>
                  <th style={{ width: 130 }}>Total Value</th>
                  <th>Notes / Description</th>
                  <th style={{ width: 140 }}>Counterparty</th>
                  <th style={{ width: 45, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    {/* Row index */}
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                      #{idx + 1}
                    </td>

                    {/* Type toggle */}
                    <td>
                      <button
                        type="button"
                        className={`type-pill ${item.type === 'buy' ? 'type-pill-buy' : 'type-pill-sell'}`}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        onClick={() => updateItem(item.id, { type: item.type === 'buy' ? 'sell' : 'buy' })}
                        title="Click to toggle BUY / SELL"
                      >
                        {item.type === 'buy' ? '▲ BUY' : '▼ SELL'}
                      </button>
                    </td>

                    {/* Weight */}
                    <td>
                      <input
                        type="number"
                        className="scan-batch-input"
                        step="0.001"
                        min="0"
                        value={item.weight || ''}
                        onChange={(e) => updateItem(item.id, { weight: parseFloat(e.target.value) || 0 })}
                        style={{ fontWeight: 600 }}
                      />
                    </td>

                    {/* Weight Unit */}
                    <td>
                      <select
                        className="scan-batch-select"
                        value={item.weightUnit}
                        onChange={(e) => updateItem(item.id, { weightUnit: e.target.value as WeightUnit })}
                      >
                        {WEIGHT_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Purity */}
                    <td>
                      <select
                        className="scan-batch-select"
                        value={item.purity}
                        onChange={(e) => updateItem(item.id, { purity: e.target.value as Purity })}
                      >
                        {PURITIES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Price per unit */}
                    <td>
                      <input
                        type="number"
                        className="scan-batch-input"
                        step="0.01"
                        min="0"
                        value={item.goldPricePerUnit || ''}
                        onChange={(e) =>
                          updateItem(item.id, { goldPricePerUnit: parseFloat(e.target.value) || 0 })
                        }
                        style={{ fontWeight: 600 }}
                      />
                    </td>

                    {/* Currency */}
                    <td>
                      <select
                        className="scan-batch-select"
                        value={item.currency}
                        onChange={(e) => {
                          const newCurr = e.target.value;
                          const currentPrice = item.goldPricePerUnit || 0;
                          const converted = convertCurrency(currentPrice, item.currency, newCurr);
                          updateItem(item.id, {
                            currency: newCurr,
                            goldPricePerUnit: Number(converted.toFixed(2)),
                          });
                        }}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Total Value */}
                    <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(item.weight * item.goldPricePerUnit, item.currency)}
                    </td>

                    {/* Notes */}
                    <td>
                      <input
                        type="text"
                        className="scan-batch-input"
                        placeholder="e.g. SELL 10g"
                        value={item.notes}
                        onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                      />
                    </td>

                    {/* Counterparty */}
                    <td>
                      <input
                        type="text"
                        className="scan-batch-input"
                        placeholder="Shop or dealer"
                        value={item.counterparty}
                        onChange={(e) => updateItem(item.id, { counterparty: e.target.value })}
                      />
                    </td>

                    {/* Delete */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeItem(item.id)}
                        title="Delete entry"
                        style={{ color: '#ef4444', padding: '4px 6px' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table summary bar */}
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--bg-muted)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
              <div>
                Total Entries: <strong style={{ color: 'var(--text-primary)' }}>{items.length}</strong>
              </div>
              <div>
                Total Weight: <strong style={{ color: 'var(--text-primary)' }}>{totalWeight.toFixed(3)}</strong>
              </div>
              <div>
                Total Portfolio Value: <strong style={{ color: 'var(--gold-primary)' }}>${totalValueSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAll}
                disabled={saving || items.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                }}
              >
                {saving ? '⏳ Saving to Ledger…' : `💾 Save All (${items.length}) to Ledger`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Default State: Upload / Drop Zone ──────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="voucher-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">AI Receipt &amp; Handwritten Slip Scanner</h1>
          <p className="page-subtitle">
            Upload single bills or handwritten lists with multiple transactions — AI extracts all rows instantly
          </p>
        </div>
        <Link href="/transactions" className="btn btn-secondary">
          ← Ledger
        </Link>
      </div>

      <div className="scan-card">
        {/* Header */}
        <div className="scan-card-header">
          <span className="scan-card-icon">🤖</span>
          <div>
            <div className="scan-card-title">AI Receipt &amp; Note Scanner</div>
            <div className="scan-card-sub">
              Upload an invoice, receipt, or handwritten note with single or multiple transactions
            </div>
          </div>
        </div>

        {/* Drop zone */}
        {(scanState === 'idle' || scanState === 'error') && (
          <>
            <div
              className={`scan-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFileChange}
                style={{ display: 'none' }}
              />

              {preview ? (
                <div className="scan-preview-wrap">
                  <img src={preview} alt="Preview" className="scan-preview-img" />
                  <div className="scan-preview-name">{fileName}</div>
                </div>
              ) : (
                <div className="scan-dropzone-inner">
                  <div className="scan-dropzone-icon">📄</div>
                  <div className="scan-dropzone-title">Drop receipt or handwritten note image here</div>
                  <div className="scan-dropzone-sub">or click to browse / capture from camera</div>
                  <div className="scan-dropzone-formats">JPG · PNG · WEBP · HEIC · up to 10 MB</div>
                </div>
              )}
            </div>

            {scanState === 'error' && (
              <div className="scan-error-banner">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {preview && (
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  className="btn btn-primary scan-submit-btn"
                  onClick={() => {
                    if (inputRef.current?.files?.[0]) processFile(inputRef.current.files[0]);
                  }}
                >
                  🤖 Scan with AI
                </button>
                <button className="btn btn-ghost" onClick={resetScan}>
                  Clear
                </button>
              </div>
            )}
          </>
        )}

        {/* Processing state */}
        {(scanState === 'uploading' || scanState === 'processing') && (
          <div className="scan-analyzing">
            <div className="scan-pulse-ring">
              <div className="scan-pulse-dot">🤖</div>
            </div>
            <div className="scan-analyzing-title">
              {scanState === 'uploading' ? 'Uploading image…' : 'AI is reading your document…'}
            </div>
            <div className="scan-analyzing-sub">
              Extracting all buy and sell transaction entries
            </div>
            <div className="scan-progress-bar">
              <div className="scan-progress-fill scan-progress-animate" />
            </div>
            {preview && <img src={preview} alt="Uploading" className="scan-preview-thumb" />}
          </div>
        )}

        {/* Tips */}
        {scanState === 'idle' && (
          <div className="scan-tips">
            <div className="scan-tips-title">📸 Tips for best results</div>
            <div className="scan-tips-grid">
              <div className="scan-tip-item">
                <span className="scan-tip-icon">📝</span>
                <span>Supports multiple handwritten entries (e.g. SELL 10g, BUY 5g)</span>
              </div>
              <div className="scan-tip-item">
                <span className="scan-tip-icon">💡</span>
                <span>Ensure good lighting and high contrast</span>
              </div>
              <div className="scan-tip-item">
                <span className="scan-tip-icon">📐</span>
                <span>Keep note flat and clearly visible</span>
              </div>
              <div className="scan-tip-item">
                <span className="scan-tip-icon">📱</span>
                <span>On mobile, capture directly using camera</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
