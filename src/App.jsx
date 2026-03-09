import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';
import { logout } from './utils/auth';
import AuthScreen from './components/AuthScreen';
import WardrobeApp from './components/WardrobeApp';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for an existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user?.user_metadata?.username || null);
      setLoading(false);
    });

    // Keep user state in sync with Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user?.user_metadata?.username || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#FAF8F5', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '20px', color: '#c9b99a', fontStyle: 'italic' }}
      >
        loading…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  return <WardrobeApp user={user} onLogout={handleLogout} />;
}
