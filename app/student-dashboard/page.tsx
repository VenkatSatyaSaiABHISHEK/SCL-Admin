'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, Bell, BookOpen, Award, Mail } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc, getDocs, collection, query, orderBy, limit } from 'firebase/firestore';

interface StudentProfile {
  uid: string;
  name: string;
  rollNo: string;
  email: string;
  year: string;
  branch: string;
  phoneNo: string;
  linkedin: string;
  github: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: any;
}

interface SyllabusItem {
  id: string;
  title: string;
  content: string;
  subject: string;
}

interface TeamScore {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
}

export default function StudentDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isStudent, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [teamRanking, setTeamRanking] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Wait for auth to finish loading before deciding to redirect
    if (!mounted || authLoading) return;

    if (!isStudent && currentUser) {
      // Admin trying to access student dashboard
      router.push('/dashboard');
    } else if (!currentUser) {
      // Not logged in at all
      router.push('/login');
    }
  }, [mounted, authLoading, isStudent, currentUser, router]);

  useEffect(() => {
    if (mounted && currentUser && isStudent) {
      loadData();
    }
  }, [mounted, currentUser, isStudent]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load student profile
      const studentRef = doc(db, 'students', currentUser!.uid);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        setProfile(studentSnap.data() as StudentProfile);
      }

      // Load announcements
      const announcementsQuery = query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const announcementsSnap = await getDocs(announcementsQuery);
      const announcementsList: Announcement[] = [];
      announcementsSnap.forEach((doc) => {
        announcementsList.push({
          id: doc.id,
          ...(doc.data() as any),
        });
      });
      setAnnouncements(announcementsList);

      // Load syllabus
      const syllabusQuery = query(
        collection(db, 'syllabus'),
        orderBy('subject', 'asc'),
        limit(5)
      );
      const syllabusSnap = await getDocs(syllabusQuery);
      const syllabusList: SyllabusItem[] = [];
      syllabusSnap.forEach((doc) => {
        syllabusList.push({
          id: doc.id,
          ...(doc.data() as any),
        });
      });
      setSyllabus(syllabusList);

      // Load team scores and rankings
      const scoresSnap = await getDocs(collection(db, 'teamScores'));
      const scoresByTeam: { [key: string]: number } = {};

      scoresSnap.forEach((doc) => {
        const data = doc.data();
        if (!scoresByTeam[data.teamId]) {
          scoresByTeam[data.teamId] = 0;
        }
        scoresByTeam[data.teamId] += data.scoreGiven || 0;
      });

      // Load teams to get names
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const teamsList: TeamScore[] = [];

      teamsSnap.forEach((doc) => {
        const score = scoresByTeam[doc.id] || 0;
        teamsList.push({
          teamId: doc.id,
          teamName: doc.data().teamName || 'Team ' + doc.id,
          score,
          rank: 0,
        });
      });

      // Calculate ranks
      teamsList.sort((a, b) => b.score - a.score);
      teamsList.forEach((team, idx) => {
        team.rank = idx + 1;
      });

      setTeamRanking(teamsList);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || authLoading || !isStudent || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white/70">Loading student dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navbar */}
      <nav className="glass-effect-strong border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent hidden sm:inline">
                Student Dashboard
              </span>
            </div>

            <div className="flex items-center gap-2">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome, {currentUser.name}</h1>
          <p className="text-white/60">Your profile, announcements, and team rankings</p>
        </div>

        {/* Student Profile Card */}
        {profile && (
          <div className="glass-effect-strong rounded-2xl border border-blue-500/30 bg-blue-950/10 p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <User className="w-6 h-6 text-blue-400" />
              Your Profile
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-white/60 text-sm font-medium mb-2">Full Name</p>
                <p className="text-white text-lg font-semibold">{profile.name}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm font-medium mb-2">Roll Number</p>
                <p className="text-white text-lg font-semibold">{profile.rollNo}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm font-medium mb-2">Email</p>
                <p className="text-white font-mono text-sm">{profile.email}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm font-medium mb-2">Year</p>
                <p className="text-white text-lg font-semibold">{profile.year}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm font-medium mb-2">Branch</p>
                <p className="text-white text-lg font-semibold">{profile.branch}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm font-medium mb-2">Phone</p>
                <p className="text-white text-lg font-semibold">{profile.phoneNo || 'N/A'}</p>
              </div>
              {profile.linkedin && (
                <div>
                  <p className="text-white/60 text-sm font-medium mb-2">LinkedIn</p>
                  <a
                    href={profile.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition text-sm truncate"
                  >
                    View Profile →
                  </a>
                </div>
              )}
              {profile.github && (
                <div>
                  <p className="text-white/60 text-sm font-medium mb-2">GitHub</p>
                  <a
                    href={profile.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition text-sm truncate"
                  >
                    View Profile →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Announcements */}
          <div className="lg:col-span-2">
            <div className="glass-effect-strong rounded-2xl border border-green-500/30 bg-green-950/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-green-400" />
                Announcements
              </h2>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-400 border-t-transparent mx-auto"></div>
                </div>
              ) : announcements.length > 0 ? (
                <div className="space-y-4">
                  {announcements.map((ann) => (
                    <div key={ann.id} className="p-4 bg-white/5 border border-green-500/20 rounded-lg hover:bg-white/10 transition">
                      <h3 className="text-white font-semibold mb-2">{ann.title}</h3>
                      <p className="text-white/70 text-sm line-clamp-2">{ann.content}</p>
                      <p className="text-white/50 text-xs mt-2">
                        {ann.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/60 text-center py-8">No announcements yet</p>
              )}
            </div>
          </div>

          {/* Team Rankings */}
          <div>
            <div className="glass-effect-strong rounded-2xl border border-yellow-500/30 bg-yellow-950/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
                Team Rankings
              </h2>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent mx-auto"></div>
                </div>
              ) : teamRanking.length > 0 ? (
                <div className="space-y-3">
                  {teamRanking.map((team) => (
                    <div
                      key={team.teamId}
                      className="p-3 bg-white/5 border border-yellow-500/20 rounded-lg hover:bg-white/10 transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-semibold text-sm">{team.teamName}</span>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-full ${
                            team.rank === 1
                              ? 'bg-yellow-500/30 border border-yellow-400/50 text-yellow-300'
                              : team.rank === 2
                              ? 'bg-gray-500/30 border border-gray-400/50 text-gray-300'
                              : team.rank === 3
                              ? 'bg-orange-500/30 border border-orange-400/50 text-orange-300'
                              : 'bg-blue-500/30 border border-blue-400/50 text-blue-300'
                          }`}
                        >
                          #{team.rank}
                        </span>
                      </div>
                      <p className="text-yellow-300 font-bold text-lg">{team.score} pts</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/60 text-center py-8">No teams found</p>
              )}
            </div>
          </div>
        </div>

        {/* Syllabus */}
        <div className="glass-effect-strong rounded-2xl border border-purple-500/30 bg-purple-950/10 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            Syllabus
          </h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400 border-t-transparent mx-auto"></div>
            </div>
          ) : syllabus.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {syllabus.map((item) => (
                <div key={item.id} className="p-4 bg-white/5 border border-purple-500/20 rounded-lg hover:bg-white/10 transition">
                  <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                  <p className="text-white/70 text-sm mb-2 line-clamp-3">{item.content}</p>
                  <p className="text-purple-300 text-xs font-medium">Subject: {item.subject}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60 text-center py-8">No syllabus items yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
