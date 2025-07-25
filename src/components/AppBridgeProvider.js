// src/components/AppBridgeProvider.js
import React from 'react';
import { Provider } from '@shopify/app-bridge-react';

/**
 * Wraps children in Shopify App Bridge Provider
 * @param {object} config - Shopify app config
 */
export const AppBridgeProvider = ({ config, children }) => {
  return <Provider config={config}>{children}</Provider>;
};
