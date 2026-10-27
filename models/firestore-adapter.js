/**
 * Firestore Database Adapter (Firebase Admin SDK)
 * 
 * This module provides a unified interface for Firestore operations.
 * Replaces Sequelize/MySQL queries with Firestore equivalents.
 * 
 * Usage:
 * import { FirestoreAdapter } from '../models/firestore-adapter.js';
 */

import { db } from '../firebase-config.js';

export class FirestoreAdapter {
  /**
   * USERS COLLECTION
   */

  static async findUserById(userId) {
    try {
      const docSnap = await db.collection('users').doc(userId).get();
      return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async findUserByEmail(email) {
    try {
      const snapshot = await db.collection('users').where('email', '==', email).get();
      
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findUserByGoogleId(googleId) {
    try {
      const snapshot = await db.collection('users').where('googleId', '==', googleId).get();
      
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error finding user by Google ID:', error);
      throw error;
    }
  }

  static async createUser(userData) {
    try {
      const newDocRef = db.collection('users').doc();
      const userWithTimestamps = {
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isApproved: userData.isApproved ?? true
      };
      
      await newDocRef.set(userWithTimestamps);
      return { id: newDocRef.id, ...userData };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async updateUser(userId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('users').doc(userId).update(updateData);
      return { id: userId, ...updates };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  static async getAllUsers(filters = {}) {
    try {
      let query = db.collection('users');
      
      if (filters.role) {
        query = query.where('role', '==', filters.role);
      }
      
      const snapshot = await query.get();
      let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort by createdAt descending
      users.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      return users;
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * APPLICATIONS COLLECTION
   */

  static async getAllApplications(filters = {}) {
    try {
      let query = db.collection('applications');
      
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      
      // Don't order by createdAt if we have filters - Firestore needs composite index
      // Instead, we'll sort in memory
      
      const snapshot = await query.get();
      let applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in memory by createdAt descending
      applications.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      return applications;
    } catch (error) {
      console.error('Error getting applications:', error);
      throw error;
    }
  }

  static async getApplicationById(appId) {
    try {
      const docSnap = await db.collection('applications').doc(appId).get();
      return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      console.error('Error getting application by ID:', error);
      throw error;
    }
  }

  static async getUserApplications(userId) {
    try {
      const snapshot = await db.collection('applications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting user applications:', error);
      throw error;
    }
  }

  static async createApplication(appData) {
    try {
      const newAppRef = db.collection('applications').doc();
      const appWithTimestamps = {
        ...appData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: appData.status ?? 'pending'
      };
      
      await newAppRef.set(appWithTimestamps);
      return { id: newAppRef.id, ...appData };
    } catch (error) {
      console.error('Error creating application:', error);
      throw error;
    }
  }

  static async updateApplication(appId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('applications').doc(appId).update(updateData);
      return { id: appId, ...updates };
    } catch (error) {
      console.error('Error updating application:', error);
      throw error;
    }
  }

  /**
   * APPOINTMENTS COLLECTION
   */

  static async getAllAppointments(filters = {}) {
    try {
      let query = db.collection('appointments');
      
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      if (filters.date) {
        query = query.where('date', '==', filters.date);
      }
      
      query = query.orderBy('date', 'desc');
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting appointments:', error);
      throw error;
    }
  }

  static async getAppointmentById(appointmentId) {
    try {
      const docSnap = await db.collection('appointments').doc(appointmentId).get();
      return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      console.error('Error getting appointment by ID:', error);
      throw error;
    }
  }

  static async createAppointment(appointmentData) {
    try {
      const newAppRef = db.collection('appointments').doc();
      const appointmentWithTimestamps = {
        ...appointmentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: appointmentData.status ?? 'pending'
      };
      
      await newAppRef.set(appointmentWithTimestamps);
      return { id: newAppRef.id, ...appointmentData };
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  static async updateAppointment(appointmentId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('appointments').doc(appointmentId).update(updateData);
      return { id: appointmentId, ...updates };
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  /**
   * NOTIFICATIONS COLLECTION
   */

  static async getUserNotifications(userId) {
    try {
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .limit(50)
        .get();
      
      let notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in memory
      notifications.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      return notifications;
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  static async createNotification(notificationData) {
    try {
      const newNotifRef = db.collection('notifications').doc();
      const notificationWithTimestamps = {
        ...notificationData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: notificationData.isRead ?? false
      };
      
      await newNotifRef.set(notificationWithTimestamps);
      return { id: newNotifRef.id, ...notificationData };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  static async markNotificationAsRead(notificationId) {
    try {
      await db.collection('notifications').doc(notificationId).update({
        isRead: true,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * TIME SLOTS COLLECTION
   */

  static async getTimeSlotsByDate(date) {
    try {
      const snapshot = await db.collection('timeSlots')
        .where('date', '==', date)
        .where('isAvailable', '==', true)
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting time slots by date:', error);
      throw error;
    }
  }

  static async getTimeSlotsByCounselor(counselorId) {
    try {
      const snapshot = await db.collection('timeSlots')
        .where('counselorId', '==', counselorId)
        .orderBy('date', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting time slots by counselor:', error);
      throw error;
    }
  }

  static async createTimeSlot(slotData) {
    try {
      const newSlotRef = db.collection('timeSlots').doc();
      const slotWithTimestamps = {
        ...slotData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookedCount: slotData.bookedCount ?? 0,
        isAvailable: slotData.isAvailable ?? true
      };
      
      await newSlotRef.set(slotWithTimestamps);
      return { id: newSlotRef.id, ...slotData };
    } catch (error) {
      console.error('Error creating time slot:', error);
      throw error;
    }
  }

  static async updateTimeSlot(slotId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('timeSlots').doc(slotId).update(updateData);
      return { id: slotId, ...updates };
    } catch (error) {
      console.error('Error updating time slot:', error);
      throw error;
    }
  }

  /**
   * ANNOUNCEMENTS COLLECTION
   */

  static async getAllAnnouncements() {
    try {
      const snapshot = await db.collection('announcements')
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting announcements:', error);
      throw error;
    }
  }

  /**
   * COUNSELING SESSIONS COLLECTION
   */

  static async createCounselingSession(sessionData) {
    try {
      const newSessionRef = db.collection('counselingSessions').doc();
      const sessionWithTimestamps = {
        ...sessionData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await newSessionRef.set(sessionWithTimestamps);
      return { id: newSessionRef.id, ...sessionData };
    } catch (error) {
      console.error('Error creating counseling session:', error);
      throw error;
    }
  }

  static async getCounselingSessionsByUser(userId) {
    try {
      const snapshot = await db.collection('counselingSessions')
        .where('studentId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting counseling sessions:', error);
      throw error;
    }
  }

  /**
   * STUDENT PROFILES COLLECTION
   */

  static async getStudentProfile(userId) {
    try {
      const docSnap = await db.collection('studentProfiles').doc(userId).get();
      return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      console.error('Error getting student profile:', error);
      throw error;
    }
  }

  static async createStudentProfile(profileData) {
    try {
      const newProfileRef = db.collection('studentProfiles').doc(profileData.userId);
      const profileWithTimestamps = {
        ...profileData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await newProfileRef.set(profileWithTimestamps);
      return { id: newProfileRef.id, ...profileData };
    } catch (error) {
      console.error('Error creating student profile:', error);
      throw error;
    }
  }

  static async updateStudentProfile(userId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('studentProfiles').doc(userId).update(updateData);
      return { id: userId, ...updates };
    } catch (error) {
      console.error('Error updating student profile:', error);
      throw error;
    }
  }

  /**
   * ANNOUNCEMENTS COLLECTION
   */

  static async createAnnouncement(announcementData) {
    try {
      const newAnnRef = db.collection('announcements').doc();
      const announcementWithTimestamps = {
        ...announcementData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await newAnnRef.set(announcementWithTimestamps);
      return { id: newAnnRef.id, ...announcementData };
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  }

  static async getAllAnnouncements() {
    try {
      const snapshot = await db.collection('announcements')
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting announcements:', error);
      throw error;
    }
  }

  /**
   * TIME SLOTS COLLECTION
   */

  static async createTimeSlot(slotData) {
    try {
      const newSlotRef = db.collection('timeSlots').doc();
      const slotWithTimestamps = {
        ...slotData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await newSlotRef.set(slotWithTimestamps);
      return { id: newSlotRef.id, ...slotData };
    } catch (error) {
      console.error('Error creating time slot:', error);
      throw error;
    }
  }

  static async getTimeSlots(filters = {}) {
    try {
      let query = db.collection('timeSlots');
      
      if (filters.counselorId) {
        query = query.where('counselorId', '==', filters.counselorId);
      }
      if (filters.date) {
        query = query.where('date', '==', filters.date);
      }
      if (filters.isAvailable !== undefined) {
        query = query.where('isAvailable', '==', filters.isAvailable);
      }
      
      const snapshot = await query.orderBy('date', 'asc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      // Fallback to in-memory sort if orderBy fails
      try {
        const snapshot = await query.get();
        let slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        slots.sort((a, b) => new Date(a.date) - new Date(b.date));
        return slots;
      } catch {
        console.error('Error getting time slots:', error);
        throw error;
      }
    }
  }

  /**
   * APPOINTMENT REQUESTS COLLECTION
   */

  static async createAppointmentRequest(appointmentData) {
    try {
      const newAppRef = db.collection('appointmentRequests').doc();
      const appointmentWithTimestamps = {
        ...appointmentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await newAppRef.set(appointmentWithTimestamps);
      return { id: newAppRef.id, ...appointmentData };
    } catch (error) {
      console.error('Error creating appointment request:', error);
      throw error;
    }
  }

  static async getAppointmentRequests(filters = {}) {
    try {
      let query = db.collection('appointmentRequests');
      
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      
      // Try to order by createdAt, but if that fails (no index), sort in memory
      try {
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (orderError) {
        console.log('⚠️ OrderBy failed, fetching and sorting in memory...');
        const snapshot = await query.get();
        let requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort in memory by createdAt descending
        requests.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        return requests;
      }
    } catch (error) {
      console.error('Error getting appointment requests:', error.message);
      throw error;
    }
  }

  static async updateAppointmentRequest(appointmentId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('appointmentRequests').doc(appointmentId).update(updateData);
      return { id: appointmentId, ...updates };
    } catch (error) {
      console.error('Error updating appointment request:', error);
      throw error;
    }
  }

  static async getCollectionData(collectionName) {
    try {
      const snapshot = await db.collection(collectionName).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error getting ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * UTILITY METHODS
   */

  static async deleteDocument(collection, docId) {
    try {
      await db.collection(collection).doc(docId).delete();
    } catch (error) {
      console.error(`Error deleting ${collection}/${docId}:`, error);
      throw error;
    }
  }

  static async deleteUser(userId) {
    try {
      await db.collection('users').doc(userId).delete();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

export default FirestoreAdapter;
