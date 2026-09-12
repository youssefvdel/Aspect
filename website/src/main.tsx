/* Seed the tracked-account mock BEFORE ./App is evaluated — Recon's tracker
   store reads localStorage at module load. */
import './mockDataInit';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../../src/index.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
