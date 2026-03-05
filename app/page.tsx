'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Script from 'next/script';

export default function Home() {
  const { currentUser, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser && isAdmin) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [currentUser, isAdmin, loading, router]);

  return (
    <>
      <Script 
        src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.3/dist/dotlottie-wc.js" 
        type="module"
        strategy="beforeInteractive"
      />
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="flex items-center justify-center mx-auto mb-6">
            {/* @ts-ignore */}
            <dotlottie-wc 
              src="https://lottie.host/94fd96de-ccd4-4c96-a074-697be169dcb6/bpu8TIzVQV.lottie" 
              style={{ width: '300px', height: '300px' }}
              autoplay="" 
              loop=""
            />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Redirecting...</p>
        </div>
      </div>
    </>
  );
}
