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
 * 
 * Environment variables required:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_PRIVATE_KEY_ID
 * - FIREBASE_PRIVATE_KEY
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_CLIENT_ID
 * - FIREBASE_AUTH_URI
 * - FIREBASE_TOKEN_URI
 * - FIREBASE_AUTH_PROVIDER_X509_CERT_URL
 * - FIREBASE_CLIENT_X509_CERT_URL
 * 
 * Or load from service account JSON file:
 * - FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file)
 */

let firebaseApp;

try {
  // Option 1: Load from JSON file (recommended for local development)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  
  if (serviceAccountPath) {
    console.log('📁 Loading Firebase service account from:', serviceAccountPath);
    const filePath = path.resolve(serviceAccountPath);
    const serviceAccountJson = fs.readFileSync(filePath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    firebaseApp = admin.initializeApp({
      credential: admin.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  } else {
    // Option 2: Load from environment variables (for Vercel)
    console.log('🔐 Loading Firebase credentials from environment variables');
    
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
      throw new Error(
        'Firebase credentials not configured. ' +
        'Set FIREBASE_SERVICE_ACCOUNT_PATH or individual env vars.'
      );
    }

    firebaseApp = admin.initializeApp({
      credential: admin.cert({
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
      }),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  }

  console.log('✅ Firebase Admin SDK initialized');
  console.log('🔥 Project ID:', process.env.FIREBASE_PROJECT_ID);

} catch (error) {
  console.error('❌ Firebase initialization failed:');
  console.error(error.message);
  process.exit(1);
}

export const db = getFirestore(firebaseApp);
export default firebaseApp;
