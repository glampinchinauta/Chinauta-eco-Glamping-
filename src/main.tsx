import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { auth } from './lib/firebase';

// Send the signed-in admin's Firebase token with every /api request so the server can verify it.
const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.includes('/api/') && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      init = { ...init, headers: { ...(init.headers as Record<string, string> || {}), Authorization: `Bearer ${token}` } };
    } catch {
      // If the token cannot be read, the request goes without it and the server decides.
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
