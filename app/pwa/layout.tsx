'use client';

import PWALayout from '@/app/components/pwa-ui/PWALayout';
import PWAAuthGuard from '@/app/components/PWAAuthGuard';
import ServiceWorkerProvider from '@/components/ServiceWorkerProvider';

export default function PwaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PWAAuthGuard>
      <ServiceWorkerProvider />
      <PWALayout>{children}</PWALayout>
    </PWAAuthGuard>
  );
}
