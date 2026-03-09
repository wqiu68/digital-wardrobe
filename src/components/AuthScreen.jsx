import { useState } from 'react';
import { login, register, loginWithGoogle } from '../utils/auth';

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await login(email, password);
        onAuth(user);
      } else {
        await register(email, password);
        setConfirmed(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    try {
      await loginWithGoogle();
      // Supabase redirects the page — onAuth will fire via onAuthStateChange
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FAF8F5', fontFamily: "'Inter', sans-serif" }}>

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] p-16" style={{ backgroundColor: '#f0ebe3' }}>
        <span style={{ ...sans, fontSize: '11px', letterSpacing: '0.3em', color: '#a09890', textTransform: 'uppercase' }}>
          My Wardrobe
        </span>
        <div>
          <h1 style={{ ...serif, fontSize: '80px', fontWeight: 300, color: '#1a1713', lineHeight: 1, marginBottom: '24px', fontStyle: 'italic' }}>
            Your<br />Digital<br />Closet.
          </h1>
          <p style={{ ...sans, fontSize: '13px', color: '#a09890', lineHeight: 1.8, maxWidth: '260px' }}>
            Catalogue every piece you own. Filter by occasion, discover new combinations.
          </p>
        </div>
        <span style={{ ...sans, fontSize: '11px', color: '#c9b99a', letterSpacing: '0.2em', textTransform: 'uppercase' }}>2026</span>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-12 lg:px-16">
        <div className="w-full max-w-xs">

          <div className="lg:hidden mb-10">
            <h1 style={{ ...serif, fontSize: '48px', fontWeight: 300, color: '#1a1713', fontStyle: 'italic', lineHeight: 1.1 }}>
              My Wardrobe
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 mb-8" style={{ borderBottom: '1px solid #e8e3de' }}>
            {[['login', 'Sign in'], ['register', 'Create account']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setConfirmed(false); }}
                style={{
                  ...sans,
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: mode === m ? '#1a1713' : '#b0a89e',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: mode === m ? '1px solid #1a1713' : '1px solid transparent',
                  paddingBottom: '12px',
                  marginBottom: '-1px',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {confirmed ? (
            <div style={{ ...sans }}>
              <p style={{ fontSize: '14px', color: '#1a1713', marginBottom: '8px', fontWeight: 500 }}>Check your email</p>
              <p style={{ fontSize: '13px', color: '#a09890', lineHeight: 1.7 }}>
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back to sign in.
              </p>
            </div>
          ) : (
            <>
              {/* Google button */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 py-3 mb-6 transition-opacity hover:opacity-80"
                style={{ ...sans, fontSize: '13px', color: '#1a1713', border: '1px solid #d4ccc4', background: 'transparent' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3de' }} />
                <span style={{ ...sans, fontSize: '11px', color: '#c9b99a' }}>or</span>
                <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3de' }} />
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09890', display: 'block', marginBottom: '10px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    required
                    style={{ ...sans, borderColor: '#d4ccc4' }}
                    className="w-full bg-transparent border-b py-2.5 text-sm focus:outline-none transition-colors placeholder:text-black/20"
                  />
                </div>

                <div>
                  <label style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09890', display: 'block', marginBottom: '10px' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'At least 6 characters' : '········'}
                    required
                    style={{ ...sans, borderColor: '#d4ccc4' }}
                    className="w-full bg-transparent border-b py-2.5 text-sm focus:outline-none transition-colors placeholder:text-black/20"
                  />
                </div>

                {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b' }}>{error}</p>}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ ...sans, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' }}
                    className="w-full py-4 hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                </div>
              </form>
            </>
          )}

          <p style={{ ...sans, fontSize: '11px', color: '#c9b99a', textAlign: 'center', marginTop: '32px' }}>
            Your wardrobe syncs across all your devices
          </p>
        </div>
      </div>
    </div>
  );
}
