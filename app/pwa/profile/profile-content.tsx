'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Download, Linkedin, Github } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import QRCode from 'react-qr-code';

export default function ProfileContent() {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [userData, setUserData] = useState({
    name: 'Student',
    email: '',
    studentId: 'CS-2024-000',
    department: 'Computer Science & Engineering',
    semester: '4th Semester',
    teamNumber: 5,
    initial: 'S',
    profilePhoto: '',
    linkedin: '',
    github: ''
  });
  
  const [teamData, setTeamData] = useState<{
    teamName: string;
    leaderName: string;
    members: Array<{ name: string; rollNo: string }>;
  } | null>(null);

  useEffect(() => {
    if (currentUser) {
      const name = currentUser.name || currentUser.email.split('@')[0];
      const initial = name.charAt(0).toUpperCase();
      setUserData(prev => ({
        ...prev,
        name,
        email: currentUser.email,
        studentId: currentUser.rollNo || prev.studentId,
        initial,
      }));
      loadTeamData();
    }
  }, [currentUser]);

  const loadTeamData = async () => {
    if (!currentUser?.uid) return;
    
    try {
      console.log('🔍 Profile: Loading team data for user:', currentUser.uid);
      
      // Load student data to get team number and social links
      const studentsQuery = query(
        collection(db, 'students'),
        where('uid', '==', currentUser.uid)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      if (!studentsSnapshot.empty) {
        const studentData = studentsSnapshot.docs[0].data();
        const studentRollNo = studentData.rollNo;
        
        console.log('✅ Profile: Student data loaded, rollNo:', studentRollNo);
        
        setUserData(prev => ({
          ...prev,
          teamNumber: studentData.teamNumber || prev.teamNumber,
          department: studentData.department || prev.department,
          semester: studentData.semester || prev.semester,
          profilePhoto: studentData.profilePhoto || '',
          linkedin: studentData.linkedin || '',
          github: studentData.github || '',
        }));
        
        // Now load actual team details from teams collection
        console.log('🔍 Profile: Loading teams collection...');
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        console.log('🔍 Profile: Found teams:', teamsSnapshot.size);
        
        // Find the team where this student is a member
        type TeamData = { teamId: string; teamName: string; leaderRollNo: string; members: string[] };
        let foundTeam: TeamData | null = null;
        
        for (const doc of teamsSnapshot.docs) {
          const data = doc.data();
          console.log('🔍 Profile: Checking team:', data.teamName, 'members:', data.members);
          
          // Check if student is in this team's members array
          if (data.members && data.members.includes(studentRollNo)) {
            console.log('✅ Profile: Found student in team:', data.teamName);
            foundTeam = {
              teamId: doc.id,
              teamName: data.teamName as string,
              leaderRollNo: data.leaderRollNo as string,
              members: data.members as string[]
            };
            break;
          }
        }
        
        if (foundTeam) {
          console.log('✅ Profile: Loading team member details...');
          
          // Load details for all team members
          const allStudentsSnapshot = await getDocs(collection(db, 'students'));
          const membersDetails: Array<{ name: string; rollNo: string }> = [];
          let leaderName = 'Unknown';
          
          foundTeam.members.forEach((memberRollNo: string) => {
            allStudentsSnapshot.docs.forEach((studentDoc) => {
              const student = studentDoc.data();
              if (student.rollNo === memberRollNo) {
                membersDetails.push({
                  name: student.name,
                  rollNo: student.rollNo
                });
                
                if (student.rollNo === foundTeam!.leaderRollNo) {
                  leaderName = student.name;
                }
              }
            });
          });
          
          console.log('✅ Profile: Team details loaded:', {
            teamName: foundTeam.teamName,
            leaderName,
            memberCount: membersDetails.length
          });
          
          setTeamData({
            teamName: foundTeam.teamName,
            leaderName,
            members: membersDetails
          });
        } else {
          console.log('⚠️ Profile: Student not found in any team');
        }
      }
    } catch (error) {
      console.error('❌ Profile: Error loading team data:', error);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleDownloadCard = async () => {
    // Dynamic import for html2canvas
    const html2canvas = (await import('html2canvas')).default;
    
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current, {
        logging: false,
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `SCL-StudentID-${userData.studentId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/pwa/login');
    } catch {
      router.push('/pwa/login');
    }
  };

  return (
    <div 
      className="min-h-screen pb-20 pt-12 px-4"
      style={{
        background: 'linear-gradient(180deg, #f8fbff, #eef4ff)'
      }}
    >
      <div className="w-full max-w-sm mx-auto">
        {/* ID Card Component */}
        <div 
          style={{ 
            perspective: '1200px',
          }}
        >
          <div
            ref={cardRef}
            onClick={handleFlip}
            className="relative transition-transform duration-700 ease-out cursor-pointer"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* FRONT SIDE */}
            <div
              className="relative rounded-2xl shadow-lg overflow-visible bg-white border-2 border-[#3B82F6] min-h-[280px] transition-all"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08)'
              }}
            >
              {/* Logo - Left Aligned */}
              <div className="pt-5 px-5 pb-3">
                <img 
                  src="https://i.ibb.co/YBfg1BR8/1000264552-removebg-preview-1.png" 
                  alt="SCL"
                  className="h-12 w-auto object-contain"
                />
              </div>

              {/* Profile Photo or Initial */}
              <div className="flex justify-center mb-4">
                {userData.profilePhoto ? (
                  <img 
                    src={userData.profilePhoto} 
                    alt={userData.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#3B82F6] shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center border-4 border-[#3B82F6] shadow-lg">
                    <span className="text-4xl font-black text-white">{userData.initial}</span>
                  </div>
                )}
              </div>

              {/* Student Info - Clean Minimal */}
              <div className="px-6 pb-5 space-y-3">
                <div className="text-center space-y-0.5">
                  <h3 className="text-2xl font-black text-[#1E293B]">{userData.name}</h3>
                  <p className="text-sm font-bold text-[#3B82F6]">{userData.studentId}</p>
                </div>

                <div className="text-center space-y-0.5 pt-1">
                  <p className="text-xs font-semibold text-[#1E293B]">{userData.department}</p>
                  <p className="text-xs font-medium text-[#64748B]">{userData.semester}</p>
                </div>

                {/* Team Badge */}
                <div className="flex justify-center pt-1">
                  {teamData ? (
                    <span className="inline-flex items-center bg-[#EFF6FF] border border-[#3B82F6] px-4 py-1.5 rounded-full">
                      <span className="text-xs font-bold text-[#3B82F6]">{teamData.teamName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center bg-[#EFF6FF] border border-[#3B82F6] px-4 py-1.5 rounded-full">
                      <span className="text-xs font-bold text-[#3B82F6]">Team {userData.teamNumber}</span>
                    </span>
                  )}
                </div>

                {/* Valid Till */}
                <div className="text-center pt-2">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">Valid Till 2027</span>
                </div>
              </div>
            </div>

            {/* BACK SIDE */}
            <div
              className="absolute inset-0 rounded-2xl shadow-lg overflow-visible bg-white border-2 border-[#3B82F6] min-h-[280px]"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08)'
              }}
            >
              {/* Logo - Left Aligned */}
              <div className="pt-5 px-5 pb-4">
                <img 
                  src="https://i.ibb.co/YBfg1BR8/1000264552-removebg-preview-1.png" 
                  alt="SCL"
                  className="h-12 w-auto object-contain"
                />
              </div>

              {/* QR Code Section */}
              <div className="px-6 pb-6 space-y-3.5">
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl border-2 border-[#3B82F6] shadow-sm">
                    <QRCode
                      value={`${window.location.origin}/verify/${userData.studentId}`}
                      size={140}
                      level="H"
                      fgColor="#1E293B"
                    />
                  </div>
                </div>

                <p className="text-center text-xs font-bold text-[#1E293B]">
                  Scan to Verify ID
                </p>

                <div className="text-center text-[9px] font-medium text-[#64748B] px-2 leading-tight">
                  {window.location.hostname}/verify/{userData.studentId}
                </div>

                {/* Social Links */}
                {(userData.linkedin || userData.github) && (
                  <div className="flex gap-2 pt-2">
                    {userData.linkedin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(userData.linkedin, '_blank');
                        }}
                        className="flex-1 bg-white border border-[#3B82F6] text-[#3B82F6] font-semibold py-2.5 rounded-lg hover:bg-[#EFF6FF] transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        <Linkedin className="w-4 h-4" />
                        <span className="text-xs">LinkedIn</span>
                      </button>
                    )}

                    {userData.github && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(userData.github, '_blank');
                        }}
                        className="flex-1 bg-white border border-gray-300 text-[#1E293B] font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        <Github className="w-4 h-4" />
                        <span className="text-xs">GitHub</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tap Indicator */}
        <div className="mt-4 text-center">
          <p className="text-xs text-[#64748B] font-medium">
            Tap card to flip ↻
          </p>
        </div>

        {/* Small Download Button */}
        <div className="mt-3 flex justify-center">
          <button
            onClick={handleDownloadCard}
            className="inline-flex items-center gap-2 bg-[#3B82F6] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-[#2563EB] transition-all shadow-md text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Download ID</span>
          </button>
        </div>
      </div>
    </div>
  );
}
