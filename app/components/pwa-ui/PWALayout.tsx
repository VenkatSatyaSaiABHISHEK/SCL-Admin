'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Home, MapPin, BookOpen, Trophy, User, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// Dynamic import for DotLottieReact (client-side only)
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((mod) => mod.DotLottieReact),
  { ssr: false }
);

interface PWALayoutProps {
  children: React.ReactNode;
}

export default function PWALayout({ children }: PWALayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useAuth();
  const isLoginPage = pathname === '/pwa/login';

  const navItems = [
    { path: '/pwa/home', label: 'Home', icon: Home },
    { path: '/pwa/attendance', label: 'Attendance', icon: MapPin },
    { path: '/pwa/syllabus', label: 'Syllabus', icon: BookOpen },
    { path: '/pwa/rankings', label: 'Rankings', icon: Trophy },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header - Hidden only on Login Page */}
      {!isLoginPage && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto h-14 flex items-center justify-between px-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                <DotLottieReact
                  src="https://lottie.host/7305cb50-68b1-4f1d-9367-15b915a5a891/ClWDG9riXb.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-bold text-gray-900 truncate">
                  Welcome, {currentUser?.name || 'Student'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Help Button */}
              <button
                onClick={() => router.push('/pwa/help')}
                className="w-9 h-9 bg-purple-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-100 transition-all hover:scale-105"
              >
                <HelpCircle className="w-[18px] h-[18px] text-purple-600" />
              </button>
              {/* Profile Button */}
              <button
                onClick={() => router.push('/pwa/profile')}
                className="w-9 h-9 bg-indigo-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-100 transition-all hover:scale-105"
              >
                <User className="w-[18px] h-[18px] text-indigo-600" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation - Hidden on Login Page */}
      {!isLoginPage && (
        <nav className="fixed bottom-0 left-0 right-0 pointer-events-none pb-4 px-4">
          <div className="max-w-screen-sm mx-auto bg-white rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)] border border-gray-200/60 pointer-events-auto">
            <div className="flex justify-around items-center h-16 px-2">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-200"
                  >
                    {active ? (
                      <>
                        <div className="relative">
                          <div className="w-12 h-7 bg-indigo-600 rounded-full flex items-center justify-center shadow-md">
                            <IconComponent className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600 mt-0.5">{item.label}</span>
                      </>
                    ) : (
                      <>
                        <IconComponent className="w-6 h-6 text-gray-400" strokeWidth={2} />
                        <span className="text-[9px] font-medium text-gray-400">{item.label}</span>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}

