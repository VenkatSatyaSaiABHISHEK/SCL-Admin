'use client';

import AdminGuard from '@/components/AdminGuard';
import PaperAttendanceContent from './paper-attendance-content';

export default function PaperAttendancePage() {
  return (
    <AdminGuard>
      <PaperAttendanceContent />
    </AdminGuard>
  );
}
