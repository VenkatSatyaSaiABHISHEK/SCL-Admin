'use client';

import dynamic from 'next/dynamic';
import AdminGuard from '@/components/AdminGuard';

const SyllabusContent = dynamic(
  () => import('./syllabus-content'),
  { ssr: false }
);

export default function SyllabusPage() {
  return (
    <AdminGuard>
      <SyllabusContent />
    </AdminGuard>
  );
}
