'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PWAPage() {
  const router = useRouter();

  useEffect(() => {
    // PWAAuthGuard will handle the redirect, but we can also redirect here
    // This only runs on the client after hydration
    router.push('/pwa/home');
  }, [router]);

  return null;
}
