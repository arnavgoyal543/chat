// Main application logic for real-time chat app

import { auth, database, googleProvider } from './firebase-config.js';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { 
  ref, 
  push, 
  set, 
  get,
  update,
  onValue, 
  onDisconnect,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
  off
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

// Global state management
const state = {
  currentUser: null,
  selectedUser: null,
  users: {},
  messages: {},
  typingTimeouts: {},
  messageListeners: {},
  typingListeners: {}
};

// DOM elements
const elements = {
  loginSection: null,
  chatSection: null,
  loginBtn: null,
  logoutBtn: null,
  loginError: null,
  currentUserName: null,
  currentUserPhoto: null,
  usersList: null,
  chatHeader: null,
  chatUserName: null,
  chatUserPhoto: null,
  chatUserStatus: null,
  chatUserStatusText: null,
  typingIndicator: null,
  messagesContainer: null,
  messagesList: null,
  noChat: null,
  messageInput: null,
  messageText: null,
  sendBtn: null
};

// Initialize DOM elements
function initializeElements() {
  elements.loginSection = document.getElementById('loginSection');
  elements.chatSection = document.getElementById('chatSection');
  elements.loginBtn = document.getElementById('loginBtn');
  elements.logoutBtn = document.getElementById('logoutBtn');
  elements.loginError = document.getElementById('loginError');
  elements.currentUserName = document.getElementById('currentUserName');
  elements.currentUserPhoto = document.getElementById('currentUserPhoto');
  elements.usersList = document.getElementById('usersList');
  elements.chatHeader = document.getElementById('chatHeader');
  elements.chatUserName = document.getElementById('chatUserName');
  elements.chatUserPhoto = document.getElementById('chatUserPhoto');
  elements.chatUserStatus = document.getElementById('chatUserStatus');
  elements.chatUserStatusText = document.getElementById('chatUserStatusText');
  elements.typingIndicator = document.getElementById('typingIndicator');
  elements.messagesContainer = document.getElementById('messagesContainer');
  elements.messagesList = document.getElementById('messagesList');
  elements.noChat = document.getElementById('noChat');
  elements.messageInput = document.getElementById('messageInput');
  elements.messageText = document.getElementById('messageText');
  elements.sendBtn = document.getElementById('sendBtn');
}

// Error handling utility
function showError(message, element = elements.loginError) {
  console.error(message);
  if (element) {
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => {
      element.classList.add('hidden');
    }, 5000);
  }
}

// Authentication functions
async function signInWithGoogle() {
  try {
    elements.loginBtn.classList.add('btn-loading');
    elements.loginError.classList.add('hidden');
    
    console.log('Attempting Google Sign-In...');
    console.log('Auth object:', auth);
    console.log('Google Provider:', googleProvider);
    console.log('Current domain:', window.location.hostname);
    console.log('Current URL:', window.location.href);
    
    // Try popup first, fallback to redirect for localhost issues
    let result;
    try {
      result = await signInWithPopup(auth, googleProvider);
    } catch (popupError) {
      if (popupError.code === 'auth/unauthorized-domain') {
        console.log('Popup failed due to unauthorized domain, trying redirect...');
        // Import redirect methods
        const { signInWithRedirect, getRedirectResult } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js');
        
        // Check if we're returning from a redirect
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult) {
          result = redirectResult;
        } else {
          // Start redirect flow
          await signInWithRedirect(auth, googleProvider);
          return; // Function will be called again after redirect
        }
      } else {
        throw popupError;
      }
    }
    const user = result.user;
    
    console.log('Sign-in successful! User:', {
      uid: user.uid,
      name: user.displayName,
      email: user.email
    });
    
    // Store user data in database
    await set(ref(database, `users/${user.uid}`), {
      name: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      lastSeen: serverTimestamp(),
      online: true
    });
    
    console.log('User data stored in database successfully');
  } catch (error) {
    console.error('Sign-in error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      customData: error.customData
    });
    
    let errorMessage = 'Failed to sign in. ';
    
    switch (error.code) {
      case 'auth/popup-blocked':
        errorMessage += 'Popup was blocked by browser. Please allow popups for this site.';
        break;
      case 'auth/popup-closed-by-user':
        errorMessage += 'Sign-in popup was closed. Please try again.';
        break;
      case 'auth/unauthorized-domain':
        errorMessage += 'This domain is not authorized. Please add your domain to Firebase Console.';
        break;
      case 'auth/operation-not-allowed':
        errorMessage += 'Google sign-in is not enabled. Please enable it in Firebase Console.';
        break;
      case 'auth/invalid-api-key':
        errorMessage += 'Invalid API key. Please check your Firebase configuration.';
        break;
      default:
        errorMessage += `Error: ${error.message}`;
        break;
    }
    
    showError(errorMessage);
  } finally {
    elements.loginBtn.classList.remove('btn-loading');
  }
}

async function signOutUser() {
  try {
    if (state.currentUser) {
      // Set user offline before signing out
      await set(ref(database, `users/${state.currentUser.uid}/online`), false);
      await set(ref(database, `users/${state.currentUser.uid}/lastSeen`), serverTimestamp());
    }
    
    await signOut(auth);
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Sign-out error:', error);
    showError('Failed to sign out. Please try again.', null);
  }
}

// User presence management
function setupPresenceSystem(user) {
  const userStatusRef = ref(database, `users/${user.uid}/online`);
  const userLastSeenRef = ref(database, `users/${user.uid}/lastSeen`);
  const connectedRef = ref(database, '.info/connected');
  
  // Monitor connection status
  onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === true) {
      // User is online
      set(userStatusRef, true);
      set(userLastSeenRef, serverTimestamp());
      
      // Set up disconnect handlers
      onDisconnect(userStatusRef).set(false);
      onDisconnect(userLastSeenRef).set(serverTimestamp());
    }
  });
}

// User management
function loadUsers() {
  const usersRef = ref(database, 'users');
  
  onValue(usersRef, (snapshot) => {
    const users = snapshot.val() || {};
    state.users = users;
    renderUsersList();
  }, (error) => {
    console.error('Error loading users:', error);
    showError('Failed to load users. Please refresh the page.', null);
  });
}

function renderUsersList() {
  if (!elements.usersList) return;
  
  elements.usersList.innerHTML = '';
  
  Object.entries(state.users).forEach(([uid, user]) => {
    // Don't show current user in the list
    if (uid === state.currentUser?.uid) return;
    
    const userElement = createUserElement(uid, user);
    elements.usersList.appendChild(userElement);
  });
}

function createUserElement(uid, user) {
  const userDiv = document.createElement('div');
  userDiv.className = `user-item ${state.selectedUser?.uid === uid ? 'active' : ''}`;
  userDiv.dataset.uid = uid;
  
  const isOnline = user.online;
  const statusClass = isOnline ? 'status-online' : 'status-offline';
  const statusText = isOnline ? 'Online' : 'Offline';
  
  userDiv.innerHTML = `
    <div class="flex items-center">
      <div class="relative">
        <img class="w-10 h-10 rounded-full" src="${user.photoURL || '/default-avatar.png'}" alt="${user.name}">
        <div class="absolute bottom-0 right-0 w-3 h-3 ${statusClass} rounded-full border-2 border-white"></div>
      </div>
      <div class="ml-3">
        <div class="font-semibold text-gray-800">${user.name}</div>
        <div class="text-xs text-gray-500">${statusText}</div>
      </div>
    </div>
  `;
  
  userDiv.addEventListener('click', () => selectUser(uid, user));
  
  return userDiv;
}

function selectUser(uid, user) {
  // Clean up previous chat
  if (state.selectedUser) {
    cleanupChatListeners();
  }
  
  state.selectedUser = { uid, ...user };
  
  // Update UI
  renderUsersList();
  updateChatHeader();
  showChatInterface();
  loadMessages();
  setupTypingListener();
}

function updateChatHeader() {
  if (!state.selectedUser) return;
  
  const user = state.selectedUser;
  const isOnline = user.online;
  
  elements.chatUserName.textContent = user.name;
  elements.chatUserPhoto.src = user.photoURL || '/default-avatar.png';
  elements.chatUserStatus.className = `w-2 h-2 rounded-full mr-2 ${isOnline ? 'status-online' : 'status-offline'}`;
  elements.chatUserStatusText.textContent = isOnline ? 'Online' : 'Offline';
  
  elements.chatHeader.classList.remove('hidden');
}

function showChatInterface() {
  elements.noChat.classList.add('hidden');
  elements.messagesList.classList.remove('hidden');
  elements.messageInput.classList.remove('hidden');
}

// Message management
function loadMessages() {
  if (!state.currentUser || !state.selectedUser) return;
  
  const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
  const messagesRef = ref(database, `messages/${chatId}`);
  
  // Clean up existing listener
  if (state.messageListeners[chatId]) {
    off(messagesRef, state.messageListeners[chatId]);
  }
  
  // Set up new listener
  const listener = onValue(messagesRef, (snapshot) => {
    const messages = snapshot.val() || {};
    state.messages[chatId] = messages;
    renderMessages(messages);
    markMessagesAsSeen();
  }, (error) => {
    console.error('Error loading messages:', error);
    showError('Failed to load messages. Please try again.', null);
  });
  
  state.messageListeners[chatId] = listener;
}

function renderMessages(messages) {
  if (!elements.messagesList) return;
  
  elements.messagesList.innerHTML = '';
  
  const sortedMessages = Object.entries(messages)
    .sort(([, a], [, b]) => a.timestamp - b.timestamp);
  
  sortedMessages.forEach(([messageId, message]) => {
    const messageElement = createMessageElement(messageId, message);
    elements.messagesList.appendChild(messageElement);
  });
  
  // Scroll to bottom
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function createMessageElement(messageId, message) {
  const messageDiv = document.createElement('div');
  const isSent = message.from === state.currentUser.uid;
  
  messageDiv.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
  
  let content = '';
  
  // Handle text content
  if (message.text) {
    content += `<div>${escapeHtml(message.text)}</div>`;
  }
  
  // Handle media content
  if (message.mediaURL) {
    content += createMediaContent(message.mediaURL);
  }
  
  // Add timestamp and status
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const statusClass = isSent ? '' : 'received';
  const seenIndicator = isSent && message.seen ? '<span class="seen-indicator">✓✓</span>' : '';
  
  content += `
    <div class="message-status ${statusClass}">
      <span class="message-timestamp">${timestamp}</span>
      ${seenIndicator}
    </div>
  `;
  
  messageDiv.innerHTML = content;
  
  return messageDiv;
}

function createMediaContent(mediaURL) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaURL);
  const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(mediaURL);
  const isBase64Image = mediaURL.startsWith('data:image/');
  const isBase64Audio = mediaURL.startsWith('data:audio/');
  
  if (isImage || isBase64Image) {
    return `
      <div class="message-media">
        <img src="${mediaURL}" alt="Shared image" onload="this.parentElement.parentElement.scrollIntoView()" onerror="this.alt='Failed to load image'; this.style.display='none';">
      </div>
    `;
  } else if (isAudio || isBase64Audio) {
    return `
      <div class="message-media">
        <audio controls>
          <source src="${mediaURL}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
      </div>
    `;
  } else {
    // Fallback for other URLs
    return `
      <div class="message-media">
        <a href="${mediaURL}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline">
          ${mediaURL}
        </a>
      </div>
    `;
  }
}

async function sendMessage() {
  const messageText = elements.messageText.value.trim();
  
  if (!messageText || !state.currentUser || !state.selectedUser) return;
  
  try {
    elements.sendBtn.classList.add('btn-loading');
    
    const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
    const messagesRef = ref(database, `messages/${chatId}`);
    
    // Detect if message contains media URL or base64 data
    const mediaURL = detectMediaContent(messageText);
    
    const messageData = {
      from: state.currentUser.uid,
      to: state.selectedUser.uid,
      timestamp: serverTimestamp(),
      seen: false
    };
    
    if (mediaURL) {
      messageData.mediaURL = mediaURL;
      // If it's just a media URL, don't include it as text
      if (messageText !== mediaURL) {
        messageData.text = messageText.replace(mediaURL, '').trim();
      }
    } else {
      messageData.text = messageText;
    }
    
    await push(messagesRef, messageData);
    
    // Clear input
    elements.messageText.value = '';
    
    // Stop typing indicator
    await stopTyping();
    
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message. Please try again.', null);
  } finally {
    elements.sendBtn.classList.remove('btn-loading');
  }
}

function detectMediaContent(text) {
  // Check for base64 image or audio data
  if (text.startsWith('data:image/') || text.startsWith('data:audio/')) {
    return text;
  }
  
  // Check for image or audio URLs
  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp3|wav|ogg|m4a))/i;
  const match = text.match(urlRegex);
  
  return match ? match[0] : null;
}

async function markMessagesAsSeen() {
  if (!state.currentUser || !state.selectedUser) return;
  
  const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
  const messages = state.messages[chatId] || {};
  
  // Mark unread messages from the selected user as seen
  const updates = {};
  Object.entries(messages).forEach(([messageId, message]) => {
    if (message.from === state.selectedUser.uid && !message.seen) {
      updates[`messages/${chatId}/${messageId}/seen`] = true;
    }
  });
  
  if (Object.keys(updates).length > 0) {
    try {
      await update(ref(database), updates);
    } catch (error) {
      console.error('Error marking messages as seen:', error);
    }
  }
}

// Typing indicator functionality
let typingTimeout;

async function handleTyping() {
  if (!state.currentUser || !state.selectedUser) return;
  
  try {
    const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
    const typingRef = ref(database, `typing/${chatId}/${state.currentUser.uid}`);
    
    // Set typing status
    await set(typingRef, {
      typing: true,
      timestamp: serverTimestamp()
    });
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set timeout to stop typing after 3 seconds
    typingTimeout = setTimeout(async () => {
      await stopTyping();
    }, 3000);
    
  } catch (error) {
    console.error('Error setting typing status:', error);
  }
}

async function stopTyping() {
  if (!state.currentUser || !state.selectedUser) return;
  
  try {
    const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
    const typingRef = ref(database, `typing/${chatId}/${state.currentUser.uid}`);
    
    await set(typingRef, null);
    
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    
  } catch (error) {
    console.error('Error removing typing status:', error);
  }
}

function setupTypingListener() {
  if (!state.currentUser || !state.selectedUser) return;
  
  const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
  const typingRef = ref(database, `typing/${chatId}/${state.selectedUser.uid}`);
  
  // Clean up existing listener
  if (state.typingListeners[chatId]) {
    off(typingRef, state.typingListeners[chatId]);
  }
  
  // Set up new listener
  const listener = onValue(typingRef, (snapshot) => {
    const typingData = snapshot.val();
    const isTyping = typingData && typingData.typing;
    
    if (isTyping) {
      elements.typingIndicator.innerHTML = `<span class="typing-dots">${state.selectedUser.name} is typing</span>`;
      elements.typingIndicator.classList.remove('hidden');
    } else {
      elements.typingIndicator.classList.add('hidden');
    }
  });
  
  state.typingListeners[chatId] = listener;
}

// Utility functions
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function cleanupChatListeners() {
  if (state.selectedUser) {
    const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
    
    // Clean up message listener
    if (state.messageListeners[chatId]) {
      const messagesRef = ref(database, `messages/${chatId}`);
      off(messagesRef, state.messageListeners[chatId]);
      delete state.messageListeners[chatId];
    }
    
    // Clean up typing listener
    if (state.typingListeners[chatId]) {
      const typingRef = ref(database, `typing/${chatId}/${state.selectedUser.uid}`);
      off(typingRef, state.typingListeners[chatId]);
      delete state.typingListeners[chatId];
    }
  }
}

// Event listeners setup
function setupEventListeners() {
  // Authentication events
  elements.loginBtn.addEventListener('click', signInWithGoogle);
  elements.logoutBtn.addEventListener('click', signOutUser);
  
  // Message events
  elements.sendBtn.addEventListener('click', sendMessage);
  elements.messageText.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Typing indicator events
  elements.messageText.addEventListener('input', handleTyping);
  elements.messageText.addEventListener('blur', stopTyping);
  
  // Authentication state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      state.currentUser = user;
      
      // Update UI
      elements.currentUserName.textContent = user.displayName;
      elements.currentUserPhoto.src = user.photoURL;
      
      // Show chat interface
      elements.loginSection.classList.add('hidden');
      elements.chatSection.classList.remove('hidden');
      
      // Setup presence and load data
      setupPresenceSystem(user);
      loadUsers();
      
    } else {
      state.currentUser = null;
      state.selectedUser = null;
      
      // Clean up listeners
      cleanupChatListeners();
      
      // Show login interface
      elements.chatSection.classList.add('hidden');
      elements.loginSection.classList.remove('hidden');
    }
  });
  
  // Handle page unload
  window.addEventListener('beforeunload', async () => {
    if (state.currentUser) {
      await stopTyping();
    }
  });
}

// Initialize application
function initializeApp() {
  try {
    initializeElements();
    setupEventListeners();
    console.log('Chat app initialized successfully');
  } catch (error) {
    console.error('Error initializing app:', error);
    showError('Failed to initialize app. Please refresh the page.');
  }
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

