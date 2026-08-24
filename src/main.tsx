import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'system';
const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
if (isDark) {
  document.documentElement.classList.add('dark');
}

// Initialize font size
const savedFontSize = localStorage.getItem('fontSize') || 'Medium';
document.documentElement.setAttribute('data-font-size', savedFontSize.toLowerCase());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
