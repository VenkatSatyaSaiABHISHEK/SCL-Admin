'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import { Loader, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import AdminGuard from '@/components/AdminGuard';
import Toast from '@/components/Toast';

interface StudentSync {
  id: string;
  name: string;
  email: string;
  rollNo: string;
  firestorePassword: string;
  syncStatus: 'pending' | 'syncing' | 'success' | 'error';
  syncError?: string;
}

export default function SyncPasswordsPage() {
  const [students, setStudents] = useState<StudentSync[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

  const syncAllPasswords = async () => {
    try {
      setSyncing(true);
      let successCount = 0;
      let errorCount = 0;

      for (const student of students) {
        if (!student.email || !student.firestorePassword) {
          setStudents((prev) =>
            prev.map((s) =>
              s.id === student.id
                ? { ...s, syncStatus: 'error', syncError: 'Missing email or password' }
                : s
            )
          );
          errorCount++;
          continue;
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
              newPassword: student.firestorePassword,
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

      if (successCount > 0) {
        setMessage({
          text: `✅ Synced ${successCount} student(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
          type: 'success',
        });
      }
      if (errorCount > 0) {
        setMessage({
          text: `❌ ${errorCount} student(s) failed to sync`,
          type: 'error',
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const syncSinglePassword = async (student: StudentSync) => {
    if (!student.email || !student.firestorePassword) {
      setMessage({ text: 'Missing email or password', type: 'error' });
      return;
    }

    try {
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, syncStatus: 'syncing' } : s))
      );

      const response = await fetch('/api/admin/resetStudentPassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: student.email,
          newPassword: student.firestorePassword,
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
            <h1 className="text-4xl font-bold text-white mb-2">Sync Passwords to Firebase</h1>
            <p className="text-slate-400">Synchronize Firestore plaintext passwords with Firebase Auth</p>
          </div>

          {/* Info Box */}
          <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-6 mb-8">
            <h2 className="text-amber-300 font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Why Sync?
            </h2>
            <p className="text-amber-200 text-sm">
              Firestore stores plain passwords for easy sharing. Firebase Auth encrypts passwords for security. 
              This syncs them so students can login with the correct password.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Bulk Sync Button */}
              <div className="mb-6">
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
                      Sync All Passwords
                    </>
                  )}
                </button>
              </div>

              {/* Students List */}
              <div className="space-y-3">
                {students.map((student) => (
                  <div key={student.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold">{student.name}</h3>
                        <p className="text-slate-400 text-sm">{student.email}</p>
                        <p className="text-slate-300 text-sm">
                          Password: <span className="font-mono text-blue-300">{student.firestorePassword}</span>
                        </p>
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
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded transition text-sm"
                        >
                          {student.syncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
