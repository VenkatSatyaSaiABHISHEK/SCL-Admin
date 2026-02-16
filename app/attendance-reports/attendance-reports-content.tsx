'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, Download, Calendar, Save } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, setDoc, doc } from 'firebase/firestore';

interface AttendanceRecord {
  date: string;
  presentCount: number;
  absentCount: number;
  totalCount: number;
  presentStudents?: string[];
  absentStudents?: string[];
}

interface StudentData {
  rollNo: string;
  name: string;
}

interface StudentStatistics {
  rollNo: string;
  name: string;
  daysPresent: number;
  daysAbsent: number;
  marks?: number;
}

export default function AttendanceReportsContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [studentStats, setStudentStats] = useState<StudentStatistics[]>([]);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'daily' | 'student'>('daily');
  const [marks, setMarks] = useState<{ [key: string]: number }>({});
  const [savingMarks, setSavingMarks] = useState(false);

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
      loadAllStudents();
      loadAttendanceRecords();
    }
  }, [mounted, isAdmin]);

  const loadAllStudents = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'students'));
      const students: StudentData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          rollNo: data.rollNo,
          name: data.name,
        });
      });
      setAllStudents(students);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      const q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const data: AttendanceRecord[] = [];
      const statsByStudent: { [key: string]: StudentStatistics } = {};

      // Initialize all students with 0 attendance
      allStudents.forEach((student) => {
        statsByStudent[student.rollNo] = {
          rollNo: student.rollNo,
          name: student.name,
          daysPresent: 0,
          daysAbsent: 0,
          marks: undefined,
        };
      });

      // Count attendance for each student
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({
          date: doc.id,
          presentCount: docData.presentCount || 0,
          absentCount: docData.absentCount || 0,
          totalCount: (docData.presentCount || 0) + (docData.absentCount || 0),
          presentStudents: docData.presentStudents || [],
          absentStudents: docData.absentStudents || [],
        });

        // Count present days
        (docData.presentStudents || []).forEach((rollNo: string) => {
          if (statsByStudent[rollNo]) {
            statsByStudent[rollNo].daysPresent += 1;
          }
        });

        // Count absent days
        (docData.absentStudents || []).forEach((rollNo: string) => {
          if (statsByStudent[rollNo]) {
            statsByStudent[rollNo].daysAbsent += 1;
          }
        });
      });

      setRecords(data);
      setStudentStats(Object.values(statsByStudent).sort((a, b) => a.rollNo.localeCompare(b.rollNo)));
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = (record: AttendanceRecord) => {
    const csv = [
      `Attendance Report - ${record.date}`,
      '',
      `Total Students: ${record.totalCount}`,
      `Present: ${record.presentCount}`,
      `Absent: ${record.absentCount}`,
      '',
      'PRESENT STUDENTS',
      ...record.presentStudents!,
      '',
      'ABSENT STUDENTS',
      ...record.absentStudents!,
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${record.date}.csv`;
    a.click();
  };

  const saveMarks = async () => {
    setSavingMarks(true);
    try {
      // Save marks to Firestore
      await setDoc(doc(db, 'marks', 'summary'), marks);
      showToast('Marks saved successfully!', 'success');
    } catch (error) {
      showToast(
        'Error saving marks: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      setSavingMarks(false);
    }
  };

  const downloadStudentReport = () => {
    const csv = [
      'Student Attendance & Marks Report',
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'Roll No,Name,Days Present,Days Absent,Total,Marks',
      ...studentStats.map((s) =>
        `${s.rollNo},${s.name},${s.daysPresent},${s.daysAbsent},${s.daysPresent + s.daysAbsent},${marks[s.rollNo] || '-'}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-marks-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
              <Calendar className="w-6 h-6 text-blue-400" />
              <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent hidden sm:inline">
                Attendance Reports
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="px-3 py-1 rounded-lg text-white/70 hover:bg-white/10 transition text-sm">
                ← Dashboard
              </Link>
              <Link href="/profile" className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition">
                <User className="w-5 h-5" />
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-lg hover:bg-red-500/20 transition text-white/70 hover:text-red-300"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Attendance Reports</h1>
          <p className="text-white/60">View daily attendance or student-wise statistics with marks</p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setView('daily')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              view === 'daily'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-white/70 hover:text-white'
            }`}
          >
            Daily Records
          </button>
          <button
            onClick={() => setView('student')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              view === 'student'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-white/70 hover:text-white'
            }`}
          >
            Student Statistics
          </button>
        </div>

        {/* Daily Reports View */}
        {view === 'daily' && (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
            {loading ? (
              <div className="text-center py-8 text-white/60">Loading records...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-white/60">No attendance records yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/20">
                    <tr>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Present</th>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Absent</th>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Total</th>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-white font-medium">{record.date}</td>
                        <td className="py-3 px-4 text-green-400">{record.presentCount}</td>
                        <td className="py-3 px-4 text-red-400">{record.absentCount}</td>
                        <td className="py-3 px-4 text-white">{record.totalCount}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => downloadReport(record)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition text-xs"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Student Statistics View */}
        {view === 'student' && (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
            {loading ? (
              <div className="text-center py-8 text-white/60">Loading records...</div>
            ) : studentStats.length === 0 ? (
              <div className="text-center py-8 text-white/60">No student data yet</div>
            ) : (
              <>
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/20">
                      <tr>
                        <th className="text-left py-3 px-4 text-white/70 font-semibold">Roll No</th>
                        <th className="text-left py-3 px-4 text-white/70 font-semibold">Name</th>
                        <th className="text-center py-3 px-4 text-white/70 font-semibold">Present</th>
                        <th className="text-center py-3 px-4 text-white/70 font-semibold">Absent</th>
                        <th className="text-center py-3 px-4 text-white/70 font-semibold">Total</th>
                        <th className="text-center py-3 px-4 text-white/70 font-semibold">Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentStats.map((student, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4 text-white font-mono">{student.rollNo}</td>
                          <td className="py-3 px-4 text-white">{student.name}</td>
                          <td className="py-3 px-4 text-center text-green-400 font-semibold">{student.daysPresent}</td>
                          <td className="py-3 px-4 text-center text-red-400 font-semibold">{student.daysAbsent}</td>
                          <td className="py-3 px-4 text-center text-white">{student.daysPresent + student.daysAbsent}</td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={marks[student.rollNo] || ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseInt(e.target.value) : 0;
                                setMarks({
                                  ...marks,
                                  [student.rollNo]: value || 0,
                                });
                              }}
                              placeholder="Add marks"
                              className="w-20 bg-slate-600 text-white text-center px-2 py-1 rounded border border-white/20 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-4 justify-end">
                  <button
                    onClick={downloadStudentReport}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition font-semibold"
                  >
                    <Download className="w-5 h-5" />
                    Download Report
                  </button>
                  <button
                    onClick={saveMarks}
                    disabled={savingMarks}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition font-semibold"
                  >
                    {savingMarks ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Marks
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
