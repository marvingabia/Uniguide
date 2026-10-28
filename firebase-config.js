import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * Firebase Admin SDK initialization
 * 
 * This connects the Node.js app to Firebase Firestore
 * Loads credentials from FIREBASE_SERVICE_ACCOUNT (JSON string) or individual env vars
 */

let firebaseApp;
let db = null;

try {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  let serviceAccount = null;

  // Try parsing JSON string from env (Vercel)
  if (serviceAccountJson && serviceAccountJson.startsWith('{')) {
    try {
      console.log('🔐 Parsing FIREBASE_SERVICE_ACCOUNT from env variable');
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (parseErr) {
      console.warn('⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseErr.message);
    }
  }

  // If no JSON string, try loading from file (local development only)
  if (!serviceAccount) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      console.log('📁 Loading Firebase from file:', serviceAccountPath);
      const content = fs.readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(content);
    }
  }

  // If still no credentials, try individual env variables
  if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log('🔐 Building serviceAccount from individual env variables');
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (privateKey) {
      serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      };
    }
  }

  // Initialize Firebase if credentials are available
  if (serviceAccount && serviceAccount.project_id) {
    firebaseApp = admin.initializeApp({
      credential: admin.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    db = getFirestore(firebaseApp);
    console.log('✅ Firebase Admin SDK initialized');
    console.log('🔥 Project ID:', serviceAccount.project_id);
  } else {
    console.warn('⚠️ Firebase credentials not fully configured');
    console.warn('   Available env vars:');
    console.warn('   - FIREBASE_SERVICE_ACCOUNT:', !!process.env.FIREBASE_SERVICE_ACCOUNT);
    console.warn('   - FIREBASE_SERVICE_ACCOUNT_PATH:', !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    console.warn('   - FIREBASE_PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID);
    console.warn('   - FIREBASE_CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL);
    console.warn('   Firebase will NOT be available - app may fail on protected routes');
  }

} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
  console.warn('⚠️ Continuing without Firebase - app may fail on protected routes');
}

export const db_instance = db;
export default firebaseApp;
