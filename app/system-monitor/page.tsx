'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, RefreshCw, Trash2, Clock, AlertCircle, CheckCircle, Activity, Zap, Eye } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import AdminGuard from '@/components/AdminGuard';

interface SessionData {
  uid: string;
  email: string;
  role: string;
  name: string;
  loginAt: any;
  lastSeen: any;
  userAgent: string;
  platform: string;
}

interface LogData {
  id: string;
  timestamp: any;
  uid: string;
  email: string;
  role: string;
  action: string;
  page: string;
  message: string;
}

interface CheckResult {
  name: string;
  success: boolean;
  message: string;
  count?: number;
  timestamp: Date;
}

export default function SystemMonitorPage() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();

  // Current session state
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  // Firestore checks state
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [checksLoading, setChecksLoading] = useState(false);

  // Active sessions state
  const [activeSessions, setActiveSessions] = useState<SessionData[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<LogData[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && currentUser) {
      setSessionInfo(currentUser);
      loadActiveSessions();
      loadLogs();
    }
  }, [mounted, currentUser]);

  const runFirestoreChecks = async () => {
    setChecksLoading(true);
    const results: CheckResult[] = [];

    // Check 1: Read users/{uid}
    try {
      const userDoc = await getDocs(collection(db, 'users'));
      results.push({
        name: 'Read /users collection',
        success: true,
        message: `Successfully read user collection`,
        count: userDoc.size,
        timestamp: new Date(),
      });
    } catch (error) {
      results.push({
        name: 'Read /users collection',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    // Check 2: Read students count
    try {
      const studentsSnap = await getDocs(collection(db, 'students'));
      results.push({
        name: 'Read students collection',
        success: true,
        message: `Successfully read students collection`,
        count: studentsSnap.size,
        timestamp: new Date(),
      });
    } catch (error) {
      results.push({
        name: 'Read students collection',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    // Check 3: Read attendance count
    try {
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      results.push({
        name: 'Read attendance collection',
        success: true,
        message: `Successfully read attendance collection`,
        count: attendanceSnap.size,
        timestamp: new Date(),
      });
    } catch (error) {
      results.push({
        name: 'Read attendance collection',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    // Check 4: Read announcements count
    try {
      const announcementsSnap = await getDocs(collection(db, 'announcements'));
      results.push({
        name: 'Read announcements collection',
        success: true,
        message: `Successfully read announcements collection`,
        count: announcementsSnap.size,
        timestamp: new Date(),
      });
    } catch (error) {
      results.push({
        name: 'Read announcements collection',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    // Check 5: Read syllabus count
    try {
      const syllabusSnap = await getDocs(collection(db, 'syllabus'));
      results.push({
        name: 'Read syllabus collection',
        success: true,
        message: `Successfully read syllabus collection`,
        count: syllabusSnap.size,
        timestamp: new Date(),
      });
    } catch (error) {
      results.push({
        name: 'Read syllabus collection',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    // Check 6: Read teams + teamScores
    try {
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const scoresSnap = await getDocs(collection(db, 'teamScores'));
      results.push({
        name: 'Read teams + teamScores',
        success: true,
        message: `Teams: ${teamsSnap.size}, Scores: ${scoresSnap.size}`,
        count: teamsSnap.size + scoresSnap.size,
        timestamp: new Date(),
      });
    } catch (error) {
      results.push({
        name: 'Read teams + teamScores',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    setChecks(results);
    setChecksLoading(false);
  };

  const loadActiveSessions = async () => {
    setSessionsLoading(true);
    try {
      const sessionsSnap = await getDocs(collection(db, 'activeSessions'));
      const data: SessionData[] = [];
      sessionsSnap.forEach((doc) => {
        const session = doc.data() as SessionData;
        data.push(session);
      });
      setActiveSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
    setSessionsLoading(false);
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const logsQuery = query(
        collection(db, 'logs'),
        orderBy('timestamp', 'desc'),
        limit(15)
      );
      const logsSnap = await getDocs(logsQuery);
      const data: LogData[] = [];
      logsSnap.forEach((doc) => {
        data.push({
          id: doc.id,
          ...(doc.data() as any),
        });
      });
      setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
    setLogsLoading(false);
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      return;
    }

    try {
      const logsSnap = await getDocs(collection(db, 'logs'));
      logsSnap.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
      setLogs([]);
    } catch (error) {
      alert('Error clearing logs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const isSessionOnline = (lastSeen: any): boolean => {
    if (!lastSeen) return false;
    const lastSeenTime = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastSeenTime.getTime()) / 1000;
    return diffSeconds < 60;
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (!mounted || !isAdmin || !currentUser) {
    return <div className="flex items-center justify-center min-h-screen bg-white">Loading...</div>;
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Navbar */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-75 transition">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-lg text-slate-900 hidden sm:inline">
                  System Monitor
                </span>
              </Link>

              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 transition text-sm font-medium"
                >
                  ← Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-red-50 transition text-slate-600 hover:text-red-600"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="flex justify-between items-start mb-8 animate-fade-in">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">System Monitor</h1>
              <p className="text-slate-500">Realtime backend + authentication flow status</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadActiveSessions}
                className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-600"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={runFirestoreChecks}
                disabled={checksLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-400 text-white font-semibold transition shadow-sm hover:shadow-md"
              >
                <RefreshCw className={`w-4 h-4 ${checksLoading ? 'animate-spin' : ''}`} />
                Run All Checks
              </button>
            </div>
          </div>

          {/* Current Session - 4 Mini Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12 animate-fade-in">
            <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm hover:shadow-md transition">
              <p className="text-slate-500 text-sm font-medium mb-2">Name</p>
              <p className="text-slate-900 font-bold text-lg">{sessionInfo?.name || 'N/A'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm hover:shadow-md transition">
              <p className="text-slate-500 text-sm font-medium mb-2">Email</p>
              <p className="text-slate-900 font-semibold text-sm break-all">{sessionInfo?.email || 'N/A'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm hover:shadow-md transition">
              <p className="text-slate-500 text-sm font-medium mb-2">Role</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                sessionInfo?.role === 'admin'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-green-100 text-green-700 border border-green-300'
              }`}>
                {sessionInfo?.role?.toUpperCase() || 'N/A'}
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm hover:shadow-md transition">
              <p className="text-slate-500 text-sm font-medium mb-2">UID</p>
              <p className="text-slate-900 font-mono text-xs break-all">{sessionInfo?.uid?.substring(0, 12) || 'N/A'}...</p>
            </div>
          </div>

          {/* Firestore Health Checks */}
          <div className="mb-12 animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-blue-600" />
              Firestore Health Checks
            </h2>

            {checks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {checks.map((check, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-6 shadow-sm hover:shadow-md transition ${
                      check.success
                        ? 'border-green-200 bg-white/70'
                        : 'border-red-200 bg-white/70'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {check.success ? (
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                        ) : (
                          <div className="p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{check.name}</p>
                          <p className={`text-sm ${check.success ? 'text-green-600' : 'text-red-600'} font-medium`}>
                            {check.success ? 'Success' : 'Failed'}
                          </p>
                        </div>
                      </div>
                      {check.count !== undefined && (
                        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                          {check.count}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-sm mb-2">{check.message}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {check.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-8 text-center shadow-sm">
                <Zap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Click "Run All Checks" to test Firestore connections</p>
              </div>
            )}
          </div>

          {/* Active Users Online */}
          <div className="mb-12 animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Eye className="w-6 h-6 text-blue-600" />
              Active Users Online
            </h2>

            <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                      <th className="px-6 py-4 text-left text-slate-900 text-sm font-semibold">Name</th>
                      <th className="px-6 py-4 text-left text-slate-900 text-sm font-semibold">Email</th>
                      <th className="px-6 py-4 text-left text-slate-900 text-sm font-semibold">Role</th>
                      <th className="px-6 py-4 text-left text-slate-900 text-sm font-semibold">Login Time</th>
                      <th className="px-6 py-4 text-left text-slate-900 text-sm font-semibold">Last Seen</th>
                      <th className="px-6 py-4 text-left text-slate-900 text-sm font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.length > 0 ? (
                      activeSessions.map((session) => (
                        <tr key={session.uid} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="px-6 py-4 text-slate-900 text-sm font-medium">{session.name}</td>
                          <td className="px-6 py-4 text-slate-600 text-sm font-mono">{session.email}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                              session.role === 'admin'
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-green-100 text-green-700 border border-green-300'
                            }`}>
                              {session.role?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-sm">{formatDate(session.loginAt)}</td>
                          <td className="px-6 py-4 text-slate-600 text-sm">{formatTime(session.lastSeen)}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 w-fit ${
                              isSessionOnline(session.lastSeen)
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-slate-200 text-slate-700 border border-slate-300'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${isSessionOnline(session.lastSeen) ? 'bg-green-600 animate-pulse' : 'bg-slate-500'}`}></span>
                              {isSessionOnline(session.lastSeen) ? 'Online' : 'Offline'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <Zap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-500 font-medium">⚡ No active sessions yet</p>
                          <p className="text-slate-400 text-sm">Sessions will appear here when users login</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Logs */}
          <div className="mb-12 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-600" />
                Recent Logs
              </h2>
              <button
                onClick={clearLogs}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 border border-red-300 text-red-600 text-sm font-semibold transition"
              >
                <Trash2 className="w-4 h-4" />
                Clear Logs
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur overflow-hidden shadow-sm">
              <div className="max-h-96 overflow-y-auto">
                {logs.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {logs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-slate-50 transition">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <p className="text-slate-400 text-xs font-mono min-w-fit">
                              {formatTime(log.timestamp)}
                            </p>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full min-w-fit flex-shrink-0 ${
                              log.role === 'admin'
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-green-100 text-green-700 border border-green-300'
                            }`}>
                              {log.role?.toUpperCase()}
                            </span>
                            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 min-w-fit flex-shrink-0">
                              {log.action}
                            </span>
                          </div>
                        </div>
                        <p className="text-slate-700 text-sm">{log.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 font-medium">No logs yet</p>
                    <p className="text-slate-400 text-sm">Logs will appear as system events occur</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
