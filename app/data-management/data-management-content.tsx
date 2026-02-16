'use client';

import { useEffect, useState } from 'react';
import { Trash2, Database, RefreshCw, TrendingUp, ArrowDown, ArrowUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

interface FirestoreItem {
  name: string;
  docCount: number;
  estimatedSize: number;
  estimatedSizeFormatted: string;
}

interface UsageStats {
  reads: number;
  writes: number;
  deletes: number;
  lastUpdated: string;
}

interface DataStats {
  firestoreCollections: FirestoreItem[];
  totalFirestoreSize: number;
  usageStats: UsageStats;
  loading: boolean;
  error: string | null;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (Math.round((bytes / Math.pow(k, i)) * 100) / 100).toFixed(2) + ' ' + sizes[i];
};

export default function DataManagementContent() {
  const COLLECTIONS = ['students', 'attendance', 'announcements', 'syllabus', 'teams', 'teamScores', 'registrationRequests', 'mentors'];
  const READS_LIMIT = 50000; // per day
  const WRITES_LIMIT = 20000; // per day
  const DELETES_LIMIT = 20000; // per day
  
  const [data, setData] = useState<DataStats>({
    firestoreCollections: [],
    totalFirestoreSize: 0,
    usageStats: { reads: 0, writes: 0, deletes: 0, lastUpdated: '' },
    loading: true,
    error: null,
  });

  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const collections: FirestoreItem[] = [];
      let totalFirestoreSize = 0;
      let totalReads = 0;
      let totalWrites = 0;

      for (const collectionName of COLLECTIONS) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          const docCount = snapshot.size;
          const estimatedSize = docCount * 1500;
          totalFirestoreSize += estimatedSize;
          totalReads += 1; // 1 read per collection fetch
          
          collections.push({
            name: collectionName,
            docCount,
            estimatedSize,
            estimatedSizeFormatted: formatBytes(estimatedSize),
          });
        } catch (err) {
          console.error(`Error reading ${collectionName}:`, err);
          totalReads += 1;
          collections.push({
            name: collectionName,
            docCount: 0,
            estimatedSize: 0,
            estimatedSizeFormatted: '0 Bytes',
          });
        }
      }

      setData({
        firestoreCollections: collections.sort((a, b) => b.estimatedSize - a.estimatedSize),
        totalFirestoreSize,
        usageStats: {
          reads: totalReads,
          writes: 0,
          deletes: 0,
          lastUpdated: new Date().toLocaleTimeString(),
        },
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      }));
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const deleteFirestoreCollection = async (collectionName: string) => {
    const collection_ = data.firestoreCollections.find((c) => c.name === collectionName);
    if (!collection_ || collection_.docCount === 0) {
      alert(`${collectionName} is already empty`);
      return;
    }

    if (!confirm(`⚠️ Delete all ${collection_.docCount} documents from "${collectionName}"?\n\nThis action cannot be undone!`)) {
      return;
    }

    setDeleting(collectionName);
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      const batch = writeBatch(db);
      let deleted = 0;

      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        deleted++;
      });

      await batch.commit();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
      alert(`✅ Successfully deleted ${deleted} documents from ${collectionName}`);
    } catch (error) {
      console.error('Error deleting collection:', error);
      alert('❌ Error deleting collection');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Data Management</h1>
              <p className="text-sm text-slate-600">Manage your Firestore collections</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={data.loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-lg font-medium transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${data.loading ? 'animate-spin' : ''}`} />
            {data.loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <p className="text-sm text-slate-600 mb-2">Total Firestore Size</p>
            <p className="text-3xl font-bold text-blue-600">{formatBytes(data.totalFirestoreSize)}</p>
            <p className="text-xs text-slate-500 mt-2">{data.firestoreCollections.reduce((sum, col) => sum + col.docCount, 0)} total documents</p>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Firebase Operations (Daily Limits)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Reads */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Reads</p>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  (data.usageStats.reads / READS_LIMIT) * 100 >= 80
                    ? 'bg-red-100 text-red-700'
                    : (data.usageStats.reads / READS_LIMIT) * 100 >= 50
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {Math.round((data.usageStats.reads / READS_LIMIT) * 100)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-1">
                {data.usageStats.reads.toLocaleString()} <span className="text-sm text-slate-500 font-normal">{" "}/ {READS_LIMIT.toLocaleString()}</span>
              </p>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${
                    (data.usageStats.reads / READS_LIMIT) * 100 >= 80
                      ? 'bg-red-500'
                      : (data.usageStats.reads / READS_LIMIT) * 100 >= 50
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((data.usageStats.reads / READS_LIMIT) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {Math.max(0, READS_LIMIT - data.usageStats.reads).toLocaleString()} remaining
              </p>
            </div>

            {/* Writes */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Writes</p>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  (data.usageStats.writes / WRITES_LIMIT) * 100 >= 80
                    ? 'bg-red-100 text-red-700'
                    : (data.usageStats.writes / WRITES_LIMIT) * 100 >= 50
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {Math.round((data.usageStats.writes / WRITES_LIMIT) * 100)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-1">
                {data.usageStats.writes.toLocaleString()} <span className="text-sm text-slate-500 font-normal">{" "}/ {WRITES_LIMIT.toLocaleString()}</span>
              </p>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${
                    (data.usageStats.writes / WRITES_LIMIT) * 100 >= 80
                      ? 'bg-red-500'
                      : (data.usageStats.writes / WRITES_LIMIT) * 100 >= 50
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((data.usageStats.writes / WRITES_LIMIT) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {Math.max(0, WRITES_LIMIT - data.usageStats.writes).toLocaleString()} remaining
              </p>
            </div>

            {/* Deletes */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Deletes</p>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  (data.usageStats.deletes / DELETES_LIMIT) * 100 >= 80
                    ? 'bg-red-100 text-red-700'
                    : (data.usageStats.deletes / DELETES_LIMIT) * 100 >= 50
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {Math.round((data.usageStats.deletes / DELETES_LIMIT) * 100)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-1">
                {data.usageStats.deletes.toLocaleString()} <span className="text-sm text-slate-500 font-normal">{" "}/ {DELETES_LIMIT.toLocaleString()}</span>
              </p>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${
                    (data.usageStats.deletes / DELETES_LIMIT) * 100 >= 80
                      ? 'bg-red-500'
                      : (data.usageStats.deletes / DELETES_LIMIT) * 100 >= 50
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((data.usageStats.deletes / DELETES_LIMIT) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {Math.max(0, DELETES_LIMIT - data.usageStats.deletes).toLocaleString()} remaining
              </p>
            </div>
          </div>
          {data.usageStats.lastUpdated && (
            <p className="text-xs text-slate-500 mt-3 text-right">
              Last updated: {data.usageStats.lastUpdated}
            </p>
          )}
        </div>

        {/* Error */}
        {data.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">⚠️ {data.error}</p>
          </div>
        )}

        {/* Collections */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Firestore Collections ({data.firestoreCollections.length})</h2>
          <div className="space-y-3">
            {data.loading ? (
              <div className="text-center py-12 text-slate-500">
                <div className="inline-block">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p className="text-sm">Loading collections...</p>
                </div>
              </div>
            ) : data.firestoreCollections.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-sm">No collections found</p>
              </div>
            ) : (
              data.firestoreCollections.map((col) => (
                <div key={col.name} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">{col.name}</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {col.docCount} docs
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Size: <span className="font-semibold">{col.estimatedSizeFormatted}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => deleteFirestoreCollection(col.name)}
                      disabled={deleting === col.name || col.docCount === 0}
                      className={`ml-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all flex items-center gap-1 whitespace-nowrap ${
                        deleting === col.name
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : col.docCount === 0
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deleting === col.name ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                      style={{
                        width: `${Math.min((col.estimatedSize / data.totalFirestoreSize) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info */}
        {!data.loading && data.firestoreCollections.length > 0 && (
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              💡 <strong>Tip:</strong> Click "Delete" to remove all documents from a collection. Deleted data cannot be recovered.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
