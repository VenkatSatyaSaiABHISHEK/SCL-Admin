'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle2, Mail, Award, Users } from 'lucide-react';

interface StudentData {
  name: string;
  email: string;
  studentId: string;
  rollNo: string;
  department: string;
  semester: string;
  teamNumber: number;
  profilePhoto?: string;
  initial: string;
}

export default function PublicStudentProfile() {
  const params = useParams();
  const studentId = params.studentId as string;
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadStudentData();
  }, [studentId]);

  const loadStudentData = async () => {
    try {
      setLoading(true);
      setError(false);

      // Query students by rollNo or studentId
      const studentsQuery = query(
        collection(db, 'students'),
        where('rollNo', '==', studentId)
      );
      
      const studentsSnapshot = await getDocs(studentsQuery);
      
      if (!studentsSnapshot.empty) {
        const data = studentsSnapshot.docs[0].data();
        const initial = data.name ? data.name.charAt(0).toUpperCase() : 'S';
        
        setStudent({
          name: data.name || 'Student',
          email: data.email || '',
          studentId: data.rollNo || studentId,
          rollNo: data.rollNo || studentId,
          department: data.department || 'Computer Science & Engineering',
          semester: data.semester || '4th Semester',
          teamNumber: data.teamNumber || 0,
          profilePhoto: data.profilePhoto || '',
          initial
        });
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Error loading student:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(180deg, #f8fbff, #eef4ff)'
        }}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#64748B] font-medium">Verifying ID...</p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          background: 'linear-gradient(180deg, #f8fbff, #eef4ff)'
        }}
      >
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#1E293B] mb-2">Student Not Found</h2>
          <p className="text-[#64748B]">The Student ID "{studentId}" could not be verified.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen py-12 px-4"
      style={{
        background: 'linear-gradient(180deg, #f8fbff, #eef4ff)'
      }}
    >
      <div className="max-w-md mx-auto">
        {/* Verification Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-green-100 border border-green-300 text-green-700 px-4 py-2 rounded-full shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold text-sm">Verified Student ID</span>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border-2 border-[#3B82F6] shadow-lg overflow-hidden">
          {/* Logo Header */}
          <div className="bg-gradient-to-r from-[#3B82F6] to-[#2563EB] px-6 py-4">
            <img 
              src="https://i.ibb.co/YBfg1BR8/1000264552-removebg-preview-1.png" 
              alt="SCL"
              className="h-10 w-auto object-contain mx-auto"
            />
          </div>

          {/* Profile Photo */}
          <div className="flex justify-center -mt-12 mb-4">
            {student.profilePhoto ? (
              <img 
                src={student.profilePhoto} 
                alt={student.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center border-4 border-white shadow-md">
                <span className="text-4xl font-black text-white">{student.initial}</span>
              </div>
            )}
          </div>

          {/* Student Info */}
          <div className="px-6 pb-6 space-y-4">
            <div className="text-center">
              <h1 className="text-2xl font-black text-[#1E293B] mb-1">{student.name}</h1>
              <p className="text-sm font-bold text-[#3B82F6]">{student.studentId}</p>
            </div>

            {/* Details */}
            <div className="space-y-3 pt-2">
              {/* Email */}
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <Mail className="w-5 h-5 text-[#3B82F6] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#64748B] uppercase mb-0.5">Email</p>
                  <p className="text-sm font-semibold text-[#1E293B] break-all">{student.email}</p>
                </div>
              </div>

              {/* Department */}
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <Award className="w-5 h-5 text-[#3B82F6] flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#64748B] uppercase mb-0.5">Department</p>
                  <p className="text-sm font-semibold text-[#1E293B]">{student.department}</p>
                  <p className="text-xs font-medium text-[#64748B]">{student.semester}</p>
                </div>
              </div>

              {/* Team */}
              {student.teamNumber > 0 && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <Users className="w-5 h-5 text-[#3B82F6] flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#64748B] uppercase mb-0.5">Team</p>
                    <p className="text-sm font-bold text-[#3B82F6]">Team {student.teamNumber}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Valid Badge */}
            <div className="text-center pt-4 border-t border-gray-200">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">Valid Till 2027</span>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-6">
          <p className="text-xs text-[#64748B] font-medium">
            Smart City Lab Students Portal
          </p>
          <p className="text-[10px] text-[#94A3B8] mt-1">
            Verified on {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
