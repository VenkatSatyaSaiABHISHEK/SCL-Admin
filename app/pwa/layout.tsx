'use client';

import PWALayout from '@/app/components/pwa-ui/PWALayout';
import PWAAuthGuard from '@/app/components/PWAAuthGuard';

export default function PwaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PWAAuthGuard>
      <PWALayout>{children}</PWALayout>
    </PWAAuthGuard>
  );
}
