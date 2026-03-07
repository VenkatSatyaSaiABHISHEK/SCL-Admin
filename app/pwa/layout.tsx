'use client';

import PWALayout from '@/app/components/pwa-ui/PWALayout';
import PWAAuthGuard from '@/app/components/PWAAuthGuard';
import PWAErrorBoundary from '@/app/components/PWAErrorBoundary';
import ServiceWorkerProvider from '@/components/ServiceWorkerProvider';

export default function PwaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PWAErrorBoundary>
      <PWAAuthGuard>
        <ServiceWorkerProvider />
        <PWALayout>{children}</PWALayout>
      </PWAAuthGuard>
    </PWAErrorBoundary>
  );
}
