'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { RefreshCw, Save, Loader, Check, AlertCircle } from 'lucide-react';
import AdminGuard from '@/components/AdminGuard';
import Toast from '@/components/Toast';

interface StudentPassword {
  id: string;
  name: string;
  email: string;
  rollNo: string;
  currentPassword: string;
  newPassword: string;
}

export default function UpdatePasswordPage() {
  const [students, setStudents] = useState<StudentPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const q = collection(db, 'students');
      const snapshot = await getDocs(q);
      
      const studentsList: StudentPassword[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
        rollNo: doc.data().rollNo || '',
        currentPassword: doc.data().password || doc.data().passwordHash || '',
        newPassword: '',
      }));

      setStudents(studentsList);
    } catch (error) {
      console.error('Error loading students:', error);
      setMessage({ text: 'Failed to load students', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (student: StudentPassword) => {
    if (!student.newPassword.trim()) {
      setMessage({ text: 'Please enter a new password', type: 'error' });
      return;
    }

    try {
      setUpdating(true);

      // Update Firestore student document with new password
      const studentRef = doc(db, 'students', student.id);
      await updateDoc(studentRef, {
        password: student.newPassword,
        passwordHash: student.newPassword, // Keep both fields in sync
      });

      setMessage({ text: `✅ Password updated for ${student.name}`, type: 'success' });
      
      // Clear the new password field
      setStudents(students.map(s => 
        s.id === student.id ? { ...s, newPassword: '', currentPassword: student.newPassword } : s
      ));
    } catch (error) {
      console.error('Error updating password:', error);
      setMessage({ text: 'Failed to update password', type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Update Student Passwords</h1>
            <p className="text-slate-400">After resetting passwords in Firebase, update them here</p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-6 mb-8">
            <h2 className="text-blue-300 font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              How to Update Passwords
            </h2>
            <ol className="space-y-2 text-blue-200 text-sm">
              <li>1. Reset password for student in Firebase Console</li>
              <li>2. Come back here and enter the new password</li>
              <li>3. Click "Update Password" to sync it with the database</li>
              <li>4. Student can now login with the new password</li>
            </ol>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {students.map((student) => (
                <div key={student.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="text-slate-400 text-sm block mb-1">Name</label>
                      <p className="text-white font-medium">{student.name}</p>
                    </div>
                    <div>
                      <label className="text-slate-400 text-sm block mb-1">Email</label>
                      <p className="text-white text-sm">{student.email}</p>
                    </div>
                    <div>
                      <label className="text-slate-400 text-sm block mb-1">Roll No</label>
                      <p className="text-white">{student.rollNo}</p>
                    </div>
                    <div>
                      <label className="text-slate-400 text-sm block mb-1">Current Password</label>
                      <p className="text-slate-300 text-sm font-mono">{student.currentPassword || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-4">
                    <label className="text-slate-300 text-sm block mb-2">New Password</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={student.newPassword}
                        onChange={(e) =>
                          setStudents(
                            students.map((s) =>
                              s.id === student.id ? { ...s, newPassword: e.target.value } : s
                            )
                          )
                        }
                        className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleUpdatePassword(student)}
                        disabled={updating || !student.newPassword}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition flex items-center gap-2"
                      >
                        {updating ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Update
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {message && (
          <Toast message={message.text} type={message.type} onClose={() => setMessage(null)} />
        )}
      </div>
    </AdminGuard>
  );
}
