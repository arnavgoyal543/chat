// Firebase configuration and initialization
// Replace with your actual Firebase config

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

// Your Firebase configuration object
// IMPORTANT: Replace these values with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCekDN15fZHQ4icxbFHHoYoX_ZHLcOghEU",
  authDomain: "pixelhope-c862c.firebaseapp.com",
  databaseURL: "https://pixelhope-c862c-default-rtdb.firebaseio.com",
  projectId: "pixelhope-c862c",
  storageBucket: "pixelhope-c862c.firebasestorage.app",
  messagingSenderId: "300311906122",
  appId: "1:300311906122:web:4b343c323b7e66071163b3",
  measurementId: "G-G41C3H05V9"
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


