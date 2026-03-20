'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError('Something went wrong. Please try again or contact Kieran.');
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#fcf2e3' }}
    >
      <div className="w-full max-w-sm px-6">
        {/* Logo / wordmark */}
        <div className="mb-10 text-center">
          <h1
            className="text-3xl font-serif"
            style={{ color: '#212122', fontFamily: 'Inria Serif, serif' }}
          >
            Forward Institute
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#212122', opacity: 0.6 }}>
            Commercial Dashboard
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#195e47' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-medium mb-2" style={{ color: '#212122' }}>
              Check your email
            </h2>
            <p className="text-sm" style={{ color: '#212122', opacity: 0.6 }}>
              We sent a login link to <strong>{email}</strong>. Click it to access the dashboard.
            </p>
            <button
              className="mt-6 text-sm underline"
              style={{ color: '#212122', opacity: 0.5 }}
              onClick={() => { setSent(false); setEmail(''); }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1"
                style={{ color: '#212122' }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border text-sm outline-none focus:ring-2"
                style={{
                  backgroundColor: 'white',
                  borderColor: '#212122',
                  color: '#212122',
                  // @ts-ignore
                  '--tw-ring-color': '#ffcc12',
                }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#dd6945' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#212122', color: '#fcf2e3' }}
            >
              {loading ? 'Sending…' : 'Send login link'}
            </button>

            <p className="text-xs text-center mt-4" style={{ color: '#212122', opacity: 0.45 }}>
              No password needed. We&apos;ll email you a one-click login link.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
