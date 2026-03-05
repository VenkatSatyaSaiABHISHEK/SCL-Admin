'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface RankingData {
  rollNo: string;
  name: string;
  attendanceMarks: number;
  taskMarks: { [taskId: string]: number };
  bonusMarks: number;
  totalScore: number;
  rank: number;
}

interface TeamData {
  teamId: string;
  teamName: string;
  leaderRollNo: string;
  members: string[];
}

interface TeamMemberScore {
  rollNo: string;
  name: string;
  attendanceMarks: number;
  taskScore: number;
  bonusMarks: number;
  totalScore: number;
  isLeader?: boolean;
}

export default function RankingsContent() {
  const [activeTab, setActiveTab] = useState<'global' | 'team'>('global');
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [userRanking, setUserRanking] = useState<RankingData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberScore[]>([]);
  const [teamName, setTeamName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      console.log('🏆 Rankings: Loading data for user:', { uid: currentUser.uid, email: currentUser.email });

      // Load all rankings
      const rankingsSnapshot = await getDocs(collection(db, 'rankings'));
      const allRankings: RankingData[] = [];
      
      rankingsSnapshot.forEach((doc) => {
        const data = doc.data();
        const taskScore = Object.values(data.taskMarks || {}).reduce((sum: number, mark) => sum + (mark as number), 0);
        
        allRankings.push({
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
      allRankings.sort((a, b) => a.rank - b.rank);
      setRankings(allRankings);
      console.log('🏆 Rankings: Loaded rankings:', allRankings.length);

      // Find current user's ranking - try both userId and uid
      let studentsSnapshot = await getDocs(
        query(collection(db, 'students'), where('userId', '==', currentUser.uid))
      );
      
      // If not found with userId, try with uid
      if (studentsSnapshot.empty) {
        console.log('🏆 Rankings: Not found with userId, trying uid...');
        studentsSnapshot = await getDocs(
          query(collection(db, 'students'), where('uid', '==', currentUser.uid))
        );
      }
      
      let userRollNo = '';
      let studentData: any = null;
      studentsSnapshot.forEach((doc) => {
        studentData = doc.data();
        userRollNo = studentData.rollNo;
        console.log('🏆 Rankings: Found student:', { rollNo: userRollNo, name: studentData.name });
      });

      if (!userRollNo) {
        console.error('❌ Rankings: User rollNo not found in students collection');
        setLoading(false);
        return;
      }

      const userRank = allRankings.find(r => r.rollNo === userRollNo);
      setUserRanking(userRank || null);
      console.log('🏆 Rankings: User ranking:', userRank);

      // Load team data
      const teamsSnapshot = await getDocs(collection(db, 'teams'));
      console.log('🏆 Rankings: Found teams:', teamsSnapshot.size);
      
      let foundTeam: TeamData | undefined;

      for (const docSnap of teamsSnapshot.docs) {
        const data = docSnap.data();
        console.log('🏆 Rankings: Checking team:', { 
          teamName: data.teamName, 
          members: data.members,
          hasUser: data.members?.includes(userRollNo)
        });
        
        if (data.members && data.members.includes(userRollNo)) {
          foundTeam = {
            teamId: docSnap.id,
            teamName: data.teamName,
            leaderRollNo: data.leaderRollNo,
            members: data.members
          };
          console.log('✅ Rankings: Found user in team:', foundTeam.teamName);
          break;
        }
      }

      if (foundTeam) {
        setTeamName(foundTeam.teamName);
        
        // Get rankings for team members
        const teamMemberScores: TeamMemberScore[] = [];
        
        foundTeam.members.forEach((memberRollNo: string) => {
          const memberRanking = allRankings.find(r => r.rollNo === memberRollNo);
          if (memberRanking) {
            const taskScore = Object.values(memberRanking.taskMarks).reduce((sum, mark) => sum + mark, 0);
            teamMemberScores.push({
              rollNo: memberRanking.rollNo,
              name: memberRanking.name,
              attendanceMarks: memberRanking.attendanceMarks,
              taskScore,
              bonusMarks: memberRanking.bonusMarks,
              totalScore: memberRanking.totalScore,
              isLeader: memberRollNo === foundTeam.leaderRollNo
            });
          } else {
            console.warn('⚠️ Rankings: No ranking data for team member:', memberRollNo);
          }
        });

        // Sort by total score descending
        teamMemberScores.sort((a, b) => b.totalScore - a.totalScore);
        setTeamMembers(teamMemberScores);
        console.log('✅ Rankings: Loaded team members:', teamMemberScores.length);
      } else {
        console.warn('⚠️ Rankings: User not found in any team. RollNo:', userRollNo);
        setTeamMembers([]);
        setTeamName('');
      }

    } catch (error) {
      console.error('❌ Rankings: Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const medalConfig: { [key: number]: { symbol: string; color: string } } = {
    1: { symbol: '1', color: 'text-yellow-600' },
    2: { symbol: '2', color: 'text-gray-400' },
    3: { symbol: '3', color: 'text-orange-600' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mx-auto mb-4 animate-pulse"></div>
          <p className="text-gray-600 font-medium">Loading rankings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 pb-24">
      <div className="px-4 pt-6 space-y-5">
        {/* Page Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Rankings</h1>
          <p className="text-gray-600 text-sm mt-1">Leaderboard & Performance</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm">
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeTab === 'global'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Top Rankers
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeTab === 'team'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Your Team
          </button>
        </div>

        {/* Content */}
        {activeTab === 'global' ? (
          <div className="space-y-3">
            {rankings.length > 0 ? (
              rankings.slice(0, 20).map((entry) => {
                const isCurrentUser = entry.rollNo === userRanking?.rollNo;
                const isTop3 = entry.rank <= 3;
                
                // Rank circle styling
                let rankCircleStyle = 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700';
                if (entry.rank === 1) rankCircleStyle = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-lg shadow-yellow-500/30';
                if (entry.rank === 2) rankCircleStyle = 'bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-lg shadow-gray-400/30';
                if (entry.rank === 3) rankCircleStyle = 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30';

                return (
                  <div
                    key={entry.rank}
                    className={`
                      relative overflow-hidden rounded-2xl p-4 transition-all duration-300 
                      hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]
                      ${isCurrentUser 
                        ? 'bg-gradient-to-r from-blue-500/10 to-blue-400/10 border-2 border-blue-500 shadow-md shadow-blue-500/20' 
                        : 'bg-white border border-gray-200 shadow-sm'
                      }
                      ${isTop3 ? 'shadow-md' : ''}
                    `}
                  >
                    {/* Current User Label */}
                    {isCurrentUser && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full shadow-sm">
                          YOU
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      {/* Rank Circle */}
                      <div 
                        className={`
                          w-12 h-12 rounded-full flex items-center justify-center 
                          font-bold text-lg flex-shrink-0 ${rankCircleStyle}
                        `}
                      >
                        {entry.rank}
                      </div>

                      {/* Student Name */}
                      <div className="flex-1 min-w-0">
                        <p 
                          className={`
                            font-semibold text-base truncate
                            ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}
                          `}
                          title={entry.name}
                        >
                          {entry.name}
                        </p>
                        {isTop3 && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {entry.rank === 1 && '🥇 Champion'}
                            {entry.rank === 2 && '🥈 Runner Up'}
                            {entry.rank === 3 && '🥉 Third Place'}
                          </p>
                        )}
                      </div>

                      {/* Points Badge */}
                      <div 
                        className={`
                          px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0
                          ${isCurrentUser 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : isTop3 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md' 
                              : 'bg-gray-100 text-gray-700'
                          }
                        `}
                      >
                        {entry.totalScore} pts
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 text-center py-16">
                <div className="text-5xl mb-4">🏆</div>
                <p className="text-gray-600 font-medium">No rankings data available yet</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {teamMembers.length > 0 ? (
              <>
                {/* Team Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg p-5 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">👥</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{teamName}</h3>
                      <p className="text-blue-100 text-sm">{teamMembers.length} Members</p>
                    </div>
                  </div>
                </div>

                {/* Team Members List */}
                <div className="space-y-3">
                  {teamMembers.map((member, index) => {
                    const isCurrentUser = member.rollNo === userRanking?.rollNo;
                    
                    return (
                      <div
                        key={member.rollNo}
                        className={`
                          relative overflow-hidden rounded-2xl p-4 transition-all duration-300
                          hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]
                          ${isCurrentUser 
                            ? 'bg-gradient-to-r from-blue-500/10 to-blue-400/10 border-2 border-blue-500 shadow-md shadow-blue-500/20' 
                            : 'bg-white border border-gray-200 shadow-sm'
                          }
                        `}
                      >
                        {/* Leader & You Labels */}
                        <div className="absolute top-2 right-2 flex gap-1">
                          {member.isLeader && (
                            <span className="text-[10px] font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 px-2 py-0.5 rounded-full shadow-sm">
                              LEADER
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full shadow-sm">
                              YOU
                            </span>
                          )}
                        </div>

                        {/* Member Info Row */}
                        <div className="flex items-center gap-4 mb-4">
                          {/* Rank Circle */}
                          <div 
                            className={`
                              w-12 h-12 rounded-full flex items-center justify-center 
                              font-bold text-lg flex-shrink-0
                              ${index === 0 
                                ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-md' 
                                : index === 1 
                                  ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-md' 
                                  : 'bg-gray-100 text-gray-700'
                              }
                            `}
                          >
                            {index + 1}
                          </div>

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <p 
                              className={`
                                font-semibold text-base truncate
                                ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}
                              `}
                              title={member.name}
                            >
                              {member.name}
                            </p>
                            <p className="text-xs text-gray-500 font-mono truncate">{member.rollNo}</p>
                          </div>

                          {/* Total Points Badge */}
                          <div 
                            className={`
                              px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0
                              ${isCurrentUser 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                              }
                            `}
                          >
                            {member.totalScore} pts
                          </div>
                        </div>

                        {/* Score Breakdown */}
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-200">
                          <div className="text-center bg-green-50 rounded-lg py-2">
                            <p className="text-green-700 text-xs font-medium mb-1">Attendance</p>
                            <p className="text-green-600 font-bold text-base">{member.attendanceMarks}</p>
                          </div>
                          <div className="text-center bg-blue-50 rounded-lg py-2">
                            <p className="text-blue-700 text-xs font-medium mb-1">Tasks</p>
                            <p className="text-blue-600 font-bold text-base">{member.taskScore}</p>
                          </div>
                          <div className="text-center bg-purple-50 rounded-lg py-2">
                            <p className="text-purple-700 text-xs font-medium mb-1">Bonus</p>
                            <p className="text-purple-600 font-bold text-base">{member.bonusMarks}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 text-center py-16">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">No Team Assigned</h3>
                <p className="text-gray-600 text-sm px-6">
                  You haven't been assigned to a team yet. Contact your administrator.
                </p>
              </div>
            )}
          </div>
        )}

        {/* User Stats Card */}
        {userRanking && activeTab === 'global' && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h3 className="font-bold text-gray-900">Your Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-center shadow-lg">
                <p className="text-blue-100 text-xs font-semibold mb-2">Current Rank</p>
                <p className="text-3xl font-bold text-white">#{userRanking.rank}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-center shadow-lg">
                <p className="text-green-100 text-xs font-semibold mb-2">Total Points</p>
                <p className="text-3xl font-bold text-white">{userRanking.totalScore}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <p className="font-bold text-amber-900 text-sm mb-1">How Points Work</p>
              <p className="text-amber-800 text-xs leading-relaxed">
                Total Score = Attendance + Task Marks + Bonus Marks. Rankings are updated by your instructor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}