'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { LogOut, ArrowLeft, ToggleLeft, AlertCircle } from 'lucide-react';
import { getRegistrationStatus, toggleRegistrationStatus } from '@/lib/api';

export default function RegistrationControlContent() {
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAdmin) {
      router.push('/login');
    }
  }, [mounted, isAdmin, router]);

  useEffect(() => {
    if (mounted && isAdmin) {
      loadRegistrationStatus();
    }
  }, [mounted, isAdmin]);

  const loadRegistrationStatus = async () => {
    try {
      setLoading(true);
      const status = await getRegistrationStatus();
      setIsActive(status);
    } catch (error) {
      console.error('Error loading status:', error);
      setMessage('Failed to load status');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    try {
      setSaving(true);
      await toggleRegistrationStatus(!isActive);
      setIsActive(!isActive);
      setMessage(
        !isActive
          ? '🟢 Registration form is now ACTIVE'
          : '🔴 Registration form is now INACTIVE'
      );
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error toggling:', error);
      setMessage('Failed to update status');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!mounted || !isAdmin || !currentUser) {
    return <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="glass-effect-strong border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
              <ArrowLeft className="w-5 h-5 text-white/70" />
              <span className="text-white/70">Back to Dashboard</span>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-white/70 hover:text-red-300"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold text-white mb-2">Registration Control</h1>
        <p className="text-white/60 mb-8">Control whether students can submit the registration form</p>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 rounded-lg p-4 ${
              messageType === 'success'
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-red-500/20 border border-red-500/30'
            }`}
          >
            <p className={messageType === 'success' ? 'text-green-300' : 'text-red-300'}>
              {message}
            </p>
          </div>
        )}

        {/* Main Control Card */}
        <div className="glass-effect-strong rounded-2xl border border-white/15 p-8 mb-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Student Registration Form</h2>
              <p className="text-white/60">Toggle to allow or block student registrations</p>
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isActive ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
            }`}>
              <span className={isActive ? 'text-3xl text-green-400' : 'text-3xl text-red-400'}>
                {isActive ? '✓' : '✕'}
              </span>
            </div>
          </div>

          {/* Status Display */}
          <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              {isActive ? (
                <>
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-lg font-semibold text-green-400">🟢 ACTIVE</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-lg font-semibold text-red-400">🔴 INACTIVE</span>
                </>
              )}
            </div>
            <p className="text-white/70">
              {isActive
                ? 'Students can see and submit the registration form in the mobile app'
                : 'Students will see a blocked/maintenance message instead of the registration form'}
            </p>
          </div>

          {/* Info Box */}
          <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-300">
                <strong>Tip:</strong> Activate registration when you want to accept new students. 
                Deactivate during off-season or when you're busy with approvals.
              </p>
            </div>
          </div>

          {/* Toggle Button */}
          <button
            onClick={handleToggle}
            disabled={loading || saving}
            className={`w-full py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              isActive
                ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30'
                : 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ToggleLeft className="w-5 h-5" />
            {saving ? 'Updating...' : isActive ? 'Click to DEACTIVATE' : 'Click to ACTIVATE'}
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
            <h3 className="text-lg font-bold text-green-400 mb-3">✓ When to ACTIVATE</h3>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>• New semester starts</li>
              <li>• You want to recruit students</li>
              <li>• Have time to review applications</li>
              <li>• Form is ready for submissions</li>
            </ul>
          </div>

          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
            <h3 className="text-lg font-bold text-red-400 mb-3">✕ When to DEACTIVATE</h3>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>• Recruitment closed</li>
              <li>• Reviewing a large batch</li>
              <li>• Maintenance or updates</li>
              <li>• End of semester</li>
            </ul>
          </div>
        </div>

        {/* Link to Requests */}
        <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-white/70 mb-4">
            Have pending registrations to review?
          </p>
          <Link
            href="/registration-requests"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Go to Registration Requests →
          </Link>
        </div>
      </div>
    </div>
  );
}
