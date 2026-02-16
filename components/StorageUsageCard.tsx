'use client';

import { useEffect, useState } from 'react';
import { HardDrive, Database, ArrowRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';

interface StorageData {
  firestoreDocuments: number;
  firestoreEstimatedSize: number;
  firestoreSizeFormatted: string;
  firestorePercentage: number;
  firestoreRemaining: string;
  loading: boolean;
  error: string | null;
}

export default function StorageUsageCard() {
  const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024; // 5GB estimated limit for reference
  const COLLECTIONS = ['students', 'attendance', 'announcements', 'syllabus', 'teams', 'teamScores', 'registrationRequests'];
  
  const [data, setData] = useState<StorageData>({
    firestoreDocuments: 0,
    firestoreEstimatedSize: 0,
    firestoreSizeFormatted: '0 MB',
    firestorePercentage: 0,
    firestoreRemaining: '0 MB',
    loading: true,
    error: null,
  });

  const fetchStorageData = async () => {
    try {
      let totalDocuments = 0;
      let estimatedSize = 0;

      for (const collectionName of COLLECTIONS) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          const docCount = snapshot.size;
          totalDocuments += docCount;
          // Rough estimate: ~1.5KB per document on average
          estimatedSize += docCount * 1500;
        } catch (err) {
          console.error(`Error reading ${collectionName}:`, err);
        }
      }

      // Convert to human readable format
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
      };

      const percentage = Math.min(Math.round((estimatedSize / STORAGE_LIMIT) * 100), 100);
      const remaining = Math.max(STORAGE_LIMIT - estimatedSize, 0);

      setData({
        firestoreDocuments: totalDocuments,
        firestoreEstimatedSize: estimatedSize,
        firestoreSizeFormatted: formatBytes(estimatedSize),
        firestorePercentage: percentage,
        firestoreRemaining: formatBytes(remaining),
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Storage data error:', err);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch data',
      }));
    }
  };

  useEffect(() => {
    fetchStorageData();
  }, []);

  if (data.loading) {
    return (
      <div className="glass-effect-strong rounded-2xl border border-white/15 p-4">
        <p className="text-white/60 text-xs">Loading...</p>
      </div>
    );
  }

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return 'from-green-400 to-emerald-500';
    if (percentage < 80) return 'from-yellow-400 to-orange-500';
    return 'from-red-400 to-pink-500';
  };

  const getStatusText = (percentage: number) => {
    if (percentage < 50) return 'text-green-300';
    if (percentage < 80) return 'text-yellow-300';
    return 'text-red-300';
  };

  return (
    <div className="glass-effect-strong rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-cyan-300" />
          <h3 className="text-sm font-bold text-white">Firebase Storage</h3>
        </div>
        <Link
          href="/data-management"
          className="text-xs px-2 py-1 rounded bg-blue-600/60 hover:bg-blue-600 text-white transition-colors flex items-center gap-1"
        >
          Manage
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {data.error && (
        <div className="p-2 bg-red-900/40 border border-red-500/60 rounded text-xs text-red-100 mb-3">
          {data.error}
        </div>
      )}

      <div className="bg-blue-900/40 border border-blue-500/50 p-2 rounded-lg">
        <div className="flex items-center gap-1 mb-2">
          <Database className="w-3 h-3 text-blue-300" />
          <span className="text-xs text-blue-100 font-semibold">Firestore Database</span>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center text-xs">
          <div>
            <p className="font-bold text-white text-sm">{data.firestoreDocuments}</p>
            <p className="text-blue-200 text-xs">Documents</p>
          </div>
          <div>
            <p className="font-bold text-white text-sm">{data.firestoreSizeFormatted}</p>
            <p className="text-blue-200 text-xs">Used</p>
          </div>
          <div>
            <p className={`font-bold text-sm ${getStatusText(data.firestorePercentage)}`}>
              {data.firestorePercentage}%
            </p>
            <p className="text-blue-200 text-xs">Usage</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 bg-gray-800/80 rounded-full h-2 overflow-hidden border border-blue-600/40">
          <div
            className={`h-full bg-gradient-to-r ${getUsageColor(data.firestorePercentage)} transition-all`}
            style={{ width: `${data.firestorePercentage}%` }}
          />
        </div>

        {/* Remaining Space */}
        <p className="text-xs text-blue-200 mt-1.5">
          Remaining: <span className="font-bold text-white">{data.firestoreRemaining}</span>
        </p>
      </div>
    </div>
  );
}
