'use client';

import dynamic from 'next/dynamic';

const AttendanceReportsContent = dynamic(
  () => import('./attendance-reports-content'),
  { ssr: false }
);

export default function AttendanceReportsPage() {
  return <AttendanceReportsContent />;
}
