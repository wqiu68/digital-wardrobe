import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import posthog from 'posthog-js';
import './index.css';
import App from './App.jsx';

posthog.init('phc_fONqb2oahZCPcUTXrrE4ordaCasfXH58QX1QQkflf9f', {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
