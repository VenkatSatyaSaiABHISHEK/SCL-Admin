'use client';

import { useEffect, useState } from 'react';
import { Play, Square, Clock, Users, AlertCircle, MapPin, Settings, Eye, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { notificationService } from '@/lib/notifications';
import { collection, getDocs, setDoc, doc, Timestamp, getDoc, query, where, onSnapshot } from 'firebase/firestore';

interface AttendanceSession {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  location: {
    latitude: number;
    longitude: number;
    radius: number;
    address?: string;
    source?: 'gps' | 'manual';
    accuracy?: number | null;
  };
  createdBy: string;
  createdAt: any;
  submissionCount: number;
  expectedStudents: number;
}

interface StudentSubmission {
  rollNo: string;
  name: string;
  timestamp: any;
  location: {
    latitude: number;
    longitude: number;
  };
  distance: number;
}

export default function AttendanceContent() {
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number, accuracy?: number} | null>(null);
  const [sessionForm, setSessionForm] = useState({
    duration: 5, // minutes
    radius: 30, // meters - standard default radius
  });
  const [manualLocation, setManualLocation] = useState({
    latitude: '',
    longitude: '', 
    useManual: false  // Default to GPS, not manual
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent'>('all');
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isAdmin) {
      router.push('/login');
      return;
    }
    
    loadStudents();
    loadTodaySession();
    checkLocationPermission();
  }, [isAdmin, router]);

  // Real-time listener for submissions
  useEffect(() => {
    if (!currentSession?.isActive) return;

    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'attendanceSubmissions'),
      where('sessionDate', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const submissionData: StudentSubmission[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        submissionData.push({
          rollNo: data.rollNo,
          name: data.name,
          timestamp: data.timestamp,
          location: data.location,
          distance: data.distance
        });
      });
      setSubmissions(submissionData);
      
      // Update session count
      if (currentSession) {
        setCurrentSession(prev => prev ? { ...prev, submissionCount: submissionData.length } : null);
      }
    });

    return () => unsubscribe();
  }, [currentSession?.isActive]);

  const checkLocationPermission = async () => {
    try {
      if (!navigator.geolocation) {
        setLocationPermission('denied');
        return;
      }

      // Try to get location directly first (this works even if permissions API fails)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // If we get location, permission is definitely granted
          setLocationPermission('granted');
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          console.log('Location permission confirmed via direct location access');
        },
        async (error) => {
          console.log('Direct location failed, checking permissions API:', error.message);
          
          // Fallback to permissions API
          try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            setLocationPermission(permission.state as any);
            
            if (permission.state === 'granted') {
              getCurrentLocation();
            }
          } catch (permError) {
            console.log('Permissions API also failed:', permError);
            setLocationPermission('denied');
          }
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
      
    } catch (error) {
      console.log('Location permission check failed:', error);
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
        } else {
          console.warn('All GPS readings had poor accuracy (>100m), using last attempt');
          // Fallback to basic reading if all readings are poor
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCurrentLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
              });
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

    // Start first reading
    navigator.geolocation.getCurrentPosition(processReading, handleError, options);
  };

  const loadStudents = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'students'));
      const students: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          rollNo: data.rollNo,
          name: data.name,
        });
      });
      setAllStudents(students);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadTodaySession = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sessionRef = doc(db, 'attendanceSessions', today);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const data = sessionSnap.data();
        setCurrentSession({
          id: sessionSnap.id,
          ...data,
          submissionCount: 0,
          expectedStudents: allStudents.length
        } as AttendanceSession);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const updateSessionLocation = async () => {
    if (!currentSession) return;
    
    let newLocation;
    if (manualLocation.useManual) {
      if (!manualLocation.latitude || !manualLocation.longitude) {
        showToast('Please enter valid latitude and longitude', 'error');
        return;
      }
      newLocation = {
        latitude: parseFloat(manualLocation.latitude),
        longitude: parseFloat(manualLocation.longitude)
      };
    } else {
      if (!currentLocation) {
        showToast('Location permission required', 'error');
        return;
      }
      newLocation = currentLocation;
    }

    try {
      setLoading(true);
      
      const updatedSession = {
        ...currentSession,
        location: {
          ...currentSession.location,
          latitude: newLocation.latitude,
          longitude: newLocation.longitude
        }
      };
      
      await setDoc(doc(db, 'attendanceSessions', currentSession.id), updatedSession);
      setCurrentSession(updatedSession);
      showToast('Session location updated successfully!', 'success');
      
    } catch (error) {
      console.error('Error updating location:', error);
      showToast('Failed to update session location', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startAttendanceSession = async () => {
    let sessionLocation;
    
    if (manualLocation.useManual) {
      if (!manualLocation.latitude || !manualLocation.longitude) {
        showToast('Please enter valid latitude and longitude', 'error');
        return;
      }
      sessionLocation = {
        latitude: parseFloat(manualLocation.latitude),
        longitude: parseFloat(manualLocation.longitude)
      };
    } else {
      if (!currentLocation) {
        showToast('Location permission required to start attendance session', 'error');
        return;
      }
      sessionLocation = currentLocation;
    }

    if (!currentUser) {
      showToast('Authentication required', 'error');
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const startTime = now.toTimeString().split(' ')[0];
      const endTime = new Date(now.getTime() + sessionForm.duration * 60000).toTimeString().split(' ')[0];

      console.log('Admin: Creating session with ID:', today);

      // Check if session already exists
      const existingSession = await getDoc(doc(db, 'attendanceSessions', today));
      if (existingSession.exists()) {
        showToast('Attendance session already exists for today', 'error');
        return;
      }

      const sessionData = {
        date: today,
        startTime,
        endTime,
        isActive: true,
        location: {
          latitude: sessionLocation.latitude,
          longitude: sessionLocation.longitude,
          radius: sessionForm.radius,
          address: 'Campus Location',
          source: (manualLocation.useManual ? 'manual' : 'gps') as 'gps' | 'manual',
          accuracy: !manualLocation.useManual && currentLocation?.accuracy ? currentLocation.accuracy : null
        },
        createdBy: currentUser.name || currentUser.email || 'Admin',
        createdAt: Timestamp.now(),
        submissionCount: 0,
        expectedStudents: allStudents.length
      };

      console.log('Admin: Session data being created:', sessionData);

      await setDoc(doc(db, 'attendanceSessions', today), sessionData);
      
      setCurrentSession({
        id: today,
        ...sessionData
      });

      console.log('Admin: Session created successfully');
      showToast(`✓ Attendance session started! Duration: ${sessionForm.duration} minutes`, 'success');
      
      // Trigger notification to all students (structure ready for PWA push notifications)
      try {
        await notificationService.notifyAttendanceSessionStarted({
          date: today,
          startTime,
          endTime,
          location: 'Campus Location',
          duration: sessionForm.duration
        });
      } catch (error) {
        console.log('Notification service not yet implemented:', error);
      }
      
    } catch (error) {
      console.error('Error starting session:', error);
      showToast('Failed to start attendance session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveAttendanceToRecords = async () => {
    if (!currentSession) return;
    
    try {
      setLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get list of present students (those who submitted)
      const presentStudents = submissions.map(sub => sub.rollNo);
      
      // Get list of absent students (all students - present students)
      const absentStudents = allStudents
        .filter(student => !presentStudents.includes(student.rollNo))
        .map(student => student.rollNo);
      
      // Save to attendance collection for reports
      const attendanceData = {
        date: today,
        presentCount: presentStudents.length,
        absentCount: absentStudents.length,
        totalCount: allStudents.length,
        presentStudents: presentStudents,
        absentStudents: absentStudents,
        sessionId: currentSession.id,
        savedAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'attendance', today), attendanceData);
      
      showToast('Attendance saved to records successfully!', 'success');
      
    } catch (error) {
      console.error('Error saving attendance to records:', error);
      showToast('Failed to save attendance to records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const stopAttendanceSession = async () => {
    if (!currentSession) return;
    
    if (!window.confirm('Stop the attendance session? Students will no longer be able to submit attendance.')) {
      return;
    }

    try {
      setLoading(true);
      
      const updatedSession = {
        ...currentSession,
        isActive: false,
        endTime: new Date().toTimeString().split(' ')[0]
      };
      
      await setDoc(doc(db, 'attendanceSessions', currentSession.id), updatedSession);
      setCurrentSession(updatedSession);
      showToast('Attendance session stopped', 'success');
      
      // Auto-save to records when session stops
      await saveAttendanceToRecords();
      
    } catch (error) {
      console.error('Error stopping session:', error);
      showToast('Failed to stop session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const reopenAttendanceSession = async () => {
    if (!currentSession) return;
    
    if (!window.confirm('Reopen the attendance session? Students will be able to submit attendance again.')) {
      return;
    }

    try {
      setLoading(true);
      
      // Extend session by 10 minutes from now
      const now = new Date();
      const newEndTime = new Date(now.getTime() + 10 * 60000).toTimeString().split(' ')[0];
      
      const updatedSession = {
        ...currentSession,
        isActive: true,
        endTime: newEndTime
      };
      
      await setDoc(doc(db, 'attendanceSessions', currentSession.id), updatedSession);
      setCurrentSession(updatedSession);
      showToast('🚀 Attendance session reopened! Extended by 10 minutes.', 'success');
      
    } catch (error) {
      console.error('Error reopening session:', error);
      showToast('Failed to reopen session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSessionStatus = () => {
    if (!currentSession) return 'Not Started';
    if (!currentSession.isActive) return 'Stopped';
    
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0];
    
    if (currentTime < currentSession.startTime) return 'Scheduled';
    if (currentSession.endTime && currentTime > currentSession.endTime) return 'Expired';
    return 'Live';
  };

  const getStatusColor = () => {
    const status = getSessionStatus();
    switch (status) {
      case 'Live': return 'text-green-700 bg-green-100';
      case 'Scheduled': return 'text-blue-700 bg-blue-100';
      case 'Stopped': return 'text-red-700 bg-red-100';
      case 'Expired': return 'text-orange-700 bg-orange-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-6 flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Live Attendance Session</h1>
            <p className="text-sm text-slate-600">{todayDate}</p>
          </div>
          {currentSession && (
            <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${getStatusColor()}`}>
              {getSessionStatus()}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#16a34a]/10 p-3 rounded-xl">
                <Users className="w-6 h-6 text-[#16a34a]" />
              </div>
              <span className="text-sm font-medium text-slate-600">Total Students</span>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-1">{allStudents.length}</p>
            <p className="text-xs text-slate-500">Registered in system</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#16a34a]/10 p-3 rounded-xl">
                <CheckCircle className="w-6 h-6 text-[#16a34a]" />
              </div>
              <span className="text-sm font-medium text-slate-600">Present</span>
            </div>
            <p className="text-4xl font-bold text-[#16a34a] mb-1">{submissions.length}</p>
            <p className="text-xs text-slate-500">Submitted attendance</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-50 p-3 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-sm font-medium text-slate-600">Absent</span>
            </div>
            <p className="text-4xl font-bold text-red-600 mb-1">{allStudents.length - submissions.length}</p>
            <p className="text-xs text-slate-500">Not yet submitted</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-50 p-3 rounded-xl">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-600">Session Radius</span>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-1">{currentSession?.location.radius || 30}m</p>
            <p className="text-xs text-slate-500">Allowed distance</p>
          </div>
        </div>

        {/* Session Control */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Session Control</h2>
            <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${getStatusColor()}`}>
              {getSessionStatus()}
            </div>
          </div>

          {currentSession ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 mb-1">Start Time</p>
                  <p className="text-lg font-bold text-slate-900">{currentSession.startTime}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 mb-1">End Time</p>
                  <p className="text-lg font-bold text-slate-900">{currentSession.endTime || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <MapPin className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 mb-1">Radius</p>
                  <p className="text-lg font-bold text-slate-900">{currentSession.location.radius}m</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <Users className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 mb-1">Submissions</p>
                  <p className="text-lg font-bold text-slate-900">{submissions.length}/{allStudents.length}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                {currentSession.isActive ? (
                  <button
                    onClick={stopAttendanceSession}
                    disabled={loading}
                    className="flex items-center gap-2 border-2 border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50 px-6 py-3 rounded-xl transition font-semibold"
                  >
                    <Square className="w-5 h-5" />
                    {loading ? 'Stopping...' : 'Stop Session & Save'}
                  </button>
                ) : (
                  <div className="flex gap-3 items-center">
                    <span className="text-slate-500 italic">Session has ended</span>
                    <button
                      onClick={saveAttendanceToRecords}
                      disabled={loading}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl transition font-semibold"
                    >
                      <Save className="w-5 h-5" />
                      {loading ? 'Saving...' : 'Save to Records'}
                    </button>
                    <button
                      onClick={reopenAttendanceSession}
                      disabled={loading}
                      className="flex items-center gap-2 bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white px-6 py-3 rounded-xl transition font-semibold"
                    >
                      <Play className="w-5 h-5" />
                      {loading ? 'Reopening...' : 'Reopen Session'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-6">No attendance session active today</p>
              
              {locationPermission !== 'granted' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-900 text-sm mb-2">Location Permission Required</p>
                      <p className="text-red-800 text-xs leading-relaxed mb-3">
                        Location permission is required to create attendance sessions. If you already granted permission but still see this message:
                      </p>
                      <div className="space-y-2">
                        <button 
                          onClick={() => {
                            console.log('Forcing location permission recheck...');
                            setLocationPermission('checking');
                            checkLocationPermission();
                          }}
                          className="text-red-600 font-semibold text-xs hover:text-red-700 transition bg-red-100 px-3 py-1 rounded-lg mr-2"
                        >
                          Refresh Permission Status
                        </button>
                        <button 
                          onClick={() => {
                            console.log('Trying direct location access...');
                            getCurrentLocation();
                          }}
                          className="text-red-600 font-semibold text-xs hover:text-red-700 transition bg-red-100 px-3 py-1 rounded-lg"
                        >
                          Try Get Location
                        </button>
                      </div>
                      <p className="text-xs text-red-600 mt-2">
                        Current status: <strong>{locationPermission}</strong> | Current location: {currentLocation ? 'Available' : 'Not available'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Start New Session</h3>
                  <p className="text-sm text-slate-600">Configure attendance session settings</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-medium mb-3">
                      <Clock className="w-4 h-4 inline mr-2" />
                      Session Duration
                    </label>
                    <select
                      value={sessionForm.duration}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a] text-slate-900 font-medium"
                    >
                      <option value={2}>2 minutes</option>
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>60 minutes</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-slate-700 font-medium mb-3">
                      <MapPin className="w-4 h-4 inline mr-2" />
                      Allowed Radius
                    </label>
                    {currentLocation && currentLocation.accuracy && currentLocation.accuracy <= 20 && (
                      <div className="mb-3 p-3 bg-[#16a34a]/10 border border-[#16a34a]/20 rounded-xl">
                        <p className="text-sm text-[#16a34a]">
                          <strong>High GPS Accuracy Detected!</strong> ({Math.round(currentLocation.accuracy)}m accuracy)
                          <br />
                          <span className="text-xs">For indoor classroom (30ft x 16ft): use 20-30m radius</span>
                        </p>
                      </div>
                    )}
                    <select
                      value={sessionForm.radius}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a] text-slate-900 font-medium"
                    >
                      <option value={15}>15 meters (Small Classroom)</option>
                      <option value={20}>20 meters (Medium Classroom)</option>
                      <option value={30}>30 meters (Large Classroom)</option>
                      <option value={50}>50 meters (Building Floor)</option>
                      <option value={100}>100 meters (Building Wide)</option>
                      <option value={200}>200 meters (Campus Area)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#16a34a]/5 rounded-xl p-4 border border-[#16a34a]/20">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 bg-[#16a34a]/10 px-3 py-1 rounded-full">
                        <Clock className="w-3 h-3 text-[#16a34a]" />
                        <span className="text-[#16a34a] font-medium">Duration: {sessionForm.duration} minutes</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#16a34a]/10 px-3 py-1 rounded-full">
                        <MapPin className="w-3 h-3 text-[#16a34a]" />
                        <span className="text-[#16a34a] font-medium">Radius: {sessionForm.radius}m</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 text-center sm:text-right">
                      <div>Expected Students: <span className="font-semibold text-slate-900">{allStudents.length}</span></div>
                    </div>
                  </div>
                </div>

                {/* Location Selection */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Session Location
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="useManualNew"
                        checked={manualLocation.useManual}
                        onChange={(e) => setManualLocation(prev => ({ ...prev, useManual: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="useManualNew" className="text-sm text-amber-800">
                        Use manual coordinates (override GPS location)
                      </label>
                    </div>

                    {manualLocation.useManual ? (
                      <div className="space-y-3">
                        <div className="bg-orange-100 border border-orange-300 rounded-xl p-3">
                          <p className="text-xs text-orange-800 font-medium">Manual Override Mode</p>
                          <p className="text-xs text-orange-700 mt-1">This will override your GPS location. Only use if GPS is inaccurate.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-amber-700 mb-1">Latitude</label>
                            <input
                              type="number"
                              step="any"
                              placeholder="Enter latitude"
                              value={manualLocation.latitude}
                              onChange={(e) => setManualLocation(prev => ({ ...prev, latitude: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-[#16a34a] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-yellow-700 mb-1">Longitude</label>
                            <input
                              type="number"
                              step="any"
                              placeholder="Enter longitude"
                              value={manualLocation.longitude}
                              onChange={(e) => setManualLocation(prev => ({ ...prev, longitude: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-yellow-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-100 border border-green-300 rounded-lg p-3">
                        <p className="text-sm text-[#16a34a] font-medium">Using Your Real GPS Location</p>
                        <p className="text-xs text-[#16a34a]/80 mt-1">
                          Current: {currentLocation ? 
                            `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}` : 
                            'Getting location...'}
                          {currentLocation?.accuracy && (
                            <span className="ml-2">({Math.round(currentLocation.accuracy)}m accuracy)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={startAttendanceSession}
                  disabled={loading || (!manualLocation.useManual && locationPermission !== 'granted') || (manualLocation.useManual && (!manualLocation.latitude || !manualLocation.longitude))}
                  className="w-full flex items-center justify-center gap-3 bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl transition font-semibold text-lg shadow-sm"
                >
                  <Play className="w-6 h-6" />
                  {loading ? 'Starting Session...' : 'Start Attendance Session'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Location Area Viewer */}
        {currentSession && currentSession.location && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
            <div className="bg-[#16a34a]/5 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#16a34a]" />
                    Attendance Location Area
                  </h3>
                  <p className="text-sm text-slate-600">Students must be within this area to submit attendance</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-3 py-1 rounded-xl text-sm font-medium bg-[#16a34a]/10 text-[#16a34a]">
                    {currentSession.location.radius}m Radius
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Location Details */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">Session Latitude</p>
                      <p className="text-lg font-mono font-bold text-slate-900">{currentSession.location.latitude.toFixed(6)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">Session Longitude</p>
                      <p className="text-lg font-mono font-bold text-slate-900">{currentSession.location.longitude.toFixed(6)}</p>
                    </div>
                  </div>
                  
                  {/* GPS Status Display */}
                  {currentLocation && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                            Your Current GPS 
                            {currentLocation.accuracy && currentLocation.accuracy <= 20 && (
                              <span className="bg-[#16a34a] text-white text-xs px-1 rounded">High Accuracy</span>
                            )}
                          </p>
                          <p className="text-sm font-mono text-blue-900">{currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}</p>
                          {currentLocation.accuracy && (
                            <p className="text-xs text-blue-600 mt-1">Accuracy: {Math.round(currentLocation.accuracy)}m</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                            Session Location
                            <span className={`text-white text-xs px-1 rounded ${
                              currentSession.location.source === 'gps' 
                                ? 'bg-[#16a34a]' 
                                : currentSession.location.source === 'manual'
                                ? 'bg-orange-500'
                                : 'bg-[#16a34a]'
                            }`}>
                              {currentSession.location.source === 'manual' ? 'Manual' : 'GPS-Based'}
                            </span>
                          </p>
                          <p className="text-sm font-mono text-blue-900">{currentSession.location.latitude.toFixed(6)}, {currentSession.location.longitude.toFixed(6)}</p>
                          <p className="text-xs text-blue-600 mt-1">Radius: {currentSession.location.radius}m</p>
                          {currentSession.location.accuracy && (
                            <p className="text-xs text-blue-600">Created with {Math.round(currentSession.location.accuracy)}m accuracy</p>
                          )}
                        </div>
                      </div>
                      <div className="text-center pt-2 border-t border-blue-200">
                        <p className="text-xs text-blue-700">
                          {currentSession.location.source === 'manual'
                            ? 'This session uses manually entered coordinates'
                            : 'This session is using the admin real GPS location, not manual coordinates'
                          }
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-[#16a34a]/10 border border-[#16a34a]/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-[#16a34a]" />
                      <span className="font-medium text-[#16a34a]">Attendance Zone Details</span>
                      <span className={`text-white text-xs px-2 py-1 rounded font-medium ${
                        currentSession.location.source === 'gps' 
                          ? 'bg-[#16a34a]' 
                          : currentSession.location.source === 'manual'
                          ? 'bg-orange-500'
                          : 'bg-[#16a34a]'
                      }`}>
                        {currentSession.location.source === 'manual' 
                          ? 'Manual Location' 
                          : 'GPS-Based Location'}
                      </span>
                    </div>
                    <ul className="text-sm text-[#16a34a] space-y-1">
                      <li>• Center: {currentSession.location.latitude.toFixed(4)}, {currentSession.location.longitude.toFixed(4)}</li>
                      <li>• Radius: {currentSession.location.radius} meters</li>
                      <li>• Area: ~{Math.round(Math.PI * Math.pow(currentSession.location.radius, 2))}m² coverage</li>
                      <li>• Students must be within this circle to submit attendance</li>
                      <li>• {currentSession.location.source === 'manual' 
                        ? 'Location source: Manual coordinates (admin override)'
                        : 'Location source: Admin real GPS (not manual coordinates)'
                      }</li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const coords = `${currentSession.location.latitude},${currentSession.location.longitude}`;
                        window.open(`https://www.google.com/maps?q=${coords}`, '_blank');
                      }}
                      className="flex items-center gap-2 bg-[#16a34a] hover:bg-[#15803d] text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                    >
                      <Eye className="w-4 h-4" />
                      View on Map
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${currentSession.location.latitude}, ${currentSession.location.longitude}`);
                        showToast('Coordinates copied to clipboard!', 'success');
                      }}
                      className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                    >
                      Copy Coordinates
                    </button>
                  </div>

                  {/* Location Update Section */}
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <h4 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Wrong Location? Update Session Location
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="useManual"
                          checked={manualLocation.useManual}
                          onChange={(e) => setManualLocation(prev => ({ ...prev, useManual: e.target.checked }))}
                          className="rounded"
                        />
                        <label htmlFor="useManual" className="text-sm text-amber-800">
                          Switch to manual coordinates (override current GPS)
                        </label>
                      </div>

                      {manualLocation.useManual && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-amber-700 mb-1">Latitude</label>
                            <input
                              type="number"
                              step="any"
                              placeholder="16.964681" 
                              value={manualLocation.latitude}
                              onChange={(e) => setManualLocation(prev => ({ ...prev, latitude: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-amber-700 mb-1">Longitude</label>
                            <input
                              type="number"
                              step="any"
                              placeholder="82.217846"
                              value={manualLocation.longitude}
                              onChange={(e) => setManualLocation(prev => ({ ...prev, longitude: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={updateSessionLocation}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        <MapPin className="w-4 h-4" />
                        {loading ? 'Updating...' : manualLocation.useManual ? 'Update to Manual Location' : 'Update to Current GPS Location'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column - Visual Representation */}
                <div className="bg-slate-50 rounded-xl p-6 flex items-center justify-center">
                  <div className="text-center">
                    <div className="relative w-48 h-48 mx-auto mb-4">
                      {/* Outer circle representing the attendance area */}
                      <div className="absolute inset-0 border-4 border-dashed border-[#16a34a]/30 rounded-full animate-pulse"></div>
                      {/* Inner circle representing the center point */}
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="w-6 h-6 bg-[#16a34a] rounded-full"></div>
                      </div>
                      {/* Radius indicator */}
                      <div className="absolute top-1/2 left-1/2 transform -translate-y-0.5 w-24 h-0.5 bg-[#16a34a]/50">
                        <span className="absolute -top-6 right-0 text-sm font-bold text-[#16a34a]">{currentSession.location.radius}m</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mb-1">Attendance Area Visualization</p>
                    <p className="text-xs text-slate-500">Students must be within the dashed circle</p>
                  </div>
                </div>
              </div>

              {currentLocation && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-slate-600">Your current location: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}</span>
                    </div>
                    <div className="text-slate-500 flex items-center gap-2">
                      <span>Distance from center: {
                        (() => {
                          const R = 6371e3;
                          const φ1 = currentLocation.latitude * Math.PI/180;
                          const φ2 = currentSession.location.latitude * Math.PI/180;
                          const Δφ = (currentSession.location.latitude - currentLocation.latitude) * Math.PI/180;
                          const Δλ = (currentSession.location.longitude - currentLocation.longitude) * Math.PI/180;
                          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
                          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                          return Math.round(R * c);
                        })()
                      }m</span>
                      {currentLocation.accuracy && (
                        <span className="text-xs text-slate-400">{Math.round(currentLocation.accuracy)}m</span>
                      )}
                      <button 
                        onClick={getCurrentLocation}
                        className="text-xs bg-[#16a34a] hover:bg-[#15803d] text-white px-2 py-1 rounded"
                        title="Refresh GPS location for better accuracy"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student Attendance Table */}
        {currentSession && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Student Attendance</h3>
                  <p className="text-sm text-slate-600">{submissions.length} of {allStudents.length} students present</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#16a34a] rounded-full animate-pulse"></div>
                  <span className="text-sm text-[#16a34a] font-medium">Live</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search by name or roll number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a]"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'present' | 'absent')}
                  className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a] bg-white"
                >
                  <option value="all">All Students</option>
                  <option value="present">Present Only</option>
                  <option value="absent">Absent Only</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              {allStudents.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No students in database</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Roll No</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Distance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allStudents
                      .filter(student => {
                        const matchesSearch = searchQuery === '' || 
                          student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.rollNo.toLowerCase().includes(searchQuery.toLowerCase());
                        
                        const isPresent = submissions.some(sub => sub.rollNo === student.rollNo);
                        const matchesFilter = filterStatus === 'all' || 
                          (filterStatus === 'present' && isPresent) ||
                          (filterStatus === 'absent' && !isPresent);
                        
                        return matchesSearch && matchesFilter;
                      })
                      .map((student, idx) => {
                        const submission = submissions.find(sub => sub.rollNo === student.rollNo);
                        const isPresent = !!submission;
                        
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-900">{student.name}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-slate-600">{student.rollNo}</p>
                            </td>
                            <td className="px-6 py-4">
                              {isPresent ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#16a34a]/10 text-[#16a34a]">
                                  Present
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                                  Absent
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-slate-600">
                                {submission?.timestamp?.toDate?.()?.toLocaleTimeString() || '-'}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-slate-600">
                                {submission ? `${Math.round(submission.distance)}m` : '-'}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>

            {allStudents.length - submissions.length === 0 && allStudents.length > 0 && (
              <div className="bg-[#16a34a]/5 border-t border-[#16a34a]/20 px-6 py-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[#16a34a]" />
                  <p className="text-sm text-[#16a34a] font-medium">All students are present!</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final End Session Button */}
        {currentSession && currentSession.isActive && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg mb-1">Ready to End Session?</h3>
                <p className="text-sm text-slate-600">Generate final attendance summary and save to database</p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('End the session and generate final attendance summary?')) {
                    setShowFinalSummary(true);
                    stopAttendanceSession();
                  }
                }}
                className="flex items-center gap-2 bg-[#16a34a] hover:bg-[#15803d] text-white px-6 py-3 rounded-xl transition font-semibold"
              >
                Final End Session
              </button>
            </div>
          </div>
        )}

        {/* Final Summary Card */}
        {showFinalSummary && !currentSession?.isActive && (
          <div className="bg-white rounded-2xl shadow-lg border border-[#16a34a]/20 p-6">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-[#16a34a] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Final Attendance Summary</h2>
              <p className="text-sm text-slate-600">Session ended at {new Date().toLocaleTimeString()}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-600 mb-1">Total Students</p>
                <p className="text-3xl font-bold text-slate-900">{allStudents.length}</p>
              </div>
              <div className="bg-[#16a34a]/10 rounded-xl p-4 text-center">
                <p className="text-sm text-[#16a34a] mb-1">Present</p>
                <p className="text-3xl font-bold text-[#16a34a]">{submissions.length}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-sm text-red-600 mb-1">Absent</p>
                <p className="text-3xl font-bold text-red-600">{allStudents.length - submissions.length}</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>Attendance Percentage</span>
                <span className="font-bold text-slate-900">
                  {allStudents.length > 0 ? Math.round((submissions.length / allStudents.length) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div 
                  className="bg-[#16a34a] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${allStudents.length > 0 ? (submissions.length / allStudents.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 flex items-center justify-center gap-2 bg-[#16a34a] hover:bg-[#15803d] text-white px-6 py-3 rounded-xl transition font-semibold"
                onClick={() => {
                  showToast('PDF download feature coming soon!', 'success');
                }}
              >
                Download PDF
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-xl transition font-semibold"
                onClick={() => {
                  setShowFinalSummary(false);
                  showToast('Attendance data saved to database!', 'success');
                }}
              >
                Save to Database
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}