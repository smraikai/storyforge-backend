import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Method 1: Try using environment variables (recommended for production)
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID || 'storyforge-586ca',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        projectId: 'storyforge-586ca',
      });
      console.log('🔥 Firebase Admin initialized with environment variables');
    } 
    // Method 2: Try using service account file
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        projectId: 'storyforge-586ca',
      });
      console.log('🔥 Firebase Admin initialized with service account file');
    }
    // Method 3: Try using Application Default Credentials (for Google Cloud environments)
    else {
      admin.initializeApp({
        projectId: 'storyforge-586ca',
      });
      console.log('🔥 Firebase Admin initialized with Application Default Credentials');
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    console.log('');
    console.log('📋 To fix this, you have these options:');
    console.log('');
    console.log('Option 1 - Environment Variables (Recommended):');
    console.log('1. Get your service account key from: https://console.firebase.google.com/project/storyforge-586ca/settings/serviceaccounts/adminsdk');
    console.log('2. Set these environment variables:');
    console.log('   export FIREBASE_PROJECT_ID="storyforge-586ca"');
    console.log('   export FIREBASE_CLIENT_EMAIL="your-service-account-email"');
    console.log('   export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    console.log('');
    console.log('Option 2 - Service Account File:');
    console.log('1. Download the JSON file and save as "firebase-service-account.json" in backend directory');
    console.log('2. Set: export GOOGLE_APPLICATION_CREDENTIALS="./firebase-service-account.json"');
    console.log('');
    throw error;
  }
}

export default admin;