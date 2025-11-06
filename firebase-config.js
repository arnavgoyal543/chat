// Firebase configuration and initialization
// Replace with your actual Firebase config

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';

// Your Firebase configuration object
// IMPORTANT: Replace these values with your actual Firebase project configuration
const firebaseConfig = {
 apiKey: "AIzaSyAx7veho0B__g2xmWO2IfwfodoX94ggJ_c",
    authDomain: "chatterbox-lite-od5xk.firebaseapp.com",
    databaseURL: "https://chatterbox-lite-od5xk-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chatterbox-lite-od5xk",
    storageBucket: "chatterbox-lite-od5xk.firebasestorage.app",
    messagingSenderId: "415560018535",
    appId: "1:415560018535:web:b56bd7e041cde9c81c82c2"
};

// Initialize Firebase
let app, auth, database, storage, googleProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  database = getDatabase(app);
  storage = getStorage(app);
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
export { auth, database, storage, googleProvider };



