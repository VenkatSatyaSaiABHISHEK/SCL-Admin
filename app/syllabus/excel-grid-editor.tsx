'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, MoreVertical, Plus, Download, Share2, Copy, Search, RotateCcw, RotateCw, X, Eye, EyeOff, Info } from 'lucide-react';

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

interface ExcelGridEditorProps {
  mentors: Mentor[];
  onSave: (rows: SyllabusRow[]) => void;
  showMessage: (msg: string, type: 'success' | 'error') => void;
  initialData?: SyllabusRow[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Completed':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'Delayed':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
};

export default function ExcelGridEditor({
  mentors,
  onSave,
  showMessage,
  initialData = [],
}: ExcelGridEditorProps) {
  const [rows, setRows] = useState<SyllabusRow[]>(
    initialData.length > 0
      ? initialData
      : [
          {
            id: '1',
            day: 1,
            date: new Date().toISOString().split('T')[0],
            topic: '',
            subtopics: '',
            mentors: [],
            status: 'Upcoming',
          },
        ]
  );

  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    column: string;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    column: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [shareLink, setShareLink] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [actionMenuRow, setActionMenuRow] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<SyllabusRow | null>(null);
  const [mentorDropdownRow, setMentorDropdownRow] = useState<string | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const gridRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with initialData when it changes (new data loaded from Firebase)
  useEffect(() => {
    if (initialData.length > 0) {
      console.log('Syncing table with loaded data:', initialData);
      setRows(initialData);
    }
  }, [initialData]);

  // Auto-save with debounce
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    // Don't save if there are empty topics
    const hasEmptyTopics = rows.some((r) => !r.topic.trim());
    if (hasEmptyTopics) return;

    setSaveStatus('saving');

    // Debounce: wait 1.5 seconds after last change before saving
    saveTimeoutRef.current = setTimeout(() => {
      onSave(rows);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000); // Show "saved" for 2 seconds
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [rows, onSave]);

  const addRow = () => {
    const newDay = Math.max(...rows.map((r) => r.day), 0) + 1;
    const newDate = new Date(rows[rows.length - 1]?.date || new Date());
    newDate.setDate(newDate.getDate() + 1);

    const newRow: SyllabusRow = {
      id: Date.now().toString(),
      day: newDay,
      date: newDate.toISOString().split('T')[0],
      topic: '',
      subtopics: '',
      mentors: [],
      status: 'Upcoming',
    };
    setRows([...rows, newRow]);
  };

  const deleteRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
    showMessage('Row deleted', 'success');
  };

  const duplicateRow = (id: string) => {
    const rowToDuplicate = rows.find((r) => r.id === id);
    if (rowToDuplicate) {
      const newRow = {
        ...rowToDuplicate,
        id: Date.now().toString(),
      };
      const index = rows.findIndex((r) => r.id === id);
      setRows([...rows.slice(0, index + 1), newRow, ...rows.slice(index + 1)]);
    }
  };

  const moveRow = (id: string, direction: 'up' | 'down') => {
    const index = rows.findIndex((r) => r.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === rows.length - 1)
    ) {
      return;
    }

    const newRows = [...rows];
    if (direction === 'up') {
      [newRows[index], newRows[index - 1]] = [newRows[index - 1], newRows[index]];
    } else {
      [newRows[index], newRows[index + 1]] = [newRows[index + 1], newRows[index]];
    }
    setRows(newRows);
  };

  const updateCell = (rowId: string, column: keyof SyllabusRow, value: any) => {
    // Special handling for date changes to shift all following rows
    if (column === 'date') {
      const rowIndex = rows.findIndex((r) => r.id === rowId);
      if (rowIndex === -1) return;

      const oldDate = new Date(rows[rowIndex].date);
      const newDate = new Date(value);
      
      // Calculate the difference in days
      const timeDiff = newDate.getTime() - oldDate.getTime();
      const dayDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));

      // Update the current row and shift all following rows
      setRows(
        rows.map((r, idx) => {
          if (r.id === rowId) {
            // Update the row being edited with the new date
            return { ...r, date: value };
          } else if (idx > rowIndex) {
            // Shift all following rows by the same amount
            const shiftedDate = new Date(r.date);
            shiftedDate.setDate(shiftedDate.getDate() + dayDiff);
            return { ...r, date: shiftedDate.toISOString().split('T')[0] };
          }
          return r;
        })
      );
    } else {
      // For non-date columns, update normally
      setRows(rows.map((r) => (r.id === rowId ? { ...r, [column]: value } : r)));
    }
  };

  const toggleMentor = (rowId: string, mentorId: string) => {
    setRows(
      rows.map((r) => {
        if (r.id === rowId) {
          const hasMentor = r.mentors.includes(mentorId);
          return {
            ...r,
            mentors: hasMentor
              ? r.mentors.filter((m) => m !== mentorId)
              : [...r.mentors, mentorId],
          };
        }
        return r;
      })
    );
  };

  const getMentorNames = (mentorIds: string[]) => {
    return mentorIds
      .map((id) => mentors.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const handleSaveAll = () => {
    const emptyTopics = rows.filter((r) => !r.topic.trim());
    if (emptyTopics.length > 0) {
      showMessage('Please fill in all topic names', 'error');
      return;
    }
    onSave(rows);
  };

  const handleExportExcel = () => {
    const headers = ['Day', 'Date', 'Topic', 'Subtopics', 'Mentors', 'Status'];
    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.day,
          r.date,
          `"${r.topic}"`,
          `"${r.subtopics}"`,
          `"${getMentorNames(r.mentors)}"`,
          r.status,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `syllabus_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showMessage('Exported to CSV', 'success');
  };

  const handleGenerateShareLink = async () => {
    try {
      showMessage('Creating share link...', 'success');
      
      // Import Firebase functions (already imported in parent)
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // Store the schedule in Firebase with isPublic flag
      const shareData = {
        rows: rows,
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Add to 'shared-schedules' collection - Firebase auto-generates short ID
      const docRef = await addDoc(collection(db, 'shared-schedules'), shareData);
      const shareCode = docRef.id;
      
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${baseUrl}/syllabus/share/${shareCode}`;
      setShareLink(link);
      showMessage('Share link created!', 'success');
    } catch (error) {
      console.error('Error creating share link:', error);
      showMessage('Failed to create share link', 'error');
    }
  };

  const copyShareLink = () => {
    if (!shareLink) {
      showMessage('Generate a share link first', 'error');
      return;
    }
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    showMessage('Link copied to clipboard!', 'success');
  };

  const filteredRows = rows.filter(
    (row) =>
      row.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.subtopics.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'date', label: 'Date', width: 100 },
    { key: 'topic', label: 'Topic', width: 250 },
    { key: 'subtopics', label: 'Subtopics', width: 320 },
    { key: 'status', label: 'Status', width: 110 },
    { key: 'mentors', label: 'Mentors', width: 150 },
  ];

  const getTruncatedText = (text: string, maxChars: number = 50) => {
    if (text.length <= maxChars) return { full: text, truncated: text, isTruncated: false };
    return { full: text, truncated: text.slice(0, maxChars) + '...', isTruncated: true };
  };

  const openDetailModal = (row: SyllabusRow) => {
    setDetailRow(row);
    setDetailModalOpen(true);
  };

  const getMentorColor = (index: number) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-orange-500'];
    return colors[index % colors.length];
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Compact Toolbar */}
      <div className="border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-2">
        <button
          onClick={addRow}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
          title="Add row"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-300"></div>

        <button
          onClick={handleExportExcel}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
          title="Export CSV"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            handleGenerateShareLink();
            setShowShareModal(true);
          }}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>

        <button
          onClick={handleSaveAll}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
          title="Save"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
          </svg>
        </button>

        {/* Auto-save Status Indicator */}
        <div className="text-xs text-gray-500 px-2 h-6 flex items-center">
          {saveStatus === 'saving' && <span className="animate-pulse">Saving...</span>}
          {saveStatus === 'saved' && <span className="text-green-600 font-medium">✓ Saved</span>}
          {saveStatus === 'idle' && <span></span>}
        </div>

        <div className="w-px h-5 bg-gray-300"></div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={() => setPreviewCollapsed(!previewCollapsed)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
          title={previewCollapsed ? 'Show preview' : 'Hide preview'}
        >
          {previewCollapsed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Table */}
        <div className={`${previewCollapsed ? 'flex-1' : 'flex-1'} flex flex-col overflow-hidden`}>
          <div className="overflow-x-auto overflow-y-auto flex-1 border border-gray-200 rounded-lg bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <th className="w-8 px-3 py-3 text-gray-500 font-semibold text-xs border-r border-gray-200"></th>
                  <th className="px-3 py-3 text-left text-gray-700 font-semibold text-xs border-r border-gray-200 w-24">Date</th>
                  <th className="px-3 py-3 text-left text-gray-700 font-semibold text-xs border-r border-gray-200" style={{width: '250px'}}>Topic</th>
                  <th className="px-3 py-3 text-left text-gray-700 font-semibold text-xs border-r border-gray-200" style={{width: '320px'}}>Subtopics</th>
                  <th className="px-3 py-3 text-left text-gray-700 font-semibold text-xs border-r border-gray-200 w-32">Status</th>
                  <th className="px-3 py-3 text-left text-gray-700 font-semibold text-xs w-40">Mentors</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      {searchTerm ? 'No results found' : 'No rows yet. Click the + button to add one.'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-200 hover:bg-blue-50/50 transition cursor-pointer h-14 ${
                        selectedRow === row.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        setSelectedRow(row.id);
                        setDetailRow(row);
                      }}
                    >
                      <td className="w-8 px-2 py-2 text-gray-400 text-xs font-medium border-r border-gray-200 text-center bg-gray-50 group relative align-middle">
                        <div className="flex items-center justify-center">
                          {idx + 1}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuRow(actionMenuRow === row.id ? null : row.id);
                            }}
                            className="ml-1 p-0.5 rounded hover:bg-gray-300 opacity-0 group-hover:opacity-100 transition"
                          >
                            <MoreVertical className="w-3.5 h-3.5 text-gray-600" />
                          </button>

                          {actionMenuRow === row.id && (
                            <div className="absolute left-8 top-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-max text-sm">
                              <button onClick={(e) => { e.stopPropagation(); openDetailModal(row); setActionMenuRow(null); }} className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-700 first:rounded-t-lg">View Details</button>
                              <button onClick={(e) => { e.stopPropagation(); duplicateRow(row.id); setActionMenuRow(null); }} className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-700">Duplicate</button>
                              <button onClick={(e) => { e.stopPropagation(); moveRow(row.id, 'up'); setActionMenuRow(null); }} className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-700">Move up</button>
                              <button onClick={(e) => { e.stopPropagation(); moveRow(row.id, 'down'); setActionMenuRow(null); }} className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-700">Move down</button>
                              <div className="border-t border-gray-200"></div>
                              <button onClick={(e) => { e.stopPropagation(); deleteRow(row.id); setActionMenuRow(null); }} className="block w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 last:rounded-b-lg">Delete</button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2 border-r border-gray-200 text-gray-700 bg-white align-middle">
                        {editingCell?.rowId === row.id && editingCell?.column === 'date' ? (
                          <input
                            autoFocus
                            type="date"
                            value={row.date}
                            onChange={(e) => updateCell(row.id, 'date', e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)}
                            className="w-full px-2 py-1 text-xs border border-blue-400 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ rowId: row.id, column: 'date' });
                            }}
                            title={row.date}
                          >
                            {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </td>

                      {/* Topic - 1 line truncated */}
                      <td className="px-3 py-2 border-r border-gray-200 text-gray-700 bg-white align-middle">
                        {editingCell?.rowId === row.id && editingCell?.column === 'topic' ? (
                          <input
                            autoFocus
                            type="text"
                            value={row.topic}
                            onChange={(e) => updateCell(row.id, 'topic', e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)}
                            className="w-full px-2 py-1 text-xs border border-blue-400 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="line-clamp-1 cursor-default hover:underline"
                            title={row.topic || 'Click to view full details'}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ rowId: row.id, column: 'topic' });
                            }}
                          >
                            {row.topic || '—'}
                          </span>
                        )}
                      </td>

                      {/* Subtopics - 2 lines truncated with line-clamp */}
                      <td className="px-3 py-2 border-r border-gray-200 text-gray-700 bg-white align-middle overflow-hidden">
                        {editingCell?.rowId === row.id && editingCell?.column === 'subtopics' ? (
                          <textarea
                            autoFocus
                            value={row.subtopics}
                            onChange={(e) => updateCell(row.id, 'subtopics', e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            className="w-full px-2 py-1 text-xs border border-blue-400 rounded resize-none"
                            rows={3}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div
                            className="text-xs text-gray-700 cursor-default hover:text-blue-600 transition overflow-hidden"
                            title={row.subtopics || 'No subtopics. Click to view full details'}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ rowId: row.id, column: 'subtopics' });
                            }}
                          >
                            {row.subtopics ? (
                              <div className="flex flex-col gap-0.5 max-h-10 overflow-hidden">
                                {row.subtopics.split(',').slice(0, 2).map((sub, idx) => (
                                  <div key={idx} className="flex items-center gap-1 min-h-max">
                                    <span className="text-blue-500 flex-shrink-0">•</span>
                                    <span className="truncate inline-block">{sub.trim()}</span>
                                  </div>
                                ))}
                                {row.subtopics.split(',').length > 2 && (
                                  <span className="text-gray-500 text-xs">+{row.subtopics.split(',').length - 2} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2 border-r border-gray-200 bg-white align-middle">
                        {editingCell?.rowId === row.id && editingCell?.column === 'status' ? (
                          <select
                            autoFocus
                            value={row.status}
                            onChange={(e) => {
                              updateCell(row.id, 'status', e.target.value);
                              setEditingCell(null);
                            }}
                            onBlur={() => setEditingCell(null)}
                            className="w-full px-2 py-1 text-xs border border-blue-400 rounded"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option>Upcoming</option>
                            <option>Completed</option>
                            <option>Delayed</option>
                          </select>
                        ) : (
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ rowId: row.id, column: 'status' });
                            }}
                            className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(row.status)}`}
                          >
                            {row.status}
                          </div>
                        )}
                      </td>

                      {/* Mentors - Avatar group */}
                      <td className="px-3 py-2 bg-white relative align-middle">
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2">
                            {row.mentors.length === 0 ? (
                              <span className="text-xs text-gray-400">None</span>
                            ) : (
                              <>
                                {row.mentors.slice(0, 3).map((mentorId) => {
                                  const mentor = mentors.find((m) => m.id === mentorId);
                                  const mentorIdx = mentors.findIndex((m) => m.id === mentorId);
                                  return (
                                    <div
                                      key={mentorId}
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white shadow-sm overflow-hidden ${!mentor?.avatar && !mentor?.photoURL && !mentor?.photoUrl ? getMentorColor(mentorIdx) : ''}`}
                                      title={mentor?.name}
                                    >
                                      {mentor?.avatar || mentor?.photoURL || mentor?.photoUrl ? (
                                        <img 
                                          src={mentor.avatar || mentor.photoURL || mentor.photoUrl}
                                          alt={mentor?.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        mentor?.name?.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                  );
                                })}
                                {row.mentors.length > 3 && (
                                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold border border-white">
                                    +{row.mentors.length - 3}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMentorDropdownRow(mentorDropdownRow === row.id ? null : row.id);
                            }}
                            className="p-1 rounded hover:bg-gray-100 text-gray-600 ml-2"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          {/* Mentor Selector Dropdown */}
                          {mentorDropdownRow === row.id && (
                            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-max max-h-64 overflow-y-auto top-full">
                              {mentors.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-500">No mentors available</div>
                              ) : (
                                mentors.map((mentor) => (
                                  <button
                                    key={mentor.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMentor(row.id, mentor.id);
                                    }}
                                    className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition flex items-center gap-2 ${
                                      row.mentors.includes(mentor.id) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                    }`}
                                  >
                                    <span className="mr-1">{row.mentors.includes(mentor.id) ? '✓' : '○'}</span>
                                    {(mentor.avatar || mentor.photoURL || mentor.photoUrl) && (
                                      <img 
                                        src={mentor.avatar || mentor.photoURL || mentor.photoUrl}
                                        alt={mentor.name}
                                        className="w-4 h-4 rounded-full object-cover"
                                      />
                                    )}
                                    {mentor.name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Details modal button hint */}
          {selectedRow && detailRow && (
            <button
              onClick={() => openDetailModal(detailRow)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <Info className="w-3 h-3" />
              Click row or press 'View Details' for full content (topic, subtopics, mentors)
            </button>
          )}
        </div>

        {/* Premium Preview Panel - Smaller & Collapsible */}
        {!previewCollapsed && selectedRow && detailRow && (
          <div className="w-80 flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 text-sm">Preview</h3>
              <button onClick={() => setPreviewCollapsed(true)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              {/* Date */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</label>
                <p className="text-sm text-gray-900 font-medium mt-1">
                  {new Date(detailRow.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</label>
                <div className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusColor(detailRow.status)}`}>
                  {detailRow.status}
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Topic</label>
                <p className="text-sm text-gray-900 font-semibold mt-1">{detailRow.topic || 'No topic'}</p>
              </div>

              {/* Subtopics preview - first 4 lines only */}
              {detailRow.subtopics && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Subtopics</label>
                  <ul className="text-xs text-gray-700 mt-1 space-y-1">
                    {detailRow.subtopics.split(',').slice(0, 4).map((sub, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-500 flex-shrink-0 mt-0.5">→</span>
                        <span className="line-clamp-2">{sub.trim()}</span>
                      </li>
                    ))}
                  </ul>
                  {detailRow.subtopics.split(',').length > 4 && (
                    <button
                      onClick={() => openDetailModal(detailRow)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 mt-2"
                    >
                      View all subtopics →
                    </button>
                  )}
                </div>
              )}

              {/* Mentors */}
              {detailRow.mentors.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Instructors</label>
                  <div className="mt-2 space-y-1.5">
                    {detailRow.mentors.map((mentorId) => {
                      const mentor = mentors.find((m) => m.id === mentorId);
                      const mentorIdx = mentors.findIndex((m) => m.id === mentorId);
                      return (
                        <div key={mentorId} className="flex items-center gap-2 p-2 rounded bg-gray-50">
                          {mentor?.avatar || mentor?.photoURL || mentor?.photoUrl ? (
                            <img 
                              src={mentor?.avatar || mentor?.photoURL || mentor?.photoUrl}
                              alt={mentor?.name}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getMentorColor(mentorIdx)}`}>
                              {mentor?.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900">{mentor?.name}</p>
                            <p className="text-xs text-gray-500">Instructor</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Open details button */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => openDetailModal(detailRow)}
                className="w-full px-3 py-2 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition"
              >
                View Full Details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailModalOpen && detailRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 px-6 py-4 border-b border-gray-200 bg-white flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{detailRow.topic}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(detailRow.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Status</label>
                <div className={`inline-block px-3 py-1.5 text-sm  font-semibold rounded-full mt-2 ${getStatusColor(detailRow.status)}`}>
                  {detailRow.status}
                </div>
              </div>

              {/* Subtopics */}
              {detailRow.subtopics && (
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 block">Subtopics</label>
                  <ul className="space-y-2">
                    {detailRow.subtopics.split(',').map((sub, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                        <span className="text-blue-500 flex-shrink-0 font-bold">→</span>
                        <span>{sub.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mentors */}
              {detailRow.mentors.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 block">Instructors</label>
                  <div className="space-y-2">
                    {detailRow.mentors.map((mentorId) => {
                      const mentor = mentors.find((m) => m.id === mentorId);
                      const mentorIdx = mentors.findIndex((m) => m.id === mentorId);
                      return (
                        <div key={mentorId} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                          {mentor?.avatar || mentor?.photoURL || mentor?.photoUrl ? (
                            <img 
                              src={mentor?.avatar || mentor?.photoURL || mentor?.photoUrl}
                              alt={mentor?.name}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${getMentorColor(mentorIdx)}`}>
                              {mentor?.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{mentor?.name}</p>
                            <p className="text-xs text-gray-500">Instructor</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-2">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Share Syllabus</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">Share Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={copyShareLink}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      linkCopied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {linkCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <button
                onClick={() => window.open(shareLink, '_blank')}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-semibold transition"
              >
                Open in new tab
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="mt-4 w-full px-3 py-2.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
