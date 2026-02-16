'use client';

import dynamic from 'next/dynamic';

const SyllabusContent = dynamic(
  () => import('./syllabus-content'),
  { ssr: false }
);

export default function SyllabusPage() {
  return <SyllabusContent />;
}
