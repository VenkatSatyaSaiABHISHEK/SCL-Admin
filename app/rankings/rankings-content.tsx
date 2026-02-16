'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, Award, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface StudentData {
  rollNo: string;
  name: string;
}

interface AttendanceRanking {
  rollNo: string;
  name: string;
  presentDays: number;
  totalDays: number;
  attendancePercentage: number;
  rank: number;
}

interface TeamScoreData {
  teamId: string;
  teamName: string;
  leaderRollNo: string;
  leaderName: string;
  totalPoints: number;
  rank: number;
  taskCount: number;
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
  const [activeTab, setActiveTab] = useState<'attendance' | 'team'>('attendance');
  const [attendanceRankings, setAttendanceRankings] = useState<AttendanceRanking[]>([]);
  const [teamRankings, setTeamRankings] = useState<TeamScoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allStudents, setAllStudents] = useState<Map<string, StudentData>>(new Map());

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
      loadData();
    }
  }, [mounted, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all students
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const studentMap = new Map<string, StudentData>();
      studentsSnapshot.forEach((doc) => {
        const data = doc.data();
        studentMap.set(data.rollNo, {
          rollNo: data.rollNo,
          name: data.name,
        });
      });
      setAllStudents(studentMap);

      // Load attendance rankings
      await loadAttendanceRankings(studentMap);

      // Load team rankings
      await loadTeamRankings(studentMap);
    } catch (error) {
      console.error('Error loading rankings:', error);
      showToast('Error loading rankings data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceRankings = async (studentMap: Map<string, StudentData>) => {
    try {
      const attendanceSnapshot = await getDocs(
        query(collection(db, 'attendance'), orderBy('date', 'asc'))
      );

      // Calculate attendance for each student
      const attendanceMap: {
        [key: string]: { presentDays: number; totalDays: number };
      } = {};

      studentMap.forEach((student) => {
        attendanceMap[student.rollNo] = { presentDays: 0, totalDays: 0 };
      });

      // Count attendance
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

      // Create rankings
      const rankings: AttendanceRanking[] = [];
      studentMap.forEach((student, rollNo) => {
        const attendance = attendanceMap[rollNo] || { presentDays: 0, totalDays: 0 };
        const percentage = attendance.totalDays > 0 
          ? Math.round((attendance.presentDays / attendance.totalDays) * 100)
          : 0;

        rankings.push({
          rollNo,
          name: student.name,
          presentDays: attendance.presentDays,
          totalDays: attendance.totalDays,
          attendancePercentage: percentage,
          rank: 0,
        });
      });

      // Sort by percentage descending
      rankings.sort((a, b) => {
        if (b.attendancePercentage !== a.attendancePercentage) {
          return b.attendancePercentage - a.attendancePercentage;
        }
        return b.presentDays - a.presentDays;
      });

      // Assign ranks
      rankings.forEach((ranking, index) => {
        ranking.rank = index + 1;
      });

      setAttendanceRankings(rankings);
    } catch (error) {
      console.error('Error loading attendance rankings:', error);
    }
  };

  const loadTeamRankings = async (studentMap: Map<string, StudentData>) => {
    try {
      const teamsSnapshot = await getDocs(collection(db, 'teams'));
      const teamScores = new Map<string, number>();
      const teamDetails = new Map<
        string,
        { name: string; leaderRollNo: string; leaderName: string; taskCount: number }
      >();

      // Get team info and initialize scores
      teamsSnapshot.forEach((doc) => {
        const data = doc.data();
        teamScores.set(doc.id, 0);
        const leaderName = studentMap.get(data.leaderRollNo)?.name || 'Unknown';
        teamDetails.set(doc.id, {
          name: data.teamName,
          leaderRollNo: data.leaderRollNo,
          leaderName,
          taskCount: 0,
        });
      });

      // Get team scores
      const scoresSnapshot = await getDocs(collection(db, 'teamScores'));
      scoresSnapshot.forEach((doc) => {
        const data = doc.data();
        const currentScore = teamScores.get(data.teamId) || 0;
        teamScores.set(data.teamId, currentScore + (data.scoreGiven || 0));

        const details = teamDetails.get(data.teamId);
        if (details) {
          details.taskCount++;
        }
      });

      // Create rankings
      const rankings: TeamScoreData[] = Array.from(teamScores.entries()).map(
        ([teamId, totalPoints]) => {
          const details = teamDetails.get(teamId) || {
            name: 'Unknown Team',
            leaderRollNo: '',
            leaderName: 'Unknown',
            taskCount: 0,
          };
          return {
            teamId,
            teamName: details.name,
            leaderRollNo: details.leaderRollNo,
            leaderName: details.leaderName,
            totalPoints,
            rank: 0,
            taskCount: details.taskCount,
          };
        }
      );

      // Sort by total points descending
      rankings.sort((a, b) => b.totalPoints - a.totalPoints);

      // Assign ranks
      rankings.forEach((ranking, index) => {
        ranking.rank = index + 1;
      });

      setTeamRankings(rankings);
    } catch (error) {
      console.error('Error loading team rankings:', error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!mounted || !isAdmin || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>
    );
  }

  const topAttendance = attendanceRankings.slice(0, 10);
  const topTeams = teamRankings.slice(0, 5);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Rankings</h1>
          <p className="text-white/60">View student and team rankings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'attendance'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Attendance Ranking
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'team'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Team Task Ranking
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white/60">Loading rankings data...</p>
          </div>
        ) : activeTab === 'attendance' ? (
          // ATTENDANCE RANKING TAB
          <div>
            {/* Top 10 Cards */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Top 10 Students</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {topAttendance.map((student, index) => (
                  <div
                    key={student.rollNo}
                    className={`glass-effect-strong rounded-2xl border p-6 ${
                      index === 0
                        ? 'border-yellow-400/30 bg-yellow-950/20'
                        : index === 1
                        ? 'border-gray-400/30 bg-gray-950/20'
                        : index === 2
                        ? 'border-orange-400/30 bg-orange-950/20'
                        : 'border-white/15'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                              index === 0
                                ? 'bg-yellow-500/30 text-yellow-300'
                                : index === 1
                                ? 'bg-gray-500/30 text-gray-300'
                                : index === 2
                                ? 'bg-orange-500/30 text-orange-300'
                                : 'bg-blue-500/30 text-blue-300'
                            }`}
                          >
                            {student.rank}
                          </div>
                          <div>
                            <p className="text-white font-bold">{student.name}</p>
                            <p className="text-white/60 text-sm">Roll: {student.rollNo}</p>
                          </div>
                        </div>
                      </div>
                      <Award
                        className={`w-6 h-6 ${
                          index === 0
                            ? 'text-yellow-400'
                            : index === 1
                            ? 'text-gray-400'
                            : index === 2
                            ? 'text-orange-400'
                            : 'text-white/40'
                        }`}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Attendance</span>
                        <span className="text-green-400 font-bold">
                          {student.attendancePercentage}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Days Present</span>
                        <span className="text-white">{student.presentDays}/{student.totalDays}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Ranking Table */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Full Rankings</h2>
              <div className="glass-effect-strong rounded-2xl border border-white/15 p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/20">
                    <tr>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Rank</th>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Roll No</th>
                      <th className="text-center py-3 px-4 text-white/70 font-semibold">
                        Present Days
                      </th>
                      <th className="text-center py-3 px-4 text-white/70 font-semibold">Total Days</th>
                      <th className="text-center py-3 px-4 text-white/70 font-semibold">
                        % Attendance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRankings.map((student, idx) => (
                      <tr key={student.rollNo} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                            {student.rank}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{student.name}</td>
                        <td className="py-3 px-4 text-white/70 font-mono">{student.rollNo}</td>
                        <td className="py-3 px-4 text-center text-green-400 font-medium">
                          {student.presentDays}
                        </td>
                        <td className="py-3 px-4 text-center text-white/70">{student.totalDays}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full font-bold text-xs ${
                              student.attendancePercentage >= 80
                                ? 'bg-green-500/20 text-green-300'
                                : student.attendancePercentage >= 60
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {student.attendancePercentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          // TEAM RANKING TAB
          <div>
            {/* Top 5 Teams Cards */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Top Teams</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {topTeams.map((team, index) => (
                  <div
                    key={team.teamId}
                    className={`glass-effect-strong rounded-2xl border p-6 cursor-pointer hover:border-blue-400/50 transition-all ${
                      index === 0
                        ? 'border-yellow-400/30 bg-yellow-950/20'
                        : index === 1
                        ? 'border-gray-400/30 bg-gray-950/20'
                        : index === 2
                        ? 'border-orange-400/30 bg-orange-950/20'
                        : 'border-white/15'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                              index === 0
                                ? 'bg-yellow-500/30 text-yellow-300'
                                : index === 1
                                ? 'bg-gray-500/30 text-gray-300'
                                : index === 2
                                ? 'bg-orange-500/30 text-orange-300'
                                : 'bg-blue-500/30 text-blue-300'
                            }`}
                          >
                            {team.rank}
                          </div>
                          <div>
                            <p className="text-white font-bold">{team.teamName}</p>
                            <p className="text-white/60 text-sm">Leader: {team.leaderName}</p>
                          </div>
                        </div>
                      </div>
                      <TrendingUp
                        className={`w-6 h-6 ${
                          index === 0
                            ? 'text-yellow-400'
                            : index === 1
                            ? 'text-gray-400'
                            : index === 2
                            ? 'text-orange-400'
                            : 'text-white/40'
                        }`}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Total Points</span>
                        <span className="text-green-400 font-bold text-lg">{team.totalPoints}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Tasks Completed</span>
                        <span className="text-white">{team.taskCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Team Rankings Table */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">All Teams</h2>
              <div className="glass-effect-strong rounded-2xl border border-white/15 p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/20">
                    <tr>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Rank</th>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Team Name</th>
                      <th className="text-left py-3 px-4 text-white/70 font-semibold">Leader</th>
                      <th className="text-center py-3 px-4 text-white/70 font-semibold">
                        Tasks
                      </th>
                      <th className="text-center py-3 px-4 text-white/70 font-semibold">
                        Total Points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamRankings.map((team) => (
                      <tr key={team.teamId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                            {team.rank}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{team.teamName}</td>
                        <td className="py-3 px-4 text-white/70">
                          {team.leaderName}
                          <span className="text-white/50 text-xs block">({team.leaderRollNo})</span>
                        </td>
                        <td className="py-3 px-4 text-center text-white/70">{team.taskCount}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-3 py-1 rounded-full font-bold bg-green-500/20 text-green-300">
                            {team.totalPoints}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {teamRankings.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-white/60">No teams created yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
