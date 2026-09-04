import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import { TransactionProvider } from '@/context/TransactionContext';
import { ToastProvider } from '@/components/Toast';
import Sidebar from '@/components/Sidebar';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';

// Self-hosted via next/font — eliminates render-blocking Google Fonts request.
// Fonts are preloaded in <head>, served from the same origin, font-display: swap.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-outfit',
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
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
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
