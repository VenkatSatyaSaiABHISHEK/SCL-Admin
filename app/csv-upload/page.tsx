'use client';

import dynamic from 'next/dynamic';

const CsvUploadContent = dynamic(
  () => import('./csv-upload-content'),
  { ssr: false }
);

export default function CsvUploadPage() {
  return <CsvUploadContent />;
}
