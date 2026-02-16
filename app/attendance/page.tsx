'use client';

import dynamic from 'next/dynamic';

const AttendanceContent = dynamic(
  () => import('./attendance-content'),
  { ssr: false }
);

export default function AttendancePage() {
  return <AttendanceContent />;
}
