'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function PWAAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Use real Firebase Auth state — not localStorage
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const isLoginPage = pathname === '/pwa/login';

      if (user) {
        setIsAuthenticated(true);
        setIsLoading(false);
        if (isLoginPage) {
          router.push('/pwa/home');
        }
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
        if (!isLoginPage) {
          router.push('/pwa/login');
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (pathname === '/pwa/login') {
    return <>{children}</>;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-700 font-medium">Redirecting to login...</p>
      </div>
    </div>
  );
}
