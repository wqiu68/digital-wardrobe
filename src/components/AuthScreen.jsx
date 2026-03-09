import { useState } from 'react';
import { login, register } from '../utils/auth';

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = mode === 'login' ? await login(username, password) : await register(username, password);
      onAuth(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FAF8F5', fontFamily: "'Inter', sans-serif" }}>

      {/* Left — brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[52%] p-16"
        style={{ backgroundColor: '#f0ebe3' }}
      >
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

        <span style={{ ...sans, fontSize: '11px', color: '#c9b99a', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          2026
        </span>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col justify-center px-12 lg:px-16">
        <div className="w-full max-w-xs">

          {/* Mobile heading */}
          <div className="lg:hidden mb-10">
            <h1 style={{ ...serif, fontSize: '48px', fontWeight: 300, color: '#1a1713', fontStyle: 'italic', lineHeight: 1.1 }}>
              My Wardrobe
            </h1>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-8 mb-8" style={{ borderBottom: '1px solid #e8e3de' }}>
            {[['login', 'Sign in'], ['register', 'Create account']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09890', display: 'block', marginBottom: '10px' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. wendy"
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

            {error && (
              <p style={{ ...sans, fontSize: '12px', color: '#c0392b' }}>{error}</p>
            )}

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

          <p style={{ ...sans, fontSize: '11px', color: '#c9b99a', textAlign: 'center', marginTop: '32px', letterSpacing: '0.05em' }}>
            Data saved locally in this browser
          </p>
        </div>
      </div>
    </div>
  );
}
