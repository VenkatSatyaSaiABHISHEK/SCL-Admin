'use client';

import dynamic from 'next/dynamic';

const AnnouncementsContent = dynamic(
  () => import('./announcements-content'),
  { ssr: false }
);

export default function AnnouncementsPage() {
  return <AnnouncementsContent />;
}
