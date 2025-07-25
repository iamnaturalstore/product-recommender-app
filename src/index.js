import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom'; // ✅ CHANGE THIS
import { AppProvider as PolarisProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HashRouter> {/* ✅ Must be HashRouter inside Shopify Admin */}
      <PolarisProvider>
        <App />
      </PolarisProvider>
    </HashRouter>
  </React.StrictMode>
);
