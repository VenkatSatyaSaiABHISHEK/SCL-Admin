import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { NextRequest, NextResponse } from 'next/server';

function getAdminAuth() {
  if (!getApps().length) {
    const serviceAccountKey = process.env.FIREBASE_ADMIN_SDK_KEY;
    if (!serviceAccountKey) {
      throw new Error('FIREBASE_ADMIN_SDK_KEY environment variable is not set');
    }
    initializeApp({
      credential: cert(JSON.parse(serviceAccountKey)),
    });
  }
  return getAuth();
}

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
}

/**
 * POST /api/admin/resetStudentPassword
 * Resets a student's Firebase Auth password
 */
export async function POST(request: NextRequest) {
  try {
    const auth = getAdminAuth();
    const body: ResetPasswordRequest = await request.json();

    if (!body.email || !body.newPassword) {
      return NextResponse.json(
        { success: false, error: 'Missing email or password' },
        { status: 400 }
      );
    }

    // Try to find existing user, create if not found
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(body.email);
      // User exists — update their password
      await auth.updateUser(userRecord.uid, {
        password: body.newPassword,
      });
    } catch (lookupError: any) {
      if (lookupError?.code === 'auth/user-not-found') {
        // User doesn't exist in Firebase Auth — create them
        userRecord = await auth.createUser({
          email: body.email,
          password: body.newPassword,
        });
      } else {
        throw lookupError; // Re-throw unexpected errors
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Password synced for ${body.email}`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error syncing password:', error);

    let errorMessage = 'Failed to sync password';

    if (error?.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak (min 6 characters)';
    } else if (error?.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage, code: error?.code ?? null },
      { status: 500 }
    );
  }
}
