'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Plus, X, Users, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';

interface StudentData {
  rollNo: string;
  name: string;
}

interface Team {
  teamId: string;
  teamName: string;
  leaderRollNo: string;
  leaderName: string;
  members: string[]; // roll numbers
  memberDetails: StudentData[];
  createdAt: any;
}

interface FormData {
  teamName: string;
  leaderRollNo: string;
  selectedMembers: string[];
}

export default function TeamsContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState<FormData>({
    teamName: '',
    leaderRollNo: '',
    selectedMembers: [],
  });

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
      // Load students
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const students: StudentData[] = [];
      studentsSnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          rollNo: data.rollNo,
          name: data.name,
        });
      });
      students.sort((a, b) => a.name.localeCompare(b.name));
      setAllStudents(students);

      // Load teams
      await loadTeams(students);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Error loading teams', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async (students: StudentData[]) => {
    try {
      const teamsSnapshot = await getDocs(collection(db, 'teams'));
      const loadedTeams: Team[] = [];

      teamsSnapshot.forEach((doc) => {
        const data = doc.data();
        const leaderName = students.find((s) => s.rollNo === data.leaderRollNo)?.name || 'Unknown';
        const memberDetails = data.members
          .map((rollNo: string) => students.find((s) => s.rollNo === rollNo))
          .filter((s: StudentData | undefined) => !!s);

        loadedTeams.push({
          teamId: doc.id,
          teamName: data.teamName,
          leaderRollNo: data.leaderRollNo,
          leaderName,
          members: data.members,
          memberDetails,
          createdAt: data.createdAt,
        });
      });

      setTeams(loadedTeams);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.teamName.trim()) {
      showToast('Please enter team name', 'error');
      return;
    }

    if (!formData.leaderRollNo) {
      showToast('Please select a leader', 'error');
      return;
    }

    if (formData.selectedMembers.length < 5) {
      showToast('Please select at least 5 members', 'error');
      return;
    }

    try {
      const teamId = `team-${Date.now()}`;
      const teamRef = doc(db, 'teams', teamId);

      await setDoc(teamRef, {
        teamName: formData.teamName,
        leaderRollNo: formData.leaderRollNo,
        members: formData.selectedMembers,
        createdAt: Timestamp.now(),
      });

      showToast('Team created successfully', 'success');
      setFormData({ teamName: '', leaderRollNo: '', selectedMembers: [] });
      setShowCreateForm(false);
      await loadTeams(allStudents);
    } catch (error) {
      console.error('Error creating team:', error);
      showToast('Error creating team', 'error');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      await deleteDoc(doc(db, 'teams', teamId));
      showToast('Team deleted successfully', 'success');
      await loadTeams(allStudents);
    } catch (error) {
      console.error('Error deleting team:', error);
      showToast('Error deleting team', 'error');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleMemberSelection = (rollNo: string) => {
    setFormData((prev) => {
      const updated = [...prev.selectedMembers];
      const index = updated.indexOf(rollNo);

      if (index > -1) {
        updated.splice(index, 1);
      } else if (updated.length < 6) {
        updated.push(rollNo);
      } else {
        showToast('Maximum 6 members allowed', 'error');
        return prev;
      }

      return { ...prev, selectedMembers: updated };
    });
  };

  if (!mounted || !isAdmin || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>
    );
  }

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
        <div className="mb-12 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Team Management</h1>
            <p className="text-white/60">Create and manage student teams</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Team
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-6">
              {/* Team Name */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Team Name</label>
                <input
                  type="text"
                  value={formData.teamName}
                  onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                  placeholder="e.g., Team A, Team B"
                  className="premium-input"
                />
              </div>

              {/* Leader Selection */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Team Leader</label>
                <select
                  value={formData.leaderRollNo}
                  onChange={(e) => setFormData({ ...formData, leaderRollNo: e.target.value })}
                  className="premium-input w-full"
                >
                  <option value="">Select a leader</option>
                  {allStudents.map((student) => (
                    <option key={student.rollNo} value={student.rollNo}>
                      {student.name} ({student.rollNo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Members Selection */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Select Members (5-6 people)
                </label>
                <p className="text-white/60 text-xs mb-3">
                  Selected: {formData.selectedMembers.length}/6
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {allStudents.map((student) => (
                    <label
                      key={student.rollNo}
                      className="flex items-center gap-3 p-3 rounded-lg glass-effect border border-white/10 hover:border-blue-400/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedMembers.includes(student.rollNo)}
                        onChange={() => toggleMemberSelection(student.rollNo)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-white text-sm">
                        {student.name}
                        <span className="text-white/60"> ({student.rollNo})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
                >
                  Create Team
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({ teamName: '', leaderRollNo: '', selectedMembers: [] });
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Teams List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white/60">Loading teams...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teams.map((team) => (
              <div
                key={team.teamId}
                onClick={() => setSelectedTeam(selectedTeam?.teamId === team.teamId ? null : team)}
                className="glass-effect-strong rounded-2xl border border-white/15 p-6 cursor-pointer hover:border-blue-400/30 transition-all hover:-translate-y-1"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{team.teamName}</h3>
                    <p className="text-white/60 text-sm mt-1">
                      <UserIcon className="w-4 h-4 inline mr-1" />
                      Leader: {team.leaderName}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTeam(team.teamId);
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-white/70 hover:text-red-300 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-white/70 text-sm mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Members ({team.members.length})
                  </p>
                  <div className="space-y-2">
                    {team.memberDetails.map((member) => (
                      <div
                        key={member.rollNo}
                        className={`text-sm p-2 rounded-lg ${
                          member.rollNo === team.leaderRollNo
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-white/5 text-white/70'
                        }`}
                      >
                        {member.name}
                        <span className="text-white/50 ml-2">({member.rollNo})</span>
                        {member.rollNo === team.leaderRollNo && (
                          <span className="ml-2 text-xs bg-yellow-500/40 px-2 py-0.5 rounded">
                            Leader
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTeam?.teamId === team.teamId && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <p className="text-white/60 text-xs mb-2">Team ID: {team.teamId}</p>
                    <p className="text-white/60 text-xs">
                      Created: {team.createdAt?.toDate?.().toLocaleDateString?.() || 'Unknown'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {teams.length === 0 && !loading && (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-12 text-center">
            <Users className="w-12 h-12 text-white/40 mx-auto mb-4" />
            <p className="text-white/60">No teams created yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              Create Your First Team
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
