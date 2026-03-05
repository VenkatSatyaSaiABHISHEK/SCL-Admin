// Notification Service - Ready for PWA Push Notifications
// This service provides the structure for sending push notifications
// when attendance sessions are started by admins

import React from 'react';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
}

class NotificationService {
  private vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
  
  // Check if notifications are supported
  isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'Notification' in window && 
           'serviceWorker' in navigator &&
           'PushManager' in window;
  }

  // Request notification permission
  async requestPermission(): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  // Subscribe to push notifications
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.isSupported()) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidKey || '')
      });

      // Store subscription in Firebase for the current user
      await this.storeSubscription(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  // Store subscription in Firebase
  private async storeSubscription(subscription: PushSubscription): Promise<void> {
    // TODO: Implement Firebase storage for push subscriptions
    // This would store the subscription alongside user data
    console.log('Subscription stored:', subscription);
  }

  // Send attendance session notification (server-side)
  async notifyAttendanceSessionStarted(sessionData: {
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    duration: number;
  }): Promise<void> {
    const payload: NotificationPayload = {
      title: `📍 Attendance Session Started`,
      body: `Mark your attendance now! Session ends at ${sessionData.endTime}`,
      icon: '/icons/attendance-icon.png',
      badge: '/icons/badge.png',
      data: {
        type: 'attendance-session',
        sessionDate: sessionData.date,
        url: '/pwa/attendance'
      },
      actions: [
        {
          action: 'mark-attendance',
          title: 'Mark Attendance'
        },
        {
          action: 'view-details',
          title: 'View Details'
        }
      ]
    };

    // TODO: Implement server-side push notification sending
    // This would use Firebase Admin SDK to send to all subscribed devices
    console.log('Attendance notification payload ready:', payload);
  }

  // Send reminder notification
  async sendReminderNotification(minutesLeft: number): Promise<void> {
    const payload: NotificationPayload = {
      title: `⏰ Attendance Reminder`,
      body: `Only ${minutesLeft} minutes left to mark attendance!`,
      icon: '/icons/reminder-icon.png',
      data: {
        type: 'attendance-reminder',
        minutesLeft,
        url: '/pwa/attendance'
      }
    };

    console.log('Reminder notification payload ready:', payload);
  }

  // Helper to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const notificationService = new NotificationService();

// Hook for React components
export function useNotifications() {
  const [permission, setPermission] = React.useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = React.useState(false);

  React.useEffect(() => {
    if (notificationService.isSupported()) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    const result = await notificationService.requestPermission();
    setPermission(result as NotificationPermission);
    return result;
  };

  const subscribe = async () => {
    const subscription = await notificationService.subscribeToPush();
    setSubscribed(!!subscription);
    return subscription;
  };

  return {
    permission,
    subscribed,
    isSupported: notificationService.isSupported(),
    requestPermission,
    subscribe
  };
}

// Types for server-side notification handling
export interface PushSubscriptionData {
  userId: string;
  rollNo?: string;
  subscription: PushSubscription;
  createdAt: Date;
  lastSeen: Date;
}

export interface NotificationQueue {
  id: string;
  type: 'attendance-session' | 'attendance-reminder' | 'announcement';
  payload: NotificationPayload;
  targetUsers: string[]; // User IDs or 'all'
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
}