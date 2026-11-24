import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { isCompanySiteHost } from './site/domainRouting';

const showCompanySite = isCompanySiteHost();
const App = lazy(() => import('./App.jsx'));
const SijitekSite = lazy(() => import('./site/SijitekSite.jsx'));

// Only register the RoofCalc Pro PWA service worker on the RoofCalc app host
if (!showCompanySite && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const isSecure =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (isSecure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Non-fatal SW registration failure
      });
    });
  }
}

const fallbackLoader = (
  <div
    style={{
      minHeight: '100dvh',
      background: '#070b14',
      color: '#94a3b8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontWeight: 600,
    }}
  >
    Loading Sijitek Solutions...
  </div>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={fallbackLoader}>
      {showCompanySite ? <SijitekSite /> : <App />}
    </Suspense>
  </StrictMode>
);
