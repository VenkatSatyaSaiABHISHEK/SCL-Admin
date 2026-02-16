'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { LogOut, ArrowLeft, Download, Settings, Share2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, setDoc, query, where } from 'firebase/firestore';
import ExcelGridEditor from './excel-grid-editor';

interface SyllabusRow {
  id: string;
  day: number;
  date: string;
  topic: string;
  subtopics: string;
  mentors: string[];
  status: 'Upcoming' | 'Completed' | 'Delayed';
}

interface Mentor {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  photoURL?: string;
  photoUrl?: string;
  color?: string;
}

interface Topic {
  id: string;
  topic: string;
  subtopics: string[];
  difficulty?: string;
  estimatedHours?: number;
  createdAt: any;
}

interface Schedule {
  id: string;
  topic_id: string;
  topic: string;
  subtopics: string[];
  mentors: string[];
  scheduledDate: string;
  status: 'Pending' | 'Completed' | 'Delayed';
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export default function SyllabusContent() {
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [syllabusRows, setSyllabusRows] = useState<SyllabusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAdmin) {
      router.push('/login');
    } else if (mounted) {
      loadMentors();
      loadSyllabus();
    }
  }, [mounted, isAdmin, router]);

  const loadMentors = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'mentors'));
      const mentorsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Mentor));
      setMentors(mentorsData);
    } catch (error) {
      console.error('Error loading mentors:', error);
      // Fallback mentors if collection doesn't exist
      setMentors([
        { id: '1', name: 'Mentor 1' },
        { id: '2', name: 'Mentor 2' },
        { id: '3', name: 'Mentor 3' },
        { id: '4', name: 'Mentor 4' },
      ]);
    }
  };

  const loadSyllabus = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'syllabus'));
      if (snapshot.docs.length > 0) {
        const data = snapshot.docs[0].data();
        console.log('Loaded syllabus data from Firebase:', data);
        setSyllabusRows(data.rows || []);
      } else {
        console.log('No syllabus found in Firebase');
        setSyllabusRows([]);
      }
    } catch (error) {
      console.error('Error loading syllabus:', error);
      showMessage('Error loading syllabus from database', 'error');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSaveSyllabus = async (rows: SyllabusRow[]) => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'syllabus'));
      
      if (snapshot.docs.length > 0) {
        await updateDoc(doc(db, 'syllabus', snapshot.docs[0].id), {
          rows: rows,
          updatedAt: Timestamp.now(),
          updatedBy: currentUser?.uid,
        });
      } else {
        await addDoc(collection(db, 'syllabus'), {
          rows: rows,
          createdAt: Timestamp.now(),
          createdBy: currentUser?.uid,
          updatedAt: Timestamp.now(),
        });
      }
      
      setSyllabusRows(rows);
      showMessage('Syllabus saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving syllabus:', error);
      showMessage('Error saving syllabus', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isAdmin || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg animate-pulse mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Excel-style Header */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Back button */}
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>

            {/* Center: Title */}
            <h1 className="text-lg font-semibold text-gray-900">Syllabus Sheet</h1>

            {/* Right: Icons */}
            <div className="flex items-center gap-1">
              <button 
                onClick={loadSyllabus}
                className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                title="Reload data from database"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button 
                className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button 
                className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
              <button 
                className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={handleLogout} 
                className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10">
        {mentors.length > 0 ? (
          <ExcelGridEditor
            mentors={mentors}
            onSave={handleSaveSyllabus}
            showMessage={showMessage}
            initialData={syllabusRows}
          />
        ) : (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <p className="text-gray-500 text-lg">Loading mentors...</p>
            </div>
          </div>
        )}
      </div>

      {/* Notification Toast */}
      {message && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md z-40">
          <div className={`px-4 py-3 rounded-lg border ${
            messageType === 'success' 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <p className="text-sm font-medium">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}


