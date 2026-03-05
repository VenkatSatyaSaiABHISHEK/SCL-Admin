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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const isLoginPage = pathname === '/pwa/login';

      if (user) {
        // Check if user is a student (not admin)
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          
          // Check students collection
          const studentDoc = await getDoc(doc(db, 'students', user.uid));
          const isStudent = studentDoc.exists();
          
          // Check users collection for role
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const isAdmin = userDoc.exists() && userDoc.data()?.role === 'admin';
          
          if (isAdmin) {
            // Admin trying to access PWA - logout and redirect to login
            await auth.signOut();
            setIsAuthenticated(false);
            setIsLoading(false);
            router.push('/pwa/login');
            return;
          }
          
          if (isStudent) {
            setIsAuthenticated(true);
            setIsLoading(false);
            if (isLoginPage) {
              router.push('/pwa/home');
            }
          } else {
            // Not a valid student
            await auth.signOut();
            setIsAuthenticated(false);
            setIsLoading(false);
            router.push('/pwa/login');
          }
        } catch (error) {
          console.error('Error checking user role:', error);
          setIsAuthenticated(false);
          setIsLoading(false);
          router.push('/pwa/login');
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
