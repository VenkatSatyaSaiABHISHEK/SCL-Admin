'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, Copy, Eye, EyeOff, Search, Download, RotateCcw, Check, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';

interface StudentData {
  id: string;
  name: string;
  rollNo: string;
  username: string;
  passwordHash: string;
  qrId: string;
  year?: string;
  backlogs?: string;
  email?: string;
  phoneNo?: string;
  linkedin?: string;
  github?: string;
  createdAt: Timestamp;
}

export default function StudentsContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [backlogsFilter, setBacklogsFilter] = useState('');
  const [filteredStudents, setFilteredStudents] = useState<StudentData[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [credentialsModal, setCredentialsModal] = useState<StudentData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncResults, setSyncResults] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAdmin) {
      router.push('/login');
    }
  }, [mounted, isAdmin, router]);

  useEffect(() => {
    if (!mounted || !isAdmin) return;

    const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentList: StudentData[] = [];
      snapshot.forEach((doc) => {
        studentList.push({
          id: doc.id,
          ...doc.data(),
        } as StudentData);
      });
      setStudents(studentList);
      setLoadingStudents(false);
    }, (error) => {
      console.error('Error fetching students:', error);
      setLoadingStudents(false);
    });

    return () => unsubscribe();
  }, [mounted, isAdmin]);

  useEffect(() => {
    let filtered = students;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q)
      );
    }

    if (yearFilter) {
      filtered = filtered.filter((s) => s.year === yearFilter);
    }

    if (backlogsFilter) {
      filtered = filtered.filter((s) => s.backlogs === backlogsFilter);
    }

    setFilteredStudents(filtered);
  }, [students, searchQuery, yearFilter, backlogsFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadCSV = () => {
    const rows = filteredStudents.map(s => {
      const uploadDate = s.createdAt?.toDate?.() || new Date();
      const formattedDate = uploadDate.toLocaleDateString('en-US');
      return [s.name, s.rollNo, s.email || '', s.phoneNo || '', s.username, s.passwordHash, s.qrId, s.year || '', s.backlogs || '', formattedDate]
        .map(field => `"${String(field).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = ['Name,Roll No,Email,Phone,Username,Password,QR ID,Year,Backlogs,Upload Date', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleSyncPasswords = async () => {
    setShowSyncConfirm(false);
    setShowSyncProgress(true);
    setSyncProgress(0);

    const results = { total: filteredStudents.length, success: 0, failed: 0, errors: [] as any[] };

    for (let i = 0; i < filteredStudents.length; i++) {
      const student = filteredStudents[i];
      setSyncProgress(Math.round((i / filteredStudents.length) * 100));

      if (!student.email) {
        results.failed++;
        results.errors.push({ name: student.name, error: 'Missing email' });
        continue;
      }

      try {
        const response = await fetch('/api/admin/resetStudentPassword', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: student.email,
            newPassword: student.passwordHash,
          }),
        });

        if (response.ok) {
          results.success++;
        } else {
          results.failed++;
          const error = await response.json();
          results.errors.push({ name: student.name, error: error.error });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ name: student.name, error: String(error) });
      }
    }

    setSyncProgress(100);
    setSyncResults(results);
  };

  const getYears = () => Array.from(new Set(students.map(s => s.year).filter(Boolean)));
  const getBacklogs = () => Array.from(new Set(students.map(s => s.backlogs).filter(Boolean)));

  if (!mounted || !isAdmin || !currentUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const activeStudents = students.filter(s => s.email).length;
  const pendingSync = students.length - activeStudents;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <User className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-lg text-gray-900">Students</span>
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition text-sm">
                ← Dashboard
              </Link>
              <Link href="/profile" className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition">
                <User className="w-5 h-5" />
              </Link>
              <button onClick={logout} className="p-2 rounded-lg hover:bg-red-50 transition text-gray-600 hover:text-red-600">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Students Management</h1>
          <p className="text-gray-600">Manage student credentials and sync passwords</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Total Students</p>
            <p className="text-3xl font-bold text-gray-900">{students.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Active Accounts</p>
            <p className="text-3xl font-bold text-green-600">{activeStudents}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Pending Sync</p>
            <p className="text-3xl font-bold text-orange-600">{pendingSync}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Last Updated</p>
            <p className="text-lg font-bold text-gray-900">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Message Alert */}
        {messageText && (
          <div className={`mb-6 rounded-lg p-4 flex items-center gap-3 ${messageType === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {messageType === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {messageText}
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {getYears().sort().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <select
              value={backlogsFilter}
              onChange={(e) => setBacklogsFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Backlogs</option>
              {getBacklogs().sort().map(backlog => (
                <option key={backlog} value={backlog}>{backlog}</option>
              ))}
            </select>

            <button
              onClick={downloadCSV}
              disabled={filteredStudents.length === 0}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-lg transition font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <button
              onClick={() => setShowSyncConfirm(true)}
              disabled={filteredStudents.length === 0}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-lg transition font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Sync
            </button>
          </div>
        </div>

        {/* Table */}
        {loadingStudents ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-300 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading students...</p>
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600">
              {students.length === 0 ? 'No students found. Upload a CSV file to get started.' : 'No students match your search.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Roll No</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Year</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Backlogs</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Credentials</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">QR ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{student.name}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{student.rollNo}</td>
                      <td className="px-6 py-4 text-gray-600">{student.email || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{student.year || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{student.backlogs || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setCredentialsModal(student)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition text-xs font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {student.qrId ? (
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-100 px-2.5 py-1 rounded text-xs font-mono text-gray-700">{student.qrId.slice(0, 8)}</code>
                            <button
                              onClick={() => copyToClipboard(student.qrId, `qr-${student.id}`)}
                              className="p-1.5 hover:bg-gray-200 rounded transition"
                              title="Copy QR ID"
                            >
                              {copied === `qr-${student.id}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
              <p className="text-gray-600">
                Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Credentials Modal */}
      {credentialsModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{credentialsModal.name}</h2>
              <button onClick={() => setCredentialsModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Username</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <code className="font-mono text-sm text-gray-900 flex-1">{credentialsModal.username}</code>
                  <button
                    onClick={() => copyToClipboard(credentialsModal.username, `user-${credentialsModal.id}`)}
                    className="p-1.5 hover:bg-gray-200 rounded transition"
                  >
                    {copied === `user-${credentialsModal.id}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Password</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <code className="font-mono text-sm text-gray-900 flex-1">
                    {showPassword ? credentialsModal.passwordHash : '••••••••'}
                  </code>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 hover:bg-gray-200 rounded transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-gray-600" /> : <Eye className="w-4 h-4 text-gray-600" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(credentialsModal.passwordHash, `pass-${credentialsModal.id}`)}
                    className="p-1.5 hover:bg-gray-200 rounded transition"
                  >
                    {copied === `pass-${credentialsModal.id}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                  </button>
                </div>
              </div>

              {credentialsModal.email && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Email</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                    <code className="font-mono text-sm text-gray-900 flex-1">{credentialsModal.email}</code>
                    <button
                      onClick={() => copyToClipboard(credentialsModal.email || '', `email-${credentialsModal.id}`)}
                      className="p-1.5 hover:bg-gray-200 rounded transition"
                    >
                      {copied === `email-${credentialsModal.id}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700"><strong>Tip:</strong> Share securely via email.</p>
              </div>

              <button
                onClick={() => setCredentialsModal(null)}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Confirm Modal */}
      {showSyncConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sync Passwords</h2>
            <p className="text-gray-600 text-sm mb-6">
              This will sync passwords to Firebase Auth for <strong>{filteredStudents.length}</strong> students.
            </p>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6">
              <p className="text-xs text-orange-700"><strong>⚠️ Warning:</strong> Ensure all students have valid emails.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSyncConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSyncPasswords}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Progress Modal */}
      {showSyncProgress && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {syncResults ? 'Sync Complete' : 'Syncing Passwords'}
            </h2>

            {!syncResults ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Progress</p>
                    <p className="text-sm font-semibold text-gray-900">{syncProgress}%</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-200" style={{ width: `${syncProgress}%` }}></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 text-center">Syncing in progress...</p>
              </>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm text-green-700 font-medium">Successful</span>
                    <span className="text-2xl font-bold text-green-600">{syncResults.success}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-sm text-red-700 font-medium">Failed</span>
                    <span className="text-2xl font-bold text-red-600">{syncResults.failed}</span>
                  </div>
                </div>

                {syncResults.errors.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-6 max-h-40 overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Errors:</p>
                    <ul className="space-y-1">
                      {syncResults.errors.map((err: any, idx: number) => (
                        <li key={idx} className="text-xs text-red-600">• {err.name}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowSyncProgress(false);
                    setSyncResults(null);
                    setSyncProgress(0);
                    setMessageText(`Synced ${syncResults.success} students successfully.`);
                    setMessageType('success');
                  }}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition font-medium"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
