import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export interface LogEntry {
  timestamp: Date;
  uid?: string;
  email?: string;
  role?: string;
  action: string;
  page?: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Write a log entry to Firestore
 */
export const writeLog = async (log: LogEntry) => {
  try {
    await addDoc(collection(db, 'logs'), {
      timestamp: Timestamp.now(),
      uid: log.uid || 'anonymous',
      email: log.email || 'unknown',
      role: log.role || 'unknown',
      action: log.action,
      page: log.page || 'unknown',
      message: log.message,
      metadata: log.metadata || {},
    });
  } catch (error) {
    console.error('Failed to write log:', error);
  }
};

/**
 * Common log actions
 */
export const LOG_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  CSV_UPLOAD_START: 'CSV_UPLOAD_START',
  CSV_UPLOAD_SUCCESS: 'CSV_UPLOAD_SUCCESS',
  CSV_UPLOAD_FAILED: 'CSV_UPLOAD_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FIRESTORE_ERROR: 'FIRESTORE_ERROR',
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  STUDENT_CREATED: 'STUDENT_CREATED',
  PROFILE_VIEWED: 'PROFILE_VIEWED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
};
