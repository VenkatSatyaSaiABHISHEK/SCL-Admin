'use client';

import dynamic from 'next/dynamic';

const StudentsContent = dynamic(
  () => import('./students-content'),
  { ssr: false }
);

export default function StudentsPage() {
  return <StudentsContent />;
}
