// Utility functions for CSV parsing

// Types
export interface ParsedStudent {
  name?: string;
  email?: string;
  rollno?: string;
  year?: string;
  branch?: string;
  phoneno?: string;
  linkedin?: string;
  github?: string;
  [key: string]: any;
}

export interface UploadResult {
  success: boolean;
  rowIndex?: number;
  rollNo?: string;
  name?: string;
  email?: string;
  uid?: string;
  password?: string;
  error?: string;
}

// Parse CSV string
export const parseCSV = (csvText: string): ParsedStudent[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: ParsedStudent[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',').map(v => v.trim());
    const row: ParsedStudent = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    rows.push(row);
  }

  return rows;
};

// Validate CSV row
export const validateStudentRow = (row: ParsedStudent): string[] => {
  const errors: string[] = [];
  
  if (!row.name || !row.name.trim()) {
    errors.push('Name is required');
  }
  
  if (!row.rollno || !row.rollno.toString().trim()) {
    errors.push('Roll number is required');
  }
  
  return errors;
};

// Upload students via API
export const uploadStudentsViaAPI = async (
  students: ParsedStudent[],
  adminIdToken: string
): Promise<UploadResult[]> => {
  try {
    const response = await fetch('/api/admin/bulkUploadCSV', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminIdToken}`,
      },
      body: JSON.stringify({ students }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('API upload error:', error);
    throw error instanceof Error ? error : new Error('Upload failed');
  }
};

// Generate CSV download format from results
export const generateCredentialsCSV = (results: UploadResult[]): string => {
  const successResults = results.filter(r => r.success && r.password);
  
  if (successResults.length === 0) {
    return '';
  }

  const headers = ['Name', 'Roll Number', 'Email', 'Password'];
  const rows = successResults.map(r => [
    r.name || '',
    r.rollNo || '',
    r.email || '',
    r.password || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
};
