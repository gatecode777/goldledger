'use client';

import Link from 'next/link';
import TransactionForm from '@/components/TransactionForm';

export default function NewTransactionPage() {
  return (
    <div className="voucher-page">
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">New Transaction</h1>
          <p className="page-subtitle">Gold buy / sell — Voucher entry</p>
        </div>
        <Link href="/transactions" className="btn btn-secondary">
          ← Ledger
        </Link>
      </div>

      <TransactionForm source="manual" voucherMode />
    </div>
  );
}
