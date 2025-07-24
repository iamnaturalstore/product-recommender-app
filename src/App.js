import React from 'react';
import { Page, Layout, Card, Text } from '@shopify/polaris';

function App() {
  return (
    <Page title="Ask Taylah">
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Welcome to your Shopify App!
            </Text>
            <Text as="p">
              This is now embedded inside Shopify Admin using App Bridge + Polaris.
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default App;
