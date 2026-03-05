'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/app/components/pwa-ui/Card';
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
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading rankings...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rankings</h1>
        <p className="text-gray-600 text-sm mt-1">Leaderboard and performance</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('global')}
          className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'global'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          Ranker
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'team'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          Your Team
        </button>
      </div>

      {/* Content */}
      {activeTab === 'global' ? (
        <>
          {/* Top 3 Leaderboard Cards */}
          {rankings.length > 0 && rankings.length <= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {rankings.map((entry) => {
                const medal = medalConfig[entry.rank] || { symbol: entry.rank.toString(), color: 'text-gray-600' };
                const isCurrentUser = entry.rollNo === userRanking?.rollNo;
                return (
                  <Card 
                    key={entry.rank} 
                    className={`text-center ${
                      isCurrentUser 
                        ? 'bg-gradient-to-b from-blue-100 to-blue-50 border-2 border-blue-300' 
                        : 'bg-gradient-to-b from-blue-50 to-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${medal.color} bg-gray-100 mx-auto mb-3`}>
                      {medal.symbol}
                    </div>
                    <p className={`font-semibold text-sm ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}`}>
                      {isCurrentUser ? 'You' : entry.name}
                    </p>
                    <p className="text-blue-600 font-bold text-base mt-2">{entry.totalScore}</p>
                    <p className="text-gray-500 text-xs mt-1">points</p>
                  </Card>
                );
              })}
            </div>
          )}

          {rankings.length > 3 && (
            <div className="grid grid-cols-3 gap-3">
              {rankings.slice(0, 3).map((entry) => {
                const medal = medalConfig[entry.rank];
                const isCurrentUser = entry.rollNo === userRanking?.rollNo;
                return (
                  <Card 
                    key={entry.rank} 
                    className={`text-center ${
                      isCurrentUser 
                        ? 'bg-gradient-to-b from-blue-100 to-blue-50 border-2 border-blue-300' 
                        : 'bg-gradient-to-b from-blue-50 to-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${medal.color} bg-gray-100 mx-auto mb-3`}>
                      {medal.symbol}
                    </div>
                    <p className={`font-semibold text-sm break-words ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}`}>
                      {isCurrentUser ? 'You' : entry.name}
                    </p>
                    <p className="text-blue-600 font-bold text-base mt-2">{entry.totalScore}</p>
                    <p className="text-gray-500 text-xs mt-1">points</p>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Rest of Leaderboard */}
          {rankings.length > 3 && (
            <div className="space-y-2">
              {rankings.slice(3, 20).map((entry) => {
              const isCurrentUser = entry.rollNo === userRanking?.rollNo;
              return (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                    isCurrentUser
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                      isCurrentUser ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {entry.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium text-sm truncate ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}`}>
                        {isCurrentUser ? 'You' : entry.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`font-bold text-sm ${isCurrentUser ? 'text-blue-600' : 'text-gray-900'}`}>
                      {entry.totalScore}
                    </p>
                  </div>
                </div>
              );
            })}
            </div>
          )}

          {rankings.length === 0 && (
            <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 text-center py-12">
              <p className="text-gray-600">No rankings data available yet</p>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Team Members Data */}
          {teamMembers.length > 0 ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <h3 className="font-semibold text-blue-900 mb-1">{teamName}</h3>
                <p className="text-blue-700 text-sm">Team Members: {teamMembers.length}</p>
              </div>

              <div className="space-y-3">
                {teamMembers.map((member) => {
                  const isCurrentUser = member.rollNo === userRanking?.rollNo;
                  return (
                    <Card 
                      key={member.rollNo}
                      className={isCurrentUser ? 'border-2 border-blue-300 bg-blue-50' : ''}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className={`font-semibold break-words ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}`}>
                              {isCurrentUser ? `${member.name} (You)` : member.name}
                            </p>
                            {member.isLeader && (
                              <span className="text-[10px] font-bold text-white bg-[#3B82F6] px-2 py-0.5 rounded flex-shrink-0">
                                LEADER
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs font-mono truncate">{member.rollNo}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-2xl font-bold ${isCurrentUser ? 'text-blue-600' : 'text-gray-900'}`}>
                            {member.totalScore}
                          </p>
                          <p className="text-gray-500 text-xs">total points</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200">
                        <div className="text-center">
                          <p className="text-gray-600 text-xs mb-1">Attendance</p>
                          <p className="text-green-600 font-bold text-sm">{member.attendanceMarks}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600 text-xs mb-1">Tasks</p>
                          <p className="text-blue-600 font-bold text-sm">{member.taskScore}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600 text-xs mb-1">Bonus</p>
                          <p className="text-purple-600 font-bold text-sm">{member.bonusMarks}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 text-center py-12">
              <div className="text-5xl mb-4">👥</div>
              <h3 className="font-semibold text-gray-900 mb-2">No Team Assigned</h3>
              <p className="text-gray-600 text-sm">
                You haven't been assigned to a team yet. Contact your administrator.
              </p>
            </Card>
          )}
        </>
      )}

      {/* Stats Overview */}
      {userRanking && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Your Ranking Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-gray-600 text-xs font-medium mb-2">Current Rank</p>
              <p className="text-3xl font-bold text-blue-600">#{userRanking.rank}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-gray-600 text-xs font-medium mb-2">Total Points</p>
              <p className="text-3xl font-bold text-green-600">{userRanking.totalScore}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="font-semibold text-amber-900 text-sm mb-2">How Points Work</p>
        <p className="text-amber-800 text-xs">
          Total Score = Attendance Marks + Task Marks + Bonus Marks. Rankings are updated by your instructor.
        </p>
      </div>
    </div>
  );
}