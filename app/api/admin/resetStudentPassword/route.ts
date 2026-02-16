import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { NextRequest, NextResponse } from 'next/server';
import serviceAccount from '@/serviceAccountKey.json';

let adminApp: ReturnType<typeof initializeApp> | null = null;
try {
  adminApp = initializeApp({
    credential: cert(serviceAccount as any),
  });
} catch (error) {
  // App already initialized
}

const auth = getAuth();

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
    const body: ResetPasswordRequest = await request.json();

    if (!body.email || !body.newPassword) {
      return NextResponse.json(
        { success: false, error: 'Missing email or password' },
        { status: 400 }
      );
    }

    // Find user by email
    const userRecord = await auth.getUserByEmail(body.email);

    // Update password
    await auth.updateUser(userRecord.uid, {
      password: body.newPassword,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Password reset for ${body.email}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error resetting password:', error);

    let errorMessage = 'Failed to reset password';

    if (error instanceof Error) {
      if (error.message.includes('user-not-found')) {
        errorMessage = 'User not found';
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
