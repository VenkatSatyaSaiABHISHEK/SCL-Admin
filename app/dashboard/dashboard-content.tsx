'use client';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sun, Moon, LogOut, User, CheckCircle, Users, MessageSquare, BookOpen, Upload, Wifi, FileText, QrCode, Database, Award, TrendingUp, Trash2, UserRound, Activity } from 'lucide-react';
import Link from 'next/link';
import { getStatistics } from '@/lib/api';
import StorageUsageCard from '@/components/StorageUsageCard';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DashboardContent() {
  const [mounted, setMounted] = useState(false);
  const [logoPreview, setLogoPreview] = useState('/logo.svg');
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const { currentUser, isAdmin, logout, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    topAttendanceStudent: 'N/A',
    topAttendancePercent: 0,
    topTeamName: 'N/A',
    totalAnnouncements: 0,
    totalMentors: 0,
  });

  useEffect(() => {
    setMounted(true);
    // Load custom logo from localStorage
    const customLogo = localStorage.getItem('customLogo');
    if (customLogo) {
      setLogoPreview(customLogo);
    }
  }, []);

  useEffect(() => {
    // Wait for auth to finish loading before deciding to redirect
    if (!mounted || loading) return;

    if (!isAdmin && currentUser) {
      // Student trying to access admin dashboard
      router.push('/student-dashboard');
    } else if (!currentUser) {
      // Not logged in at all
      router.push('/login');
    }
  }, [mounted, loading, isAdmin, currentUser, router]);

  useEffect(() => {
    if (mounted && isAdmin) {
      loadStats();
    }
  }, [mounted, isAdmin]);

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      
      const data = await getStatistics();
      const mentorsSnapshot = await getDocs(collection(db, 'mentors'));
      
      setStats({
        totalStudents: data?.totalStudents || 0,
        presentToday: data?.presentToday || 0,
        topAttendanceStudent: data?.topAttendanceStudent || 'N/A',
        topAttendancePercent: data?.topAttendancePercent || 0,
        topTeamName: data?.topTeamName || 'N/A',
        totalAnnouncements: data?.totalAnnouncements || 0,
        totalMentors: mentorsSnapshot.size,
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard stats';
      setStatsError(errorMessage);
    } finally {
      setStatsLoading(false);
    }
  };

  if (!mounted || loading || !isAdmin || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white/70">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="glass-effect-strong border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={logoPreview} alt="Smart City Lab" className="h-8 w-8 rounded-md" />
              <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent hidden sm:inline">
                Smart City Lab
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <Link
                href="/profile"
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Profile"
              >
                <User className="w-5 h-5" />
              </Link>

              <button
                onClick={logout}
                className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-white/70 hover:text-red-300"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-white/60">Welcome to Smart City Lab Admin, {currentUser.name}</p>
        </div>

        {/* Error Alert with Instructions */}
        {statsError && statsError.includes('permissions') && (
          <div className="mb-8 glass-effect-strong rounded-2xl border border-red-500/30 p-8 bg-gradient-to-br from-red-950/30 to-orange-950/20">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🔐</div>
              <div className="flex-1">
                <h3 className="text-red-300 font-bold text-lg mb-3">Firestore Permissions Error</h3>
                <p className="text-red-200/80 text-sm mb-4">
                  The dashboard cannot read data because Firestore Security Rules haven't been published yet.
                </p>
                
                <div className="bg-white/5 rounded-lg p-4 mb-4 border border-white/10">
                  <p className="text-white/80 font-semibold text-sm mb-3">📋 Quick Fix (3 steps):</p>
                  <ol className="space-y-2 text-white/70 text-sm">
                    <li>
                      <span className="font-semibold text-white">1.</span> Open <span className="text-cyan-400 font-mono">FIRESTORE_RULES.txt</span> from your project
                    </li>
                    <li>
                      <span className="font-semibold text-white">2.</span> Copy ALL the rules (Ctrl+A, Ctrl+C)
                    </li>
                    <li>
                      <span className="font-semibold text-white">3a.</span> Go to <span className="text-cyan-400">Firebase Console</span> → Your Project
                    </li>
                    <li>
                      <span className="font-semibold text-white">3b.</span> Click <span className="text-cyan-400">Firestore Database</span> → <span className="text-cyan-400">Rules</span> tab
                    </li>
                    <li>
                      <span className="font-semibold text-white">3c.</span> Clear the editor, paste the rules, and click <span className="text-cyan-400">Publish</span>
                    </li>
                    <li>
                      <span className="font-semibold text-white">4.</span> Wait 10-15 seconds, then refresh this page
                    </li>
                  </ol>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-yellow-500/20">
                  <p className="text-yellow-300 text-xs font-semibold mb-2">⚠️ What the rules enable:</p>
                  <ul className="text-white/60 text-xs space-y-1">
                    <li>✓ Read student data from Firestore (for dashboard stats)</li>
                    <li>✓ Read attendance records (for today's count)</li>
                    <li>✓ Read mentor data (for mentors count)</li>
                    <li>✓ Write permissions for admin operations</li>
                  </ul>
                </div>

                <button
                  onClick={() => loadStats()}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
                >
                  🔄 Retry Loading Stats
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generic Error Alert */}
        {statsError && !statsError.includes('permissions') && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-300 text-sm font-medium">❌ Error Loading Stats</p>
            <p className="text-red-200 text-sm mt-1">{statsError}</p>
            <button
              onClick={() => loadStats()}
              className="mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-all"
            >
              🔄 Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          {statsLoading && !statsError ? (
            // Loading Skeletons
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="glass-effect-strong rounded-2xl border border-white/15 p-6 animate-pulse">
                  <p className="text-white/80 text-sm font-medium h-4 bg-white/10 rounded w-32 mb-4"></p>
                  <h3 className="text-3xl font-bold text-white mt-2 h-10 bg-white/10 rounded w-16 mb-4"></h3>
                  <p className="text-white/60 text-xs mt-2 h-3 bg-white/10 rounded w-24"></p>
                </div>
              ))}
            </>
          ) : statsError ? (
            // Error State
            <div className="col-span-full py-8 text-center">
              <p className="text-red-400 text-lg font-medium">⚠️ Unable to Load Statistics</p>
              <p className="text-red-300 text-sm mt-2">{statsError}</p>
            </div>
          ) : (
            // Actual Stats
            <>
              <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
                <p className="text-white/80 text-sm font-medium">Total Students</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.totalStudents}</h3>
                <p className="text-white/60 text-xs mt-2">Registered students</p>
              </div>
              <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
                <p className="text-white/80 text-sm font-medium">Present Today</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.presentToday}</h3>
                <p className="text-white/60 text-xs mt-2">Students marked present</p>
              </div>
              <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
                <p className="text-white/80 text-sm font-medium">Top Attendance</p>
                <h3 className="text-lg font-bold text-white mt-2">{stats.topAttendanceStudent}</h3>
                <p className="text-green-400 text-xs mt-2">{stats.topAttendancePercent}% attendance</p>
              </div>
              <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
                <p className="text-white/80 text-sm font-medium">Top Team</p>
                <h3 className="text-lg font-bold text-white mt-2">{stats.topTeamName}</h3>
                <p className="text-white/60 text-xs mt-2">By total points</p>
              </div>
              <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
                <p className="text-white/80 text-sm font-medium">Total Mentors</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.totalMentors}</h3>
                <p className="text-white/60 text-xs mt-2">Active mentors</p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/attendance" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-blue-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Mark Attendance</h3>
            <p className="text-white/60 text-sm">Scan student QR codes</p>
          </Link>

          <Link href="/attendance-reports" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-purple-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-xl flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Reports</h3>
            <p className="text-white/60 text-sm">Attendance history & export</p>
          </Link>

          <Link href="/csv-upload" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-green-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">CSV Upload</h3>
            <p className="text-white/60 text-sm">Import students & credentials</p>
          </Link>

          <Link href="/students" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-indigo-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-xl flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Students</h3>
            <p className="text-white/60 text-sm">View all students data</p>
          </Link>

          <Link href="/qr-generator" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-yellow-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-orange-600/20 rounded-xl flex items-center justify-center mb-4">
              <QrCode className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">QR Generator</h3>
            <p className="text-white/60 text-sm">Test QR codes</p>
          </Link>

          <Link href="/rankings" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-amber-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-yellow-600/20 rounded-xl flex items-center justify-center mb-4">
              <Award className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Rankings</h3>
            <p className="text-white/60 text-sm">View student & team rankings</p>
          </Link>

          <Link href="/teams" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-pink-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500/20 to-rose-600/20 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Teams</h3>
            <p className="text-white/60 text-sm">Create & manage teams</p>
          </Link>

          <Link href="/task-marks" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-green-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-lime-600/20 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Task Marks</h3>
            <p className="text-white/60 text-sm">Score team tasks</p>
          </Link>

          <Link href="/announcements" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-blue-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-xl flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Announcements</h3>
            <p className="text-white/60 text-sm">Send messages</p>
          </Link>

          <Link href="/syllabus" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-blue-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Syllabus</h3>
            <p className="text-white/60 text-sm">Upload materials</p>
          </Link>

          <Link href="/api-integration" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-cyan-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl flex items-center justify-center mb-4">
              <Wifi className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">API Integration</h3>
            <p className="text-white/60 text-sm">Backend documentation</p>
          </Link>

          <Link href="/data-management" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-red-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-orange-600/20 rounded-xl flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Data Management</h3>
            <p className="text-white/60 text-sm">Delete files & collections</p>
          </Link>

          <Link href="/mentors" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-purple-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-xl flex items-center justify-center mb-4">
              <UserRound className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Mentors</h3>
            <p className="text-white/60 text-sm">Manage mentors & guides</p>
          </Link>

          <Link href="/system-monitor" className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-emerald-500/30 transition-all cursor-pointer hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-xl flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">System Monitor</h3>
            <p className="text-white/60 text-sm">Backend health & real-time logs</p>
          </Link>

          <StorageUsageCard />
        </div>
      </div>
    </div>
  );
}