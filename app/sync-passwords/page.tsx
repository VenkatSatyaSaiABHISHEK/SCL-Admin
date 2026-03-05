'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import { Loader, AlertTriangle, CheckCircle, Zap, RefreshCw, Copy, Eye, EyeOff, Download } from 'lucide-react';
import AdminGuard from '@/components/AdminGuard';
import Toast from '@/components/Toast';

interface StudentSync {
  id: string;
  name: string;
  email: string;
  rollNo: string;
  firestorePassword: string;
  syncStatus: 'pending' | 'syncing' | 'success' | 'error' | 'generated';
  syncError?: string;
  generatedPassword?: string;
}

// Generate secure password
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default function SyncPasswordsPage() {
  const [students, setStudents] = useState<StudentSync[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const q = collection(db, 'students');
      const snapshot = await getDocs(q);
      
      const studentsList: StudentSync[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
        rollNo: doc.data().rollNo || '',
        firestorePassword: doc.data().password || doc.data().passwordHash || '',
        syncStatus: 'pending',
      }));

      setStudents(studentsList);
    } catch (error) {
      console.error('Error loading students:', error);
      setMessage({ text: 'Failed to load students', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const downloadPasswordsCSV = () => {
    const rows = students
      .filter((s) => s.firestorePassword || s.generatedPassword)
      .map((s) => {
        const password = s.generatedPassword || s.firestorePassword;
        return [s.name, s.rollNo, s.email, password]
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(',');
      });

    const csv = ['Name,Roll No,Email,Password', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student-passwords-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    setMessage({ text: 'Downloaded passwords CSV', type: 'success' });
  };

  const syncAllPasswords = async () => {
    try {
      setSyncing(true);
      let successCount = 0;
      let errorCount = 0;
      let generatedCount = 0;

      for (const student of students) {
        if (!student.email) {
          setStudents((prev) =>
            prev.map((s) =>
              s.id === student.id
                ? { ...s, syncStatus: 'error', syncError: 'Missing email' }
                : s
            )
          );
          errorCount++;
          continue;
        }

        let passwordToUse = student.firestorePassword;

        // Generate password if missing
        if (!passwordToUse) {
          const newPassword = generatePassword();
          passwordToUse = newPassword;
          generatedCount++;

          // Save to Firestore
          try {
            const studentDocRef = doc(db, 'students', student.id);
            await updateDoc(studentDocRef, {
              password: newPassword,
              passwordHash: newPassword,
            });

            setStudents((prev) =>
              prev.map((s) =>
                s.id === student.id
                  ? { ...s, firestorePassword: newPassword, generatedPassword: newPassword, syncStatus: 'generated' }
                  : s
              )
            );
          } catch (error) {
            console.error(`Error saving password for ${student.name}:`, error);
            setStudents((prev) =>
              prev.map((s) =>
                s.id === student.id
                  ? { ...s, syncStatus: 'error', syncError: 'Failed to save password' }
                  : s
              )
            );
            errorCount++;
            continue;
          }
        }

        try {
          setStudents((prev) =>
            prev.map((s) => (s.id === student.id ? { ...s, syncStatus: 'syncing' } : s))
          );

          // Call your API to reset Firebase Auth password
          const response = await fetch('/api/admin/resetStudentPassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: student.email,
              newPassword: passwordToUse,
            }),
          });

          if (response.ok) {
            setStudents((prev) =>
              prev.map((s) =>
                s.id === student.id ? { ...s, syncStatus: 'success', syncError: undefined } : s
              )
            );
            successCount++;
          } else {
            const error = await response.json();
            setStudents((prev) =>
              prev.map((s) =>
                s.id === student.id
                  ? { ...s, syncStatus: 'error', syncError: error.error || 'Sync failed' }
                  : s
              )
            );
            errorCount++;
          }
        } catch (error) {
          setStudents((prev) =>
            prev.map((s) =>
              s.id === student.id
                ? {
                    ...s,
                    syncStatus: 'error',
                    syncError: error instanceof Error ? error.message : 'Unknown error',
                  }
                : s
            )
          );
          errorCount++;
        }
      }

      let messageText = `✅ Synced ${successCount} student(s).`;
      if (generatedCount > 0) {
        messageText += ` Generated ${generatedCount} new password(s).`;
      }
      if (errorCount > 0) {
        messageText += ` ${errorCount} failed.`;
      }

      setMessage({
        text: messageText,
        type: successCount > 0 ? 'success' : 'error',
      });
    } finally {
      setSyncing(false);
    }
  };

  const syncSinglePassword = async (student: StudentSync) => {
    if (!student.email) {
      setMessage({ text: 'Missing email', type: 'error' });
      return;
    }

    let passwordToUse = student.firestorePassword;

    try {
      // Generate password if missing
      if (!passwordToUse) {
        const newPassword = generatePassword();
        passwordToUse = newPassword;

        // Save to Firestore
        const studentDocRef = doc(db, 'students', student.id);
        await updateDoc(studentDocRef, {
          password: newPassword,
          passwordHash: newPassword,
        });

        setStudents((prev) =>
          prev.map((s) =>
            s.id === student.id
              ? { ...s, firestorePassword: newPassword, generatedPassword: newPassword }
              : s
          )
        );

        setMessage({ text: `Generated password for ${student.name}`, type: 'success' });
      }

      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, syncStatus: 'syncing' } : s))
      );

      const response = await fetch('/api/admin/resetStudentPassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: student.email,
          newPassword: passwordToUse,
        }),
      });

      if (response.ok) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === student.id ? { ...s, syncStatus: 'success', syncError: undefined } : s
          )
        );
        setMessage({ text: `✅ Password synced for ${student.name}`, type: 'success' });
      } else {
        const error = await response.json();
        setStudents((prev) =>
          prev.map((s) =>
            s.id === student.id
              ? { ...s, syncStatus: 'error', syncError: error.error || 'Sync failed' }
              : s
          )
        );
        setMessage({ text: `❌ Failed to sync: ${error.error}`, type: 'error' });
      }
    } catch (error) {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? {
                ...s,
                syncStatus: 'error',
                syncError: error instanceof Error ? error.message : 'Unknown error',
              }
            : s
        )
      );
      setMessage({ text: 'Sync failed', type: 'error' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'syncing':
        return <Loader className="w-5 h-5 text-blue-400 animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    }
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Auto-Generate & Sync Passwords</h1>
            <p className="text-slate-400">Generate passwords for students without one and sync to Firebase Auth</p>
          </div>

          {/* Info Box */}
          <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-6 mb-6">
            <h2 className="text-amber-300 font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Auto-Generate & Sync Passwords
            </h2>
            <ul className="text-amber-200 text-sm space-y-2">
              <li>• If a student has no password, a secure password will be generated automatically</li>
              <li>• Generated passwords are saved to Firestore for record-keeping</li>
              <li>• Passwords are then synced to Firebase Auth so students can login</li>
              <li>• Copy and share generated passwords with students via email or messaging</li>
            </ul>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Total Students</p>
              <p className="text-3xl font-bold text-white">{students.length}</p>
            </div>
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm mb-1">With Passwords</p>
              <p className="text-3xl font-bold text-green-300">
                {students.filter((s) => s.firestorePassword || s.generatedPassword).length}
              </p>
            </div>
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
              <p className="text-amber-400 text-sm mb-1">Need Generation</p>
              <p className="text-3xl font-bold text-amber-300">
                {students.filter((s) => !s.firestorePassword && !s.generatedPassword).length}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Bulk Actions */}
              <div className="mb-6 flex gap-3">
                <button
                  onClick={syncAllPasswords}
                  disabled={syncing}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition flex items-center gap-2 font-semibold"
                >
                  {syncing ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Syncing All...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Generate & Sync All
                    </>
                  )}
                </button>
                <button
                  onClick={downloadPasswordsCSV}
                  disabled={students.filter((s) => s.firestorePassword || s.generatedPassword).length === 0}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition flex items-center gap-2 font-semibold"
                >
                  <Download className="w-5 h-5" />
                  Download Passwords CSV
                </button>
              </div>

              {/* Students List */}
              <div className="space-y-3">
                {students.map((student) => {
                  const isVisible = showPasswords[student.id];
                  const displayPassword = student.generatedPassword || student.firestorePassword || 'No password';
                  const hasPassword = !!(student.generatedPassword || student.firestorePassword);

                  return (
                    <div 
                      key={student.id} 
                      className={`border rounded-lg p-4 ${
                        student.generatedPassword 
                          ? 'bg-green-900/20 border-green-500/30' 
                          : 'bg-slate-800 border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold">{student.name}</h3>
                          <p className="text-slate-400 text-sm">{student.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-slate-300 text-sm">Password:</span>
                            {hasPassword ? (
                              <>
                                <span className="font-mono text-blue-300 text-sm">
                                  {isVisible ? displayPassword : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePasswordVisibility(student.id)}
                                  className="p-1 hover:bg-slate-700 rounded transition"
                                  title={isVisible ? 'Hide' : 'Show'}
                                >
                                  {isVisible ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                                </button>
                                <button
                                  onClick={() => copyToClipboard(displayPassword, student.id)}
                                  className={`p-1 rounded transition ${
                                    copiedId === student.id
                                      ? 'bg-green-600 text-white'
                                      : 'hover:bg-slate-700 text-slate-400'
                                  }`}
                                  title="Copy password"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-amber-300 text-sm italic">Will generate on sync</span>
                            )}
                          </div>
                          {student.generatedPassword && (
                            <div className="mt-2 text-xs text-green-300 bg-green-900/30 px-2 py-1 rounded inline-block">
                              ✨ New password generated - Share with student!
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(student.syncStatus)}
                            <span className="text-sm text-slate-300 capitalize">{student.syncStatus}</span>
                          </div>
                          {student.syncError && (
                            <span className="text-xs text-red-300 bg-red-900/20 px-2 py-1 rounded">
                              {student.syncError}
                            </span>
                          )}
                          <button
                            onClick={() => syncSinglePassword(student)}
                            disabled={syncing || student.syncStatus === 'syncing'}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded transition text-sm flex items-center gap-2"
                          >
                            {student.syncStatus === 'syncing' ? (
                              <>
                                <Loader className="w-4 h-4 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                {!hasPassword && <RefreshCw className="w-4 h-4" />}
                                {hasPassword ? 'Sync' : 'Generate & Sync'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {message && (
          <Toast message={message.text} type={message.type} onClose={() => setMessage(null)} />
        )}
      </div>
    </AdminGuard>
  );
}
