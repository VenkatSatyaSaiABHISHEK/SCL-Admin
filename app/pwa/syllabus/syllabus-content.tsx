'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/app/components/pwa-ui/Card';
import { getSyllabusData } from '@/lib/api';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar, Share2, Users, Download, BookOpen, CheckCircle2, X, Filter } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useAuth } from '@/context/AuthContext';

interface Assignment {
  id: number;
  title: string;
  dueDate: string;
  type: 'quiz' | 'lab' | 'project' | 'exam';
  completed: boolean;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  instructor: string;
  icon: string;
  schedule: string;
  room: string;
  credits: number;
  progress: number;
  nextClass: string;
  assignments: Assignment[];
  attendance: number;
}

interface Mentor {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  photoUrl?: string;
  avatar?: string;
}

interface SyllabusItem {
  id: string;
  topic: string;
  subtopics: string;
  status: 'Completed' | 'In Progress' | 'Pending' | string;
  date: string;
  day: number;
  mentors: string[];
  studyMaterial?: string; // Google Drive link or URL to study material
}

export default function SyllabusContent() {
  const { currentUser, loading: authLoading } = useAuth();
  const [syllabusItems, setSyllabusItems] = useState<SyllabusItem[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SyllabusItem | null>(null);
  const [showTopicsModal, setShowTopicsModal] = useState(false);
  const [modalItem, setModalItem] = useState<SyllabusItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'completed' | 'materials'>('all');
  
  // Combined loading state
  const loading = authLoading || dataLoading;

  useEffect(() => {
    // Check online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Wait for Firebase auth to initialize
    if (authLoading) {
      console.log('Waiting for Firebase authentication to initialize...');
      return;
    }
    
    // Check if user is authenticated after auth has loaded
    if (!currentUser) {
      console.warn('User not authenticated after auth initialization');
      setError('Not logged in - Please log in to view syllabus');
      setDataLoading(false);
      setSyllabusItems([]);
      return;
    }
    
    console.log('✅ Auth ready. User authenticated:', currentUser.email);
    
    // Fetch real syllabus data from Firebase with timeout
    const fetchSyllabusData = async () => {
      setDataLoading(true);
      setError(null);
      
      // Check if online first
      if (!navigator.onLine) {
        console.warn('No internet connection detected');
        setError('No internet connection. Please check your network settings.');
        setIsOnline(false);
        setDataLoading(false);
        setSyllabusItems([]);
        return;
      }
      
      try {
        console.log('🔍 Starting Firestore queries...');
        console.log('🔐 Current user:', currentUser.email);
        console.log('🔐 Auth UID:', currentUser.uid);
        
        // First, load mentors to resolve mentor IDs to names
        console.log('📚 Loading mentors from Firebase...');
        const mentorsSnapshot = await getDocs(collection(db, 'mentors'));
        console.log('📚 Mentors query successful. Docs:', mentorsSnapshot.docs.length);
        const mentorsData = mentorsSnapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Mentor));
        setMentors(mentorsData);
        console.log('✅ Loaded mentors:', mentorsData.length);
        
        // Add timeout to prevent infinite loading
        console.log('📖 Loading syllabus data from Firebase...');
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout - Firebase took too long to respond')), 15000)
        );
        
        // Race between Firebase call and timeout
        const syllabusData = await Promise.race([
          getSyllabusData(),
          timeoutPromise
        ]) as any[];
        
        console.log('✅ Syllabus query successful. Items:', syllabusData.length);
        
        
        if (syllabusData && syllabusData.length > 0) {
          console.log('📋 Processing syllabus data...');
          
          // Transform the Firebase data to match our interface
          const transformedItems: SyllabusItem[] = syllabusData.map((item: any, index: number) => {
            return {
              id: item.id || `firebase_${index}`,
              topic: item.topic || 'No Topic Available',
              subtopics: item.subtopics || 'No details available',
              status: item.status || 'Pending',
              date: item.date || new Date().toISOString().split('T')[0],
              day: item.day || (index + 1),
              mentors: Array.isArray(item.mentors) ? item.mentors : (item.mentors ? [item.mentors] : []),
              studyMaterial: item.studyMaterial || item.material || item.driveLink || undefined // Support multiple field names
            };
          });
          
          setSyllabusItems(transformedItems);
          console.log('✅ Successfully loaded', transformedItems.length, 'syllabus items');
        } else {
          console.log('⚠️ No syllabus data found in Firebase');
          setSyllabusItems([]);
        }
        
      } catch (error: any) {
        console.error('❌ Error fetching syllabus data:', error);
        console.error('❌ Error code:', error?.code);
        console.error('❌ Error message:', error?.message);
        console.error('❌ Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // Determine error type and set appropriate message
        let errorMessage = 'Unable to load syllabus data';
        
        if (!navigator.onLine) {
          errorMessage = 'No internet connection';
          setIsOnline(false);
        } else if (error.message && error.message.includes('timeout')) {
          errorMessage = 'Connection timeout - Firebase is taking too long';
        } else if (error.code === 'permission-denied' || 
                   error.message?.includes('permission') || 
                   error.message?.includes('Missing or insufficient permissions')) {
          errorMessage = 'Permission denied - Please log in again or contact administrator';
        } else if (error.code === 'unavailable') {
          errorMessage = 'Firebase service temporarily unavailable';
        } else if (error.code === 'unauthenticated') {
          errorMessage = 'Not logged in - Please log in to view syllabus';
        } else {
          errorMessage = 'Failed to connect to database';
        }
        
        setError(errorMessage);
        
        // Set empty data
        setSyllabusItems([]);
      }
      
      setDataLoading(false);
    };

    fetchSyllabusData();
  }, [authLoading, currentUser]);

  const getTodayItem = () => {
    if (!syllabusItems || syllabusItems.length === 0) return null;
    const today = new Date().toISOString().split('T')[0];
    // Only return a class if there's actually one scheduled for today
    return syllabusItems.find(item => item.date === today) || null;
  };

  const getUpcomingItems = () => {
    if (!syllabusItems || syllabusItems.length === 0) return [];
    const today = new Date();
    return syllabusItems
      .filter(item => new Date(item.date) > today || item.status.toLowerCase() !== 'completed')
      .slice(0, 5);
  };

  // Filter items based on active filter
  const getFilteredItems = () => {
    if (!syllabusItems || syllabusItems.length === 0) return [];
    
    if (activeFilter === 'completed') {
      // Show only completed classes
      return syllabusItems.filter(item => item.status.toLowerCase() === 'completed');
    }
    
    if (activeFilter === 'materials') {
      // Show only classes that have study material
      return syllabusItems.filter(item => item.studyMaterial && item.studyMaterial.trim() !== '');
    }
    
    // Default: show upcoming classes (activeFilter === 'all')
    return getUpcomingItems();
  };

  const formatTime = (date: string) => {
    // Generate consistent time based on day number
    const times = ["9:00 AM", "10:30 AM", "2:00 PM", "3:30 PM", "11:00 AM"];
    const dayNum = parseInt(date.split('-')[2]) || 1;
    return times[dayNum % times.length];
  };

  const getStatusBadge = (item: SyllabusItem) => {
    if (!item) return { label: "Unknown", style: "bg-gray-100 text-gray-700" };
    const today = new Date().toISOString().split('T')[0];
    const itemDate = new Date(item.date);
    const todayDate = new Date(today);
    
    if (item.date === today) return { label: "Today", style: "bg-green-500 text-white" };
    if (itemDate < todayDate && item.status.toLowerCase() === 'completed') return { label: "Completed", style: "bg-green-100 text-green-700" };
    if (itemDate > todayDate) return { label: "Upcoming", style: "bg-blue-100 text-blue-700" };
    return { label: "Pending", style: "bg-yellow-100 text-yellow-700" };
  };

  const getMentorName = (mentorId: string): string => {
    const mentor = mentors.find(m => m.id === mentorId);
    return mentor ? mentor.name : mentorId;
  };

  const getMentorPhoto = (mentorId: string): string | null => {
    const mentor = mentors.find(m => m.id === mentorId);
    return mentor?.photoURL || mentor?.photoUrl || mentor?.avatar || null;
  };

  const getLecturerAvatar = (mentorIds: string[]) => {
    if (!mentorIds || mentorIds.length === 0) return "👨‍🏫";
    
    const mentorPhoto = getMentorPhoto(mentorIds[0]);
    const mentorName = getMentorName(mentorIds[0]);
    
    if (mentorPhoto) {
      // Return JSX for image
      return (
        <img 
          src={mentorPhoto} 
          alt={mentorName}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            // Replace with initials if image fails
            const target = e.target as HTMLImageElement;
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = mentorName.charAt(0).toUpperCase();
              parent.style.backgroundColor = '#3B82F6';
              parent.style.color = 'white';
              parent.style.display = 'flex';
              parent.style.alignItems = 'center';
              parent.style.justifyContent = 'center';
              parent.style.fontWeight = 'bold';
            }
          }}
        />
      );
    }
    
    // Fallback to initials
    return mentorName.charAt(0).toUpperCase();
  };

  const getLecturerName = (mentorIds: string[]) => {
    if (!mentorIds || mentorIds.length === 0) return "Instructor";
    // Resolve mentor ID to actual name from Firebase
    const mentorName = getMentorName(mentorIds[0]);
    return mentorName.length > 10 ? mentorName.slice(0, 10) + "..." : mentorName;
  };

  const getAllMentorNames = (mentorIds: string[]): string[] => {
    if (!mentorIds || mentorIds.length === 0) return ["Instructor"];
    return mentorIds.map(id => getMentorName(id));
  };

  const getAllMentorAvatars = (mentorIds: string[]) => {
    if (!mentorIds || mentorIds.length === 0) return ["👨‍🏫"];
    return mentorIds.slice(0, 3).map(id => {
      const mentorPhoto = getMentorPhoto(id);
      const mentorName = getMentorName(id);
      
      if (mentorPhoto) {
        return (
          <img 
            key={id}
            src={mentorPhoto} 
            alt={mentorName}
            className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = mentorName.charAt(0).toUpperCase();
                parent.className = "w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm";
              }
            }}
          />
        );
      }
      
      return (
        <div key={id} className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm">
          {mentorName.charAt(0).toUpperCase()}
        </div>
      );
    });
  };

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (dateStr === today.toISOString().split('T')[0]) return "Today";
    if (dateStr === tomorrow.toISOString().split('T')[0]) return "Tomorrow";
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-red-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-center">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">⚠️</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Connection Error</h2>
              <p className="text-white/90 text-sm">{error}</p>
            </div>
            
            <div className="p-6 space-y-4">
              {!isOnline && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                  <p className="font-semibold text-amber-900 mb-2">📡 No Internet Connection</p>
                  <ul className="text-amber-800 text-sm space-y-1 ml-4">
                    <li>• Check your WiFi or mobile data</li>
                    <li>• Make sure airplane mode is off</li>
                    <li>• Try turning WiFi off and on</li>
                  </ul>
                </div>
              )}
              
              {isOnline && error?.includes('login') && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                  <p className="font-semibold text-amber-900 mb-2">🔐 Authentication Required</p>
                  <ul className="text-amber-800 text-sm space-y-1 ml-4">
                    <li>• Your session may have expired</li>
                    <li>• Please log out and log back in</li>
                    <li>• Make sure you're using the correct credentials</li>
                  </ul>
                </div>
              )}
              
              {isOnline && error?.includes('Permission denied') && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-900 mb-2">🔒 Access Denied</p>
                  <ul className="text-red-800 text-sm space-y-1 ml-4">
                    <li>• Your account may not have permission to view syllabus</li>
                    <li>• Try logging out and logging back in</li>
                    <li>• Contact your administrator for access</li>
                  </ul>
                </div>
              )}
              
              {isOnline && !error?.includes('login') && !error?.includes('Permission denied') && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <p className="font-semibold text-blue-900 mb-2">🔍 Troubleshooting Steps</p>
                  <ul className="text-blue-800 text-sm space-y-1 ml-4">
                    <li>• Check if other apps/websites work</li>
                    <li>• Try refreshing the page</li>
                    <li>• Clear browser cache and reload</li>
                    <li>• Contact administrator if problem persists</li>
                  </ul>
                </div>
              )}
              
              <div className="flex gap-3">
                {(error?.includes('login') || error?.includes('Permission denied')) ? (
                  <>
                    <button
                      onClick={() => window.location.href = '/pwa/login'}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-xl font-semibold hover:scale-105 transition-transform"
                    >
                      🔐 Go to Login
                    </button>
                    <button
                      onClick={() => window.history.back()}
                      className="bg-gray-200 text-gray-700 px-6 py-4 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    >
                      ← Go Back
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setError(null);
                        setDataLoading(true);
                        window.location.reload();
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-semibold hover:scale-105 transition-transform"
                    >
                      🔄 Retry Connection
                    </button>
                    <button
                      onClick={() => window.history.back()}
                      className="bg-gray-200 text-gray-700 px-6 py-4 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    >
                      ← Go Back
                    </button>
                  </>
                )}
              </div>
              
              <div className="text-center text-xs text-gray-500 pt-2 space-y-1">
                <p>Connection Status: {isOnline ? '🟢 Online' : '🔴 Offline'}</p>
                <p>Login Status: {currentUser ? '✅ Logged In' : '❌ Not Logged In'}</p>
                {currentUser && <p className="text-blue-600">User: {currentUser.email}</p>}
                <p className="mt-1">If issue persists, please contact your administrator</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (syllabusItems.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
            <span className="text-2xl">📚</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Classes Found</h3>
          <p className="text-gray-500 text-sm">Your schedule will appear here once classes are added</p>
        </div>
      </div>
    );
  }

  const todayItem = getTodayItem();
  const filteredItems = getFilteredItems();

  return (
    <div className="min-h-screen bg-[#F8FAFC] max-w-full overflow-x-hidden">
      {/* ===== TODAY'S CLASS SECTION ===== */}
      {todayItem ? (
        <div className="p-4 pb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Today's Class</h2>
          <div className="relative bg-gradient-to-br from-sky-300 via-blue-300 to-indigo-400 rounded-2xl p-4 sm:p-6 text-white shadow-xl overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full transform translate-x-12 -translate-y-12"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full transform -translate-x-8 translate-y-8"></div>
            
            {/* Share Button */}
            <button className="absolute top-3 right-3 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm">
              <Share2 size={14} className="text-white" />
            </button>

            {/* Content */}
            <div className="relative pr-8">
              {/* Subject Label */}
              <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-medium mb-3 backdrop-blur-sm">
                Computer Science
              </div>
              
              {/* Topic Title - Fixed for mobile */}
              <h3 className="text-lg sm:text-2xl font-bold mb-4 leading-tight break-words pr-2">
                {todayItem.topic || 'No Topic'}
              </h3>
              
              {/* Mentors Info - Support for multiple mentors */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex -space-x-2">
                  {getAllMentorAvatars(todayItem.mentors || [])}
                  {todayItem.mentors && todayItem.mentors.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-gray-500 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
                      +{todayItem.mentors.length - 3}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <Users size={14} className="text-blue-100" />
                    <p className="font-medium text-sm sm:text-base truncate">
                      {getAllMentorNames(todayItem.mentors || []).join(', ')}
                    </p>
                  </div>
                  <p className="text-blue-100 text-xs sm:text-sm">
                    {todayItem.mentors && todayItem.mentors.length > 1 ? 'Instructors' : 'Instructor'}
                  </p>
                </div>
              </div>
              
              {/* Date - Fixed for mobile */}
              <div className="flex items-center gap-2 text-blue-100">
                <Calendar size={14} className="text-white" />
                <span className="text-xs sm:text-sm font-medium">
                  {new Date(todayItem.date).toLocaleDateString('en-US', { 
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
            
            {/* Status Badge - Repositioned for mobile */}
            <div className="absolute bottom-3 right-3">
              <div className={`px-3 py-1 rounded-xl text-xs font-bold ${
                getStatusBadge(todayItem).label === 'Today' 
                  ? 'bg-white/90 text-blue-700 shadow-lg'
                  : getStatusBadge(todayItem).style
              } shadow-lg`}>
                {getStatusBadge(todayItem).label}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* No Class Today - Animation */
        <div className="p-4 pb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Today's Class</h2>
          <div className="bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 rounded-2xl p-6 text-center shadow-sm border border-blue-200">
            <div className="w-32 h-32 mx-auto mb-4">
              <DotLottieReact
                src="https://lottie.host/269d99c2-218e-4c41-8ef3-c6088eb31316/BgTV39Wagl.lottie"
                loop
                autoplay
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Class Today</h3>
            <p className="text-gray-600 text-sm">Enjoy your free time! Check upcoming classes below.</p>
          </div>
        </div>
      )}

      {/* ===== SYLLABUS PROGRESS INDICATOR ===== */}
      <div className="px-4 pb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Syllabus Progress</h2>
        <div className="flex items-center justify-center gap-1.5">
          {syllabusItems.slice(0, 10).map((item, idx) => (
            <div 
              key={idx}
              className={`w-2.5 h-2.5 rounded-full ${
                item.status.toLowerCase() === 'completed' 
                  ? 'bg-green-500' 
                  : 'bg-gray-300'
              }`}
              title={item.topic}
            />
          ))}
          {syllabusItems.length > 10 && (
            <span className="text-xs text-gray-500 ml-1">+{syllabusItems.length - 10}</span>
          )}
        </div>
      </div>

      {/* ===== FILTER BUTTONS ===== */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-center gap-2">
          <button 
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeFilter === 'all' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
            }`}
          >
            All
          </button>
          <button 
            onClick={() => setActiveFilter('completed')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeFilter === 'completed' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
            }`}
          >
            Completed
          </button>
          <button 
            onClick={() => setActiveFilter('materials')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeFilter === 'materials' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
            }`}
          >
            Materials
          </button>
        </div>
      </div>

      {/* ===== UPCOMING CLASSES ===== */}
      <div className="px-4 pb-24 pt-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">
            {activeFilter === 'completed' ? 'Completed Classes' : 
             activeFilter === 'materials' ? 'Classes with Materials' : 
             'Upcoming Classes'}
          </h2>
          {activeFilter === 'all' && syllabusItems.length > 5 && (
            <button 
              onClick={() => {/* Could add navigation to full schedule view */}}
              className="text-indigo-600 text-sm font-semibold hover:text-indigo-700 transition-colors"
            >
              View All
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {filteredItems.map((item, index) => {
            const status = getStatusBadge(item);
            const isHighlighted = getDayLabel(item.date) === "Tomorrow";
            
            return (
              <div key={item.id} 
                   className={`bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 border ${
                     isHighlighted ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-100'
                   }`}>
                <div className="flex items-start gap-3">
                  {/* ===== LEFT: CALENDAR BADGE ===== */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className={`rounded-xl p-2.5 ${
                      isHighlighted 
                        ? 'bg-indigo-100 border-2 border-indigo-300' 
                        : 'bg-gray-100 border border-gray-200'
                    }`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${
                        isHighlighted ? 'text-indigo-700' : 'text-gray-500'
                      }`}>
                        {getDayLabel(item.date)}
                      </p>
                      <p className={`text-lg font-black ${
                        isHighlighted ? 'text-indigo-900' : 'text-gray-900'
                      }`}>
                        {new Date(item.date).getDate()}
                      </p>
                    </div>
                  </div>
                  
                  {/* ===== CENTER: CONTENT ===== */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-sm leading-tight">
                        {item.topic || 'Unknown Topic'}
                      </h3>
                      {/* ===== RIGHT: STATUS BADGE ===== */}
                      <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${status.style} whitespace-nowrap`}>
                        {status.label}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                      {item.subtopics || 'No details available'}
                    </p>
                    
                    {/* ===== OVERLAPPING MENTOR AVATARS ===== */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex -space-x-2">
                        {(item.mentors || []).slice(0, 3).map((mentorId, idx) => {
                          const mentorPhoto = getMentorPhoto(mentorId);
                          const mentorName = getMentorName(mentorId);
                          
                          if (mentorPhoto) {
                            return (
                              <img 
                                key={idx}
                                src={mentorPhoto} 
                                alt={mentorName}
                                className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<div class="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">${mentorName.charAt(0).toUpperCase()}</div>`;
                                  }
                                }}
                              />
                            );
                          }
                          
                          return (
                            <div key={idx} className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
                              {mentorName.charAt(0).toUpperCase()}
                            </div>
                          );
                        })}
                        {item.mentors && item.mentors.length > 3 && (
                          <div className="w-7 h-7 rounded-full bg-gray-500 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
                            +{item.mentors.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-600 font-medium truncate">
                        {getAllMentorNames(item.mentors || []).slice(0, 2).join(', ')}
                        {item.mentors && item.mentors.length > 2 && ` +${item.mentors.length - 2}`}
                      </span>
                    </div>
                    
                    {/* ===== CONDITIONAL ACTION BUTTONS ===== */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* View Topics Button - Always show */}
                      <button 
                        onClick={() => {
                          setModalItem(item);
                          setShowTopicsModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <BookOpen size={12} />
                        View Topics
                      </button>
                      
                      {/* Download Material Button - Conditional on studyMaterial existence */}
                      {item.studyMaterial && item.studyMaterial.trim() !== '' && (
                        <button 
                          onClick={() => window.open(item.studyMaterial, '_blank')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-bold hover:bg-green-100 transition-colors"
                        >
                          <Download size={12} />
                          Material
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* View Full Schedule or Clear Filter Button */}
        {activeFilter === 'all' && syllabusItems.length > filteredItems.length && (
          <div className="mt-6 text-center">
            <button className="bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-8 rounded-full transition-all shadow-md border-2 border-gray-200 hover:border-indigo-300 hover:shadow-lg text-sm">
              View Full Schedule <span className="text-indigo-600">({syllabusItems.length - filteredItems.length} more)</span>
            </button>
          </div>
        )}
        
        {/* Clear Filter Button */}
        {(activeFilter === 'completed' || activeFilter === 'materials') && filteredItems.length > 0 && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => setActiveFilter('all')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full transition-all shadow-md hover:shadow-lg text-sm"
            >
              Show All Classes
            </button>
          </div>
        )}
        
        {/* No results message for filters */}
        {filteredItems.length === 0 && activeFilter !== 'all' && (
          <div className="mt-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Filter size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {activeFilter === 'completed' ? 'No Completed Classes' : 'No Materials Available'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {activeFilter === 'completed' 
                ? 'Complete your classes to see them here' 
                : 'Materials will appear here when instructors upload them'}
            </p>
            <button 
              onClick={() => setActiveFilter('all')}
              className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
            >
              View All Classes
            </button>
          </div>
        )}
      </div>

      {/* Topics Modal */}
      {showTopicsModal && modalItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTopicsModal(false)}>
          <div 
            className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Topics Covered</h3>
              <button 
                onClick={() => setShowTopicsModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {/* Class Title */}
              <div className="mb-4">
                <h4 className="font-bold text-gray-900 text-base mb-1">{modalItem.topic}</h4>
                <p className="text-sm text-gray-600">{modalItem.subtopics}</p>
              </div>

              {/* Topics List */}
              <div className="space-y-2 mb-6">
                {modalItem.status.toLowerCase() === 'completed' ? (
                  <>
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-900 text-sm">Introduction & Overview</p>
                        <p className="text-xs text-green-700 mt-0.5">Covered in class</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-900 text-sm">Core Concepts</p>
                        <p className="text-xs text-green-700 mt-0.5">Covered in class</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-900 text-sm">Practical Examples</p>
                        <p className="text-xs text-green-700 mt-0.5">Covered in class</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <BookOpen size={24} className="text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium">No topics covered yet</p>
                    <p className="text-gray-500 text-xs mt-1">Topics will appear after class completion</p>
                  </div>
                )}
              </div>

              {/* Instructor Info */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 mb-2">Instructor{modalItem.mentors && modalItem.mentors.length > 1 ? 's' : ''}</p>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {getAllMentorAvatars(modalItem.mentors || [])}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {getAllMentorNames(modalItem.mentors || []).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
