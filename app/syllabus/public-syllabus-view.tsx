'use client';

import { useState, useEffect } from 'react';
import { Download, Share2, ChevronDown, X } from 'lucide-react';

interface SyllabusRow {
  id: string;
  day: number;
  date: string;
  topic: string;
  subtopics: string;
  mentors: string[];
  status: 'Upcoming' | 'Completed' | 'Delayed';
}

interface Mentor {
  id: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  photoUrl?: string;
  color?: string;
}

interface PublicSyllabusViewProps {
  schedule: SyllabusRow[];
  mentors: Mentor[];
  instituteInfo?: {
    name: string;
    logo?: string;
  };
  shareCode?: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Completed':
      return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
    case 'Delayed':
      return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' };
    default:
      return { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' };
  }
};

export default function PublicSyllabusView({
  schedule,
  mentors,
  instituteInfo,
  shareCode,
}: PublicSyllabusViewProps) {
  const [filteredSchedule, setFilteredSchedule] = useState<SyllabusRow[]>(schedule);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Upcoming' | 'Completed' | 'Delayed'>('All');
  const [viewMode, setViewMode] = useState<'card' | 'timeline'>('card');
  const [selectedItem, setSelectedItem] = useState<SyllabusRow | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = (imageUrl: string) => {
    setFailedImages((prev) => new Set([...prev, imageUrl]));
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleShare = () => {
    const shareText = `Check out our course syllabus!\n${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: 'Course Syllabus', text: shareText });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  useEffect(() => {
    if (filterStatus === 'All') {
      setFilteredSchedule(schedule);
    } else {
      setFilteredSchedule(schedule.filter((item) => item.status === filterStatus));
    }
  }, [filterStatus, schedule]);

  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-orange-500'];

  const getMentorColor = (mentorId: string) => {
    const idx = mentors.findIndex((m) => m.id === mentorId) % colors.length;
    return colors[idx];
  };

  const getTruncatedSubtopics = (subtopics: string) => {
    const lines = subtopics.split(',').slice(0, 2).map(s => s.trim());
    const totalCount = subtopics.split(',').length;
    return { lines, hasMore: totalCount > 2, total: totalCount };
  };

  const upcomingCount = schedule.filter((s) => s.status === 'Upcoming').length;
  const completedCount = schedule.filter((s) => s.status === 'Completed').length;
  const delayedCount = schedule.filter((s) => s.status === 'Delayed').length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-14 sm:h-16 relative">
            <div className="text-center">
              <h1 className="text-base sm:text-lg font-bold text-gray-900">Course Syllabus</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Last updated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="absolute right-0 flex items-center gap-1">
              <button onClick={handleExportPDF} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Download">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={handleShare} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Share">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters & Controls */}
      <div className="sticky top-14 sm:top-16 z-30 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex gap-3 items-center justify-between flex-col sm:flex-row">
            <div className="w-full sm:w-auto overflow-x-auto">
              <div className="flex gap-1.5 min-w-max">
                {(['All', 'Upcoming', 'Completed', 'Delayed'] as const).map((status) => {
                  let count = schedule.length;
                  if (status === 'Upcoming') count = upcomingCount;
                  else if (status === 'Completed') count = completedCount;
                  else if (status === 'Delayed') count = delayedCount;
                  return (
                    <button key={status} onClick={() => setFilterStatus(status)} className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap transition ${filterStatus === status ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {status} {status !== 'All' && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode('card')} className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded transition ${viewMode === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
                Cards
              </button>
              <button onClick={() => setViewMode('timeline')} className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded transition ${viewMode === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
                Timeline
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {filteredSchedule.length === 0 ? (
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No topics scheduled yet</h3>
                <p className="text-sm text-gray-500">Check back soon for course updates</p>
              </div>
            </div>
          ) : viewMode === 'card' ? (
            // Card View
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {filteredSchedule.map((item) => {
                const { lines: subLines, hasMore, total } = getTruncatedSubtopics(item.subtopics);
                const visibleMentors = item.mentors.slice(0, 3);
                const moreMentors = item.mentors.length - 3;
                const status = getStatusBadge(item.status);
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all hover:-translate-y-0.5"
                  >
                    {/* Top Row: Date & Status */}
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Topic Title */}
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3 line-clamp-2">
                      {item.topic}
                    </h3>

                    {/* Subtopics Preview */}
                    {item.subtopics && (
                      <div className="mb-4 pb-4 border-b border-gray-100">
                        <ul className="space-y-1.5 text-xs sm:text-sm text-gray-600">
                          {subLines.map((sub, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-500 flex-shrink-0 mt-1">→</span>
                              <span className="line-clamp-1">{sub}</span>
                            </li>
                          ))}
                        </ul>
                        {hasMore && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                            }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 mt-2"
                          >
                            View {total - 2} more →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Mentors & CTA */}
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {visibleMentors.map((mentorId) => {
                          const mentor = mentors.find((m) => m.id === mentorId);
                          const imageUrl = mentor?.avatar || mentor?.photoURL || mentor?.photoUrl;
                          const imageFailed = imageUrl && failedImages.has(imageUrl);
                          return (
                            <button
                              key={mentorId}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMentor(mentor || null);
                              }}
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white hover:scale-110 transition overflow-hidden ${!mentor?.avatar && !mentor?.photoURL && !mentor?.photoUrl ? getMentorColor(mentorId) : ''}`}
                              title={mentor?.name}
                            >
                              {imageUrl && !imageFailed ? (
                                <img 
                                  src={imageUrl}
                                  alt={mentor?.name}
                                  className="w-full h-full object-cover"
                                  onError={() => handleImageError(imageUrl)}
                                />
                              ) : (
                                mentor?.name?.charAt(0).toUpperCase()
                              )}
                            </button>
                          );
                        })}
                        {moreMentors > 0 && (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-bold border border-white text-center">
                            +{moreMentors}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-semibold"
                      >
                        Expand →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Timeline View
            <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
              {filteredSchedule.map((item, idx) => {
                const status = getStatusBadge(item.status);
                const visibleMentors = item.mentors.slice(0, 3);
                const moreMentors = item.mentors.length - 3;
                return (
                  <div
                    key={item.id}
                    className="flex gap-4 sm:gap-6"
                  >
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center flex-shrink-0 pt-1">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md ${status.dot}`}>
                      </div>
                      {idx < filteredSchedule.length - 1 && (
                        <div className="w-0.5 h-24 sm:h-32 bg-gray-300 mt-3"></div>
                      )}
                    </div>

                    {/* Timeline Card */}
                    <div
                      onClick={() => setSelectedItem(item)}
                      className="flex-1 pt-1 text-left cursor-pointer group"
                    >
                      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 hover:shadow-md hover:border-gray-300 transition-all group-hover:-translate-y-0.5">
                        {/* Date & Status */}
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs sm:text-sm font-semibold text-gray-500 uppercase">
                            {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
                            {item.status}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">
                          {item.topic}
                        </h3>

                        {/* Mentors */}
                        {item.mentors.length > 0 && (
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                            <span className="text-xs font-semibold text-gray-600 uppercase">Mentors:</span>
                            <div className="flex -space-x-2">
                              {visibleMentors.map((mentorId) => {
                                const mentor = mentors.find((m) => m.id === mentorId);
                                const imageUrl = mentor?.avatar || mentor?.photoURL || mentor?.photoUrl;
                                const imageFailed = imageUrl && failedImages.has(imageUrl);
                                return (
                                  <button
                                    key={mentorId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMentor(mentor || null);
                                    }}
                                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white hover:scale-110 transition overflow-hidden ${!mentor?.avatar && !mentor?.photoURL && !mentor?.photoUrl ? getMentorColor(mentorId) : ''}`}
                                    title={mentor?.name}
                                  >
                                    {imageUrl && !imageFailed ? (
                                      <img 
                                        src={imageUrl}
                                        alt={mentor?.name}
                                        className="w-full h-full object-cover"
                                        onError={() => handleImageError(imageUrl)}
                                      />
                                    ) : (
                                      mentor?.name?.charAt(0).toUpperCase()
                                    )}
                                  </button>
                                );
                              })}
                              {moreMentors > 0 && (
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-bold border border-white">
                                  +{moreMentors}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-96 sm:max-h-[90vh] overflow-y-auto flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-white">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">{selectedItem.topic}</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {new Date(selectedItem.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Status & Mentors */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${getStatusBadge(selectedItem.status).bg} ${getStatusBadge(selectedItem.status).text}`}>
                  {selectedItem.status}
                </span>
              </div>
              {selectedItem.mentors.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-600 mb-2.5 uppercase">Instructors</p>
                  <div className="space-y-2">
                    {selectedItem.mentors.map((mentorId) => {
                      const mentor = mentors.find((m) => m.id === mentorId);
                      const imageUrl = mentor?.avatar || mentor?.photoURL || mentor?.photoUrl;
                      const imageFailed = imageUrl && failedImages.has(imageUrl);
                      return (
                        <button
                          key={mentorId}
                          onClick={() => setSelectedMentor(mentor || null)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-100 transition text-left"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden ${!mentor?.avatar && !mentor?.photoURL && !mentor?.photoUrl ? getMentorColor(mentorId) : ''}`}>
                            {imageUrl && !imageFailed ? (
                              <img 
                                src={imageUrl}
                                alt={mentor?.name}
                                className="w-full h-full object-cover"
                                onError={() => handleImageError(imageUrl)}
                              />
                            ) : (
                              mentor?.name?.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{mentor?.name}</p>
                            <p className="text-xs text-gray-500">Instructor</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Subtopics */}
            <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">Subtopics</h3>
              <ul className="space-y-2.5">
                {selectedItem.subtopics.split(',').map((subtopic, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="text-blue-500 flex-shrink-0 font-bold">→</span>
                    <span>{subtopic.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Close Button */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <button
                onClick={() => setSelectedItem(null)}
                className="w-full px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mentor Profile Modal */}
      {selectedMentor && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedMentor(null)}
        >
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-72 sm:max-h-auto overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Mentor Profile</h2>
                <button onClick={() => setSelectedMentor(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="text-center">
                {(() => {
                  const imageUrl = selectedMentor.avatar || selectedMentor.photoURL || selectedMentor.photoUrl;
                  const imageFailed = imageUrl && failedImages.has(imageUrl);
                  return imageUrl && !imageFailed ? (
                    <img 
                      src={imageUrl}
                      alt={selectedMentor.name}
                      className="w-20 h-20 mx-auto rounded-full object-cover mb-4"
                      onError={() => handleImageError(imageUrl)}
                    />
                  ) : (
                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 ${getMentorColor(mentors.findIndex((m) => m.id === selectedMentor.id).toString())}`}>
                      {selectedMentor.name?.charAt(0).toUpperCase()}
                    </div>
                  );
                })()}
                )}
                <h3 className="text-lg font-bold text-gray-900">{selectedMentor.name}</h3>
                <p className="text-sm text-gray-500 mt-1">Instructor</p>
              </div>

              <button
                onClick={() => setSelectedMentor(null)}
                className="w-full mt-6 px-4 py-2.5 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs sm:text-sm text-gray-500">
          <p>© {new Date().getFullYear()} {instituteInfo?.name || 'Course Syllabus'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}