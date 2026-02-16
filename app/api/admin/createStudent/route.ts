import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Firebase Admin SDK
let adminApp: ReturnType<typeof initializeApp> | null = null;
try {
  const serviceAccountKey = process.env.FIREBASE_ADMIN_SDK_KEY;
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_ADMIN_SDK_KEY environment variable is not set');
  }
  const serviceAccount = JSON.parse(serviceAccountKey);
  adminApp = initializeApp({
    credential: cert(serviceAccount as any),
  });
} catch (error) {
  // App already initialized
}

const auth = getAuth();
const db = getFirestore();

interface CreateStudentRequest {
  email: string;
  password: string;
  name: string;
  rollNo: string;
  year?: string;
  branch?: string;
  phoneNo?: string;
  linkedin?: string;
  github?: string;
  [key: string]: any; // Allow additional fields
}

/**
 * POST /api/admin/createStudent
 * Creates a single student user and Firestore records
 * 
 * Request body:
 * {
 *   email: "student@email.com",
 *   password: "SecurePassword123",
 *   name: "John Doe",
 *   rollNo: "2023001",
 *   year: "2023",
 *   branch: "CSE",
 *   phoneNo: "1234567890",
 *   linkedin: "linkedin profile url",
 *   github: "github profile url"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   uid: "firebase-uid",
 *   email: "student@email.com",
 *   message: "Student created successfully"
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

    // Parse request body
    const body: CreateStudentRequest = await request.json();

    if (!body.email || !body.password || !body.name || !body.rollNo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: email, password, name, rollNo',
        },
        { status: 400 }
      );
    }

    // Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email: body.email,
      password: body.password,
      displayName: body.name,
    });

    const uid = userRecord.uid;

    // Create user document in Firestore with role "student"
    await db.collection('users').doc(uid).set({
      uid,
      email: body.email,
      name: body.name,
      role: 'student',
      createdAt: new Date(),
      rollNo: body.rollNo,
    });

    // Create student document using UID as document ID
    await db.collection('students').doc(uid).set({
      uid,
      name: body.name,
      rollNo: body.rollNo,
      year: body.year || '',
      branch: body.branch || '',
      email: body.email,
      phoneNo: body.phoneNo || '',
      linkedin: body.linkedin || '',
      github: body.github || '',
      password: body.password,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        uid,
        email: body.email,
        name: body.name,
        rollNo: body.rollNo,
        message: 'Student created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating student:', error);

    let errorMessage = 'Internal server error';

    if (error instanceof Error) {
      // Firebase Auth error messages
      if (error.message.includes('email-already-exists')) {
        errorMessage = 'Email already exists';
      } else if (error.message.includes('invalid-email')) {
        errorMessage = 'Invalid email address';
      } else if (error.message.includes('weak-password')) {
        errorMessage = 'Password is too weak';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
