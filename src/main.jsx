import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Register lightweight PWA service worker (never caches HTML/API so deploys remain instant)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          if (reg.active?.scriptURL && !reg.active.scriptURL.endsWith('/sw.js')) {
            reg.unregister().catch(() => {});
          }
        }
        return navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      })
      .catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
