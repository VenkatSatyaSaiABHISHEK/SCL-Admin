import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import serviceAccount from '@/serviceAccountKey.json';

// Initialize Firebase Admin SDK
let adminApp: ReturnType<typeof initializeApp> | null = null;
try {
  adminApp = initializeApp({
    credential: cert(serviceAccount as any),
  });
} catch (error) {
  // App already initialized
}

const auth = getAuth();
const db = getFirestore();

interface StudentRow {
  name?: string;
  rowIndex: number;
  [key: string]: any;
}

interface UploadResult {
  success: boolean;
  rowIndex: number;
  rollNo?: string;
  name?: string;
  email?: string;
  uid?: string;
  password?: string;
  error?: string;
}

/**
 * POST /api/admin/bulkUploadCSV
 * Bulk upload students from CSV using Firebase Admin SDK
 * 
 * Request body (multipart/form-data):
 * - file: CSV file
 * - csvData: JSON string of parsed CSV data (alternative)
 * 
 * CSV columns required:
 * - name
 * - email
 * - rollno (or rollNo)
 * 
 * Optional columns:
 * - year
 * - branch
 * - phoneno
 * - linkedin
 * - github
 * 
 * Response:
 * {
 *   success: true,
 *   totalProcessed: 5,
 *   successful: 4,
 *   failed: 1,
 *   results: [
 *     { success: true, rollNo: "2023001", name: "John", email: "john@example.com", uid: "abc123", password: "XyZ789!@" },
 *     { success: false, rollNo: "2023002", error: "Email already exists" }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get admin token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Missing or invalid token' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify the ID token (ensures request is from authenticated admin)
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Verify admin role in Firestore
    const adminDocRef = db.collection('users').doc(decodedToken.uid);
    const adminDoc = await adminDocRef.get();

    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse CSV data from request
    const body = await request.json();
    const students: StudentRow[] = body.students || [];

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No student data provided' },
        { status: 400 }
      );
    }

    const results: UploadResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each student
    for (let i = 0; i < students.length; i++) {
      const student = students[i];

      try {
        // Normalize field names
        const name = student.name?.trim();
        const rollNo = (student.rollno || student.rollNo)?.toString().trim();
        let email = student.email?.trim().toLowerCase();

        // Basic validation
        if (!name) {
          results.push({
            success: false,
            rowIndex: i + 1,
            error: 'Name is required',
          });
          failureCount++;
          continue;
        }

        if (!rollNo) {
          results.push({
            success: false,
            rowIndex: i + 1,
            name,
            error: 'Roll number is required',
          });
          failureCount++;
          continue;
        }

        // Generate email if not provided
        if (!email) {
          email = `student${rollNo}@school.local`;
        }

        // Generate random password
        const password = generateRandomPassword();

        // Create user in Firebase Authentication
        const userRecord = await auth.createUser({
          email,
          password,
          displayName: name,
        });

        const uid = userRecord.uid;

        // Create user document in Firestore
        await db.collection('users').doc(uid).set({
          uid,
          email,
          name,
          role: 'student',
          createdAt: new Date(),
          rollNo,
        });

        // Create student document using UID
        await db.collection('students').doc(uid).set({
          uid,
          name,
          rollNo,
          email,
          year: student.year?.toString() || '',
          branch: student.branch?.toString() || '',
          phoneNo: student.phoneno?.toString() || student.phoneNo?.toString() || '',
          linkedin: student.linkedin?.toString() || '',
          github: student.github?.toString() || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        results.push({
          success: true,
          rowIndex: i + 1,
          rollNo,
          name,
          email,
          uid,
          password, // Only shown once - admin must save immediately
        });
        successCount++;
      } catch (error) {
        let errorMessage = 'Unknown error';

        if (error instanceof Error) {
          if (error.message.includes('email-already-exists')) {
            errorMessage = 'Email already exists';
          } else if (error.message.includes('invalid-email')) {
            errorMessage = 'Invalid email format';
          } else if (error.message.includes('weak-password')) {
            errorMessage = 'Password too weak (minimum 6 characters)';
          } else {
            errorMessage = error.message;
          }
        }

        results.push({
          success: false,
          rowIndex: i + 1,
          rollNo: student.rollno || student.rollNo,
          name: student.name,
          error: errorMessage,
        });
        failureCount++;
      }
    }

    return NextResponse.json(
      {
        success: true,
        totalProcessed: students.length,
        successful: successCount,
        failed: failureCount,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in bulk upload:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a random password (12 characters)
 * Mix of uppercase, lowercase, numbers, and special chars
 */
function generateRandomPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  const all = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 8; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}
