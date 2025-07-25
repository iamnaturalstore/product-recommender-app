// src/components/AppBridgeProvider.js
import React from 'react';
import { AppBridgeProvider as ShopifyAppBridgeProvider } from '@shopify/app-bridge-react';

export const AppBridgeProvider = ({ config, children }) => {
  return (
    <ShopifyAppBridgeProvider config={config}>
      {children}
    </ShopifyAppBridgeProvider>
  );
};
