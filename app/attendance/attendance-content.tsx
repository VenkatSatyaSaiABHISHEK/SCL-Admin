'use client';

import { useRef, useEffect, useState } from 'react';
import QrScanner from 'qr-scanner';
import { RotateCcw, Clock, Users, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, setDoc, doc, Timestamp, getDoc } from 'firebase/firestore';

interface AttendanceRecord {
  id: number;
  rollNo: string;
  name: string;
  status: 'present' | 'absent';
  timestamp?: string;
}

interface StudentData {
  rollNo: string;
  name: string;
}

export default function AttendanceContent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [lastScannedStudent, setLastScannedStudent] = useState<StudentData | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [submissionResults, setSubmissionResults] = useState<{ present: string[]; absent: string[] } | null>(null);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const scannedRollNosRef = useRef<Set<string>>(new Set());
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownCounterRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load all students on mount
  useEffect(() => {
    loadAllStudents();
    loadTodayAttendance();
  }, []);

  const loadTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceRef = doc(db, 'attendance', today);
      const attendanceSnap = await getDoc(attendanceRef);
      
      if (attendanceSnap.exists()) {
        const data = attendanceSnap.data();
        // Show the results of today's submission
        if (data.presentStudents && data.absentStudents) {
          setSubmissionResults({
            present: data.presentStudents || [],
            absent: data.absentStudents || []
          });
          setShowResults(true);
          showToast(`✓ Today's attendance already submitted! Present: ${data.presentCount}, Absent: ${data.absentCount}`, 'success');
        }
      }
    } catch (error) {
      console.error('Error loading today\'s attendance:', error);
    }
  };

  const loadAllStudents = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'students'));
      const students: StudentData[] = [];
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

  // Check stream health - only report errors, don't auto-loop
  const checkStreamHealth = () => {
    try {
      if (!videoRef.current) return;
      
      // Check if video has valid dimensions (indicates working stream)
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        if (!streamError) {
          setStreamError(true);
          console.warn('Camera stream not initialized. Check permissions and try reconnecting.');
        }
      } else {
        if (streamError) {
          setStreamError(false);
        }
      }
    } catch (error) {
      console.error('Stream health check failed:', error);
    }
  };

  // Stream health check interval - runs every 2 seconds, non-aggressive
  useEffect(() => {
    if (!showCamera) return;
    const healthCheckInterval = setInterval(checkStreamHealth, 2000);
    // Check immediately on mount
    checkStreamHealth();
    return () => clearInterval(healthCheckInterval);
  }, [showCamera, streamError]);

  // Initialize scanner - FIXED: Keep stream running indefinitely, use cooldown for processing
  useEffect(() => {
    if (showCamera && videoRef.current && !scannerRef.current) {
      try {
        scannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            // Skip processing if in cooldown
            if (cooldownActive) return;

            try {
              const data = typeof result.data === 'string' ? result.data : String(result.data || '');
              const qrData = JSON.parse(data);
              const rollNo = qrData.rollNo || qrData.roll || '';
              const name = qrData.name || '';

              if (rollNo && !scannedRollNosRef.current.has(rollNo)) {
                // Validate student exists in database
                const studentExists = allStudents.some((s) => s.rollNo === rollNo);
                
                if (!studentExists) {
                  showToast(`❌ Student ${rollNo} not found in database`, 'error');
                  return;
                }

                // Activate 300ms cooldown - FASTER scanning between QR codes
                setCooldownActive(true);

                if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
                if (cooldownCounterRef.current) clearTimeout(cooldownCounterRef.current);

                // End cooldown after 300ms for faster repeated scanning
                cooldownTimeoutRef.current = setTimeout(() => {
                  setCooldownActive(false);
                  setCooldownSeconds(0);
                }, 300);

                scannedRollNosRef.current.add(rollNo);
                const now = new Date();
                setLastScanTime(now.toLocaleTimeString());
                setLastScannedStudent({ rollNo, name });

                const newRecord: AttendanceRecord = {
                  id: Date.now(),
                  rollNo,
                  name,
                  status: 'present',
                  timestamp: now.toLocaleTimeString(),
                };

                setAttendance((prev) => [...prev, newRecord]);
                showToast(`✓ ${name} (${rollNo}) marked present`, 'success');
              }
            } catch (error) {
              console.error('Invalid QR format:', error);
              showToast('Invalid QR code format', 'error');
            }
          },
          { 
            preferredCamera: 'environment'
          }
        );

        scannerRef.current.start();
        setIsScanning(true);
        setStreamError(false);
        console.log('Camera started - scanning active');
      } catch (error) {
        console.error('Camera initialization error:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        setStreamError(true);
        setShowCamera(false);
        showToast(`Camera error: ${errorMsg}. Check permissions and try again.`, 'error');
      }
    }
    // Only destroy when explicitly stopping
    else if (!showCamera && scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
        scannedRollNosRef.current.clear();
        setIsScanning(false);
        setCooldownActive(false);
        setCooldownSeconds(0);
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }

    return () => {
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
      if (cooldownCounterRef.current) clearTimeout(cooldownCounterRef.current);
      if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
    };
  }, [showCamera, cooldownActive]);

  const restartCamera = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.start();
        setStreamError(false);
        showToast('Camera restarted', 'success');
      } catch (error) {
        console.error('Restart failed:', error);
        showToast('Failed to restart camera', 'error');
      }
    }
  };

  const markAbsent = (id: number) => {
    setAttendance((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'absent' } : a))
    );
  };

  const removeRecord = (id: number) => {
    setAttendance((prev) => prev.filter((a) => a.id !== id));
    scannedRollNosRef.current.delete(attendance.find((a) => a.id === id)?.rollNo || '');
  };

  const submitAttendance = async () => {
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const presentRollNos = attendance.filter((a) => a.status === 'present').map((a) => a.rollNo);
      const absentRollNos = allStudents
        .filter((s) => !presentRollNos.includes(s.rollNo))
        .map((s) => s.rollNo);

      // Save to Firestore
      const attendanceRef = doc(db, 'attendance', today);
      await setDoc(attendanceRef, {
        date: today,
        presentStudents: presentRollNos,
        absentStudents: absentRollNos,
        presentCount: presentRollNos.length,
        absentCount: absentRollNos.length,
        totalStudents: allStudents.length,
        submittedAt: Timestamp.now(),
        submittedBy: currentUser?.name || 'Admin',
      });

      // Store results and show them
      setSubmissionResults({
        present: presentRollNos,
        absent: absentRollNos
      });
      setShowResults(true);
      showToast('✓ Attendance submitted successfully!', 'success');
      setAttendance([]);
      setShowCamera(false);
      scannedRollNosRef.current.clear();
      setLastScannedStudent(null);
      setLastScanTime(null);
    } catch (error) {
      showToast(
        'Error submitting attendance: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAttendance = attendance.filter(
    (record) =>
      record.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const totalStudents = allStudents.length;
  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6 flex flex-col">
      {/* Results View */}
      {showResults && submissionResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-50 to-slate-50 px-6 md:px-8 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Attendance Report</h2>
                <p className="text-sm text-slate-600 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button
                onClick={() => setShowResults(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 md:p-8">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <p className="text-green-600 font-semibold text-sm mb-1">Present</p>
                  <p className="text-3xl font-bold text-green-700">{submissionResults.present.length}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                  <p className="text-red-600 font-semibold text-sm mb-1">Absent</p>
                  <p className="text-3xl font-bold text-red-700">{submissionResults.absent.length}</p>
                </div>
                <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                  <p className="text-slate-600 font-semibold text-sm mb-1">Total</p>
                  <p className="text-3xl font-bold text-slate-700">{allStudents.length}</p>
                </div>
              </div>

              {/* Present List */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  Present Students ({submissionResults.present.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {submissionResults.present.length === 0 ? (
                    <p className="text-slate-500 text-sm">No present students</p>
                  ) : (
                    submissionResults.present.map((rollNo, idx) => {
                      const student = allStudents.find(s => s.rollNo === rollNo);
                      return (
                        <div key={rollNo} className="flex items-center gap-3 p-2 bg-green-50 rounded-lg border border-green-100">
                          <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{student?.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-600">{rollNo}</p>
                          </div>
                          <span className="bg-green-200 text-green-700 px-2 py-1 rounded text-xs font-semibold">Present</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Absent List */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Absent Students ({submissionResults.absent.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {submissionResults.absent.length === 0 ? (
                    <p className="text-slate-500 text-sm">No absent students - 100% attendance!</p>
                  ) : (
                    submissionResults.absent.map((rollNo, idx) => {
                      const student = allStudents.find(s => s.rollNo === rollNo);
                      return (
                        <div key={rollNo} className="flex items-center gap-3 p-2 bg-red-50 rounded-lg border border-red-100">
                          <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{student?.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-600">{rollNo}</p>
                          </div>
                          <span className="bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-semibold">Absent</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowResults(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-all"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
        {/* Compact Header */}
        <div className="mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Mark Attendance</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-0.5">{todayDate}</p>
        </div>

        {/* Stats Cards - Compact 3 Column Grid */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
          {/* Card 1: Today Present */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-3 md:p-4 hover:shadow-md transition-all">
            <div className="flex flex-col items-start justify-between h-full">
              <div className="flex items-center justify-between w-full mb-2">
                <p className="text-slate-600 text-xs font-medium">Today Present</p>
                <div className="bg-green-100 p-1.5 rounded-md">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-green-600">{presentCount}</p>
            </div>
          </div>

          {/* Card 2: Total Students */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-3 md:p-4 hover:shadow-md transition-all">
            <div className="flex flex-col items-start justify-between h-full">
              <div className="flex items-center justify-between w-full mb-2">
                <p className="text-slate-600 text-xs font-medium">Total Students</p>
                <div className="bg-blue-100 p-1.5 rounded-md">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-600">{totalStudents}</p>
            </div>
          </div>

          {/* Card 3: Last Scan Time */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-3 md:p-4 hover:shadow-md transition-all">
            <div className="flex flex-col items-start justify-between h-full">
              <div className="flex items-center justify-between w-full mb-2">
                <p className="text-slate-600 text-xs font-medium">Last Scan</p>
                <div className="bg-slate-100 p-1.5 rounded-md">
                  <Clock className="w-4 h-4 text-slate-600" />
                </div>
              </div>
              <p className="text-sm md:text-base font-bold text-slate-900">{lastScanTime || '-'}</p>
            </div>
          </div>
        </div>

        {/* Main Content - 60/40 Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 flex-1 min-h-0">
          {/* Left Column - Camera (60%) */}
          <div className="lg:col-span-3 flex flex-col min-h-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">
              {/* Camera Header */}
              <div className="bg-gradient-to-r from-blue-50 to-slate-50 px-4 md:px-5 py-2.5 md:py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}
                  />
                  <span className={`text-sm md:text-base font-semibold ${isScanning ? 'text-green-700' : 'text-slate-600'}`}>
                    {isScanning
                      ? cooldownActive
                        ? 'Processing...'
                        : 'Live Scanning'
                      : 'Standby'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {isScanning && (
                    <button
                      onClick={restartCamera}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-md transition-colors text-xs md:text-sm font-medium"
                      title="Restart camera stream"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Restart</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowCamera(!showCamera)}
                    className={`flex items-center gap-1.5 px-3 md:px-4 py-1 rounded-md font-medium transition-all text-xs md:text-sm ${
                      showCamera
                        ? 'bg-red-50 hover:bg-red-100 text-red-700'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                    }`}
                  >
                    {showCamera ? 'Stop' : 'Start'}
                  </button>
                </div>
              </div>

              {/* Camera Display */}
              <div className="relative bg-slate-900 flex-1 flex items-center justify-center overflow-hidden" style={{ minHeight: '420px' }}>
                {showCamera ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                    />
                    {streamError && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center bg-red-900/40 backdrop-blur-sm rounded-lg p-6 max-w-xs">
                          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                          <p className="text-white font-bold mb-1">Camera Not Available</p>
                          <p className="text-red-200 text-sm mb-4">Check:
                            <br/>✓ Browser permission
                            <br/>✓ Camera connections
                            <br/>✓ Other apps using camera</p>
                          <button
                            onClick={restartCamera}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                          >
                            Reconnect Camera
                          </button>
                        </div>
                      </div>
                    )}
                    {cooldownActive && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-3 border-white/30 border-t-white mx-auto"></div>
                          <p className="text-white text-sm mt-3 font-medium">Processing scan...</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-slate-400 text-sm">Camera not active</p>
                    <p className="text-slate-500 text-xs mt-1">Click Start to begin scanning</p>
                  </div>
                )}
              </div>

              {/* Last Scanned Student Card */}
              {lastScannedStudent && (
                <div className="px-4 md:px-5 py-3 border-t border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
                  <p className="text-slate-600 text-xs font-medium mb-2">Last Scanned</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {lastScannedStudent.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{lastScannedStudent.name}</p>
                      <p className="text-xs text-slate-600">{lastScannedStudent.rollNo}</p>
                    </div>
                    <div className="bg-green-100 px-2 py-0.5 rounded">
                      <p className="text-green-700 text-xs font-semibold">Present</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Records (40%) */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-slate-50 px-4 md:px-5 py-2.5 md:py-3 border-b border-slate-100 flex-shrink-0">
                <h2 className="font-bold text-slate-900 text-sm md:text-base">Attendance</h2>
                <p className="text-xs text-slate-600 mt-0.5">{filteredAttendance.length} / {attendance.length}</p>
              </div>

              {/* Search Bar */}
              <div className="px-4 md:px-5 py-2 border-b border-slate-100 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Records List - Scrollable */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredAttendance.length === 0 ? (
                  <div className="px-4 md:px-5 py-8 text-center flex flex-col items-center justify-center h-full">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium text-sm">No records</p>
                    <p className="text-slate-500 text-xs mt-1">Start scanning</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredAttendance.map((record) => (
                      <div key={record.id} className="px-4 md:px-5 py-2.5 hover:bg-slate-50 transition-colors text-xs">
                        <div className="flex items-start justify-between gap-1.5 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{record.name}</p>
                            <p className="text-slate-600 text-xs">{record.rollNo}</p>
                          </div>
                          <span
                            className={`inline-flex gap-0.5 items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                              record.status === 'present'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                            {record.status === 'present' ? 'P' : 'A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-slate-500 text-xs">{record.timestamp}</p>
                          <div className="flex gap-0.5">
                            {record.status === 'present' && (
                              <button
                                onClick={() => markAbsent(record.id)}
                                className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-700 rounded text-xs transition-colors"
                              >
                                A
                              </button>
                            )}
                            <button
                              onClick={() => removeRecord(record.id)}
                              className="px-1.5 py-0.5 hover:bg-red-100 text-red-700 rounded text-xs transition-colors"
                            >
                              X
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {attendance.length > 0 && (
                <div className="px-4 md:px-5 py-3 border-t border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 space-y-2 flex-shrink-0">
                  <div className="grid grid-cols-2 gap-1.5 text-xs mb-2">
                    <div className="bg-green-50 px-2 py-1.5 rounded">
                      <p className="text-green-700 font-semibold">{presentCount}</p>
                      <p className="text-green-600 text-xs">Present</p>
                    </div>
                    <div className="bg-slate-100 px-2 py-1.5 rounded">
                      <p className="text-slate-700 font-semibold">{totalStudents - presentCount}</p>
                      <p className="text-slate-600 text-xs">Absent</p>
                    </div>
                  </div>
                  <button
                    onClick={submitAttendance}
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-400 text-white font-semibold py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-sm"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white"></div>
                        <span className="hidden md:inline">Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Submit</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setAttendance([]);
                      scannedRollNosRef.current.clear();
                      setLastScannedStudent(null);
                      setLastScanTime(null);
                    }}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg transition-all text-sm"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}