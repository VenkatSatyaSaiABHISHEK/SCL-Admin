'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/app/components/pwa-ui/Button';
import { useAuth } from '@/context/AuthContext';

export default function LoginContent() {
  const router = useRouter();
  const { login, currentUser, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load dotlottie web component
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.3/dist/dotlottie-wc.js';
    script.type = 'module';
    document.head.appendChild(script);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && currentUser) {
      router.push('/pwa/home');
    }
  }, [currentUser, loading, router]);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.push('/pwa/home');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setError('Invalid email or password');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts. Please try again later.');
      } else if (msg.includes('Account not found')) {
        setError('Account not found. Please contact admin.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
      {/* Login Form - Centered */}
      <div className="w-full max-w-sm">
        {/* Animation Branding */}
        <div className="text-center mb-4">
          <div className="flex justify-center">
            <dotlottie-wc 
              src="https://lottie.host/fa9c1c4a-3175-421d-b715-1e6ba38ae590/qHIKV3iGeC.lottie"
              style={{ width: '220px', height: '220px' }}
              autoplay
              loop
            />
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div>
              <label className="block text-base font-bold text-black mb-2">
                Student ID / Email
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your student ID or email"
                disabled={submitting}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all text-base text-black placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-base font-bold text-black mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={submitting}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all text-base text-black placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <Button
              onClick={() => handleLogin()}
              variant="primary"
              size="lg"
              disabled={submitting}
              className="w-full mt-6"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Helper Text */}
            <p className="text-sm text-gray-700 text-center border-t pt-4 font-medium">
              Use credentials provided by SmartCity Lab portal
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm">
          © 2026 SmartCity Lab - Attendance Management System
        </p>
      </div>
    </div>
  );
}
