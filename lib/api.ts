import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * REGISTRATION CONTROL API
 */

export const getRegistrationStatus = async (): Promise<boolean> => {
  try {
    const docRef = doc(db, 'appConfig', 'registration');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().active || false;
    }
    // Create default config if doesn't exist
    await setDoc(docRef, { active: true, updatedAt: Timestamp.now() });
    return true;
  } catch (error) {
    console.error('Error getting registration status:', error);
    return false;
  }
};

export const toggleRegistrationStatus = async (active: boolean): Promise<void> => {
  try {
    const docRef = doc(db, 'appConfig', 'registration');
    await updateDoc(docRef, {
      active,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error toggling registration status:', error);
    throw error;
  }
};

/**
 * REGISTRATION REQUESTS API
 */

export const getRegistrationRequests = async () => {
  try {
    const q = query(
      collection(db, 'registrationRequests'),
      orderBy('submittedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching registration requests:', error);
    return [];
  }
};

export const getPendingRequests = async () => {
  try {
    const q = query(
      collection(db, 'registrationRequests'),
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        rollNo: data.rollNo || '',
        class: data.class || '',
        branch: data.branch || '',
        email: data.email || '',
        phone: data.phone || '',
        skills: data.skills || '',
        teamNo: data.teamNo || '',
        photoUrl: data.photoUrl,
        studentUid: data.studentUid || '',
        status: data.status || 'pending',
        submittedAt: data.submittedAt,
      };
    });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    return [];
  }
};

export const getRequestById = async (requestId: string) => {
  try {
    const docRef = doc(db, 'registrationRequests', requestId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching request:', error);
    return null;
  }
};

/**
 * APPROVAL / REJECTION API
 */

export const approveStudent = async (requestId: string, studentData: any) => {
  try {
    // Create user document
    const userDocRef = doc(db, 'users', studentData.studentUid);
    await setDoc(userDocRef, {
      ...studentData,
      role: 'student',
      status: 'approved',
      approvedAt: Timestamp.now(),
    });

    // Update request status
    const requestRef = doc(db, 'registrationRequests', requestId);
    await updateDoc(requestRef, {
      status: 'approved',
      approvedAt: Timestamp.now(),
    });

    // Create system message
    await createSystemMessage(
      studentData.studentUid,
      'Registration Approved',
      'Your registration has been approved. You can now use the app.',
      'approval'
    );

    return { success: true };
  } catch (error) {
    console.error('Error approving student:', error);
    throw error;
  }
};

export const rejectStudent = async (requestId: string, studentUid: string, reason?: string) => {
  try {
    // Update request status
    const requestRef = doc(db, 'registrationRequests', requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      rejectionReason: reason || 'No reason provided',
      rejectedAt: Timestamp.now(),
    });

    // Create system message
    await createSystemMessage(
      studentUid,
      'Registration Rejected',
      reason || 'Your registration was rejected. Please contact the admin.',
      'rejection'
    );

    return { success: true };
  } catch (error) {
    console.error('Error rejecting student:', error);
    throw error;
  }
};

/**
 * SYSTEM MESSAGES API
 */

export const createSystemMessage = async (
  studentUid: string,
  title: string,
  message: string,
  type: 'approval' | 'rejection' | 'announcement' | 'group'
) => {
  try {
    const messageRef = doc(collection(db, `users/${studentUid}/messages`));
    await setDoc(messageRef, {
      title,
      message,
      type,
      read: false,
      createdAt: Timestamp.now(),
      from: 'admin',
    });
    return { success: true };
  } catch (error) {
    console.error('Error creating system message:', error);
    throw error;
  }
};

export const getStudentMessages = async (studentUid: string) => {
  try {
    const q = query(
      collection(db, `users/${studentUid}/messages`),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

/**
 * ANNOUNCEMENTS API
 */

export const sendAnnouncement = async (
  title: string,
  message: string,
  targetAudience: 'all' | 'groupId',
  targetGroupId?: string
) => {
  try {
    const announcementRef = doc(collection(db, 'announcements'));
    await setDoc(announcementRef, {
      title,
      message,
      targetAudience,
      targetGroupId: targetGroupId || null,
      createdAt: Timestamp.now(),
      createdBy: 'admin',
    });

    // If targeting all students, create message for each
    if (targetAudience === 'all') {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = [];
      for (const userDoc of usersSnap.docs) {
        batch.push(
          createSystemMessage(
            userDoc.id,
            title,
            message,
            'announcement'
          )
        );
      }
      await Promise.all(batch);
    }

    return { success: true, announcementId: announcementRef.id };
  } catch (error) {
    console.error('Error sending announcement:', error);
    throw error;
  }
};

/**
 * STATISTICS API
 */

export const getStatistics = async (): Promise<{
  totalStudents: number;
  presentToday: number;
  topAttendanceStudent: string;
  topAttendancePercent: number;
  topTeamName: string;
  totalAnnouncements: number;
}> => {
  let totalStudents = 0;
  let presentToday = 0;
  let topAttendanceStudent = '';
  let topAttendancePercent = 0;
  let topTeamName = 'N/A';
  let totalAnnouncements = 0;

  // Get total students
  try {
    const studentsSnap = await getDocs(collection(db, 'students'));
    totalStudents = studentsSnap.size;
  } catch (err) {
    console.error('Error fetching students:', err);
  }

  // Get today's attendance count
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendanceRef = doc(db, 'attendance', today);
    const attendanceSnap = await getDoc(attendanceRef);
    presentToday = attendanceSnap.exists() ? (attendanceSnap.data().presentCount || 0) : 0;
  } catch (err) {
    console.error('Error fetching today\'s attendance:', err);
  }

  // Get top attendance student
  if (totalStudents > 0) {
    try {
      const attendanceQuery = query(
        collection(db, 'attendance'),
        orderBy('date', 'asc')
      );
      const attendanceRecords = await getDocs(attendanceQuery);
      const attendanceMap: { [key: string]: { present: number; total: number } } = {};

      attendanceRecords.forEach((doc) => {
        const data = doc.data();
        if (data.presentStudents && Array.isArray(data.presentStudents)) {
          data.presentStudents.forEach((rollNo: string) => {
            if (!attendanceMap[rollNo]) {
              attendanceMap[rollNo] = { present: 0, total: 0 };
            }
            attendanceMap[rollNo].present++;
            attendanceMap[rollNo].total++;
          });
        }
        if (data.absentStudents && Array.isArray(data.absentStudents)) {
          data.absentStudents.forEach((rollNo: string) => {
            if (!attendanceMap[rollNo]) {
              attendanceMap[rollNo] = { present: 0, total: 0 };
            }
            attendanceMap[rollNo].total++;
          });
        }
      });

      let topRollNo = '';
      let topPercent = 0;
      Object.entries(attendanceMap).forEach(([rollNo, data]) => {
        const percent = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
        if (percent > topPercent) {
          topPercent = percent;
          topRollNo = rollNo;
        }
      });

      if (topRollNo) {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const studentData = studentsSnap.docs.find(
          (doc) => doc.data().rollNo === topRollNo
        );
        topAttendanceStudent = studentData?.data().name || 'N/A';
        topAttendancePercent = topPercent;
      }
    } catch (err) {
      console.error('Error calculating top attendance:', err);
    }
  }

  // Get top team
  try {
    const teamsSnap = await getDocs(collection(db, 'teams'));
    if (teamsSnap.size > 0) {
      const teamScoresMap: { [key: string]: { name: string; points: number } } = {};

      teamsSnap.forEach((doc) => {
        teamScoresMap[doc.id] = {
          name: doc.data().teamName || 'Team ' + doc.id,
          points: 0,
        };
      });

      const scoresSnap = await getDocs(collection(db, 'teamScores'));
      scoresSnap.forEach((doc) => {
        const data = doc.data();
        if (teamScoresMap[data.teamId]) {
          teamScoresMap[data.teamId].points += data.scoreGiven || 0;
        }
      });

      let maxPoints = 0;
      Object.values(teamScoresMap).forEach((team) => {
        if (team.points > maxPoints) {
          maxPoints = team.points;
          topTeamName = team.name;
        }
      });
    }
  } catch (err) {
    console.error('Error calculating team scores:', err);
  }

  // Get total announcements
  try {
    const announcementsSnap = await getDocs(collection(db, 'announcements'));
    totalAnnouncements = announcementsSnap.size;
  } catch (err) {
    console.error('Error fetching announcements:', err);
  }

  return {
    totalStudents,
    presentToday,
    topAttendanceStudent,
    topAttendancePercent,
    topTeamName,
    totalAnnouncements,
  };
};

/**
 * SYSTEM HEALTH CHECK
 */

export const updateSystemHealth = async () => {
  try {
    const healthRef = doc(db, 'systemHealth', 'status');
    await setDoc(healthRef, {
      lastPing: Timestamp.now(),
      status: 'online',
      version: '1.0.0',
    });
    return { connected: true };
  } catch (error) {
    console.error('Error updating system health:', error);
    return { connected: false };
  }
};
