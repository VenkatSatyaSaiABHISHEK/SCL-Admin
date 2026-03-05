'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, Play, Square, Clock, MapPin, Settings, Calendar, Users } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, Timestamp, collection, getDocs, query, where } from 'firebase/firestore';

interface AttendanceSession {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // meters
    address?: string;
  };
  createdBy: string;
  createdAt: any;
  studentCount?: number;
}

export default function AttendanceSessionContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  
  // Session creation form
  const [sessionForm, setSessionForm] = useState({
    startTime: '',
    endTime: '',
    radius: 100,
    useCurrentLocation: true,
    customLocation: { latitude: 0, longitude: 0, address: '' }
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAdmin) {
      router.push('/login');
    }
  }, [mounted, isAdmin, router]);

  useEffect(() => {
    if (mounted && isAdmin) {
      loadCurrentSession();
      loadRecentSessions();
      checkLocationPermission();
    }
  }, [mounted, isAdmin]);

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
    } catch {
      setLocationPermission('denied');
    }
  };

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Location error:', error);
        setLocationPermission('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const loadCurrentSession = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sessionRef = doc(db, 'attendanceSessions', today);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        setCurrentSession({ id: sessionSnap.id, ...sessionSnap.data() } as AttendanceSession);
      }
    } catch (error) {
      console.error('Error loading current session:', error);
    }
  };

  const loadRecentSessions = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'attendanceSessions'));
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AttendanceSession))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
      
      setSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const createSession = async () => {
    if (!currentUser) return;

    if (sessionForm.useCurrentLocation && !currentLocation) {
      showToast('Current location required. Please enable location access.', 'error');
      return;
    }

    if (!sessionForm.startTime || !sessionForm.endTime) {
      showToast('Please set start and end times', 'error');
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      // Check if session already exists for today
      const existingSession = await getDoc(doc(db, 'attendanceSessions', today));
      if (existingSession.exists()) {
        showToast('Attendance session already exists for today', 'error');
        return;
      }

      const sessionData: Omit<AttendanceSession, 'id'> = {
        date: today,
        startTime: sessionForm.startTime,
        endTime: sessionForm.endTime,
        isActive: true,
        location: sessionForm.useCurrentLocation ? {
          latitude: currentLocation!.latitude,
          longitude: currentLocation!.longitude,
          radius: sessionForm.radius,
          address: 'Current Campus Location'
        } : {
          latitude: sessionForm.customLocation.latitude,
          longitude: sessionForm.customLocation.longitude,
          radius: sessionForm.radius,
          address: sessionForm.customLocation.address
        },
        createdBy: currentUser.name || currentUser.email || 'Admin',
        createdAt: Timestamp.now(),
        studentCount: 0
      };

      await setDoc(doc(db, 'attendanceSessions', today), sessionData);
      
      setCurrentSession({ id: today, ...sessionData });
      showToast('✓ Attendance session created successfully!', 'success');
      loadRecentSessions();
      
      // Reset form
      setSessionForm({
        startTime: '',
        endTime: '',
        radius: 100,
        useCurrentLocation: true,
        customLocation: { latitude: 0, longitude: 0, address: '' }
      });
      
    } catch (error) {
      console.error('Error creating session:', error);
      showToast('Failed to create session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const stopSession = async () => {
    if (!currentSession) return;
    
    if (!window.confirm('Stop the current attendance session? Students will no longer be able to mark attendance.')) {
      return;
    }

    try {
      setLoading(true);
      
      // Get student count who marked attendance
      const q = query(
        collection(db, 'studentAttendance'),
        where('date', '==', currentSession.date)
      );
      const attendanceSnapshot = await getDocs(q);
      const studentCount = attendanceSnapshot.size;
      
      const updatedSession = {
        ...currentSession,
        isActive: false,
        endTime: new Date().toTimeString().split(' ')[0],
        studentCount
      };
      
      await setDoc(doc(db, 'attendanceSessions', currentSession.id), updatedSession);
      
      setCurrentSession(updatedSession);
      showToast('✓ Attendance session stopped', 'success');
      loadRecentSessions();
      
    } catch (error) {
      console.error('Error stopping session:', error);
      showToast('Failed to stop session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSessionStatus = (session: AttendanceSession) => {
    if (!session.isActive) return 'stopped';
    
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0];
    
    if (currentTime < session.startTime) return 'scheduled';
    if (session.endTime && currentTime > session.endTime) return 'expired';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-700 bg-green-100';
      case 'scheduled': return 'text-blue-700 bg-blue-100';
      case 'stopped': return 'text-red-700 bg-red-100';
      case 'expired': return 'text-orange-700 bg-orange-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  if (!mounted || !isAdmin || !currentUser) {
    return <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>;
  }

  const todaySession = currentSession;
  const todayStatus = todaySession ? getSessionStatus(todaySession) : 'none';

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="glass-effect-strong border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <Settings className="w-6 h-6 text-blue-400" />
              <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent hidden sm:inline">
                Session Control
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/attendance" className="px-3 py-1 rounded-lg text-white/70 hover:bg-white/10 transition text-sm">
                Attendance Control
              </Link>
              <Link href="/dashboard" className="px-3 py-1 rounded-lg text-white/70 hover:bg-white/10 transition text-sm">
                Dashboard
              </Link>
              <Link href="/profile" className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition">
                <User className="w-5 h-5" />
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-lg hover:bg-red-500/20 transition text-white/70 hover:text-red-300"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Attendance Session Control</h1>
          <p className="text-white/60">Manage today's attendance session and location settings</p>
        </div>

        {/* Current Session Status */}
        <div className="glass-effect-strong rounded-2xl border border-white/15 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Today's Session</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(todayStatus)}`}>
              {todayStatus === 'none' ? 'Not Created' : todayStatus.charAt(0).toUpperCase() + todayStatus.slice(1)}
            </div>
          </div>

          {todaySession ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-white/60 text-sm">Start Time</p>
                  <p className="text-white font-semibold">{todaySession.startTime}</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <Clock className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                  <p className="text-white/60 text-sm">End Time</p>
                  <p className="text-white font-semibold">{todaySession.endTime || 'Not set'}</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <Users className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-white/60 text-sm">Students</p>
                  <p className="text-white font-semibold">{todaySession.studentCount || 0}</p>
                </div>
              </div>

              {todaySession.location && (
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-blue-400" />
                    <span className="text-white font-semibold">Location Settings</span>
                  </div>
                  <p className="text-white/80 text-sm">
                    Radius: {todaySession.location.radius}m • 
                    Coordinates: {todaySession.location.latitude.toFixed(6)}, {todaySession.location.longitude.toFixed(6)}
                  </p>
                  {todaySession.location.address && (
                    <p className="text-white/60 text-xs mt-1">{todaySession.location.address}</p>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                {todaySession.isActive ? (
                  <button
                    onClick={stopSession}
                    disabled={loading}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg transition font-semibold"
                  >
                    <Square className="w-5 h-5" />
                    {loading ? 'Stopping...' : 'Stop Session'}
                  </button>
                ) : (
                  <div className="text-white/60 italic">Session has ended</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/60 mb-6">No attendance session created for today</p>
              <p className="text-white/40 text-sm">Create a session to enable student attendance marking</p>
            </div>
          )}
        </div>

        {/* Create New Session */}
        {!todaySession && (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Create Today's Session</h2>
            
            <div className="space-y-6">
              {/* Time Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 font-semibold mb-2">Start Time</label>
                  <input
                    type="time"
                    value={sessionForm.startTime}
                    onChange={(e) => setSessionForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-white/80 font-semibold mb-2">End Time</label>
                  <input
                    type="time"
                    value={sessionForm.endTime}
                    onChange={(e) => setSessionForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Location Settings */}
              <div>
                <label className="block text-white/80 font-semibold mb-4">Location Settings</label>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="useCurrentLocation"
                      checked={sessionForm.useCurrentLocation}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, useCurrentLocation: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-slate-700 border-white/20 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="useCurrentLocation" className="text-white/80">
                      Use current location ({locationPermission === 'granted' ? 'Available' : 'Permission required'})
                    </label>
                  </div>

                  {currentLocation && sessionForm.useCurrentLocation && (
                    <div className="p-3 bg-white/5 rounded-lg text-sm">
                      <p className="text-white/80">
                        Detected: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-white/60 text-sm mb-2">Campus Radius (meters)</label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={sessionForm.radius}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, radius: parseInt(e.target.value) || 100 }))}
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-white/40 text-xs mt-1">Students must be within this distance to mark attendance</p>
                  </div>
                </div>
              </div>

              <button
                onClick={createSession}
                disabled={loading || (!sessionForm.useCurrentLocation && !sessionForm.customLocation.latitude)}
                className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-4 rounded-lg transition font-semibold text-lg"
              >
                <Play className="w-6 h-6" />
                {loading ? 'Creating Session...' : 'Start Attendance Session'}
              </button>
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        <div className="glass-effect-strong rounded-2xl border border-white/15 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Recent Sessions</h2>
          
          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white font-semibold">{session.date}</p>
                    <p className="text-white/60 text-sm">
                      {session.startTime} - {session.endTime || 'Ongoing'} • 
                      {session.studentCount || 0} students
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(getSessionStatus(session))}`}>
                    {getSessionStatus(session)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No previous sessions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}