'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Plus, X, Edit2, Save } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, Timestamp, updateDoc } from 'firebase/firestore';

interface Team {
  teamId: string;
  teamName: string;
  leaderRollNo: string;
  leaderName: string;
  members: string[];
}

interface TaskScore {
  scoreId: string;
  teamId: string;
  teamName: string;
  taskTitle: string;
  scoreOutOf: number;
  scoreGiven: number;
  remarks: string;
  createdAt: any;
}

interface FormData {
  teamId: string;
  taskTitle: string;
  scoreOutOf: number;
  scoreGiven: number;
  remarks: string;
}

export default function TaskMarksContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [taskScores, setTaskScores] = useState<TaskScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    teamId: '',
    taskTitle: '',
    scoreOutOf: 50,
    scoreGiven: 0,
    remarks: '',
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
      // Load teams
      const teamsSnapshot = await getDocs(collection(db, 'teams'));
      const loadedTeams: Team[] = [];

      teamsSnapshot.forEach((doc) => {
        const data = doc.data();
        loadedTeams.push({
          teamId: doc.id,
          teamName: data.teamName,
          leaderRollNo: data.leaderRollNo,
          leaderName: 'Team Leader',
          members: data.members,
        });
      });

      setTeams(loadedTeams);

      // Load task scores
      await loadTaskScores(loadedTeams);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Error loading task marks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskScores = async (loadedTeams: Team[]) => {
    try {
      const scoresSnapshot = await getDocs(collection(db, 'teamScores'));
      const scores: TaskScore[] = [];

      scoresSnapshot.forEach((doc) => {
        const data = doc.data();
        const team = loadedTeams.find((t) => t.teamId === data.teamId);

        scores.push({
          scoreId: doc.id,
          teamId: data.teamId,
          teamName: team?.teamName || 'Unknown Team',
          taskTitle: data.taskTitle,
          scoreOutOf: data.scoreOutOf || 50,
          scoreGiven: data.scoreGiven || 0,
          remarks: data.remarks || '',
          createdAt: data.createdAt,
        });
      });

      // Sort by team and date
      scores.sort((a, b) => {
        if (a.teamId !== b.teamId) return a.teamId.localeCompare(b.teamId);
        return (b.createdAt?.toDate?.()?.getTime?.() || 0) - (a.createdAt?.toDate?.()?.getTime?.() || 0);
      });

      setTaskScores(scores);
    } catch (error) {
      console.error('Error loading task scores:', error);
    }
  };

  const handleAddOrUpdateScore = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.teamId) {
      showToast('Please select a team', 'error');
      return;
    }

    if (!formData.taskTitle.trim()) {
      showToast('Please enter task title', 'error');
      return;
    }

    if (formData.scoreGiven > formData.scoreOutOf) {
      showToast('Score given cannot exceed score out of', 'error');
      return;
    }

    try {
      if (editingId) {
        // Update existing score
        const scoreRef = doc(db, 'teamScores', editingId);
        await updateDoc(scoreRef, {
          teamId: formData.teamId,
          taskTitle: formData.taskTitle,
          scoreOutOf: formData.scoreOutOf,
          scoreGiven: formData.scoreGiven,
          remarks: formData.remarks,
        });
        showToast('Task score updated successfully', 'success');
      } else {
        // Create new score
        const scoreId = `score-${Date.now()}`;
        const scoreRef = doc(db, 'teamScores', scoreId);

        await setDoc(scoreRef, {
          teamId: formData.teamId,
          taskTitle: formData.taskTitle,
          scoreOutOf: formData.scoreOutOf,
          scoreGiven: formData.scoreGiven,
          remarks: formData.remarks,
          createdAt: Timestamp.now(),
        });
        showToast('Task score added successfully', 'success');
      }

      setFormData({
        teamId: '',
        taskTitle: '',
        scoreOutOf: 50,
        scoreGiven: 0,
        remarks: '',
      });
      setEditingId(null);
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      console.error('Error saving score:', error);
      showToast('Error saving task score', 'error');
    }
  };

  const handleEditScore = (score: TaskScore) => {
    setFormData({
      teamId: score.teamId,
      taskTitle: score.taskTitle,
      scoreOutOf: score.scoreOutOf,
      scoreGiven: score.scoreGiven,
      remarks: score.remarks,
    });
    setEditingId(score.scoreId);
    setShowAddForm(true);
  };

  const handleDeleteScore = async (scoreId: string) => {
    if (!confirm('Are you sure you want to delete this score?')) return;

    try {
      await deleteDoc(doc(db, 'teamScores', scoreId));
      showToast('Task score deleted successfully', 'success');
      await loadData();
    } catch (error) {
      console.error('Error deleting score:', error);
      showToast('Error deleting task score', 'error');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const resetForm = () => {
    setFormData({
      teamId: '',
      taskTitle: '',
      scoreOutOf: 50,
      scoreGiven: 0,
      remarks: '',
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  if (!mounted || !isAdmin || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>
    );
  }

  // Group scores by team
  const scoresByTeam: { [key: string]: TaskScore[] } = {};
  taskScores.forEach((score) => {
    if (!scoresByTeam[score.teamId]) {
      scoresByTeam[score.teamId] = [];
    }
    scoresByTeam[score.teamId].push(score);
  });

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
            <h1 className="text-4xl font-bold text-white mb-2">Task Marks</h1>
            <p className="text-white/60">Add and manage team task scores</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Score
          </button>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingId ? 'Edit Task Score' : 'Add New Task Score'}
            </h2>
            <form onSubmit={handleAddOrUpdateScore} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team Selection */}
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">Team</label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                    className="premium-input w-full"
                    disabled={!!editingId}
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.teamId} value={team.teamId}>
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Task Title */}
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">Task Title</label>
                  <input
                    type="text"
                    value={formData.taskTitle}
                    onChange={(e) => setFormData({ ...formData, taskTitle: e.target.value })}
                    placeholder="e.g., Task 1, Task 2"
                    className="premium-input"
                  />
                </div>

                {/* Score OutOf */}
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Score Out Of
                  </label>
                  <input
                    type="number"
                    value={formData.scoreOutOf}
                    onChange={(e) =>
                      setFormData({ ...formData, scoreOutOf: parseInt(e.target.value) })
                    }
                    className="premium-input"
                    min="1"
                  />
                </div>

                {/* Score Given */}
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Score Given
                  </label>
                  <input
                    type="number"
                    value={formData.scoreGiven}
                    onChange={(e) =>
                      setFormData({ ...formData, scoreGiven: parseInt(e.target.value) })
                    }
                    className="premium-input"
                    min="0"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Add any remarks or notes"
                  className="premium-input resize-none h-24"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Update Score' : 'Add Score'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Scores Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white/60">Loading task scores...</p>
          </div>
        ) : (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/20">
                <tr>
                  <th className="text-left py-3 px-4 text-white/70 font-semibold">Team Name</th>
                  <th className="text-left py-3 px-4 text-white/70 font-semibold">Task Title</th>
                  <th className="text-center py-3 px-4 text-white/70 font-semibold">Out Of</th>
                  <th className="text-center py-3 px-4 text-white/70 font-semibold">Given</th>
                  <th className="text-left py-3 px-4 text-white/70 font-semibold">Remarks</th>
                  <th className="text-center py-3 px-4 text-white/70 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taskScores.map((score) => (
                  <tr key={score.scoreId} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white font-medium">{score.teamName}</td>
                    <td className="py-3 px-4 text-white/70">{score.taskTitle}</td>
                    <td className="py-3 px-4 text-center text-white/70">{score.scoreOutOf}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-3 py-1 rounded-full font-bold bg-green-500/20 text-green-300">
                        {score.scoreGiven}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white/60 text-xs">{score.remarks}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleEditScore(score)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs mr-2"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteScore(score.scoreId)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors text-xs"
                      >
                        <X className="w-3 h-3" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {taskScores.length === 0 && (
              <div className="text-center py-8">
                <p className="text-white/60">No task scores added yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
