'use client';

import { useEffect, useState } from 'react';
import { Edit, Trash2, CheckCircle, AlertCircle, Search, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

interface Mentor {
  mentorId: string;
  name: string;
  year: string;
  email?: string;
  photoUrl: string;
  createdAt: any;
}

export default function MentorsContent() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [filteredMentors, setFilteredMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageError, setImageError] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    year: '',
    email: '',
  });

  // Load mentors with real-time updates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'mentors'), (snapshot) => {
      const mentorsList = snapshot.docs.map((doc) => ({
        mentorId: doc.id,
        ...doc.data(),
      } as Mentor));
      const sorted = mentorsList.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setMentors(sorted);
      filterMentors(sorted, searchTerm);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter mentors based on search term
  const filterMentors = (mentorsList: Mentor[], search: string) => {
    if (!search.trim()) {
      setFilteredMentors(mentorsList);
      return;
    }
    const lowerSearch = search.toLowerCase();
    setFilteredMentors(
      mentorsList.filter(
        (m) =>
          m.name.toLowerCase().includes(lowerSearch) ||
          m.year.toLowerCase().includes(lowerSearch) ||
          m.email?.toLowerCase().includes(lowerSearch)
      )
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const search = e.target.value;
    setSearchTerm(search);
    filterMentors(mentors, search);
  };

  // Handle URL input change and validate image
  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setImageUrl(url);
    setImageError('');

    if (url.trim()) {
      // Validate URL format
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        setImageError('URL must start with http:// or https://');
        setImagePreview('');
        return;
      }

      // Try to load the image
      const img = new Image();
      img.onload = () => {
        setImagePreview(url);
        setImageError('');
      };
      img.onerror = () => {
        setImageError('Unable to load image from URL');
        setImagePreview('');
      };
      img.src = url;
    } else {
      setImagePreview('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Mentor name is required');
      return;
    }

    if (!formData.year.trim()) {
      setError('Year is required');
      return;
    }

    if (!imageUrl.trim()) {
      setError('Profile image URL is required');
      return;
    }

    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }

    if (!imagePreview) {
      setError('Please wait for the image to load before submitting');
      return;
    }

    setSubmitting(true);

    try {
      if (editing) {
        // Update existing mentor
        const mentorDoc = doc(db, 'mentors', editing);
        await updateDoc(mentorDoc, {
          name: formData.name.trim(),
          year: formData.year.trim(),
          email: formData.email.trim() || null,
          photoUrl: imageUrl.trim(),
        });
        setSuccess('Mentor updated successfully!');
      } else {
        // Add new mentor
        await addDoc(collection(db, 'mentors'), {
          name: formData.name.trim(),
          year: formData.year.trim(),
          email: formData.email.trim() || null,
          photoUrl: imageUrl.trim(),
          createdAt: new Date(),
        });
        setSuccess('Mentor added successfully!');
      }

      // Reset form
      setFormData({ name: '', year: '', email: '' });
      setImageUrl('');
      setImagePreview('');
      setEditing(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving mentor:', err);
      setError('Error saving mentor. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (mentor: Mentor) => {
    setFormData({
      name: mentor.name,
      year: mentor.year,
      email: mentor.email || '',
    });
    setImageUrl(mentor.photoUrl);
    setImagePreview(mentor.photoUrl);
    setEditing(mentor.mentorId);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (mentorId: string) => {
    if (!confirm('Are you sure you want to delete this mentor?')) {
      return;
    }

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'mentors', mentorId));
      setSuccess('Mentor deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting mentor:', err);
      setError('Error deleting mentor. Please try again.');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', year: '', email: '' });
    setImageUrl('');
    setImagePreview('');
    setEditing(null);
    setError('');
    setSuccess('');
    setImageError('');
  };

  const latestMentor = mentors.length > 0 ? mentors[0] : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900">Mentors</h1>
            <button
              onClick={() => {
                handleCancel();
                setFormData({ name: '', year: '', email: '' });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              Add Mentor
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-slate-500 text-sm font-medium mb-1">Total Mentors</p>
            <p className="text-2xl font-bold text-slate-900">{mentors.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-slate-500 text-sm font-medium mb-1">Active</p>
            <p className="text-2xl font-bold text-slate-900">{mentors.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-slate-500 text-sm font-medium mb-1">Latest</p>
            <p className="text-lg font-bold text-slate-900 truncate">{latestMentor?.name || '—'}</p>
          </div>
        </div>

        {/* 2-Column Layout: 65% Left, 35% Right */}
        <div className="grid grid-cols-3 gap-6">
          {/* LEFT SIDE - Mentors List (Takes 65% = 2 columns) */}
          <div className="col-span-2">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search mentors…"
                  className="w-full px-4 py-2.5 pl-10 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                />
              </div>
            </div>

            {/* Mentors List */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-slate-500">Loading mentors…</p>
              </div>
            ) : filteredMentors.length === 0 && !searchTerm ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-900 font-semibold mb-1">No mentors yet</p>
                <p className="text-slate-500 text-sm">Click "Add Mentor" to create your first mentor profile</p>
              </div>
            ) : filteredMentors.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
                <p className="text-slate-500">No mentors match your search</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMentors.map((mentor) => (
                  <div
                    key={mentor.mentorId}
                    className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4 hover:shadow-md hover:border-slate-300 transition-all hover:scale-[1.01] cursor-pointer group"
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-blue-200 to-blue-300 border border-blue-300 flex items-center justify-center">
                      <img
                        src={mentor.photoUrl}
                        alt={mentor.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {!mentor.photoUrl && (
                        <span className="text-sm font-bold text-blue-700">
                          {mentor.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{mentor.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-200">
                          {mentor.year}
                        </span>
                        {mentor.email && (
                          <p className="text-xs text-slate-500 truncate">{mentor.email}</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(mentor)}
                        className="p-1.5 rounded-md hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-all"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(mentor.mentorId)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-slate-600 hover:text-red-600 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT SIDE - Add/Edit Panel (Takes 35% = 1 column, sticky) */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm sticky top-20">
              <h3 className="text-base font-semibold text-slate-900 mb-4">
                {editing ? 'Edit Mentor' : 'Add Mentor'}
              </h3>

              {/* Success Message */}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 animate-fade-in">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-green-700 text-xs font-medium">{success}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 text-xs font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Avatar Preview - Small Circle */}
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 border-2 border-blue-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-blue-700">
                        {formData.name.charAt(0).toUpperCase() || '👤'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Image URL */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Image URL</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={handleImageUrlChange}
                    placeholder="https://example.com/img.jpg"
                    className={`w-full px-3 py-2 text-sm bg-white border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                      imageError ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                    }`}
                  />
                  {imageError && (
                    <p className="text-red-600 text-xs mt-1">{imageError}</p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Mentor name"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                  />
                </div>

                {/* Year */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Year *</label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="e.g., 3rd Year"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="mentor@email.com"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting || !imagePreview || imageError !== ''}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
                  >
                    {submitting ? 'Saving…' : editing ? 'Update' : 'Save'}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-medium transition-all"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
