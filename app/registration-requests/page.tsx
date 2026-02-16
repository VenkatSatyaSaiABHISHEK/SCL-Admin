'use client';

import dynamic from 'next/dynamic';

const RegistrationRequestsContent = dynamic(
  () => import('./registration-requests-content'),
  { ssr: false }
);

export default function RegistrationRequestsPage() {
  return <RegistrationRequestsContent />;
}
