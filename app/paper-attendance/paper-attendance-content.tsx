'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, Eye, CheckSquare, Square, Plus, X } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Student {
  id: string;
  rollNo: string;
  name: string;
  branch: string;
  year: string;
  section: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  time: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  presentStudents: string[];
  absentStudents: string[];
  timestamp: any;
}

export default function PaperAttendanceContent() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // Filters
  const [yearFilter, setYearFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'take' | 'history'>('take');

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  // Get unique values for filters
  const years = [...new Set(students.map(s => s.year))];
  const branches = [...new Set(students.map(s => s.branch))];
  const sections = [...new Set(students.map(s => s.section))];

  // Filter students
  const filteredStudents = students.filter(s => {
    if (yearFilter && s.year !== yearFilter) return false;
    if (branchFilter && s.branch !== branchFilter) return false;
    if (sectionFilter && s.section !== sectionFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!s.rollNo.toLowerCase().includes(search) && !s.name.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      console.log('📂 Reading file:', file.name);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          console.log('📝 File loaded, parsing...');
          
          const workbook = XLSX.read(data, { type: 'binary' });
          console.log('📊 Workbook parsed, sheets:', workbook.SheetNames);
          
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
          
          console.log('📋 Raw data:', jsonData);

          // Parse students from Excel
          const parsedStudents = jsonData.map((row, idx) => ({
            id: `student-${idx}`,
            rollNo: String(row['Roll No'] || row['rollNo'] || row['R No'] || '').trim(),
            name: String(row['Student Name'] || row['name'] || row['Name'] || '').trim(),
            branch: String(row['Branch'] || row['branch'] || '').trim(),
            year: String(row['Year'] || row['year'] || '').trim(),
            section: String(row['Section'] || row['section'] || '').trim(),
          })).filter(s => s.rollNo && s.name);

          console.log('✨ Parsed students:', parsedStudents);

          setStudents(parsedStudents);
          // Initialize all as absent
          const initialStatus: Record<string, boolean> = {};
          parsedStudents.forEach(s => {
            initialStatus[s.id] = false;
          });
          setAttendanceStatus(initialStatus);
          
          showMessage(`✅ Loaded ${parsedStudents.length} students successfully!`, 'success');
        } catch (error) {
          console.error('Parse error:', error);
          showMessage('❌ Error parsing Excel file: ' + (error as any).message, 'error');
        } finally {
          setLoading(false);
          // Reset input to allow re-upload of same file
          e.target.value = '';
        }
      };
      
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('File read error:', error);
      showMessage('❌ Error reading file: ' + (error as any).message, 'error');
      setLoading(false);
    }
  };

  // Toggle student attendance
  const toggleStudent = (studentId: string) => {
    setAttendanceStatus(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // Mark all present
  const markAllPresent = () => {
    const newStatus: Record<string, boolean> = {};
    filteredStudents.forEach(s => {
      newStatus[s.id] = true;
    });
    setAttendanceStatus(prev => ({ ...prev, ...newStatus }));
  };

  // Clear all
  const clearAll = () => {
    const newStatus: Record<string, boolean> = {};
    filteredStudents.forEach(s => {
      newStatus[s.id] = false;
    });
    setAttendanceStatus(prev => ({ ...prev, ...newStatus }));
  };

  // Submit attendance
  const submitAttendance = async () => {
    if (students.length === 0) {
      showMessage('❌ No students loaded', 'error');
      return;
    }

    try {
      setLoading(true);

      const presentStudents = filteredStudents.filter(s => attendanceStatus[s.id]);
      const absentStudents = filteredStudents.filter(s => !attendanceStatus[s.id]);

      const today = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString();

      // Check if attendance already taken today
      const existingQuery = query(
        collection(db, 'attendance'),
        where('date', '==', today)
      );
      const existingDocs = await getDocs(existingQuery);

      if (existingDocs.size > 0) {
        showMessage('⚠️ Attendance already taken for today!', 'error');
        setLoading(false);
        return;
      }

      // Save to Firestore
      const attendanceRecord = {
        date: today,
        time: time,
        totalStudents: filteredStudents.length,
        presentCount: presentStudents.length,
        absentCount: absentStudents.length,
        presentStudents: presentStudents.map(s => `${s.rollNo} - ${s.name}`),
        absentStudents: absentStudents.map(s => `${s.rollNo} - ${s.name}`),
        timestamp: Timestamp.now(),
      };

      await addDoc(collection(db, 'attendance'), attendanceRecord);

      showMessage('✅ Attendance submitted successfully!', 'success');
      loadAttendanceRecords();
      
      // Reset
      const resetStatus: Record<string, boolean> = {};
      students.forEach(s => {
        resetStatus[s.id] = false;
      });
      setAttendanceStatus(resetStatus);
    } catch (error) {
      showMessage('❌ Error submitting attendance', 'error');
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load attendance records
  const loadAttendanceRecords = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'attendance'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRecord[];
      setRecords(data.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
    } catch (error) {
      console.error('Load records error:', error);
    }
  };

  // Delete record
  const deleteRecord = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    
    try {
      await deleteDoc(doc(db, 'attendance', recordId));
      showMessage('✅ Record deleted', 'success');
      loadAttendanceRecords();
    } catch (error) {
      showMessage('❌ Error deleting record', 'error');
    }
  };

  // Export attendance as Excel
  const exportToExcel = (record: AttendanceRecord) => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', record.date],
      ['Time', record.time],
      [],
      ['PRESENT STUDENTS'],
      ...record.presentStudents.map(s => [s]),
      [],
      ['ABSENT STUDENTS'],
      ...record.absentStudents.map(s => [s]),
      [],
      ['Summary'],
      ['Total Students', record.totalStudents],
      ['Present', record.presentCount],
      ['Absent', record.absentCount],
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `Attendance-${record.date}.xlsx`);
  };

  // Export as PDF
  const exportToPDF = (record: AttendanceRecord) => {
    const pdf = new jsPDF() as any;
    
    pdf.setFontSize(16);
    pdf.text(`Attendance Report - ${record.date}`, 14, 15);
    
    pdf.setFontSize(10);
    pdf.text(`Time: ${record.time}`, 14, 25);

    const presentData = record.presentStudents.map(s => [s]);
    const absentData = record.absentStudents.map(s => [s]);

    pdf.setFontSize(12);
    pdf.text('PRESENT STUDENTS', 14, 40);
    pdf.autoTable({
      head: [['Student']],
      body: presentData,
      startY: 45,
      margin: { left: 14, right: 14 }
    });

    const absentStartY = pdf.lastAutoTable.finalY + 10;
    pdf.setFontSize(12);
    pdf.text('ABSENT STUDENTS', 14, absentStartY);
    pdf.autoTable({
      head: [['Student']],
      body: absentData,
      startY: absentStartY + 5,
      margin: { left: 14, right: 14 }
    });

    const summaryY = pdf.lastAutoTable.finalY + 10;
    pdf.setFontSize(11);
    pdf.text(`Total: ${record.totalStudents} | Present: ${record.presentCount} | Absent: ${record.absentCount}`, 14, summaryY);

    pdf.save(`Attendance-${record.date}.pdf`);
  };

  // Load records on mount
  useEffect(() => {
    loadAttendanceRecords();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">📋 Paper Attendance</h1>
        <p className="text-gray-600">College attendance register management system</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-white rounded-lg p-2 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('take')}
          className={`px-6 py-2 rounded font-semibold transition ${
            activeTab === 'take' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Take Attendance
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-2 rounded font-semibold transition ${
            activeTab === 'history' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          History
        </button>
      </div>

      {/* TAKE ATTENDANCE TAB */}
      {activeTab === 'take' && (
        <div className="space-y-6">
          {/* File Upload */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="flex items-center justify-center w-full border-2 border-dashed border-blue-300 rounded-lg p-8 cursor-pointer hover:border-blue-500 transition">
              <div className="text-center">
                <Upload className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                <p className="text-green-600 font-semibold mb-1">Click to upload Excel file</p>
                <p className="text-gray-500 text-sm">(.xlsx) with Roll No, Name, Branch, Year, Section</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {students.length > 0 && (
            <>
              {/* Filters */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">🔍 Filters & Search</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">📅 All Years</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>

                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">🏢 All Branches</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>

                  <select
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">👥 All Sections</option>
                    {sections.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                  </select>

                  <input
                    type="text"
                    placeholder="🔎 Roll No or Name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Attendance Stats & Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{filteredStudents.length}</p>
                    <p className="text-sm text-gray-600">Total</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {filteredStudents.filter(s => attendanceStatus[s.id]).length}
                    </p>
                    <p className="text-sm text-gray-600">Present</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {filteredStudents.filter(s => !attendanceStatus[s.id]).length}
                    </p>
                    <p className="text-sm text-gray-600">Absent</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {filteredStudents.length > 0 
                        ? Math.round((filteredStudents.filter(s => attendanceStatus[s.id]).length / filteredStudents.length) * 100)
                        : 0}%
                    </p>
                    <p className="text-sm text-gray-600">Attendance</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={markAllPresent}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Mark All Present
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Clear All
                  </button>
                  <button
                    onClick={submitAttendance}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Submit Attendance
                  </button>
                </div>
              </div>

              {/* Attendance Register */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <h2 className="text-lg font-bold text-gray-900 p-6 border-b">📖 Attendance Register</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Roll No</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Branch</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Present</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, idx) => (
                        <tr
                          key={student.id}
                          className={`border-b hover:bg-gray-50 transition ${
                            attendanceStatus[student.id] ? 'bg-green-50' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-700">{idx + 1}</td>
                          <td className="px-4 py-3 text-gray-900 font-semibold">{student.rollNo}</td>
                          <td className="px-4 py-3 text-gray-700">{student.name}</td>
                          <td className="px-4 py-3 text-gray-600">{student.branch}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleStudent(student.id)}
                              className="inline-flex"
                            >
                              {attendanceStatus[student.id] ? (
                                <CheckSquare className="w-5 h-5 text-green-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">📚 Attendance History</h2>
          
          {records.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 text-lg">No attendance records yet</p>
            </div>
          ) : (
            records.map(record => (
              <div key={record.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">{record.date}</h3>
                      <p className="text-blue-100">Time: {record.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">{record.presentCount}/{record.totalStudents}</p>
                      <p className="text-blue-100">Present</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-green-700 font-semibold text-lg">{record.presentCount}</p>
                      <p className="text-green-600 text-sm">Present</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-red-700 font-semibold text-lg">{record.absentCount}</p>
                      <p className="text-red-600 text-sm">Absent</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-blue-700 font-semibold text-lg">
                        {Math.round((record.presentCount / record.totalStudents) * 100)}%
                      </p>
                      <p className="text-blue-600 text-sm">Attendance %</p>
                    </div>
                  </div>

                  {/* Present Students */}
                  <div className="mb-6">
                    <h4 className="font-bold text-green-700 mb-3">✓ Present ({record.presentStudents.length})</h4>
                    <div className="bg-green-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <ul className="space-y-1 text-sm text-gray-700">
                        {record.presentStudents.map((student, idx) => (
                          <li key={idx}>• {student}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Absent Students */}
                  <div className="mb-6">
                    <h4 className="font-bold text-red-700 mb-3">✗ Absent ({record.absentStudents.length})</h4>
                    <div className="bg-red-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <ul className="space-y-1 text-sm text-gray-700">
                        {record.absentStudents.map((student, idx) => (
                          <li key={idx}>• {student}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => exportToExcel(record)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export Excel
                    </button>
                    <button
                      onClick={() => exportToPDF(record)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export PDF
                    </button>
                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
