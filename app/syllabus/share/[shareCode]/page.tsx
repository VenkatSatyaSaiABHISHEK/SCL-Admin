'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import PublicSyllabusView from '../../public-syllabus-view';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

interface Mentor {
  id: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  photoUrl?: string;
  color?: string;
}

interface SyllabusRow {
  id: string;
  day: number;
  date: string;
  topic: string;
  subtopics: string;
  mentors: string[];
  status: 'Upcoming' | 'Completed' | 'Delayed';
}

// Fallback mentors (quick display while Firebase loads)
const FALLBACK_MENTORS: Mentor[] = [
  { id: '1', name: 'Mentor 1' },
  { id: '2', name: 'Mentor 2' },
  { id: '3', name: 'Mentor 3' },
  { id: '4', name: 'Mentor 4' },
];

// Cache for mentors to prevent re-fetching
let mentorCache: Mentor[] | null = null;
let mentorCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function SharePage() {
  const params = useParams();
  const shareCode = params?.shareCode as string;
  const [schedule, setSchedule] = useState<SyllabusRow[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>(FALLBACK_MENTORS);
  const [loading, setLoading] = useState(true);

  // Fetch schedule from Firebase (always gets fresh data)
  useEffect(() => {
    const loadSchedule = async () => {
      if (!shareCode) {
        setLoading(false);
        return;
      }

      try {
        // First try: Check if it's a new format (short Firebase ID)
        const docRef = doc(db, 'shared-schedules', shareCode);
        const docSnapshot = await getDoc(docRef);

        if (docSnapshot.exists()) {
          // New format found in Firebase
          const data = docSnapshot.data();
          const rows = Array.isArray(data.rows) ? data.rows : [data.rows];
          console.log('Loaded shared schedule from Firebase (new format):', rows);
          setSchedule(rows);
        } else {
          // Try old format: decode from URL base64
          try {
            const decodedCode = decodeURIComponent(shareCode);
            const decodedData = JSON.parse(atob(decodedCode));
            const rows = Array.isArray(decodedData) ? decodedData : [decodedData];
            console.log('Loaded shared schedule from URL (old format):', rows);
            setSchedule(rows);
          } catch (decodeError) {
            console.error('Share code invalid (not Firebase ID or valid base64):', shareCode);
            setSchedule([]);
          }
        }
      } catch (error) {
        console.error('Error loading shared schedule:', error);
        setSchedule([]);
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, [shareCode]);

  // Fetch mentors in parallel (with caching)
  useEffect(() => {
    const loadMentors = async () => {
      // Check if cache is still valid
      if (mentorCache && Date.now() - mentorCacheTime < CACHE_DURATION) {
        setMentors(mentorCache);
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, 'mentors'));
        const mentorsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          // Check for multiple possible image field names (case-insensitive variations)
          const imageUrl = data.photoUrl || data.photoURL || data.avatar || data.photo || data.image || data.profileImage;
          console.log(`Mentor ${data.name}:`, { 
            id: doc.id, 
            name: data.name,
            photoUrl: data.photoUrl,
            photoURL: data.photoURL,
            avatar: data.avatar,
            imageUrl: imageUrl
          });
          return {
            id: doc.id,
            ...data,
            photoURL: imageUrl, // Normalize to photoURL
            photoUrl: imageUrl, // Also set photoUrl
          } as Mentor;
        });
        
        console.log('All mentors loaded:', mentorsData); 
        
        // Update cache
        mentorCache = mentorsData;
        mentorCacheTime = Date.now();
        
        setMentors(mentorsData);
      } catch (error) {
        console.error('Error loading mentors:', error);
        // Keep fallback mentors
        setMentors(FALLBACK_MENTORS);
      } finally {
        setLoading(false);
      }
    };

    loadMentors();
  }, []);

  if (!schedule.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Invalid share link</h3>
          <p className="text-sm text-gray-500">The syllabus data could not be loaded</p>
        </div>
      </div>
    );
  }

  return (
    <PublicSyllabusView
      schedule={schedule}
      mentors={mentors}
      instituteInfo={{
        name: 'Course Syllabus',
      }}
      shareCode={shareCode}
    />
  );
}
