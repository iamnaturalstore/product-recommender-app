import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider as PolarisProvider } from '@shopify/polaris';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <PolarisProvider>
        <App />
      </PolarisProvider>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
);
