'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, User, Upload, Copy, Download, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { parseCSV, uploadStudentsViaAPI, UploadResult, generateCredentialsCSV } from '@/lib/csv-utils';
import { auth } from '@/lib/firebase';

export default function CsvUploadContent() {
  const [mounted, setMounted] = useState(false);
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAdmin) {
      router.push('/login');
    }
  }, [mounted, isAdmin, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setResults([]);
      setShowResults(false);
    }
  };

  const handleUpload = async () => {
    if (!csvFile) return;

    setUploading(true);
    try {
      // Get admin ID token for API authentication
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        alert('Error: Could not get authentication token. Please login again.');
        return;
      }

      const text = await csvFile.text();
      const students = parseCSV(text);

      if (students.length === 0) {
        alert('CSV file is empty. Please add students.');
        return;
      }

      const uploadResults = await uploadStudentsViaAPI(students, idToken);
      setResults(uploadResults);
      setShowResults(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Error uploading CSV: ' + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadCredentials = () => {
    const csv = generateCredentialsCSV(results);
    
    if (!csv) {
      alert('No successful uploads to download');
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-credentials-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <Upload className="w-6 h-6 text-blue-400" />
              <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent hidden sm:inline">
                CSV Upload
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="px-3 py-1 rounded-lg text-white/70 hover:bg-white/10 transition text-sm">
                ← Dashboard
              </Link>
              <Link href="/profile" className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition">
                <User className="w-5 h-5" />
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-lg hover:bg-red-500/20 transition text-white/70 hover:text-red-300"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Student CSV Upload</h1>
          <p className="text-white/60">Bulk import students and auto-generate credentials</p>
        </div>

        {/* CSV Format Info */}
        <div className="glass-effect-strong rounded-2xl border border-green-500/30 bg-green-950/10 p-6 mb-8">
          <h2 className="text-lg font-bold text-green-300 mb-4">📋 CSV Format Required</h2>
          <p className="text-white/80 text-sm mb-4">Your CSV file must have these columns (at least Name and RollNo):</p>
          <div className="bg-black/40 rounded-lg p-4 font-mono text-green-400 text-sm overflow-x-auto border border-green-500/20">
            name, email, rollno, year, branch, phoneno, linkedin, github
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-green-300 flex items-center gap-2">
              <span>✓</span> <strong>name</strong> - Required (student full name)
            </p>
            <p className="text-green-300 flex items-center gap-2">
              <span>✓</span> <strong>rollno</strong> - Required (unique roll number)
            </p>
            <p className="text-white/70 flex items-center gap-2">
              <span>○</span> <strong>email</strong> - Optional (auto-generated if empty)
            </p>
            <p className="text-white/70 flex items-center gap-2">
              <span>○</span> Other fields: year, branch, phoneno, linkedin, github - Optional
            </p>
          </div>
          <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-500/30 rounded text-yellow-200 text-xs">
            ⚠️ Passwords are auto-generated and shown once. Save the CSV with credentials immediately!
          </div>
        </div>

        {/* Upload Section */}
        <div className="glass-effect-strong rounded-2xl border border-blue-500/30 bg-blue-950/10 p-8 mb-8">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-400/50 rounded-lg p-12 cursor-pointer hover:border-blue-400 hover:bg-blue-950/20 transition">
            <Upload className="w-16 h-16 text-blue-400 mb-4" />
            <span className="text-white font-semibold text-lg">Select CSV File</span>
            <span className="text-white/60 text-sm mt-2">{csvFile?.name || 'Click to browse or drag & drop'}</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            onClick={handleUpload}
            disabled={!csvFile || uploading}
            className="w-full mt-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-green-600/50 disabled:to-emerald-600/50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload Students
              </>
            )}

          </button>
        </div>

        {/* Results */}
        {showResults && results.length > 0 && (
          <div className="glass-effect-strong rounded-2xl border border-white/15 p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Upload Results</h2>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-semibold">{results.filter(r => r.success).length} Success</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 font-semibold">{results.filter(r => !r.success).length} Failed</span>
                  </div>
                </div>
              </div>
              <button
                onClick={downloadCredentials}
                disabled={results.filter(r => r.success).length === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-blue-600/50 disabled:to-cyan-600/50 text-white px-6 py-2 rounded-lg transition whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-4 border transition ${
                    result.success
                      ? 'bg-green-950/20 border-green-500/30 hover:border-green-500/50'
                      : 'bg-red-950/20 border-red-500/30 hover:border-red-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-white">{result.name || result.rollNo}</p>
                        <p className="text-white/60 text-sm">Roll No: {result.rollNo}</p>
                      </div>
                    </div>

                  </div>

                  {result.success && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10">
                      <div>
                        <p className="text-white/60 text-xs font-semibold mb-2">Email</p>
                        <div className="flex items-center gap-2 bg-cyan-950/30 border border-cyan-500/30 rounded p-2">
                          <code className="text-cyan-300 text-xs font-mono flex-1 truncate">{result.email}</code>
                          <button
                            onClick={() => copyToClipboard(result.email!)}
                            title="Copy email"
                            className="p-1 hover:bg-cyan-500/20 rounded transition text-cyan-300"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-white/60 text-xs font-semibold mb-2">Password</p>
                        <div className="flex items-center gap-2 bg-yellow-950/30 border border-yellow-500/30 rounded p-2">
                          <code className="text-yellow-300 text-xs font-mono flex-1">{result.password}</code>
                          <button
                            onClick={() => copyToClipboard(result.password!)}
                            title="Copy password"
                            className="p-1 hover:bg-yellow-500/20 rounded transition text-yellow-300"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-white/60 text-xs font-semibold mb-2">Firebase UID</p>
                        <div className="flex items-center gap-2 bg-purple-950/30 border border-purple-500/30 rounded p-2">
                          <code className="text-purple-300 text-xs font-mono flex-1 truncate">{result.uid}</code>
                          <button
                            onClick={() => copyToClipboard(result.uid!)}
                            title="Copy UID"
                            className="p-1 hover:bg-purple-500/20 rounded transition text-purple-300"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!result.success && (
                    <div className="mt-3 pt-3 border-t border-red-500/20">
                      <p className="text-red-300 text-sm font-medium">Error: {result.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setCsvFile(null);
                  setShowResults(false);
                  setResults([]);
                }}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Upload Another File
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-white/70 text-sm">
                  <strong className="text-green-400">✓</strong> <strong>{results.filter(r => r.success).length}</strong> Success
                </p>
              </div>
              <div className="text-center">
                <p className="text-white/70 text-sm">
                  <strong className="text-red-400">✗</strong> <strong>{results.filter(r => !r.success).length}</strong> Failed
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
