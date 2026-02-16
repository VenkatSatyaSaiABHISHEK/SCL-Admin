'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';

interface AdminGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Admin Guard - Protects admin-only pages
 * If not logged in → redirects to /login
 * If role != admin → redirects to /student-dashboard
 */
export default function AdminGuard({ children, redirectTo = '/student-dashboard' }: AdminGuardProps) {
  const { currentUser, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;

    if (!currentUser) {
      // Not logged in
      router.push('/login');
      return;
    }

    if (!isAdmin) {
      // Logged in but not admin
      router.push(redirectTo);
      return;
    }
  }, [mounted, loading, currentUser, isAdmin, router, redirectTo]);

  if (!mounted || loading || !currentUser || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white/70">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
