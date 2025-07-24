import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import {
  AppBridgeProvider
} from '@shopify/app-bridge-react';
import { getSessionToken } from '@shopify/app-bridge-utils';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider as PolarisProvider } from '@shopify/polaris';

import '@shopify/polaris/build/esm/styles.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

const host = new URLSearchParams(window.location.search).get('host');

root.render(
  <BrowserRouter>
    <PolarisProvider>
      <AppBridgeProvider
        config={{
          apiKey: 'YOUR_SHOPIFY_API_KEY', // we'll dynamically inject this later
          host: host,
          forceRedirect: true
        }}
      >
        <App />
      </AppBridgeProvider>
    </PolarisProvider>
  </BrowserRouter>
);
