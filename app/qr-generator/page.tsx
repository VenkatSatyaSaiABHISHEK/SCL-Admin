'use client';

import dynamic from 'next/dynamic';

const QRGeneratorContent = dynamic(
  () => import('./qr-generator-content'),
  { ssr: false }
);

export default function QRGeneratorPage() {
  return <QRGeneratorContent />;
}
