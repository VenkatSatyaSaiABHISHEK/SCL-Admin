'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState('/logo.svg');
  const [gradientPos, setGradientPos] = useState({ x: 50, y: 50 });
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { login, currentUser, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    // Load custom logo from localStorage
    const customLogo = localStorage.getItem('customLogo');
    if (customLogo) {
      setLogoPreview(customLogo);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (mounted && !authLoading && currentUser) {
      // User is already logged in, redirect to appropriate dashboard
      if (isAdmin) {
        router.push('/dashboard');
      } else {
        router.push('/student-dashboard');
      }
    }
  }, [mounted, authLoading, currentUser, isAdmin, router]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setGradientPos({ x, y });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Will be redirected based on role by AuthContext
      // Admin → /dashboard, Student → /student-dashboard
      // We'll let the useEffect on dashboard/student-dashboard handle the redirect
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking auth persistence
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white/70">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background: `radial-gradient(circle 800px at ${gradientPos.x}% ${gradientPos.y}%, rgba(59, 130, 246, 0.15) 0%, transparent 80%), 
                     linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)`
      }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-full blur-3xl animate-pulse animation-delay-2000" />
      </div>

      <div className="glass-effect-strong rounded-2xl p-8 w-full max-w-md relative z-10"
        style={{
          boxShadow: `0 0 60px rgba(59, 130, 246, ${0.1 + (50 - Math.abs(gradientPos.x - 50)) / 500})`
        }}
      >
        <div className="text-center mb-8">
          <img src={logoPreview} alt="Smart City Lab" className="h-16 w-16 mx-auto mb-4 rounded-lg" />
          <h1 className="text-3xl font-bold text-white mb-2">Smart City Lab</h1>
          <p className="text-white/60">Student & Admin Login</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="premium-input"
              required
            />
          </div>

          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="premium-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="premium-btn-primary w-full"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-white/50 text-center text-sm mt-6">
          Admin login - Enter your email and password
        </p>
      </div>
    </div>
  );
}
