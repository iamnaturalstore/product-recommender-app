import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider as PolarisProvider } from '@shopify/polaris';

import '@shopify/polaris/build/esm/styles.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <PolarisProvider>
        <App />
      </PolarisProvider>
    </BrowserRouter>
  </React.StrictMode>
);
