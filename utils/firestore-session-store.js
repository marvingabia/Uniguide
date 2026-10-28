import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, query, where, getDocs } from 'firebase-admin/firestore';
import firebaseApp from '../firebase-config.js';

/**
 * Custom Firestore Session Store for Express
 * 
 * Stores sessions in Firebase Firestore for persistent storage
 * Perfect for serverless platforms like Vercel
 */

class FirestoreSessionStore {
  constructor() {
    try {
      this.db = getFirestore(firebaseApp);
      this.sessionsCollection = 'sessions';
      console.log('✅ Firestore session store initialized');
    } catch (err) {
      console.error('❌ Firestore session store init error:', err.message);
      this.db = null;
    }
  }

  /**
   * Get session from Firestore
   */
  get(sid, callback) {
    // Fallback if Firebase not initialized
    if (!this.db) {
      console.warn('⚠️ Firestore not initialized, returning null');
      return callback(null, null);
    }

    try {
      const sessionRef = doc(this.db, this.sessionsCollection, sid);
      
      getDoc(sessionRef)
        .then((docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            
            // Check if session is expired
            if (data.expires && data.expires < Date.now()) {
              // Session expired, delete it
              this.destroy(sid, () => {});
              callback(null, null);
            } else {
              // Return session data (without metadata)
              const sessionData = { ...data };
              delete sessionData.expires;
              delete sessionData.createdAt;
              callback(null, sessionData);
            }
          } else {
            callback(null, null);
          }
        })
        .catch((err) => {
          console.error('❌ Firestore session GET error:', err.message);
          callback(null, null); // Fallback gracefully
        });
    } catch (err) {
      console.error('❌ Firestore session GET error:', err.message);
      callback(null, null);
    }
  }

  /**
   * Set session in Firestore
   */
  set(sid, sessionData, callback) {
    // Fallback if Firebase not initialized
    if (!this.db) {
      console.warn('⚠️ Firestore not initialized, skipping session save');
      return callback(null);
    }

    try {
      const sessionRef = doc(this.db, this.sessionsCollection, sid);
      
      // Extract maxAge from cookie
      const maxAge = sessionData.cookie?.maxAge || (1000 * 60 * 60 * 8); // 8 hours default
      const expiresAt = Date.now() + maxAge;

      const dataToStore = {
        ...sessionData,
        expires: expiresAt,
        createdAt: sessionData.cookie?.originalMaxAge 
          ? Date.now() 
          : (sessionData._createdAt || Date.now()),
        updatedAt: Date.now()
      };

      setDoc(sessionRef, dataToStore, { merge: true })
        .then(() => {
          callback(null);
        })
        .catch((err) => {
          console.error('❌ Firestore session SET error:', err.message);
          callback(null); // Fallback gracefully
        });
    } catch (err) {
      console.error('❌ Firestore session SET error:', err.message);
      callback(null);
    }
  }

  /**
   * Destroy session in Firestore
   */
  destroy(sid, callback) {
    try {
      const sessionRef = doc(this.db, this.sessionsCollection, sid);
      
      deleteDoc(sessionRef)
        .then(() => {
          callback(null);
        })
        .catch((err) => {
          console.error('❌ Firestore session DESTROY error:', err);
          callback(err);
        });
    } catch (err) {
      console.error('❌ Firestore session DESTROY error:', err);
      callback(err);
    }
  }

  /**
   * Clear all expired sessions
   */
  async clear(callback) {
    try {
      const now = Date.now();
      const expiredQuery = query(
        collection(this.db, this.sessionsCollection),
        where('expires', '<', now)
      );

      const expiredDocs = await getDocs(expiredQuery);
      const deletePromises = expiredDocs.docs.map((docSnapshot) =>
        deleteDoc(docSnapshot.ref)
      );

      await Promise.all(deletePromises);
      callback(null);
    } catch (err) {
      console.error('❌ Firestore session CLEAR error:', err);
      callback(err);
    }
  }

  /**
   * Get session length (total sessions)
   */
  async length(callback) {
    try {
      const allSessions = await getDocs(
        collection(this.db, this.sessionsCollection)
      );
      callback(null, allSessions.size);
    } catch (err) {
      console.error('❌ Firestore session LENGTH error:', err);
      callback(err);
    }
  }

  /**
   * Get all sessions (for debugging)
   */
  async all(callback) {
    try {
      const allSessions = await getDocs(
        collection(this.db, this.sessionsCollection)
      );
      
      const sessions = {};
      allSessions.docs.forEach((doc) => {
        const data = doc.data();
        delete data.expires;
        delete data.createdAt;
        delete data.updatedAt;
        sessions[doc.id] = data;
      });

      callback(null, sessions);
    } catch (err) {
      console.error('❌ Firestore session ALL error:', err);
      callback(err);
    }
  }

  /**
   * Touch session (update lastAccess time)
   */
  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }
}

export default FirestoreSessionStore;
