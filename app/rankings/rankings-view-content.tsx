'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Medal, Edit, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// Data Interfaces
interface StudentData {
  rollNo: string;
  name: string;
  attendanceMarks: number;
  taskMarks: { [taskId: string]: number };
  bonusMarks: number;
  totalScore: number;
  rank: number;
}

interface Task {
  id: string;
  title: string;
  maxMarks: number;
}

export default function RankingsViewContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  
  // State Management
  const [students, setStudents] = useState<StudentData[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // =================== HANDLERS ===================

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
      loadAllData();
    }
  }, [mounted, isAdmin]);

  // =================== DATA LOADING ===================

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRankings(),
        loadTasks()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRankings = async () => {
    try {
      const rankingsSnapshot = await getDocs(collection(db, 'rankings'));
      const rankingsData: StudentData[] = [];
      
      rankingsSnapshot.forEach((doc) => {
        const data = doc.data();
        rankingsData.push({
          rollNo: data.rollNo || doc.id,
          name: data.name || 'Unknown',
          attendanceMarks: data.attendanceMarks || 0,
          taskMarks: data.taskMarks || {},
          bonusMarks: data.bonusMarks || 0,
          totalScore: data.totalScore || 0,
          rank: data.rank || 0
        });
      });

      // Sort by rank
      rankingsData.sort((a, b) => a.rank - b.rank);
      
      console.log('✅ Loaded rankings:', rankingsData);
      console.log('✅ Total students:', rankingsData.length);
      
      setStudents(rankingsData);
    } catch (error) {
      console.error('Error loading rankings:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const tasksSnapshot = await getDocs(
        query(collection(db, 'tasks'), orderBy('dateCreated', 'asc'))
      );
      
      const tasksData: Task[] = [];
      tasksSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive) {
          tasksData.push({
            id: doc.id,
            title: data.title,
            maxMarks: data.maxMarks
          });
        }
      });
      
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  // =================== RENDER ===================

  if (!mounted || !isAdmin || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>
    );
  }

  const topStudents = students.slice(0, 10);
  
  console.log('🔍 RENDER - Students array:', students);
  console.log('🔍 RENDER - Students length:', students.length);
  console.log('🔍 RENDER - Top students:', topStudents);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="glass-effect-strong border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <div className="text-2xl">←</div>
              <span className="text-white/70">Back to Dashboard</span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/rankings/edit"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Mode
              </Link>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-white/70 hover:text-red-300"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Student Rankings</h1>
          <p className="text-white/60">
            View current rankings and scores • Switch to Edit Mode to make changes
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white/60">Loading rankings data...</p>
          </div>
        ) : (
          <>
            {/* Top 10 Students */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Medal className="w-7 h-7 text-yellow-400" />
                Top 10 Students
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {topStudents.map((student, index) => (
                  <div
                    key={student.rollNo}
                    className={`glass-effect-strong rounded-xl border p-5 ${
                      index === 0
                        ? 'border-yellow-400/40 bg-yellow-950/30'
                        : index === 1
                        ? 'border-gray-400/40 bg-gray-950/30'
                        : index === 2
                        ? 'border-orange-400/40 bg-orange-950/30'
                        : 'border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? 'bg-yellow-500/30 text-yellow-300'
                            : index === 1
                            ? 'bg-gray-400/30 text-gray-300'
                            : index === 2
                            ? 'bg-orange-500/30 text-orange-300'
                            : 'bg-blue-500/30 text-blue-300'
                        }`}
                      >
                        {student.rank}
                      </div>
                      {index < 3 && (
                        <Medal
                          className={`w-5 h-5 ${
                            index === 0
                              ? 'text-yellow-400'
                              : index === 1
                              ? 'text-gray-400'
                              : 'text-orange-400'
                          }`}
                        />
                      )}
                    </div>
                    <p className="text-white font-bold text-sm mb-1 truncate">{student.name}</p>
                    <p className="text-white/50 text-xs mb-3 font-mono">{student.rollNo}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Total Score</span>
                        <span className="text-green-400 font-bold text-base">
                          {student.totalScore}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Attendance</span>
                        <span className="text-white/80">{student.attendanceMarks}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Tasks</span>
                        <span className="text-blue-400">
                          {Object.values(student.taskMarks).reduce((a, b) => a + b, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="glass-effect-strong border border-white/15 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                  <h3 className="text-white/70 font-medium">Total Students</h3>
                </div>
                <p className="text-4xl font-bold text-white">{students.length}</p>
              </div>

              <div className="glass-effect-strong border border-white/15 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                  <h3 className="text-white/70 font-medium">Active Tasks</h3>
                </div>
                <p className="text-4xl font-bold text-white">{tasks.length}</p>
              </div>

              <div className="glass-effect-strong border border-white/15 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                  <h3 className="text-white/70 font-medium">Avg Score</h3>
                </div>
                <p className="text-4xl font-bold text-white">
                  {students.length > 0
                    ? Math.round(students.reduce((sum, s) => sum + s.totalScore, 0) / students.length)
                    : 0}
                </p>
              </div>
            </div>

            {/* Rankings Table */}
            <div className="glass-effect-strong rounded-xl border border-white/15 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 sticky top-0 z-10">
                    <tr className="border-b border-white/20">
                      <th className="py-3 px-4 text-left text-white/70 font-semibold whitespace-nowrap">
                        Rank
                      </th>
                      <th className="py-3 px-4 text-left text-white/70 font-semibold whitespace-nowrap min-w-[200px]">
                        Student Name
                      </th>
                      <th className="py-3 px-4 text-left text-white/70 font-semibold whitespace-nowrap">
                        Roll No
                      </th>
                      <th className="py-3 px-4 text-center text-green-400 font-semibold whitespace-nowrap">
                        Attendance Marks
                      </th>
                      {tasks.map((task) => (
                        <th
                          key={task.id}
                          className="py-3 px-4 text-center text-blue-400 font-semibold whitespace-nowrap"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span className="truncate max-w-[100px]" title={task.title}>
                              {task.title}
                            </span>
                            <span className="text-white/50 text-xs">/{task.maxMarks}</span>
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-4 text-center text-yellow-400 font-semibold whitespace-nowrap">
                        Bonus
                      </th>
                      <th className="py-3 px-4 text-center text-purple-400 font-semibold whitespace-nowrap">
                        Total Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.rollNo} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${
                              student.rank <= 3
                                ? student.rank === 1
                                  ? 'bg-yellow-500/30 text-yellow-300'
                                  : student.rank === 2
                                  ? 'bg-gray-400/30 text-gray-300'
                                  : 'bg-orange-500/30 text-orange-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {student.rank}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{student.name}</td>
                        <td className="py-3 px-4 text-white/70 font-mono text-xs">
                          {student.rollNo}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-green-400 font-semibold">
                            {student.attendanceMarks}
                          </span>
                        </td>
                        {tasks.map((task) => (
                          <td key={task.id} className="py-3 px-4 text-center">
                            <span className="text-white/90">
                              {student.taskMarks[task.id] ?? 0}
                            </span>
                          </td>
                        ))}
                        <td className="py-3 px-4 text-center">
                          <span className="text-yellow-400">
                            {student.bonusMarks}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-3 py-1.5 rounded-lg font-bold text-base bg-purple-500/20 text-purple-300">
                            {student.totalScore}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {students.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-white/60 mb-4">No ranking data available yet</p>
                    <Link
                      href="/rankings/edit"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Go to Edit Mode
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
