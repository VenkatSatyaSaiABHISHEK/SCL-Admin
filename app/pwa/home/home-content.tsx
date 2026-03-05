'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import { Bell, MapPin, Clock, BookOpen, Trophy, Calendar, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function HomeContent() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState({
    name: 'Student',
    email: '',
    attendanceRate: 85,
    totalPoints: 1250,
    rank: 12,
    totalSessions: 16,
    attendedSessions: 14
  });

  const [attendanceSession, setAttendanceSession] = useState<any>(null);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'closed' | 'inactive'>('inactive');
  const [debugAttendanceRecords, setDebugAttendanceRecords] = useState<any[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [todaysSyllabus, setTodaysSyllabus] = useState<any[]>([]);
  const [latestAttendance, setLatestAttendance] = useState<any>(null);
  const [recentSyllabusUpdate, setRecentSyllabusUpdate] = useState<any>(null);
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [mentors, setMentors] = useState<any[]>([]);

  // Request notification permission on first load
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (!currentUser) return;
      
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        console.log('📢 Browser does not support notifications');
        return;
      }
      
      // Check current permission status
      if (Notification.permission === 'default') {
        // Show a friendly prompt first
        setShowNotificationPrompt(true);
      } else if (Notification.permission === 'granted') {
        console.log('📢 Notifications already granted');
      } else {
        console.log('📢 Notifications denied');
      }
    };
    
    requestNotificationPermission();
  }, [currentUser]);

  const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('📢 Notification permission granted!');
        setShowNotificationPrompt(false);
        
        // Send a welcome notification
        new Notification('🎉 Notifications Enabled!', {
          body: "You'll now receive updates about classes, attendance sessions, and announcements.",
          icon: 'https://i.ibb.co/YBfg1BR8/1000264552-removebg-preview-1.png',
          badge: 'https://i.ibb.co/YBfg1BR8/1000264552-removebg-preview-1.png'
        });
      }
    } catch (error) {
      console.error('📢 Error requesting notification permission:', error);
    }
  };

  // Load real ranking data from Firebase
  useEffect(() => {
    const loadRankingData = async () => {
      console.log('🔍 Home PWA: loadRankingData called, currentUser:', currentUser);
      
      if (!currentUser) {
        console.log('❌ Home PWA: No currentUser, skipping ranking load');
        return;
      }

      try {
        console.log('🔍 Home PWA: Fetching student with userId:', currentUser.uid);
        
        // Get user's roll number from students collection using document ID
        const studentDocRef = doc(db, 'students', currentUser.uid);
        const studentDoc = await getDoc(studentDocRef);

        console.log('🔍 Home PWA: Student document exists?', studentDoc.exists());

        if (studentDoc.exists()) {
          const studentData = studentDoc.data();
          const userRollNo = studentData.rollNo;
          const userName = studentData.name || 'Student';

          console.log('✅ Home PWA: Found student - rollNo:', userRollNo, 'name:', userName);

          // Get ranking data from rankings collection
          console.log('🔍 Home PWA: Fetching rankings...');
          const rankingsSnapshot = await getDocs(collection(db, 'rankings'));
          console.log('🔍 Home PWA: Rankings count:', rankingsSnapshot.size);
          
          const allRankings: any[] = [];
          
          rankingsSnapshot.forEach((doc) => {
            const data = doc.data();
            allRankings.push({
              rollNo: data.rollNo || doc.id,
              name: data.name || 'Unknown',
              attendanceMarks: data.attendanceMarks || 0,
              totalScore: data.totalScore || 0,
              rank: data.rank || 0
            });
          });

          console.log('🔍 Home PWA: All rankings:', allRankings);

          // Find current user's ranking
          const userRanking = allRankings.find(r => r.rollNo === userRollNo);

          console.log('🔍 Home PWA: User ranking found?', !!userRanking, userRanking);

          if (userRanking) {
            // Get attendance data from studentAttendance collection
            // Try to query all attendance records and filter manually
            console.log('🔍 Home PWA: Fetching attendance for userId:', currentUser.uid, 'rollNo:', userRollNo);
            
            const attendanceSnapshot = await getDocs(collection(db, 'studentAttendance'));
            
            console.log('🔍 Home PWA: Total attendance records:', attendanceSnapshot.size);

            let totalSessions = 0;
            let attendedSessions = 0;
            const foundRecords: any[] = [];
            
            attendanceSnapshot.forEach((doc) => {
              const data = doc.data();
              // Match by userId, studentId, rollNo, or uid
              if (data.userId === currentUser.uid || 
                  data.studentId === currentUser.uid || 
                  data.uid === currentUser.uid ||
                  data.rollNo === userRollNo) {
                totalSessions++;
                // If attendance record exists, consider present (unless explicitly marked absent)
                const isPresent = data.status === 'absent' ? false : true;
                if (isPresent) {
                  attendedSessions++;
                }
                foundRecords.push({
                  id: doc.id,
                  date: data.date,
                  status: data.status,
                  present: data.present,
                  isPresent,
                  logic: 'Record exists = Present (unless status = "absent")'
                });
                console.log('🔍 Home PWA: Found attendance record:', {
                  id: doc.id,
                  date: data.date,
                  status: data.status,
                  present: data.present,
                  calculatedPresent: isPresent
                });
              }
            });

            setDebugAttendanceRecords(foundRecords);
            console.log('🔍 Home PWA: Attendance stats - Total:', totalSessions, 'Attended:', attendedSessions);

            const attendanceRate = totalSessions > 0 
              ? Math.round((attendedSessions / totalSessions) * 100) 
              : 0;

            const newUserData = {
              name: userName,
              email: studentData.email || currentUser.email || '',
              attendanceRate,
              totalPoints: userRanking.totalScore,
              rank: userRanking.rank,
              totalSessions,
              attendedSessions
            };

            console.log('✅ Home PWA: Setting user data:', newUserData);
            setUserData(newUserData);
          } else {
            console.log('⚠️ Home PWA: No ranking found for rollNo:', userRollNo);
            
            // Get attendance data even if no ranking exists
            console.log('🔍 Home PWA: Fetching attendance for userId:', currentUser.uid, 'rollNo:', userRollNo);
            
            const attendanceSnapshot = await getDocs(collection(db, 'studentAttendance'));
            
            console.log('🔍 Home PWA: Total attendance records:', attendanceSnapshot.size);

            let totalSessions = 0;
            let attendedSessions = 0;
            const foundRecords: any[] = [];
            
            attendanceSnapshot.forEach((doc) => {
              const data = doc.data();
              // Match by userId, studentId, rollNo, or uid
              if (data.userId === currentUser.uid || 
                  data.studentId === currentUser.uid || 
                  data.uid === currentUser.uid ||
                  data.rollNo === userRollNo) {
                totalSessions++;
                // If attendance record exists, consider present (unless explicitly marked absent)
                const isPresent = data.status === 'absent' ? false : true;
                if (isPresent) {
                  attendedSessions++;
                }
                foundRecords.push({
                  id: doc.id,
                  date: data.date,
                  status: data.status,
                  present: data.present,
                  isPresent,
                  logic: 'Record exists = Present (unless status = "absent")'
                });
                console.log('🔍 Home PWA: Found attendance record:', {
                  date: data.date,
                  status: data.status,
                  present: data.present,
                  calculatedPresent: isPresent
                });
              }
            });

            setDebugAttendanceRecords(foundRecords);
            console.log('🔍 Home PWA: Attendance stats - Total:', totalSessions, 'Attended:', attendedSessions);

            const attendanceRate = totalSessions > 0 
              ? Math.round((attendedSessions / totalSessions) * 100) 
              : 0;
            
            // Fallback to basic student data with attendance
            setUserData(prev => ({
              ...prev,
              name: userName,
              email: studentData.email || currentUser.email || '',
              attendanceRate,
              totalSessions,
              attendedSessions
            }));
          }
        } else {
          console.log('⚠️ Home PWA: No student document found for userId:', currentUser.uid);
        }
      } catch (error) {
        console.error('❌ Home PWA: Error loading ranking data:', error);
      }
    };

    loadRankingData();
  }, [currentUser]);

  // Real-time listener for attendance sessions
  useEffect(() => {
    // Wait for authentication before setting up listener
    if (authLoading) {
      console.log('🔄 Session: Waiting for auth...');
      return;
    }
    
    if (!currentUser) {
      console.log('❌ Session: No user, skipping listener setup');
      return;
    }
    
    console.log('✅ Session: Auth ready, setting up listener for user:', currentUser.rollNo || currentUser.email);
    
    const today = new Date().toISOString().split('T')[0];
    console.log('🔍 Session: Looking for session with date:', today);
    
    const sessionRef = doc(db, 'attendanceSessions', today);
    
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      console.log('🔄 Session: Snapshot received, document exists:', doc.exists());
      
      if (doc.exists()) {
        const data = doc.data();
        console.log('🔄 Session: Session data:', {
          id: doc.id,
          isActive: data.isActive,
          startTime: data.startTime,
          endTime: data.endTime,
          location: data.location
        });
        
        setAttendanceSession(data);
        
        // Check status based on isActive and time
        if (data.isActive === true) {
          console.log('✅ Session: Status -> ACTIVE');
          setSessionStatus('active');
        } else {
          console.log('⚠️ Session: Status -> INACTIVE (isActive = false)');
          setSessionStatus('inactive');
        }
      } else {
        console.log('❌ Session: No document found for today:', today);
        setAttendanceSession(null);
        setSessionStatus('inactive');
      }
    }, (error) => {
      console.error('❌ Session: Listener error:', error);
    });

    // Also check for announcements and other notifications
    const setupNotificationListeners = () => {
      console.log('🔔 Notifications: Setting up listeners...');
      
      // Listen for new announcements - but only for push notifications, not to display in panel
      const announcementsRef = collection(db, 'announcements');
      const announcementsUnsubscribe = onSnapshot(announcementsRef, async (snapshot) => {
        console.log('🔔 Announcements: Got update, total:', snapshot.size);
        
        // Check for new announcements since last check
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const ann = change.doc.data();
            const title = ann.title || 'New Announcement';
            const message = ann.content || ann.message || ann.description || 'Check announcements for details';
            
            // Send browser push notification
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                const notification = new Notification(title, {
                  body: message,
                  icon: 'https://i.ibb.co/YBfg1BR8/1000264552-removebg-preview-1.png',
                  badge: 'https://i.ibb.co/YBfg1BR8/1000264552-removebg-preview-1.png',
                  tag: `announcement-${change.doc.id}`,
                  requireInteraction: false,
                  silent: false
                });
                
                notification.onclick = () => {
                  window.focus();
                  notification.close();
                };
                
                console.log('📢 Push notification sent:', title);
              } catch (error) {
                console.error('Failed to send notification:', error);
              }
            }
          }
        });
        
        // Don't add announcements to the notification panel
      });
      
      // Listen for ranking/grade updates
      const rankingsRef = collection(db, 'rankings');
      const rankingsUnsubscribe = onSnapshot(rankingsRef, (snapshot) => {
        console.log('🔔 Rankings: Got update, entries:', snapshot.size);
        
        // Check if user's rank changed
        const userRanking = snapshot.docs.find(doc => doc.id === currentUser?.rollNo);
        if (userRanking) {
          const data = userRanking.data();
          const updatedAt = data.updatedAt || '';
          const isRecent = updatedAt && new Date(updatedAt) > new Date(Date.now() - 60 * 60 * 1000); // 1 hour
          
          if (isRecent) {
            const rankingNotification = {
              id: `rank_${Date.now()}`,
              type: 'ranking',
              title: 'Your Ranking Updated',
              message: `You're now rank #${data.rank} with ${data.totalScore} points`,
              timestamp: new Date(updatedAt),
              icon: '🏆'
            };
            
            // Append ranking notification to existing notifications
            setLiveNotifications(prev => [rankingNotification, ...prev.filter(n => !n.id.startsWith('rank_'))]);
          }
        }
      });
      
      return () => {
        announcementsUnsubscribe();
        rankingsUnsubscribe();
      };
    };

    const cleanupNotifications = setupNotificationListeners();

    return () => {
      unsubscribe();
      cleanupNotifications();
    };
  }, [authLoading, currentUser]);

  // Load mentors for displaying avatars
  useEffect(() => {
    const loadMentors = async () => {
      try {
        const mentorsSnapshot = await getDocs(collection(db, 'mentors'));
        const mentorsData = mentorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMentors(mentorsData);
        console.log('👥 Loaded mentors:', mentorsData.length);
      } catch (error) {
        console.error('❌ Error loading mentors:', error);
      }
    };
    
    if (currentUser) {
      loadMentors();
    }
  }, [currentUser]);

  // Load today's syllabus and send notification if classes exist
  useEffect(() => {
    const loadTodaysSyllabus = async () => {
      if (!currentUser) {
        console.log('📅 Home: No user, skipping syllabus load');
        return;
      }
      
      try {
        const today = new Date().toISOString().split('T')[0];
        console.log('📅 Home: Loading syllabus for today:', today);
        
        const syllabusSnapshot = await getDocs(collection(db, 'syllabus'));
        console.log('📅 Home: Total syllabus documents:', syllabusSnapshot.size);
        
        let allClasses: any[] = [];
        
        // Check if using admin-style format with rows property
        if (syllabusSnapshot.docs.length > 0) {
          const firstDoc = syllabusSnapshot.docs[0].data();
          console.log('📅 Home: First document keys:', Object.keys(firstDoc));
          
          if (firstDoc.rows && Array.isArray(firstDoc.rows)) {
            console.log('📅 Home: Found rows array with', firstDoc.rows.length, 'items');
            allClasses = firstDoc.rows.map((row: any, index: number) => ({
              id: row.id || `row_${index}`,
              ...row
            }));
          } else {
            // Individual documents format
            allClasses = syllabusSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          }
        }
        
        console.log('📅 Home: Total classes loaded:', allClasses.length);
        
        // Filter for today's classes with flexible date matching
        const todaysClasses = allClasses.filter((item: any) => {
          if (!item.date) return false;
          
          const itemDate = item.date.toString();
          const todayFormatted = today;
          const todaySlash = today.replace(/-/g, '/');
          const todayLocalString = new Date(today).toLocaleDateString();
          
          const matches = itemDate === todayFormatted || 
                         itemDate === todaySlash ||
                         itemDate === todayLocalString ||
                         itemDate.split('T')[0] === todayFormatted;
          
          if (matches) {
            console.log('✅ Found matching class:', item.topic, 'on', itemDate);
          }
          
          return matches;
        });
        
        console.log('📅 Home: Classes found for today:', todaysClasses.length);
        
        setTodaysSyllabus(todaysClasses);
        
        // Send notification if there are classes today and not already notified
        if (todaysClasses.length > 0 && 'Notification' in window) {
          const notificationSentKey = `notification_sent_${today}`;
          const alreadySent = localStorage.getItem(notificationSentKey);
          
          if (!alreadySent && Notification.permission === 'granted') {
            const classTopics = todaysClasses.map((c: any) => c.topic).join(', ');
            const notification = new Notification('📚 Classes Today!', {
              body: `You have ${todaysClasses.length} class${todaysClasses.length > 1 ? 'es' : ''} scheduled today: ${classTopics}`,
              icon: '/icon-144x144.svg',
              badge: '/icon-144x144.svg',
              tag: 'daily-schedule',
              requireInteraction: false,
              silent: false
            });
            
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
            
            // Mark as sent for today
            localStorage.setItem(notificationSentKey, 'true');
            console.log('📢 Sent daily class notification');
          }
        }
        
        // Check for recent syllabus updates (within last 24 hours)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const recentUpdate = allClasses.find((item: any) => 
          item.studyMaterial && 
          (item.date === today || item.date === yesterdayStr)
        );
        
        setRecentSyllabusUpdate(recentUpdate || null);
      } catch (error) {
        console.error('❌ Home: Error loading syllabus:', error);
      }
    };
    
    loadTodaysSyllabus();
  }, [currentUser]);

  // Load latest attendance record
  useEffect(() => {
    const loadLatestAttendance = async () => {
      if (!currentUser) return;
      
      try {
        console.log('📊 Attendance: Loading for user:', currentUser.uid, currentUser.email);
        
        const attendanceSnapshot = await getDocs(collection(db, 'studentAttendance'));
        console.log('📊 Attendance: Total records found:', attendanceSnapshot.size);
        
        const studentDocRef = doc(db, 'students', currentUser.uid);
        const studentDoc = await getDoc(studentDocRef);
        const userRollNo = studentDoc.exists() ? studentDoc.data().rollNo : null;
        console.log('📊 Attendance: User rollNo:', userRollNo);
        
        // Get all attendance records for this student
        const userRecords = attendanceSnapshot.docs
          .map(doc => {
            const data = doc.data();
            console.log(`📊 Attendance record ${doc.id}:`, {
              date: data.date,
              userId: data.userId,
              studentId: data.studentId,
              rollNo: data.rollNo,
              status: data.status,
              present: data.present,
              hasRecord: true // If record exists, assume present unless explicitly absent
            });
            return { id: doc.id, ...data };
          })
          .filter((record: any) => {
            const matches = record.userId === currentUser.uid || 
              record.studentId === currentUser.uid ||
              record.rollNo === userRollNo;
            if (matches) {
              // If attendance record exists, default to present (unless explicitly marked absent)
              const isPresent = record.status === 'absent' ? false : true; // Default to present if record exists
              console.log('✅ Attendance: Matched record for user:', {
                recordId: record.id,
                date: record.date,
                originalStatus: record.status,
                originalPresent: record.present,
                calculatedPresent: isPresent,
                logic: 'Record exists = Present (unless status = "absent")'
              });
            }
            return matches;
          })
          .sort((a: any, b: any) => {
            // Sort by date descending (newest first)
            return (b.date || '').localeCompare(a.date || '') || 0;
          });
        
        console.log('📊 Attendance: User records found:', userRecords.length, userRecords);
        
        if (userRecords.length > 0) {
          const latest = userRecords[0];
          console.log('📊 Attendance: Latest record:', latest);
          setLatestAttendance(latest);
          
          // Check if today's attendance was marked
          const today = new Date().toISOString().split('T')[0];
          const todayRecord = userRecords.find((r: any) => r.date === today);
          if (todayRecord) {
            console.log('📊 Attendance: TODAY\'S record found:', todayRecord);
          } else {
            console.log('📊 Attendance: No record found for today:', today);
          }
        } else {
          console.log('📊 Attendance: No records found for this user');
        }
      } catch (error) {
        console.error('❌ Attendance: Error loading:', error);
      }
    };
    
    loadLatestAttendance();
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* ===== NOTIFICATION PERMISSION PROMPT ===== */}
        {showNotificationPrompt && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-4 text-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm mb-1">Enable Notifications</h3>
                <p className="text-xs text-white/90 leading-relaxed mb-3">
                  Get instant alerts when classes start, attendance sessions begin, or important announcements are made.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleEnableNotifications}
                    className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                  >
                    Enable Now
                  </button>
                  <button
                    onClick={() => setShowNotificationPrompt(false)}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg text-xs font-semibold hover:bg-white/20 transition-colors"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== NOTIFICATION FEED ===== */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-500 rounded-lg flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Notifications</h2>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100">
            {/* Attendance Session Notification */}
            {sessionStatus === 'active' && (
              <div 
                onClick={() => router.push('/pwa/attendance')}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-start gap-3"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900">Attendance Active Now</p>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">Just now</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Mark your attendance within campus location. Ends at {attendanceSession?.endTime || 'Unknown'}.
                  </p>
                  <div className="mt-2 inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-md text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    Active Now
                  </div>
                </div>
              </div>
            )}

            {/* Live Notifications from Database */}
            {liveNotifications.length > 0 && liveNotifications.slice(0, 3).map((notif) => (
              <div key={notif.id} className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-start gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm">{notif.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900">{notif.title}</p>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">
                      {notif.timestamp ? new Date(notif.timestamp).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      }) : 'Now'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            ))}

            {/* Today's Attendance Status */}
            {latestAttendance && latestAttendance.date === new Date().toISOString().split('T')[0] && (
              <div className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  (latestAttendance.status === 'absent' ? false : true) // If record exists and not explicitly absent, consider present
                    ? 'bg-green-100' 
                    : 'bg-red-100'
                }`}>
                  <Clock className={`w-4 h-4 ${
                    (latestAttendance.status === 'absent' ? false : true)
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900">Today's Attendance</p>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">Today</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {(latestAttendance.status === 'absent' ? false : true)
                      ? 'You successfully marked your attendance for today.' 
                      : 'You are marked absent for today.'}
                  </p>
                  <div className={`mt-2 inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold ${
                    (latestAttendance.status === 'absent' ? false : true)
                      ? 'bg-green-50 text-green-700' 
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {(latestAttendance.status === 'absent' ? false : true) 
                      ? '✓ Present' 
                      : '✗ Absent'}
                  </div>
                </div>
              </div>
            )}

            {/* Class Today Notification - Only show if class exists today */}
            {todaysSyllabus.length > 0 && (
              <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-start gap-3"
                   onClick={() => router.push('/pwa/syllabus')}>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900">Class Today</p>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">Today</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {todaysSyllabus.map((cls: any, idx: number) => cls.topic).join(' and ')}
                  </p>
                </div>
              </div>
            )}

            {/* Syllabus Updated Notification - Only show if recent material exists */}
            {recentSyllabusUpdate && (
              <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-start gap-3"
                   onClick={() => router.push('/pwa/syllabus')}>
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900">Syllabus Updated</p>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">1h ago</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    New learning materials added for {recentSyllabusUpdate.topic}.
                  </p>
                </div>
              </div>
            )}

            {/* Empty State - Show when no notifications */}
            {sessionStatus !== 'active' && 
             todaysSyllabus.length === 0 && 
             !recentSyllabusUpdate && 
             liveNotifications.length === 0 &&
             !(latestAttendance && latestAttendance.date === new Date().toISOString().split('T')[0]) && (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">No new updates</p>
                <p className="text-xs text-gray-500">You're all caught up.</p>
              </div>
            )}
          </div>
        </section>

        {/* ===== TODAY'S STATUS (Side-by-Side Stats) ===== */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3 px-1">Your Progress</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Attendance Card with Circular Progress */}
            <div 
              onClick={() => router.push('/pwa/profile')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 mb-2">
                  {/* Background circle */}
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      stroke="#E5E7EB"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      stroke="#4F46E5"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - userData.attendanceRate / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-black text-gray-900">{userData.attendanceRate}%</span>
                  </div>
                </div>
                <p className="text-xs font-bold text-gray-900 mb-0.5">Attendance</p>
                <p className="text-[10px] text-gray-500">{userData.attendedSessions} of {userData.totalSessions} sessions</p>
              </div>
            </div>

            {/* Rank Card with Badge */}
            <div 
              onClick={() => router.push('/pwa/rankings')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-2 shadow-md relative">
                  <div className="text-center">
                    <div className="text-2xl font-black text-white">#{userData.rank}</div>
                  </div>
                  {userData.rank <= 10 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                      <Trophy className="w-3 h-3 text-yellow-900" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-gray-900 mb-0.5">Class Rank</p>
                <p className="text-[10px] text-gray-500">{userData.totalPoints.toLocaleString()} points</p>
                {userData.rank <= 10 && (
                  <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">
                    🏆 Top 10
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ===== TODAY'S SCHEDULE ===== */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Today's Schedule</h2>
              </div>
              <button 
                onClick={() => router.push('/pwa/syllabus')}
                className="text-xs text-indigo-600 font-semibold hover:text-indigo-700"
              >
                View All
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100">
            {todaysSyllabus.length > 0 ? (
              todaysSyllabus.map((cls: any, index) => {
                // Get mentor details
                const classMentors = Array.isArray(cls.mentors) 
                  ? cls.mentors.map((mentorId: string) => 
                      mentors.find(m => m.id === mentorId || m.name === mentorId)
                    ).filter(Boolean)
                  : [];
                
                return (
                  <div 
                    key={cls.id}
                    onClick={() => router.push('/pwa/syllabus')}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-start gap-3"
                  >
                    <div className={`w-8 h-8 ${index % 2 === 0 ? 'bg-blue-100' : 'bg-purple-100'} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <BookOpen className={`w-4 h-4 ${index % 2 === 0 ? 'text-blue-600' : 'text-purple-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm text-gray-900 leading-snug">
                          {cls.topic}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed mb-2 line-clamp-2">
                        <Clock className="w-3 h-3 inline mr-1 flex-shrink-0" />
                        {cls.subtopics || 'Time not specified'}
                      </p>
                      {classMentors.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {classMentors.slice(0, 3).map((mentor: any, idx: number) => (
                            <div 
                              key={mentor.id}
                              className="w-6 h-6 rounded-full overflow-hidden border-2 border-white shadow-sm"
                              style={{ marginLeft: idx > 0 ? '-8px' : '0' }}
                            >
                              {mentor.photoURL || mentor.photoUrl || mentor.avatar ? (
                                <img 
                                  src={mentor.photoURL || mentor.photoUrl || mentor.avatar} 
                                  alt={mentor.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-white">
                                    {mentor.name?.charAt(0).toUpperCase() || '?'}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                          {classMentors.length > 3 && (
                            <span className="text-[10px] text-gray-500 font-medium ml-1">
                              +{classMentors.length - 3}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 ml-1">
                            {classMentors.map((m: any) => m.name).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">No classes scheduled today</p>
                <p className="text-xs text-gray-500">Check your syllabus for upcoming classes</p>
              </div>
            )}
          </div>
        </section>

        {/* Subtle Info Card when attendance inactive */}
        {sessionStatus === 'inactive' && !latestAttendance && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-amber-900 mb-0.5">Attendance Not Active</p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Your instructor will activate attendance during class time.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Latest Attendance Record */}
        {latestAttendance && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Latest Attendance</h3>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  {new Date(latestAttendance.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  (latestAttendance.status === 'absent' ? false : true) // Record exists = Present unless explicitly absent
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {(latestAttendance.status === 'absent' ? false : true)
                    ? '✓ Present' 
                    : '✗ Absent'}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {(latestAttendance.status === 'absent' ? false : true)
                  ? 'You successfully marked your attendance.' 
                  : 'No attendance record for this day.'}
              </p>
            </div>
          </div>
        )}

        {/* DEBUG: Show Attendance Records - Hidden by default for production */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="w-full text-left font-semibold text-sm text-gray-900 mb-2"
          >
            🔍 Debug: View My Attendance Records ({debugAttendanceRecords.length})
          </button>
          {showDebug && (
            <div className="space-y-2 mt-3">
              {debugAttendanceRecords.length === 0 ? (
                <p className="text-xs text-gray-500">No attendance records found</p>
              ) : (
                debugAttendanceRecords.map((record, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 text-xs">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-gray-900">Date: {record.date}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (record.status === 'absent' ? false : true) // Record exists = Present unless explicitly absent
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {(record.status === 'absent' ? false : true) ? '✓ Present' : '✗ Absent'}
                      </span>
                    </div>
                    <div className="text-gray-600 space-y-0.5">
                      <div>ID: <code className="bg-white px-1 rounded">{record.id}</code></div>
                      <div>Status: <code className="bg-white px-1 rounded">{record.status || 'No status (defaults to present)'}</code></div>
                      <div>Present Field: <code className="bg-white px-1 rounded">{String(record.present || 'undefined')}</code></div>
                      <div>Logic: <code className="bg-white px-1 rounded">{record.logic || 'Record exists = Present'}</code></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
