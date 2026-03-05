'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Clock, MapPin, CheckCircle, AlertCircle, MessageSquare, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

interface Message {
  id: string;
  type: 'attendance' | 'announcement' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

export default function MessagesContent() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [attendanceSession, setAttendanceSession] = useState<any>(null);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'closed' | 'inactive'>('inactive');

  useEffect(() => {
    // Load system messages (no auth needed - static demo messages)
    loadMessages();
  }, []);

  useEffect(() => {
    // Wait for authentication before setting up Firestore listener
    if (authLoading) {
      console.log('🔄 Messages PWA: Waiting for auth...');
      return;
    }
    
    if (!currentUser) {
      console.log('❌ Messages PWA: No user, skipping listener setup');
      return;
    }
    
    console.log('✅ Messages PWA: Auth ready, setting up listener for user:', currentUser.rollNo || currentUser.email);
    setupAttendanceListener();
  }, [authLoading, currentUser]);

  const setupAttendanceListener = () => {
    const today = new Date().toISOString().split('T')[0];
    const sessionRef = doc(db, 'attendanceSessions', today);
    
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setAttendanceSession(data);
        
        const now = new Date();
        const todayString = now.toISOString().split('T')[0];
        
        // Create proper Date objects for time comparison
        const currentDateTime = now;
        const startDateTime = data.startTime ? 
          new Date(todayString + 'T' + data.startTime) : null;
        const endDateTime = data.endTime ? 
          new Date(todayString + 'T' + data.endTime) : null;
        
        let newStatus: 'active' | 'closed' | 'inactive' = 'inactive';
        
        if (!data.isActive) {
          newStatus = 'inactive';
        } else if (endDateTime && currentDateTime > endDateTime) {
          newStatus = 'closed';
        } else if (startDateTime && currentDateTime >= startDateTime) {
          newStatus = 'active';
        } else {
          newStatus = 'inactive';
        }
        
        setSessionStatus(newStatus);
        
        // Add real-time message for session changes
        if (newStatus === 'active' && sessionStatus !== 'active') {
          addSystemMessage('🎯 Attendance Session Started', 
            'A new attendance session is now active. Click to mark your attendance.', 'high');
        }
      } else {
        setAttendanceSession(null);
        setSessionStatus('inactive');
      }
    });

    return () => unsubscribe();
  };

  const loadMessages = () => {
    // Generate some system messages
    const systemMessages: Message[] = [
      {
        id: '1',
        type: 'system',
        title: 'Welcome to SCL Admin System',
        message: 'Your student account is active. You can now mark attendance using GPS location.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        read: false,
        priority: 'medium'
      },
      {
        id: '2',
        type: 'announcement',
        title: 'Location Permission Required',
        message: 'Please enable location permission in your browser to mark attendance. This ensures you are within the campus radius.',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        read: false,
        priority: 'high'
      },
      {
        id: '3',
        type: 'system',
        title: 'New Features Available',
        message: 'We have added real-time attendance tracking and improved location accuracy. Update the app for the best experience.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        read: true,
        priority: 'low'
      }
    ];
    
    setMessages(systemMessages);
  };

  const addSystemMessage = (title: string, message: string, priority: 'high' | 'medium' | 'low') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      title,
      message,
      timestamp: new Date(),
      read: false,
      priority
    };
    
    setMessages(prev => [newMessage, ...prev]);
  };

  const markAsRead = (messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, read: true } : msg
      )
    );
  };

  const getIcon = (type: string, priority: string) => {
    if (type === 'attendance') return <MapPin className="w-5 h-5 text-green-600" />;
    if (priority === 'high') return <AlertCircle className="w-5 h-5 text-red-600" />;
    return <Bell className="w-5 h-5 text-blue-600" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Messages & Alerts</h1>
              <p className="text-sm text-gray-600">
                {unreadCount > 0 ? `${unreadCount} unread messages` : 'All messages read'}
              </p>
            </div>
          </div>
          <MessageSquare className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Live Attendance Status */}
      {sessionStatus === 'active' && attendanceSession && (
        <div className="mx-4 mt-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">🚨 URGENT: Attendance Session Active!</h3>
              <p className="text-green-100 text-sm">Action required now</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Until {attendanceSession.endTime}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Campus location required</span>
            </div>
          </div>

          <button 
            onClick={() => router.push('/pwa/attendance')}
            className="w-full bg-white text-green-600 font-semibold py-3 rounded-xl hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Mark Attendance Now
          </button>
        </div>
      )}

      {/* Messages List */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Messages</h2>
          <span className="text-sm text-gray-600">{messages.length} messages</span>
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No messages yet</p>
            <p className="text-sm text-gray-400">Check back later for updates</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                onClick={() => markAsRead(message.id)}
                className={`border rounded-xl p-4 transition-colors cursor-pointer hover:shadow-md ${getPriorityColor(message.priority)} ${!message.read ? 'ring-2 ring-blue-200' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(message.type, message.priority)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-semibold text-gray-900 ${!message.read ? 'text-blue-900' : ''}`}>
                        {message.title}
                      </h3>
                      {!message.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm mt-1 leading-relaxed">
                      {message.message}
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{message.timestamp.toLocaleString()}</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        message.priority === 'high' ? 'bg-red-100 text-red-800' :
                        message.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {message.priority}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        message.type === 'attendance' ? 'bg-green-100 text-green-800' :
                        message.type === 'announcement' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {message.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 space-y-3">
          <h3 className="font-semibold text-gray-900">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => router.push('/pwa/attendance')}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
            >
              <MapPin className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Mark Attendance</p>
                <p className="text-sm text-gray-600">Submit your location for today's session</p>
              </div>
            </button>
            
            <button
              onClick={() => router.push('/pwa/home')}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
            >
              <Calendar className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Back to Dashboard</p>
                <p className="text-sm text-gray-600">Return to home screen</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}