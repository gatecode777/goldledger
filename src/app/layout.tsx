import type { Metadata } from 'next';
import { Manrope, DM_Sans } from 'next/font/google';
import './globals.css';
import { TransactionProvider } from '@/context/TransactionContext';
import { ToastProvider } from '@/components/Toast';
import Sidebar from '@/components/Sidebar';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';

// Self-hosted via next/font — eliminates render-blocking Google Fonts request.
// Manrope for crisp display headings & financial figures; DM Sans for readable UI & tables.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GoldLedger — Gold Transaction Management System',
  description:
    'Secure admin portal for managing gold buy/sell transactions with multi-currency support and live dashboard analytics.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isLoggedIn = !!session;

  return (
    <html lang="en" className={`${manrope.variable} ${dmSans.variable}`}>
      <body>
        <SessionProvider session={session}>
          <ToastProvider>
            {isLoggedIn ? (
              <TransactionProvider>
                <div className="app-shell">
                  <Sidebar />
                  <main className="main-content">
                    <div className="page-wrapper">{children}</div>
                  </main>
                </div>
              </TransactionProvider>
            ) : (
              // Login page renders standalone — no sidebar/shell
              <div>{children}</div>
            )}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
