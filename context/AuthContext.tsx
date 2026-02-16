'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { writeLog, LOG_ACTIONS } from '@/lib/logging';

interface User {
  uid: string;
  email: string;
  name: string;
  role: string;
  loginTime?: Date;
}

interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  isStudent: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let sessionUpdateInterval: NodeJS.Timeout | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      try {
        if (user) {
          // User is logged in - check their role
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const userRole = userData?.role || 'user';
            const isAdminUser = userRole === 'admin';
            const isStudentUser = userRole === 'student';
            
            setCurrentUser({
              uid: user.uid,
              email: user.email || '',
              name: userData?.name || user.displayName || 'User',
              role: userRole,
              loginTime: userData?.loginTime?.toDate?.() || new Date(),
            });
            setIsAdmin(isAdminUser);
            setIsStudent(isStudentUser);

            // Update last seen every 30 seconds
            if (sessionUpdateInterval) clearInterval(sessionUpdateInterval);
            
            sessionUpdateInterval = setInterval(async () => {
              try {
                const sessionRef = doc(db, 'activeSessions', user.uid);
                await updateDoc(sessionRef, {
                  lastSeen: Timestamp.now(),
                });
              } catch (error) {
                // Session may have been deleted
              }
            }, 30000); // Every 30 seconds

          } else {
            // User doc missing
            console.error('User document not found in Firestore. UID:', user.uid);
            setCurrentUser(null);
            setIsAdmin(false);
            setIsStudent(false);
          }
        } else {
          // User is logged out
          setCurrentUser(null);
          setIsAdmin(false);
          setIsStudent(false);
          if (sessionUpdateInterval) {
            clearInterval(sessionUpdateInterval);
            sessionUpdateInterval = null;
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setCurrentUser(null);
        setIsAdmin(false);
        setIsStudent(false);
      } finally {
        // Mark auth as initialized after first check (persistence has been checked)
        setAuthInitialized(true);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (sessionUpdateInterval) clearInterval(sessionUpdateInterval);
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      // Use Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check user role in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await signOut(auth);
        await writeLog({
          timestamp: new Date(),
          uid: user.uid,
          email: user.email || '',
          role: 'unknown',
          action: LOG_ACTIONS.LOGIN_FAILED,
          message: 'User profile missing in Firestore',
        });
        throw new Error('User profile missing in Firestore users collection');
      }

      const userData = userDocSnap.data();
      const userRole = userData?.role;

      // Create or update active session
      try {
        await setDoc(
          doc(db, 'activeSessions', user.uid),
          {
            uid: user.uid,
            email: user.email || '',
            role: userRole,
            name: userData?.name || user.displayName || 'User',
            loginAt: Timestamp.now(),
            lastSeen: Timestamp.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
          },
          { merge: true }
        );
      } catch (sessionError) {
        console.error('Failed to create session:', sessionError);
      }

      // Log login
      await writeLog({
        timestamp: new Date(),
        uid: user.uid,
        email: user.email || '',
        role: userRole,
        action: LOG_ACTIONS.LOGIN_SUCCESS,
        message: `${userRole} user logged in successfully`,
        metadata: { platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown' },
      });

      setCurrentUser({
        uid: user.uid,
        email: user.email || '',
        name: userData?.name || user.displayName || 'User',
        role: userRole,
        loginTime: new Date(),
      });
      setIsAdmin(userRole === 'admin');
      setIsStudent(userRole === 'student');

      // Start session update interval
      if (sessionUpdateInterval) clearInterval(sessionUpdateInterval);
      sessionUpdateInterval = setInterval(async () => {
        try {
          const sessionRef = doc(db, 'activeSessions', user.uid);
          await updateDoc(sessionRef, {
            lastSeen: Timestamp.now(),
          });
        } catch (error) {
          // Session may have been deleted
        }
      }, 30000);

    } catch (error) {
      console.error('Login error:', error);
      throw error instanceof Error ? error : new Error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const uid = currentUser?.uid;

      // Stop session update interval
      if (sessionUpdateInterval) {
        clearInterval(sessionUpdateInterval);
        sessionUpdateInterval = null;
      }

      // Delete active session
      if (uid) {
        try {
          await deleteDoc(doc(db, 'activeSessions', uid));
          
          // Log logout
          await writeLog({
            timestamp: new Date(),
            uid,
            email: currentUser?.email,
            role: currentUser?.role,
            action: LOG_ACTIONS.LOGOUT,
            message: `${currentUser?.role} user logged out`,
          });
        } catch (error) {
          console.error('Error cleaning up session:', error);
        }
      }

      // Sign out from Firebase
      await signOut(auth);
      setCurrentUser(null);
      setIsAdmin(false);
      setIsStudent(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, isStudent, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
