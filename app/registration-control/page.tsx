'use client';

import dynamic from 'next/dynamic';

const RegistrationControlContent = dynamic(
  () => import('./registration-control-content'),
  { ssr: false }
);

export default function RegistrationControlPage() {
  return <RegistrationControlContent />;
}
