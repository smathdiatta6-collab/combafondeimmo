import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type NotificationType = 'message' | 'payment' | 'contract' | 'system';

export interface Notification {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  link?: string;
}

export const createNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      createdAt: new Date().toISOString(),
      read: false
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};
