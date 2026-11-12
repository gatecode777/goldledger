'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTransactions } from '@/context/TransactionContext';
import { CURRENCIES, convertUSDTo } from '@/lib/currencies';
import { formatCurrency } from '@/lib/formatters';
import {
  IconGoldBar,
  IconDashboard,
  IconLedger,
  IconTransfer,
  IconUsers,
  IconScan,
  IconSettings,
  IconPlus,
  IconGlobe,
  IconLogOut,
  IconMenu,
  IconX,
} from '@/components/Icons';

const navItems = [
  { href: '/',                icon: IconDashboard, label: 'Dashboard' },
  { href: '/transactions',    icon: IconLedger,    label: 'Transaction Log' },
  { href: '/money-transfers', icon: IconTransfer,  label: 'Gold Transfer' },
  { href: '/counterparties',  icon: IconUsers,     label: 'Buyers & Sellers' },
  { href: '/scan',            icon: IconScan,      label: 'AI Scan' },
  { href: '/settings',        icon: IconSettings,  label: 'Gold Rate Settings' },
];

const Sidebar = React.memo(function Sidebar() {
  const pathname = usePathname();
  const { transactions, counterparties, moneyTransfers, rateSettings, globalCurrency, setGlobalCurrency } = useTransactions();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const txCount = useMemo(() => transactions.length, [transactions]);
  const partyCount = useMemo(() => counterparties?.length ?? 0, [counterparties]);
  const mtCount = useMemo(() => moneyTransfers?.length ?? 0, [moneyTransfers]);
  const convertedRate = useMemo(() => {
    const rateUSD = rateSettings?.referenceRateUSD ?? 0;
    return convertUSDTo(rateUSD, globalCurrency);
  }, [rateSettings?.referenceRateUSD, globalCurrency]);

  return (
    <>
      {/* Mobile Sticky Top Header (hidden on desktop via CSS) */}
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <div className="sidebar-logo-icon" style={{ width: 30, height: 30 }}>
            <IconGoldBar size={15} />
          </div>
          <span className="sidebar-logo-name" style={{ fontSize: 15 }}>GoldLedger</span>
        </div>
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <IconX size={18} /> : <IconMenu size={18} />}
        </button>
      </header>

      {/* Backdrop for mobile drawer */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <IconGoldBar size={18} />
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">GoldLedger</span>
            <span className="sidebar-logo-sub">Admin Portal</span>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="sidebar-cta-wrap">
          <Link href="/transactions/new" className="sidebar-primary-cta">
            <IconPlus size={15} />
            <span>New Transaction</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="sidebar-section-label">Menu</span>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <Icon size={16} />
                </span>
                <span>{item.label}</span>
                {item.href === '/transactions' && (
                  <span className="nav-badge">{txCount}</span>
                )}
                {item.href === '/money-transfers' && mtCount > 0 && (
                  <span className="nav-badge">{mtCount}</span>
                )}
                {item.href === '/counterparties' && partyCount > 0 && (
                  <span className="nav-badge">{partyCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Global Currency Selector */}
          <div className="sidebar-currency-box">
            <div className="sidebar-currency-label">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <IconGlobe size={12} />
                Currency
              </span>
              <span className="sidebar-currency-active-code">{globalCurrency}</span>
            </div>
            <select
              className="sidebar-currency-select"
              value={globalCurrency}
              onChange={(e) => setGlobalCurrency(e.target.value)}
              title="Change global currency across the whole project"
              aria-label="Global display currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.symbol} ({c.name})
                </option>
              ))}
            </select>
          </div>

          <div className="sidebar-rate-display">
            <div className="sidebar-rate-label">Spot Reference Rate</div>
            <div
              className="sidebar-rate-value"
              title={formatCurrency(convertedRate, globalCurrency)}
            >
              {formatCurrency(convertedRate, globalCurrency)}
            </div>
            <div className="sidebar-rate-sub">{globalCurrency} / troy oz</div>
          </div>

          <button
            type="button"
            className="sidebar-signout-btn"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <IconLogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
});

export default Sidebar;
