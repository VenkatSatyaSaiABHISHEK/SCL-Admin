'use client';

import dynamic from 'next/dynamic';
import AdminGuard from '@/components/AdminGuard';

const PaperAttendanceContent = dynamic(
  () => import('./paper-attendance-content'),
  { ssr: false }
);

export default function PaperAttendancePage() {
  return (
    <AdminGuard>
      <PaperAttendanceContent />
    </AdminGuard>
  );
}
