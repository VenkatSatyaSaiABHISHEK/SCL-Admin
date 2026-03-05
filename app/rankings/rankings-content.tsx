'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, Award, TrendingUp, Plus, Save, Trash2, Medal } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc, setDoc, updateDoc } from 'firebase/firestore';

// Data Interfaces
interface StudentData {
  rollNo: string;
  name: string;
  presentDays: number;
  totalDays: number;
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
  dateCreated: string;
  isActive: boolean;
}

interface AttendanceRecord {
  date: string;
  presentStudents?: string[];
  absentStudents?: string[];
}

export default function RankingsContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  // State Management
  const [students, setStudents] = useState<StudentData[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  
  // Task Management
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', maxMarks: 5 });
  
  // Auto-fill mode
  const [autoFullMarks, setAutoFullMarks] = useState(true);

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
        loadStudents(),
        loadTasks()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Error loading rankings data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      // Get all students
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const studentMap = new Map<string, { name: string }>();
      
      studentsSnapshot.forEach((doc) => {
        const data = doc.data();
        studentMap.set(data.rollNo, { name: data.name });
      });

      // Get attendance records
      const attendanceSnapshot = await getDocs(
        query(collection(db, 'attendance'), orderBy('date', 'asc'))
      );

      // Calculate attendance for each student
      const attendanceMap: { [key: string]: { presentDays: number; totalDays: number } } = {};
      
      studentMap.forEach((_, rollNo) => {
        attendanceMap[rollNo] = { presentDays: 0, totalDays: 0 };
      });

      attendanceSnapshot.forEach((doc) => {
        const data = doc.data() as AttendanceRecord;
        if (data.presentStudents) {
          data.presentStudents.forEach((rollNo) => {
            if (attendanceMap[rollNo]) {
              attendanceMap[rollNo].presentDays++;
              attendanceMap[rollNo].totalDays++;
            }
          });
        }
        if (data.absentStudents) {
          data.absentStudents.forEach((rollNo) => {
            if (attendanceMap[rollNo]) {
              attendanceMap[rollNo].totalDays++;
            }
          });
        }
      });

      // Get existing rankings data
      const rankingsSnapshot = await getDocs(collection(db, 'rankings'));
      const rankingsMap = new Map<string, any>();
      
      rankingsSnapshot.forEach((doc) => {
        rankingsMap.set(doc.id, doc.data());
      });

      // Build student data array with comprehensive scoring
      const studentsData: StudentData[] = [];
      
      studentMap.forEach((student, rollNo) => {
        const attendance = attendanceMap[rollNo] || { presentDays: 0, totalDays: 0 };
        const rankingData = rankingsMap.get(rollNo) || {};
        
        const attendanceMarks = attendance.presentDays; // 1 mark per present day
        const taskMarks = rankingData.taskMarks || {};
        const bonusMarks = rankingData.bonusMarks || 0;
        
        // Calculate total task marks
        const totalTaskMarks = Object.values(taskMarks).reduce((sum: number, marks) => sum + (marks as number), 0);
        const totalScore = attendanceMarks + totalTaskMarks + bonusMarks;

        studentsData.push({
          rollNo,
          name: student.name,
          presentDays: attendance.presentDays,
          totalDays: attendance.totalDays,
          attendanceMarks,
          taskMarks,
          bonusMarks,
          totalScore,
          rank: 0,
        });
      });

      // Sort and assign ranks
      studentsData.sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        return b.attendanceMarks - a.attendanceMarks; // Tie-breaker: higher attendance wins
      });

      studentsData.forEach((student, index) => {
        student.rank = index + 1;
      });

      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading students:', error);
      throw error;
    }
  };

  const loadTasks = async () => {
    try {
      const tasksSnapshot = await getDocs(
        query(collection(db, 'tasks'), orderBy('dateCreated', 'asc'))
      );
      
      const tasksData: Task[] = [];
      tasksSnapshot.forEach((doc) => {
        tasksData.push({
          id: doc.id,
          ...doc.data()
        } as Task);
      });
      
      setTasks(tasksData.filter(t => t.isActive));
    } catch (error) {
      console.error('Error loading tasks:', error);
      throw error;
    }
  };

  // =================== TASK MANAGEMENT ===================

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) {
      showToast('Please enter task title', 'error');
      return;
    }

    try {
      const taskId = `task_${Date.now()}`;
      await setDoc(doc(db, 'tasks', taskId), {
        title: taskForm.title,
        maxMarks: taskForm.maxMarks,
        dateCreated: new Date().toISOString(),
        isActive: true
      });

      showToast('Task added successfully', 'success');
      setShowTaskDialog(false);
      setTaskForm({ title: '', maxMarks: 5 });
      await loadTasks();
    } catch (error) {
      showToast('Error adding task', 'error');
      console.error(error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task? This will remove all marks for this task.')) return;

    try {
      await updateDoc(doc(db, 'tasks', taskId), { isActive: false });
      showToast('Task deleted', 'success');
      await loadTasks();
    } catch (error) {
      showToast('Error deleting task', 'error');
      console.error(error);
    }
  };

  // =================== MARKING SYSTEM ===================

  const handleCellChange = (rollNo: string, taskId: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    const task = tasks.find(t => t.id === taskId);
    const maxMarks = task?.maxMarks || 5;
    const finalValue = Math.min(numValue, maxMarks);

    setStudents(prev => prev.map(student => {
      if (student.rollNo === rollNo) {
        const updatedTaskMarks = { ...student.taskMarks, [taskId]: finalValue };
        const totalTaskMarks = Object.values(updatedTaskMarks).reduce((sum, marks) => sum + marks, 0);
        const totalScore = student.attendanceMarks + totalTaskMarks + student.bonusMarks;
        
        return { ...student, taskMarks: updatedTaskMarks, totalScore };
      }
      return student;
    }));

    // Recalculate ranks
    recalculateRanks();
  };

  const handleDoubleClick = (rollNo: string, taskId: string) => {
    if (!autoFullMarks) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    handleCellChange(rollNo, taskId, String(task.maxMarks));
  };

  const handleBonusChange = (rollNo: string, value: string) => {
    const numValue = parseInt(value) || 0;

    setStudents(prev => prev.map(student => {
      if (student.rollNo === rollNo) {
        const totalTaskMarks = Object.values(student.taskMarks).reduce((sum, marks) => sum + marks, 0);
        const totalScore = student.attendanceMarks + totalTaskMarks + numValue;
        
        return { ...student, bonusMarks: numValue, totalScore };
      }
      return student;
    }));

    recalculateRanks();
  };

  const recalculateRanks = () => {
    setStudents(prev => {
      const sorted = [...prev].sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        return b.attendanceMarks - a.attendanceMarks;
      });

      sorted.forEach((student, index) => {
        student.rank = index + 1;
      });

      return sorted;
    });
  };

  // =================== BULK OPERATIONS ===================

  const toggleStudentSelection = (rollNo: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rollNo)) {
        newSet.delete(rollNo);
      } else {
        newSet.add(rollNo);
      }
      return newSet;
    });
  };

  const handleBulkGiveFullMarks = (taskId: string) => {
    if (selectedStudents.size === 0) {
      showToast('Please select students first', 'error');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setStudents(prev => prev.map(student => {
      if (selectedStudents.has(student.rollNo)) {
        const updatedTaskMarks = { ...student.taskMarks, [taskId]: task.maxMarks };
        const totalTaskMarks = Object.values(updatedTaskMarks).reduce((sum, marks) => sum + marks, 0);
        const totalScore = student.attendanceMarks + totalTaskMarks + student.bonusMarks;
        
        return { ...student, taskMarks: updatedTaskMarks, totalScore };
      }
      return student;
    }));

    recalculateRanks();
    showToast(`Full marks given to ${selectedStudents.size} students`, 'success');
  };

  // =================== SAVE TO DATABASE ===================

  const handleSaveAllMarks = async () => {
    setSaving(true);
    try {
      const promises = students.map(student => 
        setDoc(doc(db, 'rankings', student.rollNo), {
          rollNo: student.rollNo,
          name: student.name,
          attendanceMarks: student.attendanceMarks,
          taskMarks: student.taskMarks,
          bonusMarks: student.bonusMarks,
          totalScore: student.totalScore,
          rank: student.rank,
          updatedAt: new Date().toISOString()
        })
      );

      await Promise.all(promises);
      showToast('All rankings saved successfully!', 'success');
    } catch (error) {
      showToast('Error saving rankings', 'error');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // =================== RENDER ===================

  if (!mounted || !isAdmin || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>
    );
  }

  const topStudents = students.slice(0, 10);
  const allSelected = students.length > 0 && selectedStudents.size === students.length;

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

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-white/70 hover:text-red-300"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Student Rankings</h1>
          <p className="text-white/60">
            Dynamic ranking system with attendance and task-based scoring
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
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls Bar */}
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <button
                onClick={() => setShowTaskDialog(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Task Column
              </button>

              <button
                onClick={handleSaveAllMarks}
                disabled={saving}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save All Marks'}
              </button>

              <label className="flex items-center gap-2 cursor-pointer text-white/70 hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={autoFullMarks}
                  onChange={(e) => setAutoFullMarks(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 bg-white/10"
                />
                <span className="text-sm">Enable double-click auto-fill</span>
              </label>
            </div>

            {/* Legend */}
            <div className="mb-6 glass-effect-strong border border-white/10 rounded-lg p-4">
              <p className="text-white/60 text-sm">
                <span className="font-semibold text-white">Legend:</span> Attendance Marks =
                Present Days (1 per day) • Task Marks = Editable (0-max) • Double-click to
                auto-fill • Select students for bulk operations • Total Score = Attendance +
                Tasks + Bonus
              </p>
            </div>

            {/* Excel-like Table */}
            <div className="glass-effect-strong rounded-xl border border-white/15 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 sticky top-0 z-10">
                    <tr className="border-b border-white/20">
                      <th className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => {
                            if (allSelected) {
                              setSelectedStudents(new Set());
                            } else {
                              setSelectedStudents(new Set(students.map((s) => s.rollNo)));
                            }
                          }}
                          className="w-4 h-4 rounded border-white/30 bg-white/10"
                        />
                      </th>
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
                          className="py-3 px-4 text-center text-blue-400 font-semibold whitespace-nowrap min-w-[140px]"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="truncate max-w-[100px]" title={task.title}>
                              {task.title}
                            </span>
                            <span className="text-white/50 text-xs">/{task.maxMarks}</span>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1 hover:bg-red-500/20 rounded transition-colors"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-4 text-center text-yellow-400 font-semibold whitespace-nowrap">
                        Bonus Marks
                      </th>
                      <th className="py-3 px-4 text-center text-purple-400 font-semibold whitespace-nowrap min-w-[120px]">
                        Total Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr
                        key={student.rollNo}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                          selectedStudents.has(student.rollNo) ? 'bg-blue-500/10' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedStudents.has(student.rollNo)}
                            onChange={() => toggleStudentSelection(student.rollNo)}
                            className="w-4 h-4 rounded border-white/30 bg-white/10"
                          />
                        </td>
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
                          <span className="text-white/40 text-xs ml-1">
                            ({student.presentDays}/{student.totalDays})
                          </span>
                        </td>
                        {tasks.map((task) => (
                          <td key={task.id} className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={task.maxMarks}
                              value={student.taskMarks[task.id] ?? 0}
                              onChange={(e) =>
                                handleCellChange(student.rollNo, task.id, e.target.value)
                              }
                              onDoubleClick={() => handleDoubleClick(student.rollNo, task.id)}
                              className="w-16 px-2 py-1 bg-white/5 border border-white/20 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                        ))}
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="0"
                            value={student.bonusMarks}
                            onChange={(e) => handleBonusChange(student.rollNo, e.target.value)}
                            className="w-16 px-2 py-1 bg-white/5 border border-white/20 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
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
                    <p className="text-white/60">No student data available</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Task Dialog */}
      {showTaskDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-effect-strong border border-white/20 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-6">Add New Task Column</h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g., Assignment 1, Quiz 2"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Maximum Marks
                </label>
                <input
                  type="number"
                  min="1"
                  value={taskForm.maxMarks}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, maxMarks: parseInt(e.target.value) || 0 })
                  }
                  placeholder="e.g., 10, 20, 100"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTaskDialog(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                disabled={!taskForm.title.trim() || taskForm.maxMarks <= 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
