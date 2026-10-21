'use client';

import React, { useState, useRef } from 'react';
import { parseExcelTransactions, downloadSampleExcelTemplate, ParseSummary } from '@/lib/excel';
import { useToast } from '@/components/Toast';
import { useTransactions } from '@/context/TransactionContext';
import { formatCurrency, formatDate, purityLabel } from '@/lib/formatters';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  referenceRateUSD?: number;
  defaultCurrency?: string;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  referenceRateUSD = 2355,
  defaultCurrency = 'USD',
}: ExcelImportModalProps) {
  const { showToast } = useToast();
  const { importTransactions } = useTransactions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'error'>('all');
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  async function handleFile(file: File) {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      showToast('Please upload an Excel (.xlsx, .xls) or .csv file', 'error');
      return;
    }

    setSelectedFile(file);
    setParsing(true);
    setParseError(null);
    setSummary(null);

    try {
      const res = await parseExcelTransactions(file, referenceRateUSD, defaultCurrency);
      setSummary(res);
      if (res.errorCount > 0 && res.validCount === 0) {
        setFilterTab('error');
      } else {
        setFilterTab('all');
      }
    } catch (err: any) {
      console.error(err);
      setParseError(err?.message || 'Failed to parse file. Please verify format.');
    } finally {
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  async function handleConfirmImport() {
    if (!summary || summary.validTransactions.length === 0) return;

    setImporting(true);
    try {
      const count = await importTransactions(summary.validTransactions);
      showToast(`Successfully imported ${count} transactions!`, 'success');
      onImportSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to save imported transactions', 'error');
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setSummary(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const displayedRows = summary?.rows.filter((r) => {
    if (filterTab === 'valid') return r.status === 'valid';
    if (filterTab === 'error') return r.status === 'error';
    return true;
  });

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !importing) onClose(); }}>
      <div className="modal" style={{ maxWidth: 840, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: '#fff',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            }}>
              📊
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: 18, fontWeight: 700 }}>
                Import Transactions from Excel
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Upload .xlsx or .xls file to bulk import transactions into your ledger
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={downloadSampleExcelTemplate}
              title="Download pre-filled Excel template"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Sample Template
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={importing}
              style={{ fontSize: 16 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: 24, flex: 1 }}>

          {/* Upload Drop Zone if no summary */}
          {!summary && !parsing && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
                }}
              />

              <div
                className={`excel-dropzone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: 48, marginBottom: 10 }}>📁</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Drag & Drop Excel file here, or <span style={{ color: 'var(--gold-primary)', textDecoration: 'underline' }}>browse</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Supports .xlsx, .xls, and .csv formats
                </div>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: 'var(--bg-muted)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}>
                  💡 Tip: Download our <strong>Sample Template</strong> above for guaranteed format accuracy.
                </div>
              </div>

              {parseError && (
                <div style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#dc2626',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  ⚠️ {parseError}
                </div>
              )}
            </div>
          )}

          {/* Parsing State */}
          {parsing && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div className="page-spinner" style={{ margin: '0 auto 16px auto' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                Reading & Validating Excel rows…
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Parsing {selectedFile?.name}
              </div>
            </div>
          )}

          {/* Parsed Summary and Table Preview */}
          {summary && (
            <div>
              {/* File Info Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--bg-muted)',
                borderRadius: 10,
                border: '1px solid var(--border)',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedFile?.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {summary.totalRows} row{summary.totalRows !== 1 ? 's' : ''} detected
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleReset}
                  style={{ fontSize: 12, color: 'var(--text-muted)' }}
                >
                  🔄 Choose different file
                </button>
              </div>

              {/* Status metrics bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginBottom: 16,
              }}>
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--bg-card)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Parsed
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                    {summary.totalRows}
                  </div>
                </div>

                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: 10,
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}>
                  <div style={{ fontSize: 11, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Ready to Import
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                    {summary.validCount}
                  </div>
                </div>

                <div style={{
                  padding: '12px 16px',
                  background: summary.errorCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card)',
                  borderRadius: 10,
                  border: summary.errorCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, color: summary.errorCount > 0 ? '#dc2626' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Errors / Skipped
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: summary.errorCount > 0 ? '#dc2626' : 'var(--text-secondary)', marginTop: 2 }}>
                    {summary.errorCount}
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button
                  type="button"
                  className={`type-pill ${filterTab === 'all' ? 'type-pill-active' : ''}`}
                  onClick={() => setFilterTab('all')}
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  All ({summary.totalRows})
                </button>
                <button
                  type="button"
                  className={`type-pill ${filterTab === 'valid' ? 'type-pill-buy' : ''}`}
                  onClick={() => setFilterTab('valid')}
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  ✅ Valid ({summary.validCount})
                </button>
                {summary.errorCount > 0 && (
                  <button
                    type="button"
                    className={`type-pill ${filterTab === 'error' ? 'type-pill-sell' : ''}`}
                    onClick={() => setFilterTab('error')}
                    style={{ fontSize: 12, padding: '5px 12px' }}
                  >
                    ⚠️ Errors ({summary.errorCount})
                  </button>
                )}
              </div>

              {/* Preview Table */}
              <div className="table-wrapper" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="tx-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>Row</th>
                      <th style={{ width: 80 }}>Status</th>
                      <th>Type</th>
                      <th>Purity</th>
                      <th>Weight</th>
                      <th>Price</th>
                      <th>Total Value</th>
                      <th>Dealer</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows?.map((r) => {
                      const isOk = r.status === 'valid';
                      const tx = r.data;
                      return (
                        <tr key={r.rowNumber} style={{ background: isOk ? undefined : 'rgba(239, 68, 68, 0.04)' }}>
                          <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>#{r.rowNumber}</td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: isOk ? '#dcfce7' : '#fee2e2',
                              color: isOk ? '#15803d' : '#b91c1c',
                            }}>
                              {isOk ? 'Valid' : 'Error'}
                            </span>
                          </td>
                          <td>
                            {tx ? (
                              <span className={`tx-badge ${tx.type}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                                {tx.type === 'buy' ? '📈 BUY' : '📉 SELL'}
                              </span>
                            ) : (
                              String(r.raw.type || r.raw.Type || '—')
                            )}
                          </td>
                          <td>
                            {tx ? (
                              <span className="purity-tag" style={{ fontSize: 10 }}>
                                {purityLabel(tx.purity, tx.customPurity)}
                              </span>
                            ) : (
                              String(r.raw.purity || r.raw.Purity || '—')
                            )}
                          </td>
                          <td>
                            {tx ? `${tx.weight} ${tx.weightUnit}` : String(r.raw.weight || r.raw.Weight || '—')}
                          </td>
                          <td>
                            {tx ? `${tx.goldPricePerUnit} ${tx.currency}` : String(r.raw.price || r.raw.Price || '—')}
                          </td>
                          <td className="font-bold">
                            {tx ? formatCurrency(tx.totalValue, tx.currency) : '—'}
                          </td>
                          <td style={{ maxWidth: 120 }} className="truncate">
                            {tx?.counterparty || String(r.raw.counterparty || r.raw.Dealer || '—')}
                          </td>
                          <td>
                            {isOk ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                {tx?.dateTime ? formatDate(tx.dateTime) : 'Now'}
                              </span>
                            ) : (
                              <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 500 }}>
                                {r.errors.join('; ')}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', justifyContent: 'space-between' }}>
          <div>
            {summary && summary.validCount > 0 && (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {summary.validCount} transaction{summary.validCount !== 1 ? 's' : ''} will be added to your ledger.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={importing}
            >
              Cancel
            </button>
            {summary && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={importing || summary.validCount === 0}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                }}
              >
                {importing ? (
                  <>
                    <span className="page-spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }} />
                    Importing…
                  </>
                ) : (
                  `📥 Import ${summary.validCount} Transactions`
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
