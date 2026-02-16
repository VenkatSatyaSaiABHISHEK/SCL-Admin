'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { User, Upload, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function ProfileContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const [logoPreview, setLogoPreview] = useState('/logo.svg');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAdmin) {
      router.push('/login');
    }

    // Load custom logo from localStorage
    const customLogo = localStorage.getItem('customLogo');
    if (customLogo) {
      setLogoPreview(customLogo);
    }
  }, [mounted, isAdmin, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select a valid image file');
      setMessageType('error');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setMessage('File size must be less than 2MB');
      setMessageType('error');
      return;
    }

    // Convert to base64 and save
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      localStorage.setItem('customLogo', base64);
      setLogoPreview(base64);
      setMessage('Logo uploaded successfully!');
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    };
    reader.readAsDataURL(file);
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
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <img src={logoPreview} alt="Smart City Lab" className="h-8 w-8 rounded-md" />
              <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent hidden sm:inline">
                Smart City Lab
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="p-2 rounded-lg text-white/70 hover:bg-white/10 transition">
                ← Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-500/20 transition text-white/70 hover:text-red-300"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Profile</h1>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Info */}
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-xl flex items-center justify-center">
                <User className="w-8 h-8 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{currentUser.name}</h2>
                <p className="text-white/60 text-sm">Administrator</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-white/60 text-sm">Email</p>
                <p className="text-white font-medium">{currentUser.email}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Role</p>
                <p className="text-white font-medium">Admin</p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Status</p>
                <p className="text-green-400 font-medium">✓ Active</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="premium-btn-primary w-full mt-6"
            >
              <LogOut className="w-4 h-4 inline mr-2" />
              Logout
            </button>
          </div>

          {/* Logo Upload */}
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Logo Management</h3>

            <div className="mb-6">
              <p className="text-white/60 text-sm mb-4">Current Logo Preview</p>
              <div className="w-full h-48 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-xl flex items-center justify-center border border-white/15">
                <img
                  src={logoPreview}
                  alt="Logo Preview"
                  className="max-w-full max-h-full rounded-lg"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500/30 transition">
                  <Upload className="w-8 h-8 text-cyan-300 mx-auto mb-2" />
                  <p className="text-white/80 text-sm font-medium">Click to upload or drag</p>
                  <p className="text-white/50 text-xs">PNG, JPG, GIF (Max 2MB)</p>
                </div>
              </label>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-200 text-xs">
                <strong>Recommended:</strong> 400x400px square PNG image for best results
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
