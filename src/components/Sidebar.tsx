'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTransactions } from '@/context/TransactionContext';

const navItems = [
  { href: '/',             icon: '📊', label: 'Dashboard' },
  { href: '/transactions', icon: '📋', label: 'Transaction Log' },
  { href: '/settings',     icon: '⚙️',  label: 'Gold Rate Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { transactions, rateSettings } = useTransactions();

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
                <span className="nav-badge">{transactions.length}</span>
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
          <div className="sidebar-rate-value">
            ${(rateSettings?.referenceRateUSD ?? 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </div>
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
}
