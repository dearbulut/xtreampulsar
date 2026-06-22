import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Synchronously apply saved theme before first paint to prevent flash
try {
  const stored = localStorage.getItem('xp-ui');
  if (stored) {
    const parsed = JSON.parse(stored) as { state?: { theme?: string } };
    if (parsed?.state?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }
} catch {
  // ignore malformed storage
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
