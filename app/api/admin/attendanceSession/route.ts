import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { action, sessionData } = await request.json();
    const today = new Date().toISOString().split('T')[0];
    const sessionRef = doc(db, 'attendanceSessions', today);

    if (action === 'start') {
      // Start a new attendance session
      const session = {
        date: today,
        isActive: true,
        startTime: sessionData.startTime || new Date().toTimeString().split(' ')[0],
        endTime: sessionData.endTime,
        location: sessionData.location || null,
        createdAt: Timestamp.now(),
        createdBy: sessionData.adminId,
      };

      await setDoc(sessionRef, session);
      return NextResponse.json({ success: true, message: 'Attendance session started', session });

    } else if (action === 'stop') {
      // Stop the current session
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const session = sessionSnap.data();
        await setDoc(sessionRef, {
          ...session,
          isActive: false,
          endedAt: Timestamp.now(),
        });
        return NextResponse.json({ success: true, message: 'Attendance session ended' });
      } else {
        return NextResponse.json({ success: false, message: 'No active session found' }, { status: 404 });
      }

    } else if (action === 'status') {
      // Get current session status
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        return NextResponse.json({ success: true, session: sessionSnap.data() });
      } else {
        return NextResponse.json({ success: true, session: null });
      }
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Attendance session API error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sessionRef = doc(db, 'attendanceSessions', today);
    const sessionSnap = await getDoc(sessionRef);

    if (sessionSnap.exists()) {
      return NextResponse.json({ success: true, session: sessionSnap.data() });
    } else {
      return NextResponse.json({ success: true, session: null });
    }
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to get session status'
    }, { status: 500 });
  }
}