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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading rankings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Rankings</h1>
          <p className="text-sm text-gray-600">Leaderboard & Performance</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            onClick={() => setActiveTab('global')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'global'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Top Rankers
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'team'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Your Team
          </button>
        </div>

        {/* Content */}
        {activeTab === 'global' ? (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {rankings.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {rankings.slice(0, 20).map((entry) => {
                  const isCurrentUser = entry.rollNo === userRanking?.rollNo;
                  
                  // Rank styling
                  let rankColor = 'text-gray-500';
                  if (entry.rank === 1) rankColor = 'text-yellow-600 font-bold';
                  if (entry.rank === 2) rankColor = 'text-gray-400 font-bold';
                  if (entry.rank === 3) rankColor = 'text-orange-500 font-bold';

                  return (
                    <div
                      key={entry.rank}
                      className={`
                        relative flex items-center gap-4 px-4 py-3.5 transition-colors
                        hover:bg-gray-50
                        ${isCurrentUser ? 'bg-blue-50/50 border-l-2 border-blue-500' : ''}
                      `}
                    >
                      {/* Current User Label */}
                      {isCurrentUser && (
                        <div className="absolute top-2 right-3">
                          <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                            YOU
                          </span>
                        </div>
                      )}

                      {/* Rank */}
                      <div className={`w-8 text-center font-semibold ${rankColor}`}>
                        {entry.rank}
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
                        text-sm font-semibold px-2.5 py-1 rounded-md
                        ${isCurrentUser 
                          ? 'text-blue-700 bg-blue-100' 
                          : 'text-gray-700 bg-gray-100'
                        }
                      `}>
                        {entry.totalScore} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🏆</div>
                <p className="text-sm text-gray-500">No rankings data available yet</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {teamMembers.length > 0 ? (
              <>
                {/* Team Header */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👥</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{teamName}</h3>
                      <p className="text-xs text-gray-600">{teamMembers.length} Members</p>
                    </div>
                  </div>
                </div>

                {/* Team Members List */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {teamMembers.map((member, index) => {
                      const isCurrentUser = member.rollNo === userRanking?.rollNo;
                      
                      return (
                        <div
                          key={member.rollNo}
                          className={`
                            relative px-4 py-4 transition-colors hover:bg-gray-50
                            ${isCurrentUser ? 'bg-blue-50/50 border-l-2 border-blue-500' : ''}
                          `}
                        >
                          {/* Labels */}
                          <div className="absolute top-2 right-3 flex gap-1">
                            {member.isLeader && (
                              <span className="text-[9px] font-semibold text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded">
                                LEADER
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                YOU
                              </span>
                            )}
                          </div>

                          {/* Member Row */}
                          <div className="flex items-center gap-4 mb-3">
                            {/* Position */}
                            <div className={`
                              w-8 text-center font-semibold text-sm
                              ${index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-400' : 'text-gray-500'}
                            `}>
                              {index + 1}
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
                              text-sm font-semibold px-2.5 py-1 rounded-md
                              ${isCurrentUser 
                                ? 'text-blue-700 bg-blue-100' 
                                : 'text-gray-700 bg-gray-100'
                              }
                            `}>
                              {member.totalScore} pts
                            </div>
                          </div>

                          {/* Score Breakdown */}
                          <div className="flex gap-4 text-xs text-gray-600 ml-12">
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
              <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
                <div className="text-5xl mb-3">👥</div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No Team Assigned</h3>
                <p className="text-sm text-gray-500">
                  You haven't been assigned to a team yet. Contact your administrator.
                </p>
              </div>
            )}
          </div>
        )}

        {/* User Stats Card */}
        {userRanking && activeTab === 'global' && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">📊</span>
              <h3 className="text-sm font-semibold text-gray-900">Your Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Current Rank</p>
                <p className="text-2xl font-bold text-gray-900">#{userRanking.rank}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Total Points</p>
                <p className="text-2xl font-bold text-gray-900">{userRanking.totalScore}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
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