'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/app/components/pwa-ui/Button';
import StatusBadge from '@/app/components/pwa-ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { MapPin, Clock, CheckCircle, AlertCircle, Loader, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface AttendanceSession {
  date: string;
  isActive: boolean;
  startTime?: string;
  endTime?: string;
  location: {
    latitude: number;
    longitude: number;
    radius: number;
    source?: 'gps' | 'manual';
    accuracy?: number | null;
  };
}

type SessionStatus = 'active' | 'closed' | 'inactive';

export default function AttendanceContent() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('inactive');
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number, accuracy?: number} | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<AttendanceSession | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [markedToday, setMarkedToday] = useState(false);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { currentUser, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  // Check location permission and get current location
  useEffect(() => {
    checkLocationPermission();
  }, []);
  
  // Load attendance data only after auth is ready
  useEffect(() => {
    // Wait for Firebase auth to initialize
    if (authLoading) {
      console.log('Attendance: Waiting for Firebase auth to initialize...');
      return;
    }
    
    // Check if user is authenticated
    if (!currentUser) {
      console.warn('Attendance: User not authenticated');
      return;
    }
    
    console.log('✅ Attendance: Auth ready. User:', currentUser.email);
    
    // Now safe to load data from Firestore
    loadTodayAttendance();
    loadAttendanceSession();
    loadRecentAttendance();
    
    // Force check session status every 5 seconds
    const statusInterval = setInterval(() => {
      loadAttendanceSession();
    }, 5000);
    
    return () => clearInterval(statusInterval);
  }, [authLoading, currentUser]);

  // Real-time listener for attendance sessions (only after auth is ready)
  useEffect(() => {
    // Wait for Firebase auth to initialize
    if (authLoading) {
      console.log('Attendance listener: Waiting for auth...');
      return;
    }
    
    // Check if user is authenticated
    if (!currentUser) {
      console.warn('Attendance listener: User not authenticated');
      return;
    }
    
    console.log('✅ Attendance listener: Setting up real-time listener');
    
    const today = new Date().toISOString().split('T')[0];
    const sessionRef = doc(db, 'attendanceSessions', today);
    
    console.log('Student PWA: Setting up listener for session:', today);
    
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      console.log('Student PWA: Session document exists:', doc.exists());
      
      if (doc.exists()) {
        const data = doc.data() as AttendanceSession;
        console.log('Student PWA: Raw session data:', data);
        setAttendanceSession(data);
        
        // Simple and direct status check
        if (data.isActive === true) {
          console.log('Student PWA: Session isActive=true, setting to active');
          setSessionStatus('active');
          showToast('🎯 Attendance session detected! You can mark your attendance.', 'success');
        } else {
          console.log('Student PWA: Session isActive=false, setting to inactive');
          setSessionStatus('inactive');
        }
      } else {
        console.log('Student PWA: No session document found');
        setAttendanceSession(null);
        setSessionStatus('inactive');
      }
    }, (error) => {
      console.error('Student PWA: Session listener error:', error);
      // Try to refresh the listener connection
      setTimeout(() => {
        console.log('Student PWA: Retrying session listener...');
      }, 2000);
    });

    return () => unsubscribe();
  }, [authLoading, currentUser, showToast]);

  // Check if user is within campus radius when location changes
  useEffect(() => {
    if (currentLocation && attendanceSession?.location) {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        attendanceSession.location.latitude,
        attendanceSession.location.longitude
      );
      
      // For indoor use: factor in GPS accuracy tolerance
      // If accuracy is poor (>20m), subtract accuracy from distance to account for GPS error
      const accuracy = currentLocation.accuracy || 0;
      const effectiveDistance = accuracy > 20 ? Math.max(0, distance - accuracy) : distance;
      
      console.log(`Distance: ${Math.round(distance)}m, GPS Accuracy: ±${Math.round(accuracy)}m, Effective: ${Math.round(effectiveDistance)}m, Required: ${attendanceSession.location.radius}m`);
      
      setIsWithinRange(effectiveDistance <= attendanceSession.location.radius);
    }
  }, [currentLocation, attendanceSession]);

  const checkLocationPermission = async () => {
    try {
      if (!navigator.geolocation) {
        setLocationPermission('denied');
        return;
      }

      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setLocationPermission(permission.state as any);

      if (permission.state === 'granted') {
        getCurrentLocation();
      }

      permission.onchange = () => {
        setLocationPermission(permission.state as any);
        if (permission.state === 'granted') {
          getCurrentLocation();
        }
      };
    } catch {
      setLocationPermission('denied');
    }
  };

  const getCurrentLocation = () => {
    let readings = [];
    let readingCount = 0;
    const maxReadings = 3;
    
    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0 // Don't use cached location
    };

    const processReading = (position: GeolocationPosition) => {
      const accuracy = position.coords.accuracy;
      console.log(`GPS reading ${readingCount + 1}: accuracy ${accuracy}m`);
      
      // Only use readings with good accuracy (under 100m)
      if (accuracy <= 100) {
        readings.push({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: accuracy
        });
      }
      
      readingCount++;
      
      // If we have enough good readings or max attempts reached
      if (readings.length >= 2 || readingCount >= maxReadings) {
        if (readings.length > 0) {
          // Use the most accurate reading or average if similar accuracy
          const bestReading = readings.reduce((best, current) => 
            current.accuracy < best.accuracy ? current : best
          );
          
          setCurrentLocation({
            latitude: bestReading.latitude,
            longitude: bestReading.longitude,
            accuracy: bestReading.accuracy
          });
          
          console.log(`Using GPS reading with ${bestReading.accuracy}m accuracy`);
          showToast(`📍 GPS locked with ${Math.round(bestReading.accuracy)}m accuracy`, 'success');
        } else {
          console.warn('All GPS readings had poor accuracy (>100m), using last attempt');
          // Fallback to basic reading if all readings are poor
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCurrentLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
              });
              showToast('⚠️ Using low-accuracy GPS reading. Results may be inaccurate.', 'error');
            },
            (error) => {
              console.error('Final location error:', error);
              setLocationPermission('denied');
            },
            options
          );
        }
      } else {
        // Take another reading after a short delay
        setTimeout(() => {
          navigator.geolocation.getCurrentPosition(processReading, handleError, options);
        }, 1000);
      }
    };
    
    const handleError = (error: GeolocationPositionError) => {
      console.error('Location error:', error);
      readingCount++;
      
      if (readingCount < maxReadings) {
        // Retry with less strict settings
        setTimeout(() => {
          navigator.geolocation.getCurrentPosition(
            processReading, 
            handleError, 
            { ...options, timeout: 30000, enableHighAccuracy: false }
          );
        }, 2000);
      } else {
        setLocationPermission('denied');
        showToast('Unable to get accurate location. Please ensure GPS is enabled and try moving to an open area.', 'error');
      }
    };

    showToast('📡 Getting accurate GPS location...', 'success');
    // Start first reading
    navigator.geolocation.getCurrentPosition(processReading, handleError, options);
  };

  const requestLocationPermission = async () => {
    try {
      setLocationPermission('checking');
      await getCurrentLocation();
    } catch {
      setLocationPermission('denied');
    }
  };

  const loadTodayAttendance = async () => {
    if (!currentUser?.rollNo) {
      console.log('loadTodayAttendance: No user or rollNo, skipping');
      return;
    }

    try {
      console.log('📅 loadTodayAttendance: User:', currentUser.rollNo);
      const today = new Date().toISOString().split('T')[0];
      const attendanceRef = doc(db, 'studentAttendance', `${currentUser.rollNo}_${today}`);
      const attendanceSnap = await getDoc(attendanceRef);
      
      if (attendanceSnap.exists()) {
        console.log('✅ Today attendance already marked');
        setMarkedToday(true);
      } else {
        console.log('🔴 No attendance marked today');
      }
    } catch (error: any) {
      console.error('❌ Error loading today attendance:', error);
      console.error('❌ Error code:', error?.code);
      console.error('❌ Error message:', error?.message);
    }
  };

  const loadAttendanceSession = async () => {
    // Guard: Don't query if no user
    if (!currentUser) {
      console.log('loadAttendanceSession: No user, skipping query');
      return;
    }
    
    try {
      console.log('🔍 loadAttendanceSession: User:', currentUser.email);
      const today = new Date().toISOString().split('T')[0];
      console.log('Manual session check for:', today);
      
      const sessionDoc = await getDoc(doc(db, 'attendanceSessions', today));
      
      if (sessionDoc.exists()) {
        const data = sessionDoc.data() as AttendanceSession;
        console.log('Manual session data loaded:', data);
        setAttendanceSession(data);
        
        if (data.isActive === true) {
          console.log('Manual check: Session is active!');
          setSessionStatus('active');
        } else {
          console.log('Manual check: Session is inactive');
          setSessionStatus('inactive');
        }
      } else {
        console.log('Manual check: No session document found');
        setAttendanceSession(null);
        setSessionStatus('inactive');
      }
    } catch (error: any) {
      console.error('❌ Manual session load error:', error);
      console.error('❌ Error code:', error?.code);
      console.error('❌ Error message:', error?.message);
      if (error.message?.includes('Missing or insufficient permissions')) {
        console.error('❌ FIRESTORE PERMISSION DENIED - User may not be authenticated properly');
        setSessionStatus('inactive'); 
      }
    }
  };

  const loadRecentAttendance = async () => {
    if (!currentUser?.rollNo) {
      console.log('loadRecentAttendance: No user or rollNo, skipping');
      return;
    }

    try {
      console.log('📊 loadRecentAttendance: User:', currentUser.rollNo);
      // Get last 5 attendance records for this student
      const q = query(
        collection(db, 'studentAttendance'),
        where('rollNo', '==', currentUser.rollNo)
      );
      const snapshot = await getDocs(q);
      
      console.log('✅ Recent attendance query successful. Records:', snapshot.docs.length);
      
      const records = snapshot.docs
        .map(doc => ({ ...doc.data(), date: doc.data().date, time: doc.data().time, timestamp: doc.data().timestamp }))
        .sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds)
        .slice(0, 5);
      
      setRecentAttendance(records);
      console.log('✅ Loaded', records.length, 'recent attendance records');
    } catch (error: any) {
      console.error('❌ Error loading recent attendance:', error);
      console.error('❌ Error code:', error?.code);
      console.error('❌ Error message:', error?.message);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const handleMarkAttendance = async () => {
    if (!currentUser?.rollNo) {
      showToast('User not authenticated', 'error');
      return;
    }

    if (sessionStatus !== 'active') {
      showToast('Attendance session is not active', 'error');
      return;
    }

    if (locationPermission !== 'granted') {
      showToast('Location permission required', 'error');
      return;
    }
    
    // 🔐 CRITICAL FIX: Force refresh Firebase Auth token before writing
    try {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        console.log('🔐 Refreshing Firebase Auth token...');
        await firebaseUser.getIdToken(true); // Force token refresh
        console.log('✅ Token refreshed successfully');
      } else {
        console.error('❌ No Firebase user found');
        showToast('Authentication error. Please log out and log back in.', 'error');
        return;
      }
    } catch (tokenError) {
      console.error('❌ Token refresh error:', tokenError);
      showToast('Authentication error. Please log out and log back in.', 'error');
      return;
    }

    if (!isWithinRange) {
      const distance = attendanceSession?.location ? calculateDistance(
        currentLocation!.latitude,
        currentLocation!.longitude,
        attendanceSession.location.latitude,
        attendanceSession.location.longitude
      ) : 0;
      
      showToast(
        `❌ You're ${Math.round(distance)}m away. Must be within ${attendanceSession?.location.radius || 30}m of campus location.`, 
        'error'
      );
      return;
    }

    if (markedToday) {
      showToast('Attendance already marked for today', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      
      // Calculate distance for submission
      const distance = attendanceSession?.location ? calculateDistance(
        currentLocation!.latitude,
        currentLocation!.longitude,
        attendanceSession.location.latitude,
        attendanceSession.location.longitude
      ) : 0;
      
      // 🔍 DEBUG: Log auth state before writing
      console.log('🔐 DEBUG - About to write attendance:');
      console.log('  currentUser.uid:', currentUser.uid);
      console.log('  currentUser.rollNo:', currentUser.rollNo);
      console.log('  currentUser.email:', currentUser.email);
      console.log('  Full currentUser object:', currentUser);
      
      // Save student attendance record
      const attendanceRef = doc(db, 'studentAttendance', `${currentUser.rollNo}_${today}`);
      const attendanceData = {
        userId: currentUser.uid,          // ✅ Required by Firestore rules
        rollNo: currentUser.rollNo,
        name: currentUser.name || currentUser.email,
        date: today,
        time: now.toTimeString().split(' ')[0],
        location: currentLocation,
        timestamp: Timestamp.now(),
      };
      
      console.log('📝 Writing to studentAttendance with data:', attendanceData);
      await setDoc(attendanceRef, attendanceData);
      console.log('✅ Successfully wrote to studentAttendance');

      // Save to attendanceSubmissions for real-time admin monitoring
      const submissionRef = doc(db, 'attendanceSubmissions', `${currentUser.rollNo}_${today}`);
      const submissionData = {
        userId: currentUser.uid,          // ✅ Required by Firestore rules (must match auth.uid)
        rollNo: currentUser.rollNo,
        name: currentUser.name || currentUser.email,
        sessionDate: today,
        timestamp: Timestamp.now(),
        location: currentLocation,
        distance: Math.round(distance),
      };
      
      console.log('📝 Writing to attendanceSubmissions with data:', submissionData);
      await setDoc(submissionRef, submissionData);
      console.log('✅ Successfully wrote to attendanceSubmissions');

      setMarkedToday(true);
      showToast('Attendance marked successfully!', 'success');
      loadRecentAttendance();
    } catch (error) {
      console.error('Error marking attendance:', error);
      showToast('Failed to mark attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = () => {
    switch (sessionStatus) {
      case 'active': return '🔴 Live Session';
      case 'closed': return '⭕ Session Ended';
      default: return '⚪ Not Started';
    }
  };

  const getStatusBadgeColor = () => {
    switch (sessionStatus) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 pb-20">
      <div className="max-w-md mx-auto">
        
        {/* Compact Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200">
          <div className="px-4 py-3">
            <div className="text-center">
              <h1 className="text-base font-bold text-gray-900">Attendance</h1>
              <p className="text-xs text-gray-500">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">

          {/* Status Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`relative p-6 text-center ${
              sessionStatus === 'active' 
                ? 'bg-gradient-to-br from-green-400/10 to-emerald-400/10' 
                : markedToday
                ? 'bg-gradient-to-br from-blue-400/10 to-indigo-400/10'
                : 'bg-gradient-to-br from-gray-100 to-gray-50'
            }`}>
              
              {markedToday ? (
                /* Already Marked */
                <>
                  <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Attendance Marked</h2>
                  <p className="text-sm text-gray-600">Your attendance has been recorded</p>
                </>
              ) : sessionStatus === 'active' ? (
                /* Active Session */
                <>
                  <div className="relative w-20 h-20 mx-auto mb-3">
                    <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
                    <div className="relative w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                      <MapPin className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <h2 className="text-lg font-bold text-green-900 mb-1">Session Active</h2>
                  <p className="text-sm text-green-700">
                    {attendanceSession?.endTime ? `Ends at ${attendanceSession.endTime}` : 'Mark your attendance now'}
                  </p>
                </>
              ) : (
                /* Not Started - Show Lottie Animation */
                <>
                  <div className="flex justify-center mb-2">
                    <DotLottieReact
                      src="https://lottie.host/e2a37f4f-0e4f-482d-ad3d-e7b47dcd2184/yYW7UlTLNy.lottie"
                      loop
                      autoplay
                      style={{ width: '200px', height: '200px' }}
                    />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Not Started</h2>
                  <p className="text-sm text-gray-600">Waiting for instructor to begin session</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    Refresh Page
                  </button>
                </>
              )}
            </div>

          </div>

          {/* Compact Status Indicators - Horizontal Pills */}
          {sessionStatus === 'active' && !markedToday && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  sessionStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${sessionStatus === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  Session
                </div>

                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  locationPermission === 'granted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {locationPermission === 'granted' ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  Location
                </div>

                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  locationPermission === 'granted' && isWithinRange 
                    ? 'bg-green-100 text-green-700'
                    : locationPermission === 'granted' && !isWithinRange
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {locationPermission === 'granted' && isWithinRange ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : locationPermission === 'granted' && !isWithinRange ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  )}
                  Range
                </div>
              </div>

              {currentLocation && attendanceSession?.location && (
                <div className="mt-3 text-center text-xs text-gray-600">
                  <span className="font-semibold text-gray-900">
                    {Math.round(calculateDistance(
                      currentLocation.latitude,
                      currentLocation.longitude,
                      attendanceSession.location.latitude,
                      attendanceSession.location.longitude
                    ))}m
                  </span>
                  {' away • '}
                  <span className="font-semibold text-gray-900">{attendanceSession.location.radius}m</span>
                  {' required'}
                </div>
              )}
            </div>
          )}
          {/* Action Button - Only show when active and not marked */}
          {sessionStatus === 'active' && !markedToday && (
            <button
              onClick={handleMarkAttendance}
              disabled={loading || locationPermission !== 'granted' || !isWithinRange}
              className={`w-full h-14 rounded-xl font-bold text-base shadow-md transition-all transform active:scale-95 ${
                loading || locationPermission !== 'granted' || !isWithinRange
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:shadow-lg'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-5 h-5 animate-spin" />
                  Marking...
                </span>
              ) : locationPermission !== 'granted' ? (
                'Enable Location First'
              ) : !isWithinRange ? (
                'Move Closer to Campus'
              ) : (
                'Mark Attendance'
              )}
            </button>
          )}

          {/* Compact GPS Warning */}
          {sessionStatus === 'active' && currentLocation?.accuracy && currentLocation.accuracy > 50 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-900">GPS accuracy low ({Math.round(currentLocation.accuracy)}m)</p>
                  <p className="text-xs text-amber-700">Move to an open area</p>
                </div>
                <button 
                  onClick={getCurrentLocation}
                  className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors flex-shrink-0"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}

          {/* Location Permission Alert */}
          {locationPermission !== 'granted' && sessionStatus === 'active' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-blue-900">Location access needed</p>
                  <p className="text-xs text-blue-700">Required to verify campus presence</p>
                </div>
                <button 
                  onClick={requestLocationPermission}
                  disabled={locationPermission === 'checking'}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {locationPermission === 'checking' ? 'Checking' : 'Enable'}
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Recent Attendance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-gray-900">Recent Attendance</h3>
                  <p className="text-xs text-gray-500">
                    {recentAttendance.length === 0 ? 'No records yet' : `${recentAttendance.length} record${recentAttendance.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              {showHistory ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showHistory && recentAttendance.length > 0 && (
              <div className="border-t border-gray-100 p-3 space-y-2">
                {recentAttendance.map((record, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{record.date}</p>
                      <p className="text-xs text-gray-600">{record.time}</p>
                    </div>
                    <span className="bg-green-500 text-white px-2 py-1 rounded-md text-xs font-bold">
                      Marked
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Help Text */}
          <div className="text-center text-xs text-gray-500 space-y-1 py-2">
            <p>Make sure you're on campus and within range</p>
            <p>Having issues? Contact your administrator</p>
          </div>

        </div>
      </div>
    </div>
  );
}