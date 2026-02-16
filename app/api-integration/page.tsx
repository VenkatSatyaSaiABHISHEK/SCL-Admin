'use client';

import dynamic from 'next/dynamic';

const ApiIntegrationContent = dynamic(
  () => import('./api-integration-content'),
  { ssr: false }
);

export default function ApiIntegrationPage() {
  return <ApiIntegrationContent />;
}
