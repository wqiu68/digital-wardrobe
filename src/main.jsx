import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import posthog from 'posthog-js';
import './index.css';
import App from './App.jsx';

// Don't let the browser restore an old scroll position on load (e.g. after Google sign-in)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

posthog.init('phc_fONqb2oahZCPcUTXrrE4ordaCasfXH58QX1QQkflf9f', {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
