import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider as PolarisProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

import App from './App';
import AppBridgeProvider from './components/AppBridgeProvider';

const apiKey = new URLSearchParams(window.location.search).get('shopifyApiKey') || process.env.REACT_APP_SHOPIFY_API_KEY;
const host = new URLSearchParams(window.location.search).get('host');

const config = {
  apiKey,
  host,
  forceRedirect: true,
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HashRouter>
      <AppBridgeProvider config={config}>
        <PolarisProvider>
          <App />
        </PolarisProvider>
      </AppBridgeProvider>
    </HashRouter>
  </React.StrictMode>
);
