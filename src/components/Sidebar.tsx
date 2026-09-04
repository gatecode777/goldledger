'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTransactions } from '@/context/TransactionContext';

const navItems = [
  { href: '/',             icon: '📊', label: 'Dashboard' },
  { href: '/transactions', icon: '📋', label: 'Transaction Log' },
  { href: '/scan',         icon: '🤖', label: 'AI Scan' },
  { href: '/settings',     icon: '⚙️',  label: 'Gold Rate Settings' },
];

// React.memo — prevents re-render when parent re-renders but pathname/data unchanged
const Sidebar = React.memo(function Sidebar() {
  const pathname = usePathname();
  const { transactions, rateSettings } = useTransactions();

  // Only recompute when the array length changes, not on every array reference change
  const txCount = useMemo(() => transactions.length, [transactions]);
  const referenceRate = useMemo(
    () => (rateSettings?.referenceRateUSD ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    [rateSettings?.referenceRateUSD]
  );

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🥇</div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">GoldLedger</span>
          <span className="sidebar-logo-sub">Admin Portal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Navigation</span>

        {navItems.map((item) => {
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
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.href === '/transactions' && (
                <span className="nav-badge">{txCount}</span>
              )}
            </Link>
          );
        })}

        <span className="sidebar-section-label">Quick Actions</span>
        <Link href="/transactions/new" className="nav-link">
          <span className="nav-icon">➕</span>
          <span>New Transaction</span>
        </Link>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-rate-display">
          <div className="sidebar-rate-label">Reference Rate</div>
          <div className="sidebar-rate-value">${referenceRate}</div>
          <div className="sidebar-rate-sub">USD / troy oz</div>
        </div>

        <button
          className="sidebar-signout-btn"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
});

export default Sidebar;
