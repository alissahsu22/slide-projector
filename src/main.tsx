import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { syncShelfRow } from './experience/curation';
import './index.css';

// Before the first frame: the magazines take their opening pose from the shelf
// row, so fitting it afterwards would make them slide across on load.
syncShelfRow(window.innerWidth, window.innerHeight);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
