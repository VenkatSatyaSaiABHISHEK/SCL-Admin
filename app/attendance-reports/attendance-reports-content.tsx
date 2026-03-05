'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, Download, Calendar, Save, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

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

  const toggleRowExpansion = (date: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const getStudentInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getStudentName = (rollNo: string) => {
    const student = allStudents.find(s => s.rollNo === rollNo);
    return student?.name || rollNo;
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-extrabold text-white mb-2 tracking-tight">Attendance Reports</h1>
          <p className="text-base text-white/75">View daily attendance or student-wise statistics with marks</p>
        </div>

        {/* View Toggle - Pill Shaped */}
        <div className="flex gap-2 mb-8 bg-slate-800/60 p-1 rounded-full w-fit backdrop-blur-sm border border-white/15 shadow-lg">
          <button
            onClick={() => setView('daily')}
            className={`px-7 py-2 rounded-full font-semibold transition-all duration-200 text-sm ${
              view === 'daily'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            Daily Records
          </button>
          <button
            onClick={() => setView('student')}
            className={`px-7 py-2 rounded-full font-semibold transition-all duration-200 text-sm ${
              view === 'student'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            Student Statistics
          </button>
        </div>

        {/* Daily Reports View */}
        {view === 'daily' && (
          <div className="space-y-3.5">
            {loading ? (
              <div className="glass-effect-strong rounded-xl border border-white/15 p-6 text-center text-white/60">
                Loading records...
              </div>
            ) : records.length === 0 ? (
              <div className="glass-effect-strong rounded-xl border border-white/15 p-6 text-center text-white/60">
                No attendance records yet
              </div>
            ) : (
              records.map((record, idx) => (
                <div 
                  key={idx} 
                  className="glass-effect-strong rounded-xl border border-white/15 overflow-hidden hover:border-white/25 transition-all duration-200 hover:shadow-2xl shadow-lg"
                >
                  {/* Card Header */}
                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Date and Badges */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
                        <h3 className="text-lg font-bold text-white min-w-[110px]">{record.date}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 bg-emerald-500/25 text-emerald-300 rounded-full text-xs font-bold border border-emerald-400/40">
                            {record.presentCount} Present
                          </span>
                          <span className="px-2.5 py-1 bg-rose-500/25 text-rose-300 rounded-full text-xs font-bold border border-rose-400/40">
                            {record.absentCount} Absent
                          </span>
                          <span className="px-2.5 py-1 bg-sky-500/25 text-sky-300 rounded-full text-xs font-bold border border-sky-400/40">
                            {record.totalCount} Total
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => downloadReport(record)}
                          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg transition-all duration-200 text-xs font-semibold shadow-md shadow-blue-600/30 hover:shadow-blue-600/50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                        <button
                          onClick={() => toggleRowExpansion(record.date)}
                          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-1.5 rounded-lg transition-all duration-200 text-xs font-semibold"
                        >
                          {expandedRows[record.date] ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Hide
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              View
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Student List */}
                  {expandedRows[record.date] && (
                    <div className="border-t border-white/10 bg-black/20 p-4 animate-in slide-in-from-top duration-200">
                      {/* All Present Message */}
                      {record.absentCount === 0 && record.presentCount > 0 && (
                        <div className="mb-3.5 p-3 bg-emerald-50/95 border-l-4 border-emerald-500 rounded-lg shadow-sm flex items-center gap-2.5">
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-emerald-800 font-semibold text-sm">
                            All students are present today!
                          </p>
                        </div>
                      )}

                      {/* Present Students */}
                      {record.presentStudents && record.presentStudents.length > 0 && (
                        <div className={record.absentStudents && record.absentStudents.length > 0 ? "mb-4" : ""}>
                          <h4 className="text-white/90 font-bold mb-2.5 text-xs uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                            Present Students ({record.presentCount})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {record.presentStudents.map((rollNo, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30 transition-all duration-150 hover:shadow-md hover:shadow-emerald-500/20 shadow-sm cursor-pointer"
                              >
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-md">
                                  {getStudentInitials(getStudentName(rollNo))}
                                </div>
                                {/* Student Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-semibold truncate text-sm leading-tight">
                                    {getStudentName(rollNo)}
                                  </p>
                                  <p className="text-white/65 text-xs font-mono mt-0.5">{rollNo}</p>
                                </div>
                                {/* Status Badge */}
                                <span className="w-6 h-6 bg-emerald-500 text-white rounded-lg text-sm font-bold flex-shrink-0 shadow-sm flex items-center justify-center">
                                  ✓
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Absent Students */}
                      {record.absentStudents && record.absentStudents.length > 0 && (
                        <div>
                          <h4 className="text-white/90 font-bold mb-2.5 text-xs uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 bg-rose-400 rounded-full"></span>
                            Absent Students ({record.absentCount})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {record.absentStudents.map((rollNo, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 bg-rose-500/10 hover:bg-rose-500/20 p-3 rounded-xl border border-rose-500/30 transition-all duration-150 hover:shadow-md hover:shadow-rose-500/20 shadow-sm cursor-pointer"
                              >
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-md">
                                  {getStudentInitials(getStudentName(rollNo))}
                                </div>
                                {/* Student Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-semibold truncate text-sm leading-tight">
                                    {getStudentName(rollNo)}
                                  </p>
                                  <p className="text-white/65 text-xs font-mono mt-0.5">{rollNo}</p>
                                </div>
                                {/* Status Badge */}
                                <span className="w-6 h-6 bg-rose-500 text-white rounded-lg text-sm font-bold flex-shrink-0 shadow-sm flex items-center justify-center">
                                  ✗
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
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
                  <table className="w-full">
                    <thead className="border-b-2 border-white/20">
                      <tr>
                        <th className="text-left py-4 px-4 text-white/80 font-bold text-sm uppercase tracking-wider">Roll No</th>
                        <th className="text-left py-4 px-4 text-white/80 font-bold text-sm uppercase tracking-wider">Name</th>
                        <th className="text-center py-4 px-4 text-white/80 font-bold text-sm uppercase tracking-wider">Present</th>
                        <th className="text-center py-4 px-4 text-white/80 font-bold text-sm uppercase tracking-wider">Absent</th>
                        <th className="text-center py-4 px-4 text-white/80 font-bold text-sm uppercase tracking-wider">Total</th>
                        <th className="text-center py-4 px-4 text-white/80 font-bold text-sm uppercase tracking-wider">Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentStats.map((student, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors duration-150">
                          <td className="py-4 px-4 text-white font-mono font-semibold">{student.rollNo}</td>
                          <td className="py-4 px-4 text-white font-medium">{student.name}</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center justify-center px-3 py-1.5 bg-emerald-500/25 text-emerald-300 rounded-full text-sm font-bold border border-emerald-400/30">
                              {student.daysPresent}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center justify-center px-3 py-1.5 bg-rose-500/25 text-rose-300 rounded-full text-sm font-bold border border-rose-400/30">
                              {student.daysAbsent}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center justify-center px-3 py-1.5 bg-sky-500/25 text-sky-300 rounded-full text-sm font-bold border border-sky-400/30">
                              {student.daysPresent + student.daysAbsent}
                            </span>
                          </td>
                          <td className="py-4 px-4 flex justify-center">
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
                              placeholder="0"
                              className="w-20 bg-slate-700 text-white text-center px-3 py-2 rounded-lg border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-semibold"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <button
                    onClick={downloadStudentReport}
                    className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-cyan-600/20 hover:shadow-cyan-600/40"
                  >
                    <Download className="w-5 h-5" />
                    Download Report
                  </button>
                  <button
                    onClick={saveMarks}
                    disabled={savingMarks}
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-green-600/20 hover:shadow-green-600/40"
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
