import React from 'react';
import AppBridgeReact from '@shopify/app-bridge-react'; // ✅ CORRECT for v4.2.0

const AppBridgeProvider = ({ config, children }) => {
  return (
    <AppBridgeReact config={config}>
      {children}
    </AppBridgeReact>
  );
};

export default AppBridgeProvider;
