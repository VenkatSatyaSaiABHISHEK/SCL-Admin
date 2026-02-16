'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { LogOut, ArrowLeft, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query } from 'firebase/firestore';

export default function AnnouncementsContent() {
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load announcements from Firestore
  useEffect(() => {
    if (!mounted || !isAdmin) return;

    const loadAnnouncements = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const announceList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAnnouncements(announceList);
      } catch (error) {
        console.error('Error loading announcements:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
  }, [mounted, isAdmin]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  useEffect(() => {
    if (mounted && !isAdmin) {
      router.push('/login');
    }
  }, [mounted, isAdmin, router]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setPosting(true);
    try {
      const newAnnouncement = {
        title,
        message,
        timestamp: new Date(),
        createdBy: currentUser?.email || 'admin',
      };

      const docRef = await addDoc(collection(db, 'announcements'), newAnnouncement);
      
      setAnnouncements([
        { id: docRef.id, ...newAnnouncement },
        ...announcements,
      ]);
      setTitle('');
      setMessage('');
      setShowForm(false);
    } catch (error) {
      console.error('Error posting announcement:', error);
      alert('Failed to post announcement');
    } finally {
      setPosting(false);
    }
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold text-white mb-2">Announcements</h1>
        <p className="text-white/60 mb-8">Create and manage announcements for students</p>

        {/* Post New Announcement */}
        <div className="glass-effect-strong rounded-2xl border border-white/15 p-6 mb-8">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="premium-btn-primary w-full"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create New Announcement
            </button>
          ) : (
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title"
                  className="premium-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your announcement..."
                  rows={4}
                  className="premium-input w-full resize-none"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="premium-btn-primary"
                  disabled={posting}
                >
                  {posting ? 'Posting...' : 'Post Announcement'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="glass-effect-strong rounded-2xl border border-white/15 p-12 text-center">
              <MessageSquare className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/60 text-lg">No announcements yet</p>
              <p className="text-white/40 text-sm mt-2">Create your first announcement to get started</p>
            </div>
          ) : (
            announcements.map((ann) => (
              <div
                key={ann.id}
                className="glass-effect-strong rounded-2xl border border-white/15 p-6 hover:border-blue-500/30 transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{ann.title}</h3>
                    <p className="text-white/70 mb-3">{ann.message}</p>
                    <p className="text-white/50 text-sm">
                      Posted on {ann.timestamp?.toDate?.()?.toLocaleDateString() || 'N/A'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'announcements', ann.id));
                        setAnnouncements(announcements.filter((a) => a.id !== ann.id));
                      } catch (error) {
                        console.error('Error deleting announcement:', error);
                        alert('Failed to delete announcement');
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-white/70 hover:text-red-300"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
