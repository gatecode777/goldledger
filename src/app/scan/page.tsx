'use client';

import React, { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import TransactionForm from '@/components/TransactionForm';
import { Transaction } from '@/lib/types';

type ScanState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface ScanResult {
  data: Partial<Transaction> & { lowConfidenceFields?: string[] };
}

export default function ScanPage() {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [preview, setPreview]     = useState<string | null>(null);
  const [fileName, setFileName]   = useState('');
  const [result, setResult]       = useState<ScanResult | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    // Validate on client side too
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

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setFileName(file.name);

    setScanState('uploading');
    setErrorMsg('');
    setResult(null);

    // Send to API
    const formData = new FormData();
    formData.append('image', file);

    try {
      setScanState('processing');
      const res = await fetch('/api/scan', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? `Server error (${res.status})`);
      }

      setResult({ data: json.data });
      setScanState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error occurred.');
      setScanState('error');
    }
  }, []);

  // Drop zone handlers
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
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── If scan succeeded → show the pre-filled voucher form ──────────────────
  if (scanState === 'done' && result) {
    const { lowConfidenceFields = [], ...initialValues } = result.data;
    return (
      <div className="voucher-page">
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title">AI Scan Result</h1>
            <p className="page-subtitle">Review the extracted data below, then save</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={resetScan} className="btn btn-secondary">
              🔄 Scan Another
            </button>
            <Link href="/transactions" className="btn btn-ghost">
              ← Ledger
            </Link>
          </div>
        </div>

        {/* Scanned image thumbnail + confidence banner */}
        <div className="scan-result-preview" style={{ marginBottom: 20 }}>
          <div className="scan-result-header">
            <span style={{ fontSize: 20 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e' }}>
                AI Extraction Complete — {fileName}
              </div>
              <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                {lowConfidenceFields.length === 0
                  ? '✅ High confidence on all fields'
                  : `⚠ Review highlighted fields: ${lowConfidenceFields.join(', ')}`}
              </div>
            </div>
            {preview && (
              <img
                src={preview}
                alt="Scanned receipt"
                style={{
                  width: 80, height: 60,
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
          initialValues={initialValues as Partial<Transaction>}
          lowConfidenceFields={lowConfidenceFields}
        />
      </div>
    );
  }

  // ── Upload / processing UI ─────────────────────────────────────────────────
  return (
    <div className="voucher-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">AI Receipt Scanner</h1>
          <p className="page-subtitle">Upload a gold bill or invoice — AI will extract the transaction details</p>
        </div>
        <Link href="/transactions" className="btn btn-secondary">← Ledger</Link>
      </div>

      <div className="scan-card">
        {/* Header */}
        <div className="scan-card-header">
          <span className="scan-card-icon">🤖</span>
          <div>
            <div className="scan-card-title">Gemini 2.0 Flash Vision</div>
            <div className="scan-card-sub">Powered by Google AI Studio — free, 1500 req/day</div>
          </div>
          <div className="scan-model-badge">gemini-2.0-flash-exp</div>
        </div>

        {/* Drop zone */}
        {(scanState === 'idle' || scanState === 'error') && (
          <>
            <div
              className={`scan-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
                  <div className="scan-dropzone-title">Drop a receipt image here</div>
                  <div className="scan-dropzone-sub">or click to browse / use camera</div>
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
              {scanState === 'uploading' ? 'Uploading image…' : 'AI is reading your receipt…'}
            </div>
            <div className="scan-analyzing-sub">
              Gemini Vision is extracting transaction details
            </div>
            <div className="scan-progress-bar">
              <div className="scan-progress-fill scan-progress-animate" />
            </div>
            {preview && (
              <img src={preview} alt="Uploading" className="scan-preview-thumb" />
            )}
          </div>
        )}

        {/* Tips */}
        {scanState === 'idle' && (
          <div className="scan-tips">
            <div className="scan-tips-title">📸 Tips for best results</div>
            <div className="scan-tips-grid">
              <div className="scan-tip-item">
                <span className="scan-tip-icon">💡</span>
                <span>Good lighting, no shadows on text</span>
              </div>
              <div className="scan-tip-item">
                <span className="scan-tip-icon">📐</span>
                <span>Keep the receipt flat and fully visible</span>
              </div>
              <div className="scan-tip-item">
                <span className="scan-tip-icon">🔍</span>
                <span>Ensure weight, purity &amp; price are readable</span>
              </div>
              <div className="scan-tip-item">
                <span className="scan-tip-icon">📱</span>
                <span>On mobile, use the camera directly</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
