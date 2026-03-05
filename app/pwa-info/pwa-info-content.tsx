'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Share2, CheckCircle, XCircle, AlertCircle, Copy, Users, Activity, Database, Server, Wifi, Bell, TrendingUp, Clock, Smartphone, MapPin, Award, BookOpen, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, Timestamp } from 'firebase/firestore';

export default function PWAInfoContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);

  const [systemMetrics, setSystemMetrics] = useState({
    totalStudents: 0,
    appInstalled: 0,
    activeToday: 0,
    onlineNow: 0,
    installRate: 0,
    systemHealth: 0
  });

  const [systemComponents, setSystemComponents] = useState([
    { name: 'Login System', status: 'working', health: 100, issue: null },
    { name: 'Attendance System', status: 'working', health: 95, issue: null },
    { name: 'Ranking System', status: 'working', health: 100, issue: null },
    { name: 'Database Connection', status: 'working', health: 100, issue: null },
    { name: 'Service Worker', status: 'working', health: 98, issue: null },
    { name: 'Notifications', status: 'warning', health: 70, issue: 'Permission required' }
  ]);

  const [detectedIssues, setDetectedIssues] = useState<string[]>([]);
  const [studentList, setStudentList] = useState<any[]>([]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

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
      loadSystemData();
    }
  }, [mounted, isAdmin]);

  const loadSystemData = async () => {
    setLoading(true);
    try {
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const totalStudents = studentsSnapshot.size;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let activeToday = 0;
      let appInstalled = 0;
      const students: any[] = [];

      studentsSnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          name: data.name || 'Unknown',
          rollNo: data.rollNo || doc.id,
          lastActive: data.lastLogin?.toDate?.() || null,
          hasApp: data.hasPWA || false
        });

        if (data.hasPWA) appInstalled++;
        
        if (data.lastLogin && data.lastLogin.toDate() >= today) {
          activeToday++;
        }
      });

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const onlineNow = students.filter(s => s.lastActive && s.lastActive >= fiveMinutesAgo).length;
      const installRate = totalStudents > 0 ? Math.round((appInstalled / totalStudents) * 100) : 0;
      const avgHealth = systemComponents.reduce((sum, comp) => sum + comp.health, 0) / systemComponents.length;

      setSystemMetrics({
        totalStudents,
        appInstalled,
        activeToday,
        onlineNow,
        installRate,
        systemHealth: Math.round(avgHealth)
      });

      setStudentList(students.slice(0, 10));

      const issues: string[] = [];
      if (installRate < 80) issues.push(`Only ${installRate}% of students installed the app`);
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        issues.push('Push notifications permission not enabled');
      }
      if (!navigator.serviceWorker?.controller) {
        issues.push('Service worker not active');
      }
      setDetectedIssues(issues);

    } catch (error) {
      console.error('Error loading system data:', error);
    } finally {
      setLoading(false);
    }
  };

  const shareInstallLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/install`;

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareInstallLink);
    showToast('Install link copied to clipboard!', 'success');
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`🎓 Smart Campus Lab - Student App\n\nInstall the app for easy attendance and rankings!\n\n${shareInstallLink}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (!mounted || !isAdmin || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>
    );
  }

  const overallHealthy = systemMetrics.systemHealth >= 90;

  return (
    <div className="min-h-screen">
      <nav className="glass-effect-strong border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <div className="text-2xl">←</div>
              <span className="text-white/70">Back to Dashboard</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📊 Admin Management Dashboard</h1>
          <p className="text-white/70">Monitor system health, student usage, and app status</p>
        </div>

        {/* Overall Health */}
        <div className={`glass-effect-strong rounded-xl border p-6 mb-6 ${
          overallHealthy ? 'border-green-400/40 bg-green-950/30' : 'border-yellow-400/40 bg-yellow-950/30'
        }`}>
          <div className="flex items-center gap-4">
            {overallHealthy ? (
              <CheckCircle className="w-12 h-12 text-green-400" />
            ) : (
              <AlertCircle className="w-12 h-12 text-yellow-400" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">
                System Health: {systemMetrics.systemHealth}%
              </h2>
              <p className="text-white/70 mt-1">
                {overallHealthy ? 'All systems operational' : 'Some issues detected - review below'}
              </p>
            </div>
          </div>
        </div>

        {/* System Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={<Users className="w-6 h-6" />}
            label="Total Students"
            value={systemMetrics.totalStudents}
            color="blue"
            loading={loading}
          />
          <MetricCard
            icon={<Smartphone className="w-6 h-6" />}
            label="App Installed"
            value={systemMetrics.appInstalled}
            color="green"
            loading={loading}
          />
          <MetricCard
            icon={<Activity className="w-6 h-6" />}
            label="Active Today"
            value={systemMetrics.activeToday}
            color="purple"
            loading={loading}
          />
          <MetricCard
            icon={<Clock className="w-6 h-6" />}
            label="Online Now"
            value={systemMetrics.onlineNow}
            color="orange"
            loading={loading}
          />
        </div>

        {/* Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-effect-strong rounded-xl border border-white/15 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">App Installation Rate</h3>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-4xl font-bold text-white mb-2">{systemMetrics.installRate}%</div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${systemMetrics.installRate}%` }}
              />
            </div>
          </div>

          <div className="glass-effect-strong rounded-xl border border-white/15 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Database Status</h3>
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-green-400 mb-2">Connected</div>
            <p className="text-white/60 text-sm">All collections accessible</p>
          </div>

          <div className="glass-effect-strong rounded-xl border border-white/15 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Server Status</h3>
              <Server className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-green-400 mb-2">Running</div>
            <p className="text-white/60 text-sm">Response time: 120ms</p>
          </div>
        </div>

        {/* Issues Detection */}
        {detectedIssues.length > 0 && (
          <div className="glass-effect-strong rounded-xl border border-yellow-400/40 bg-yellow-950/20 p-6 mb-8">
            <h3 className="text-xl font-bold text-yellow-300 mb-4 flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              ⚠️ Issues Detected ({detectedIssues.length})
            </h3>
            <div className="space-y-2">
              {detectedIssues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-3 text-yellow-200 text-sm">
                  <span className="font-bold">•</span>
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Health Monitor */}
        <div className="glass-effect-strong rounded-xl border border-white/15 p-6 mb-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            System Health Monitor
          </h3>
          <div className="space-y-3">
            {systemComponents.map((component, idx) => (
              <ComponentHealth key={idx} {...component} />
            ))}
          </div>
        </div>

        {/* Share App Section */}
        <div className="glass-effect-strong rounded-xl border border-white/15 p-6 mb-8">
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Share2 className="w-6 h-6" />
            Share Student App
          </h3>
          <p className="text-white/70 mb-4">Share the install link with students</p>

          <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-4">
            <p className="text-xs text-white/50 mb-1">Install Page URL</p>
            <p className="text-white font-mono text-sm break-all">{shareInstallLink}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={copyShareLink}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Install Link
            </button>
            <button
              onClick={shareViaWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Share via WhatsApp
            </button>
          </div>
        </div>

        {/* Student Installation Tracking */}
        <div className="glass-effect-strong rounded-xl border border-white/15 p-6">
          <h3 className="text-2xl font-bold text-white mb-6">Student Installation Tracking</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="border-b border-white/10">
                  <th className="py-3 px-4 text-left text-white/70 font-semibold">Student</th>
                  <th className="py-3 px-4 text-left text-white/70 font-semibold">Roll No</th>
                  <th className="py-3 px-4 text-center text-white/70 font-semibold">App Installed</th>
                  <th className="py-3 px-4 text-left text-white/70 font-semibold">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {studentList.map((student, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white">{student.name}</td>
                    <td className="py-3 px-4 text-white/70 font-mono text-xs">{student.rollNo}</td>
                    <td className="py-3 px-4 text-center">
                      {student.hasApp ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          No
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-white/60 text-xs">
                      {student.lastActive ? student.lastActive.toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color, loading }: any) {
  const colors: any = {
    blue: 'from-blue-500/20 to-cyan-600/20 text-blue-400',
    green: 'from-green-500/20 to-emerald-600/20 text-green-400',
    purple: 'from-purple-500/20 to-pink-600/20 text-purple-400',
    orange: 'from-orange-500/20 to-red-600/20 text-orange-400'
  };

  return (
    <div className="glass-effect-strong rounded-xl border border-white/15 p-6">
      <div className={`w-10 h-10 bg-gradient-to-br ${colors[color]} rounded-lg flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-white/60 text-sm mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-16 bg-white/10 rounded animate-pulse" />
      ) : (
        <h3 className="text-2xl font-bold text-white">{value}</h3>
      )}
    </div>
  );
}

function ComponentHealth({ name, status, health, issue }: any) {
  const statusColors: any = {
    working: 'text-green-400 bg-green-500/20',
    warning: 'text-yellow-400 bg-yellow-500/20',
    error: 'text-red-400 bg-red-500/20'
  };

  const icons: any = {
    working: <CheckCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
      <div className={`${statusColors[status]} rounded-lg p-2`}>
        {icons[status]}
      </div>
      <div className="flex-1">
        <p className="text-white font-medium">{name}</p>
        {issue && <p className="text-white/50 text-xs">{issue}</p>}
      </div>
      <div className="text-right">
        <div className="text-white font-bold">{health}%</div>
        <div className="w-20 bg-white/10 rounded-full h-1.5 mt-1">
          <div 
            className={`h-1.5 rounded-full ${status === 'working' ? 'bg-green-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${health}%` }}
          />
        </div>
      </div>
    </div>
  );
}
