'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <span className="text-white text-4xl">🎓</span>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Redirecting...</p>
      </div>
    </div>
  );
}
