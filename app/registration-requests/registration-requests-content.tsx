'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { LogOut, ArrowLeft, CheckCircle, XCircle, Mail } from 'lucide-react';
import { getPendingRequests, approveStudent, rejectStudent } from '@/lib/api';

interface RegistrationRequest {
  id: string;
  name: string;
  rollNo: string;
  class: string;
  branch: string;
  email: string;
  phone: string;
  skills: string;
  teamNo: string;
  photoUrl?: string;
  studentUid: string;
  status: string;
  submittedAt: any;
}

export default function RegistrationRequestsContent() {
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [showRejectReason, setShowRejectReason] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
      loadRequests();
    }
  }, [mounted, isAdmin]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getPendingRequests();
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
      setMessage('Failed to load registration requests');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: RegistrationRequest) => {
    try {
      setProcessing(request.id);
      await approveStudent(request.id, {
        name: request.name,
        rollNo: request.rollNo,
        class: request.class,
        branch: request.branch,
        email: request.email,
        phone: request.phone,
        skills: request.skills,
        teamNo: request.teamNo,
        photoUrl: request.photoUrl,
        studentUid: request.studentUid,
      });
      setMessage(`✓ ${request.name} approved successfully!`);
      setMessageType('success');
      setRequests(requests.filter((r) => r.id !== request.id));
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error approving:', error);
      setMessage('Failed to approve student');
      setMessageType('error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: RegistrationRequest) => {
    try {
      setProcessing(request.id);
      await rejectStudent(request.id, request.studentUid, rejectReason);
      setMessage(`✗ ${request.name} rejected`);
      setMessageType('success');
      setRequests(requests.filter((r) => r.id !== request.id));
      setShowRejectReason(null);
      setRejectReason('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error rejecting:', error);
      setMessage('Failed to reject student');
      setMessageType('error');
    } finally {
      setProcessing(null);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!mounted || !isAdmin || !currentUser) {
    return <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="glass-effect-strong border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
              <ArrowLeft className="w-5 h-5 text-white/70" />
              <span className="text-white/70">Back to Dashboard</span>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-white/70 hover:text-red-300"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold text-white mb-2">Registration Requests</h1>
        <p className="text-white/60 mb-8">Review and approve student registrations</p>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 rounded-lg p-4 ${
              messageType === 'success'
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-red-500/20 border border-red-500/30'
            }`}
          >
            <p className={messageType === 'success' ? 'text-green-300' : 'text-red-300'}>
              {message}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="glass-effect-strong rounded-2xl border border-white/15 p-4 mb-8">
          <p className="text-white/70">
            <strong className="text-white">{requests.length}</strong> pending request{requests.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-white/60">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-12 text-center">
            <Mail className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No pending requests</p>
            <p className="text-white/40 text-sm mt-2">All registrations have been reviewed</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-blue-500/30 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4 flex-1">
                    {request.photoUrl && (
                      <img
                        src={request.photoUrl}
                        alt={request.name}
                        className="w-16 h-16 rounded-lg object-cover border border-white/10"
                      />
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-white">{request.name}</h3>
                      <p className="text-white/60 text-sm">Roll No: {request.rollNo}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-400 text-xs font-semibold">
                    Pending
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white/60 text-xs">Class</p>
                    <p className="text-white font-medium">{request.class}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Branch</p>
                    <p className="text-white font-medium">{request.branch}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Team No</p>
                    <p className="text-white font-medium">{request.teamNo}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Email</p>
                    <p className="text-white font-medium text-sm">{request.email}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Phone</p>
                    <p className="text-white font-medium">{request.phone}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Skills</p>
                    <p className="text-white font-medium text-sm truncate">{request.skills}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(request)}
                    disabled={processing === request.id}
                    className="flex-1 px-4 py-3 bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processing === request.id ? 'Approving...' : 'Approve'}
                  </button>

                  <button
                    onClick={() => setShowRejectReason(showRejectReason === request.id ? null : request.id)}
                    disabled={processing === request.id}
                    className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>

                {/* Reject Reason Form */}
                {showRejectReason === request.id && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Reason for rejection (optional)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Tell the student why their application was rejected..."
                      className="premium-input w-full mb-3 resize-none"
                      rows={3}
                    />
                    <button
                      onClick={() => handleReject(request)}
                      disabled={processing === request.id}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                    >
                      {processing === request.id ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
