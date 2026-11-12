'use client';

import { useState, useEffect, useRef } from 'react';
import { IconGoldBar, IconAlert, IconMail, IconLock, IconEye, IconEyeOff } from '@/components/Icons';

interface Props {
  action: (formData: FormData) => Promise<void>;
  error?: string;
}

function LoginFormInner({ action, error: errorProp }: Props) {
  const hasError = errorProp === 'invalid';

  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await action(formData);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`login-page ${mounted ? 'mounted' : ''}`}>
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="login-grid" />
      </div>

      {/* Card */}
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon"><IconGoldBar size={22} /></div>
          <div className="login-logo-text">
            <span className="login-logo-name">GoldLedger</span>
            <span className="login-logo-sub">Admin Portal</span>
          </div>
        </div>

        <div className="login-divider" />

        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">Sign in to manage your gold transactions</p>

        {hasError && (
          <div className="login-error">
            <IconAlert size={16} />
            <span>Invalid credentials. Please try again.</span>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">Email Address</label>
            <div className="login-input-wrap">
              <span className="login-input-icon"><IconMail size={16} /></span>
              <input
                id="login-email"
                name="email"
                type="email"
                className="login-input"
                placeholder="admin@goldledger.com"
                autoComplete="email"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <span className="login-input-icon"><IconLock size={16} /></span>
              <input
                id="login-password"
                name="password"
                type={showPass ? 'text' : 'password'}
                className="login-input"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPass((p) => !p)}
                tabIndex={-1}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" />
                Authenticating…
              </>
            ) : (
              <>
                <IconLock size={15} />
                Sign In to GoldLedger
              </>
            )}
          </button>
        </form>

        <p className="login-footer-note">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconLock size={12} /> Secured with end-to-end encrypted sessions
          </span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPageClient({ action, error }: Props) {
  return <LoginFormInner action={action} error={error} />;
}
