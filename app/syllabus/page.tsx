'use client';

import AdminGuard from '@/components/AdminGuard';
import SyllabusContent from './syllabus-content';

export default function SyllabusPage() {
  return (
    <AdminGuard>
      <SyllabusContent />
    </AdminGuard>
  );
}
