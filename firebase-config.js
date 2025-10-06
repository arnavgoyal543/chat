// Firebase configuration and initialization
// Replace with your actual Firebase config

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

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

// Demo function to show message bubbles without Firebase
function addDemoMessages() {
  const messagesList = document.getElementById('messagesList');
  if (!messagesList) return;

  // Clear existing content
  messagesList.innerHTML = '';
  messagesList.classList.remove('hidden');
  
  // Hide "no chat" message
  const noChat = document.getElementById('noChat');
  if (noChat) noChat.classList.add('hidden');

  // Show message input
  const messageInput = document.getElementById('messageInput');
  if (messageInput) messageInput.classList.remove('hidden');

  // Demo messages
  const demoMessages = [
    { id: 'msg1', text: 'Hey there! How are you doing?', from: 'other', timestamp: '10:30 AM', avatar: '/default-avatar.png' },
    { id: 'msg2', text: 'I\'m doing great! Just working on this awesome chat app with enhanced mobile UI 😊', from: 'me', timestamp: '10:32 AM' },
    { id: 'msg3', text: 'That sounds exciting! I love the new message bubbles and mobile design', from: 'other', timestamp: '10:33 AM', avatar: '/default-avatar.png' },
    { id: 'msg4', text: 'Thanks! The mobile sidebar toggle and swipe gestures work really well too', from: 'me', timestamp: '10:35 AM' }
  ];

  demoMessages.forEach(msg => {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${msg.from === 'me' ? 'sent' : 'received'}`;
    
    // Add avatar for received messages
    if (msg.from !== 'me' && msg.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'message-avatar received';
      avatar.src = msg.avatar;
      avatar.alt = 'User';
      avatar.style.backgroundColor = '#e5e7eb'; // Fallback for missing images
      messageContainer.appendChild(avatar);
    }
    
    // Create message bubble
    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble ${msg.from === 'me' ? 'message-sent' : 'message-received'}`;
    
    const messageText = document.createElement('div');
    messageText.textContent = msg.text;
    messageBubble.appendChild(messageText);
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-timestamp';
    messageTime.textContent = msg.timestamp;
    messageBubble.appendChild(messageTime);
    
    messageContainer.appendChild(messageBubble);
    messagesList.appendChild(messageContainer);
  });

  // Show chat header
  const chatHeader = document.getElementById('chatHeader');
  if (chatHeader) {
    chatHeader.classList.remove('hidden');
    const chatUserName = document.getElementById('chatUserName');
    const chatUserPhoto = document.getElementById('chatUserPhoto');
    if (chatUserName) chatUserName.textContent = 'Demo User';
    if (chatUserPhoto) chatUserPhoto.src = '/default-avatar.png';
  }
}

// Demo toggle function for mobile menu (fallback if Firebase doesn't load)
function initDemoMode() {
  // Show chat section
  const chatSection = document.getElementById('chatSection');
  const loginSection = document.getElementById('loginSection');
  if (chatSection && loginSection) {
    loginSection.classList.add('hidden');
    chatSection.classList.remove('hidden');
  }

  // Add demo messages
  setTimeout(addDemoMessages, 500);
}

// Initialize demo mode if Firebase fails to load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!window.firebase) {
      console.log('Firebase not available, starting demo mode...');
      initDemoMode();
    }
  }, 2000);
});



