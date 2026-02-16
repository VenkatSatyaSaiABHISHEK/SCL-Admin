'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { Copy, Eye, EyeOff, Loader } from 'lucide-react';
import AdminGuard from '@/components/AdminGuard';
import Toast from '@/components/Toast';

interface StudentPassword {
  id: string;
  name: string;
  email: string;
  rollNo: string;
  password: string | null;
  passwordHash: string | null;
}

export default function StudentPasswordsPage() {
  const [students, setStudents] = useState<StudentPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'students'));
      const snapshot = await getDocs(q);
      
      const studentsList: StudentPassword[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
        rollNo: doc.data().rollNo || '',
        password: doc.data().password || null,
        passwordHash: doc.data().passwordHash || null,
      }));

      setStudents(studentsList);
    } catch (error) {
      console.error('Error loading students:', error);
      setMessage({ text: 'Failed to load students', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyPassword = (password: string, studentName: string) => {
    navigator.clipboard.writeText(password);
    setCopiedId(studentName);
    setMessage({ text: 'Password copied!', type: 'success' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPassword = (student: StudentPassword): string | null => {
    return student.password || student.passwordHash;
  };

  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(searchLower) ||
      student.email.toLowerCase().includes(searchLower) ||
      student.rollNo.toLowerCase().includes(searchLower)
    );
  });

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Student Passwords</h1>
            <p className="text-slate-400">View and manage student login credentials</p>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by name, email, or roll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-sm">Total Students</p>
              <p className="text-2xl font-bold text-white">{students.length}</p>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-sm">With Passwords</p>
              <p className="text-2xl font-bold text-green-400">{students.filter((s) => getPassword(s)).length}</p>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-sm">Filtered Results</p>
              <p className="text-2xl font-bold text-blue-400">{filteredStudents.length}</p>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
              <p className="text-slate-400">No students found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Roll No</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Password</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const password = getPassword(student);
                    const isVisible = showPasswords[student.id];

                    return (
                      <tr key={student.id} className="border-b border-slate-700 hover:bg-slate-800/50 transition">
                        <td className="px-6 py-4 text-sm text-white font-medium">{student.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{student.email}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{student.rollNo}</td>
                        <td className="px-6 py-4 text-sm font-mono">
                          {password ? (
                            <span className="text-slate-300 select-all">
                              {isVisible ? password : '•'.repeat(password.length)}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No password set</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            {password && (
                              <>
                                <button
                                  onClick={() => togglePasswordVisibility(student.id)}
                                  className="p-2 hover:bg-slate-700 rounded transition text-slate-400 hover:text-slate-200"
                                  title={isVisible ? 'Hide' : 'Show'}
                                >
                                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => copyPassword(password, student.name)}
                                  className={`p-2 rounded transition ${
                                    copiedId === student.name
                                      ? 'bg-green-900 text-green-300'
                                      : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                                  }`}
                                  title="Copy password"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
