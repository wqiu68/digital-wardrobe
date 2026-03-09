import { useState } from 'react';
import { getSession } from './utils/auth';
import AuthScreen from './components/AuthScreen';
import WardrobeApp from './components/WardrobeApp';

export default function App() {
  const [user, setUser] = useState(() => getSession()?.username || null);

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  return <WardrobeApp user={user} onLogout={() => setUser(null)} />;
}
