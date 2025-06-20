// Firebase configuration and initialization
// Replace with your actual Firebase config

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

// Your Firebase configuration object
// IMPORTANT: Replace these values with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyA2Y_jXJRKaQZl4_81igZ2-Ptcsg0Mgtww",
  authDomain: "mansu-cf312.firebaseapp.com",
  databaseURL: "https://mansu-cf312-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mansu-cf312",
  storageBucket: "mansu-cf312.firebasestorage.app",
  messagingSenderId: "903982901097",
  appId: "1:903982901097:web:e32240d30eab6c17fbbff8",
  measurementId: "G-LDG1DW97HM"
};

// Initialize Firebase
let app, auth, database, googleProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  database = getDatabase(app);
  googleProvider = new GoogleAuthProvider();
  
  // Add additional Google provider settings for better compatibility
  googleProvider.addScope('email');
  googleProvider.addScope('profile');
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  
  console.log('Firebase initialized successfully');
  console.log('Auth domain:', firebaseConfig.authDomain);
  console.log('Current URL:', window.location.href);
} catch (error) {
  console.error('Error initializing Firebase:', error);
  console.error('Full error details:', {
    code: error.code,
    message: error.message,
    stack: error.stack
  });
  // Show user-friendly error message
  document.addEventListener('DOMContentLoaded', () => {
    const loginError = document.getElementById('loginError');
    if (loginError) {
      loginError.textContent = `Firebase error: ${error.message}`;
      loginError.classList.remove('hidden');
    }
  });
}

// Export Firebase services for use in other modules
export { auth, database, googleProvider };

