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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading rankings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Rankings</h1>
          <p className="text-sm text-gray-600">Leaderboard & Performance</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-white shadow-sm">
          <button
            onClick={() => setActiveTab('global')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'global'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Top Rankers
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'team'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Your Team
          </button>
        </div>

        {/* Content */}
        {activeTab === 'global' ? (
          <div className="space-y-8">
            {rankings.length > 0 ? (
              <>
                {/* TOP 3 HIGHLIGHT SECTION */}
                {rankings.length >= 1 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {rankings.slice(0, 3).map((entry) => {
                        const isCurrentUser = entry.rollNo === userRanking?.rollNo;
                        
                        // Trophy and color styling
                        let trophy = '';
                        let bgColor = 'bg-white';
                        let borderColor = 'border-gray-200';
                        let textColor = 'text-gray-900';
                        
                        if (entry.rank === 1) {
                          trophy = '🥇';
                          bgColor = 'bg-gradient-to-br from-yellow-50 to-orange-50';
                          borderColor = 'border-yellow-200';
                          textColor = 'text-yellow-800';
                        } else if (entry.rank === 2) {
                          trophy = '🥈';
                          bgColor = 'bg-gradient-to-br from-gray-50 to-slate-50';
                          borderColor = 'border-gray-300';
                          textColor = 'text-gray-700';
                        } else if (entry.rank === 3) {
                          trophy = '🥉';
                          bgColor = 'bg-gradient-to-br from-orange-50 to-amber-50';
                          borderColor = 'border-orange-200';
                          textColor = 'text-orange-700';
                        }

                        return (
                          <div
                            key={entry.rank}
                            className={`
                              relative ${bgColor} border ${borderColor} rounded-2xl p-6 shadow-md
                              transition-transform hover:scale-105
                              ${isCurrentUser ? 'ring-2 ring-blue-500' : ''}
                            `}
                          >
                            {/* YOU Label */}
                            {isCurrentUser && (
                              <div className="absolute top-3 right-3">
                                <span className="text-[9px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">
                                  YOU
                                </span>
                              </div>
                            )}

                            {/* Trophy */}
                            <div className="text-center mb-4">
                              <div className="text-5xl mb-2">{trophy}</div>
                              <div className={`text-2xl font-bold ${textColor}`}>
                                #{entry.rank}
                              </div>
                            </div>

                            {/* Avatar Placeholder */}
                            <div className="flex justify-center mb-4">
                              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg">
                                {entry.name.charAt(0).toUpperCase()}
                              </div>
                            </div>

                            {/* Student Name */}
                            <h3 className="text-center font-semibold text-gray-900 mb-3 truncate" title={entry.name}>
                              {entry.name}
                            </h3>

                            {/* Performance Summary */}
                            <div className="bg-white/60 rounded-lg p-3 mb-4 space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-600">Attendance:</span>
                                <span className="font-semibold text-green-600">{entry.attendanceMarks}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-600">Tasks:</span>
                                <span className="font-semibold text-blue-600">
                                  {Object.values(entry.taskMarks).reduce((sum, mark) => sum + mark, 0)}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-600">Bonus:</span>
                                <span className="font-semibold text-purple-600">{entry.bonusMarks}</span>
                              </div>
                            </div>

                            {/* Total Points */}
                            <div className="text-center">
                              <div className="inline-flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-full font-bold shadow-md">
                                <span className="text-lg">{entry.totalScore}</span>
                                <span className="text-xs">pts</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* LEADERBOARD TABLE */}
                {rankings.length > 3 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Complete Leaderboard</h2>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="divide-y divide-gray-100">
                        {rankings.slice(3, 20).map((entry) => {
                          const isCurrentUser = entry.rollNo === userRanking?.rollNo;

                          return (
                            <div
                              key={entry.rank}
                              className={`
                                relative flex items-center gap-4 px-5 py-4 transition-colors
                                hover:bg-gray-50
                                ${isCurrentUser ? 'bg-blue-50/70 border-l-4 border-blue-600' : ''}
                              `}
                            >
                              {/* YOU Label */}
                              {isCurrentUser && (
                                <div className="absolute top-2 right-4">
                                  <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                    YOU
                                  </span>
                                </div>
                              )}

                              {/* Rank */}
                              <div className="w-10 text-center">
                                <span className="text-base font-bold text-gray-700">
                                  {entry.rank}
                                </span>
                              </div>

                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow">
                                  {entry.name.charAt(0).toUpperCase()}
                                </div>
                              </div>

                              {/* Student Name */}
                              <div className="flex-1 min-w-0">
                                <p 
                                  className={`text-sm font-medium truncate ${
                                    isCurrentUser ? 'text-blue-900' : 'text-gray-900'
                                  }`}
                                  title={entry.name}
                                >
                                  {entry.name}
                                </p>
                              </div>

                              {/* Points Badge */}
                              <div className={`
                                text-sm font-semibold px-3 py-1.5 rounded-lg
                                ${isCurrentUser 
                                  ? 'text-blue-700 bg-blue-100 border border-blue-200' 
                                  : 'text-gray-700 bg-gray-100 border border-gray-200'
                                }
                              `}>
                                {entry.totalScore} pts
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl text-center py-16 shadow-sm">
                <div className="text-5xl mb-3">🏆</div>
                <p className="text-sm text-gray-500">No rankings data available yet</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {teamMembers.length > 0 ? (
              <>
                {/* Team Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-md px-5 py-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">👥</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold">{teamName}</h3>
                      <p className="text-sm text-blue-100">{teamMembers.length} Members</p>
                    </div>
                  </div>
                </div>

                {/* Team Members List */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="divide-y divide-gray-100">
                    {teamMembers.map((member, index) => {
                      const isCurrentUser = member.rollNo === userRanking?.rollNo;
                      
                      return (
                        <div
                          key={member.rollNo}
                          className={`
                            relative px-5 py-4 transition-colors hover:bg-gray-50
                            ${isCurrentUser ? 'bg-blue-50/70 border-l-4 border-blue-600' : ''}
                          `}
                        >
                          {/* Labels */}
                          <div className="absolute top-2 right-4 flex gap-1">
                            {member.isLeader && (
                              <span className="text-[9px] font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 px-2 py-0.5 rounded-full">
                                LEADER
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                YOU
                              </span>
                            )}
                          </div>

                          {/* Member Row */}
                          <div className="flex items-center gap-4 mb-3">
                            {/* Position */}
                            <div className="w-10 text-center">
                              <span className={`text-base font-bold ${
                                index === 0 ? 'text-yellow-600' : 
                                index === 1 ? 'text-gray-400' : 
                                'text-gray-700'
                              }`}>
                                {index + 1}
                              </span>
                            </div>

                            {/* Avatar */}
                            <div className="flex-shrink-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow ${
                                index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                                index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                                'bg-gradient-to-br from-blue-400 to-blue-600'
                              }`}>
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                            </div>

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                              <p 
                                className={`text-sm font-medium truncate ${
                                  isCurrentUser ? 'text-blue-900' : 'text-gray-900'
                                }`}
                                title={member.name}
                              >
                                {member.name}
                              </p>
                              <p className="text-xs text-gray-500 font-mono mt-0.5">{member.rollNo}</p>
                            </div>

                            {/* Total Points */}
                            <div className={`
                              text-sm font-semibold px-3 py-1.5 rounded-lg
                              ${isCurrentUser 
                                ? 'text-blue-700 bg-blue-100 border border-blue-200' 
                                : 'text-gray-700 bg-gray-100 border border-gray-200'
                              }
                            `}>
                              {member.totalScore} pts
                            </div>
                          </div>

                          {/* Score Breakdown */}
                          <div className="flex gap-4 text-xs text-gray-600 ml-14">
                            <div>
                              <span className="text-gray-500">Attendance:</span>{' '}
                              <span className="font-semibold text-green-600">{member.attendanceMarks}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Tasks:</span>{' '}
                              <span className="font-semibold text-blue-600">{member.taskScore}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Bonus:</span>{' '}
                              <span className="font-semibold text-purple-600">{member.bonusMarks}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl text-center py-16 shadow-sm">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">No Team Assigned</h3>
                <p className="text-sm text-gray-500">
                  You haven't been assigned to a team yet. Contact your administrator.
                </p>
              </div>
            )}
          </div>
        )}

        {/* User Stats Card */}
        {userRanking && activeTab === 'global' && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">📊</span>
              <h3 className="text-base font-semibold text-gray-900">Your Performance</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center border border-blue-200">
                <p className="text-xs font-medium text-blue-700 mb-2">Current Rank</p>
                <p className="text-3xl font-bold text-blue-900">#{userRanking.rank}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center border border-green-200">
                <p className="text-xs font-medium text-green-700 mb-2">Total Points</p>
                <p className="text-3xl font-bold text-green-900">{userRanking.totalScore}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm p-5">
          <div className="flex gap-3">
            <div className="text-lg">💡</div>
            <div>
              <p className="text-xs font-semibold text-amber-900 mb-1">How Points Work</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Total Score = Attendance + Task Marks + Bonus Marks. Rankings are updated by your instructor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}