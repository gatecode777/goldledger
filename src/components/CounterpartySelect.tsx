'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Counterparty, TransactionType } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

interface CounterpartySelectProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCounterparty: (counterparty: Counterparty) => void;
  counterparties: Counterparty[];
  transactionType: TransactionType;
  tabIndex?: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
  className?: string;
}

export default function CounterpartySelect({
  value,
  onChange,
  onSelectCounterparty,
  counterparties = [],
  transactionType,
  tabIndex = 1,
  inputRef,
  placeholder = 'e.g. Tanishq, Local Dealer, John Doe…',
  className = 'voucher-input',
}: CounterpartySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and order suggestions
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = counterparties.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    });

    // Prioritize relevant role based on transaction type:
    // If buying gold -> we are buying from a SELLER
    // If selling gold -> we are selling to a BUYER
    const preferredRole = transactionType === 'buy' ? 'seller' : 'buyer';

    return list.sort((a, b) => {
      const aMatches = a.type === preferredRole || a.type === 'both';
      const bMatches = b.type === preferredRole || b.type === 'both';
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [counterparties, value, transactionType]);

  const selectedParty = useMemo(() => {
    return counterparties.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
  }, [counterparties, value]);

  function handleSelect(c: Counterparty) {
    onChange(c.name);
    onSelectCounterparty(c);
    setIsOpen(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter' && isOpen && highlightIndex >= 0 && highlightIndex < filtered.length) {
      e.preventDefault();
      handleSelect(filtered[highlightIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef as any}
          type="text"
          className={className}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightIndex(0);
          }}
          onFocus={() => {
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          tabIndex={tabIndex}
          autoComplete="off"
          style={{ paddingRight: 36 }}
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          tabIndex={-1}
          title="Toggle saved buyers/sellers list"
          style={{
            position: 'absolute',
            right: 8,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
          }}
        >
          {isOpen ? '▲' : '▼'}
        </button>
      </div>

      {/* Selected counterparty auto-price indicator */}
      {selectedParty && selectedParty.defaultPrice > 0 && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-gold)',
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontWeight: 500,
        }}>
          <span>⚡ Saved profile:</span>
          <strong>{selectedParty.name}</strong>
          <span>({formatCurrency(selectedParty.defaultPrice, selectedParty.currency)} / {selectedParty.weightUnit || 'g'})</span>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1px solid var(--border-md)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 1000,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
              <div>No saved counterparty matching <strong>&quot;{value}&quot;</strong></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                ✨ Will be automatically registered with this transaction&apos;s price on submit!
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                padding: '6px 12px',
                background: '#fafbfc',
                borderBottom: '1px solid var(--border)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>Select Saved {transactionType === 'buy' ? 'Seller / Dealer' : 'Buyer / Customer'}</span>
                <span>Saved Price</span>
              </div>

              {filtered.map((party, index) => {
                const isSelected = highlightIndex === index || party.name.toLowerCase() === value.trim().toLowerCase();
                const isPreferred = (transactionType === 'buy' && party.type === 'seller') ||
                                    (transactionType === 'sell' && party.type === 'buyer') ||
                                    party.type === 'both';

                return (
                  <div
                    key={party.id || party.name}
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent blur
                      handleSelect(party);
                    }}
                    onMouseEnter={() => setHighlightIndex(index)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? '#fffbeb' : '#ffffff',
                      borderLeft: isSelected ? '3px solid var(--gold-500)' : '3px solid transparent',
                      transition: 'background 120ms',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {party.name}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 'var(--radius-sm)',
                            textTransform: 'uppercase',
                            background: party.type === 'seller' ? '#fef3c7' : party.type === 'buyer' ? '#e0f2fe' : '#f3f4f6',
                            color: party.type === 'seller' ? '#b45309' : party.type === 'buyer' ? '#0369a1' : '#4b5563',
                          }}
                        >
                          {party.type}
                        </span>
                        {isPreferred && (
                          <span style={{ fontSize: 10, color: '#16a34a' }} title="Matches current transaction flow">✓</span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-600)' }}>
                        {formatCurrency(party.defaultPrice, party.currency)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        per {party.weightUnit || 'g'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Directory footer */}
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
            background: '#fafbfc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {counterparties.length} saved buyers/sellers
            </span>
            <Link
              href="/counterparties"
              style={{
                color: 'var(--gold-600)',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ⚙️ Manage Directory →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
