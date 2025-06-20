// Main application logic for real-time chat app

import { auth, database, googleProvider } from './firebase-config.js';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  updateProfile
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
  off,
  limitToLast // <-- add this import
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

// Global state management
const state = {
  currentUser: null,
  selectedUser: null,
  users: {},
  messages: {},
  typingTimeouts: {},
  messageListeners: {},
  typingListeners: {},
  replyingTo: null,
  mediaRecorder: null,
  audioChunks: [],
  isRecording: false,

  // Add these variables to state for pagination
  messagePagination: {
    limit: 50,
    loaded: 0,
    oldestKey: null,
    chatId: null
  }
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
  sendBtn: null,
  voiceButton: null
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
  elements.voiceButton = document.getElementById('voiceButton');
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
  console.log('Loading users from database...');
  const usersRef = ref(database, 'users');
  
  onValue(usersRef, (snapshot) => {
    const users = snapshot.val() || {};
    console.log('Users data from database:', users);
    console.log('Number of users found:', Object.keys(users).length);
    
    state.users = users;
    listenToAllChats(); // <-- Add this line
    renderUsersList();
  }, (error) => {
    console.error('Error loading users:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message
    });
    showError('Failed to load users. Please refresh the page.', null);
  });
}

function renderUsersList() {
  console.log('Rendering users list...');
  console.log('Users list element:', elements.usersList);
  console.log('Current user:', state.currentUser?.uid);
  console.log('All users:', state.users);
  
  if (!elements.usersList) {
    console.error('Users list element not found!');
    return;
  }
  
  elements.usersList.innerHTML = '';

  const otherUsers = Object.entries(state.users).filter(([uid, user]) => {
    return uid !== state.currentUser?.uid;
  });

  if (otherUsers.length === 0) {
    elements.usersList.innerHTML = '<div class="text-center text-gray-500 py-4">No other users online yet.<br><span class="text-xs">Share this app with friends!</span></div>';
    return;
  }

  // Use DocumentFragment for batch DOM update
  const fragment = document.createDocumentFragment();
  otherUsers.forEach(([uid, user]) => {
    const userElement = createUserElement(uid, user);
    fragment.appendChild(userElement);
  });
  elements.usersList.appendChild(fragment);
  
  console.log('Users list rendered successfully');
}
function getUnreadCountForUser(uid) {
  if (!state.currentUser) return 0;
  const chatId = getChatId(state.currentUser.uid, uid);
  const messages = state.messages[chatId] || {};
  let count = 0;
  Object.values(messages).forEach(msg => {
    if (msg.from === uid && !msg.seen) count++;
  });
  return count;
}
function createUserElement(uid, user) {
  const unreadCount = getUnreadCountForUser(uid);
  const unreadBadge = unreadCount > 0
    ? `<span class="unread-badge">${unreadCount}</span>`
    : '';

  // Define statusClass and statusText
  const isOnline = user.online;
  const statusClass = isOnline ? 'status-online' : 'status-offline';
  const statusText = isOnline ? 'Online' : 'Offline';

  // Create the userDiv element
  const userDiv = document.createElement('div');
  userDiv.className = `user-item ${state.selectedUser?.uid === uid ? 'active' : ''}`;
  userDiv.dataset.uid = uid;

  userDiv.innerHTML = `
    <div class="flex items-center">
      <div class="relative">
        <img class="w-10 h-10 rounded-full" src="${user.photoURL || '/default-avatar.png'}" alt="${user.name}">
        <div class="absolute bottom-0 right-0 w-3 h-3 ${statusClass} rounded-full border-2 border-white"></div>
      </div>
      <div class="ml-3 flex items-center">
        <div class="font-semibold text-gray-800">${user.name}</div>
        ${unreadBadge}
      </div>
      <div class="text-xs text-gray-500 ml-3">${statusText}</div>
    </div>
  `;

  userDiv.addEventListener('click', () => selectUser(uid, user));

  return userDiv;
}

function selectUser(uid, user) {
  state.selectedUser = { uid, ...user };

  updateChatHeader();
  showChatInterface();
  // Do NOT call loadMessages() here, let listenToAllChats handle rendering
  setupTypingListener();

  // Render messages for the selected chat if already loaded
  const chatId = getChatId(state.currentUser.uid, uid);
  if (state.messages[chatId]) {
    renderMessages(state.messages[chatId]);
    markMessagesAsSeen();
  }

  // Always load the latest messages with pagination
  loadMessages(true);
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
function loadMessages(initial = true) {
  if (!state.currentUser || !state.selectedUser) return;

  const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
  state.messagePagination.chatId = chatId;
  let messagesQuery;
  let limit = state.messagePagination.limit;

  if (initial) {
    messagesQuery = query(ref(database, `messages/${chatId}`), limitToLast(limit));
  } else {
    // Load more: fetch messages older than oldestKey
    messagesQuery = query(
      ref(database, `messages/${chatId}`),
      orderByChild('timestamp'),
      endAt(state.messages[chatId][state.messagePagination.oldestKey].timestamp - 1),
      limitToLast(limit)
    );
  }

  // Clean up existing listener
  if (state.messageListeners[chatId]) {
    off(ref(database, `messages/${chatId}`), state.messageListeners[chatId]);
  }

  // Set up new listener
  const listener = onValue(messagesQuery, (snapshot) => {
    const messages = snapshot.val() || {};
    const keys = Object.keys(messages);
    if (keys.length === 0) {
      removeLoadMoreButton();
      return;
    }

    // Save oldest key for pagination
    const sortedKeys = keys.sort((a, b) => messages[a].timestamp - messages[b].timestamp);
    state.messagePagination.oldestKey = sortedKeys[0];
    state.messagePagination.loaded = keys.length;

    // If less than limit, hide load more
    if (keys.length < limit) {
      removeLoadMoreButton();
    } else {
      addLoadMoreButton();
    }

    // Merge messages for "load more"
    if (!initial && state.messages[chatId]) {
      state.messages[chatId] = { ...messages, ...state.messages[chatId] };
      renderMessages(messages, true); // Prepend
    } else {
      state.messages[chatId] = messages;
      renderMessages(messages);
    }
    markMessagesAsSeen().catch(console.error);
  }, (error) => {
    console.error('Error loading messages:', error);
    showError('Failed to load messages. Please try again.', null);
  });

  state.messageListeners[chatId] = listener;
}

// Update renderMessages to prepend messages if loading more
function renderMessages(messages, prepend = false) {
  if (!elements.messagesList) return;

  const sortedMessages = Object.entries(messages)
    .sort(([, a], [, b]) => a.timestamp - b.timestamp);

  if (!prepend) {
    elements.messagesList.innerHTML = '';
  }
  sortedMessages.forEach(([messageId, message]) => {
    // If prepend, only add messages not already in DOM
    if (prepend && document.getElementById(`msg-${messageId}`)) return;
    const messageElement = createMessageElement(messageId, message);
    messageElement.id = `msg-${messageId}`;
    if (prepend) {
      elements.messagesList.insertBefore(messageElement, elements.messagesList.firstChild);
    } else {
      elements.messagesList.appendChild(messageElement);
    }
  });
}

// Add Load More button logic
function addLoadMoreButton() {
  let btn = document.getElementById('loadMoreBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'loadMoreBtn';
    btn.className = 'load-more-btn';
    btn.textContent = 'Load More';
    btn.onclick = loadMoreMessages;
    elements.messagesList.parentNode.insertBefore(btn, elements.messagesList);
  }
  btn.classList.remove('hidden');
}

function removeLoadMoreButton() {
  const btn = document.getElementById('loadMoreBtn');
  if (btn) btn.classList.add('hidden');
}

// Load more messages handler
function loadMoreMessages() {
  loadMessages(false);
}

// Modified loadMessages for pagination
function loadMessages(initial = true) {
  if (!state.currentUser || !state.selectedUser) return;

  const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
  state.messagePagination.chatId = chatId;
  let messagesQuery;
  let limit = state.messagePagination.limit;

  if (initial) {
    messagesQuery = query(ref(database, `messages/${chatId}`), limitToLast(limit));
  } else {
    // Load more: fetch messages older than oldestKey
    messagesQuery = query(
      ref(database, `messages/${chatId}`),
      orderByChild('timestamp'),
      endAt(state.messages[chatId][state.messagePagination.oldestKey].timestamp - 1),
      limitToLast(limit)
    );
  }

  // Clean up existing listener
  if (state.messageListeners[chatId]) {
    off(ref(database, `messages/${chatId}`), state.messageListeners[chatId]);
  }

  // Set up new listener
  const listener = onValue(messagesQuery, (snapshot) => {
    const messages = snapshot.val() || {};
    const keys = Object.keys(messages);
    if (keys.length === 0) {
      removeLoadMoreButton();
      return;
    }

    // Save oldest key for pagination
    const sortedKeys = keys.sort((a, b) => messages[a].timestamp - messages[b].timestamp);
    state.messagePagination.oldestKey = sortedKeys[0];
    state.messagePagination.loaded = keys.length;

    // If less than limit, hide load more
    if (keys.length < limit) {
      removeLoadMoreButton();
    } else {
      addLoadMoreButton();
    }

    // Merge messages for "load more"
    if (!initial && state.messages[chatId]) {
      state.messages[chatId] = { ...messages, ...state.messages[chatId] };
      renderMessages(messages, true); // Prepend
    } else {
      state.messages[chatId] = messages;
      renderMessages(messages);
    }
    markMessagesAsSeen().catch(console.error);
  }, (error) => {
    console.error('Error loading messages:', error);
    showError('Failed to load messages. Please try again.', null);
  });

  state.messageListeners[chatId] = listener;
}

// In selectUser, always call loadMessages(true)
function selectUser(uid, user) {
  state.selectedUser = { uid, ...user };

  updateChatHeader();
  showChatInterface();
  setupTypingListener();

  // Always load the latest messages with pagination
  loadMessages(true);
}

// Add reply state management
function handleReplyClick(messageId, message) {
  state.replyingTo = {
    messageId,
    text: message.text,
    from: message.from,
    type: message.type,
    mediaURL: message.mediaURL
  };
  updateReplyUI();
  elements.messageText.focus();
}

function updateReplyUI() {
  const replyPreview = document.getElementById('replyPreview');
  if (state.replyingTo) {
    const replyToUser = state.users[state.replyingTo.from];
    const replyToName = replyToUser ? replyToUser.name : 'User';
    
    let replyContent = '';
    
    // Add text content if exists
    if (state.replyingTo.text) {
      replyContent += `<div class="reply-text">${escapeHtml(state.replyingTo.text)}</div>`;
    }
    
    // Add media content if exists
    if (state.replyingTo.mediaURL) {
      if (state.replyingTo.type === 'voice') {
        replyContent += `
          <div class="reply-media voice-message">
            <audio controls>
              <source src="${state.replyingTo.mediaURL}" type="audio/webm">
              Your browser does not support the audio element.
            </audio>
            <span class="voice-duration">Voice note</span>
          </div>
        `;
      } else if (state.replyingTo.mediaURL.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(state.replyingTo.mediaURL)) {
        replyContent += `
          <div class="reply-media">
            <img src="${state.replyingTo.mediaURL}" alt="Shared image" class="reply-image">
          </div>
        `;
      }
    }
    
    replyPreview.innerHTML = `
      <div class="reply-preview">
        <div class="reply-to">Replying to ${replyToName}</div>
        ${replyContent}
        <button onclick="cancelReply()" class="cancel-reply">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;
    replyPreview.classList.remove('hidden');
  } else {
    replyPreview.classList.add('hidden');
  }
}

function cancelReply() {
  state.replyingTo = null;
  updateReplyUI();
}

// Add success message function
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Emoji picker functionality
const emojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
  '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
  '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
  '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
  '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
  '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
  '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
  '🤠', '💩', '👻', '👽', '👾', '🤖', '😺', '😸',
  '🙌', '👏', '👋', '🤙', '👍', '👎', '👊', '✊',
  '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🙏',
  '🫶', '🤲', '👐', '✋', '🤚', '🖐️', '🖖', '👈',
  '👉', '👆', '👇', '☝️', '🖕', '✍️','💓', '💗', 
  '💖', '💘', '💝', '💞', '💕', '❤️',
  '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍',
  '💔', '❣️', '💟', '💯', '💢', '💥', '🕳️','✨', 
  '🌟', '💫', '🌈', '☀️', '🌤️', '⛅', '☁️',
  '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '🌪️', '🌊', '💧',
  '🔥', '⚡', '🌙', '🌑', '🌕', '🌍', '🪐', '🛸',
  '🎉', '🎊', '🎈', '🎂', '🎁', '🎀', '🧸', '🎮',
  '🎧', '🎤', '📱', '💻', '🖥️', '🕹️', '📸', '📷',
  '📹', '🎬', '📺', '📻', '📡', '⌚', '⏰', '🕰️',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄',
  '🐔', '🐧', '🐦', '🐤', '🐣', '🦆', '🦅', '🦉',
  '🐢', '🐍', '🦎', '🦂', '🕷️', '🦕', '🦖', '🐙'
];

function initializeEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiButton = document.getElementById('emojiButton');
    const messageText = document.getElementById('messageText');
    
    // Populate emoji grid
    const emojiGrid = emojiPicker.querySelector('.emoji-grid');
    emojis.forEach(emoji => {
        const emojiItem = document.createElement('button');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji;
        emojiItem.onclick = () => {
            messageText.value += emoji;
            messageText.focus();
            emojiPicker.classList.add('hidden');
        };
        emojiGrid.appendChild(emojiItem);
    });
    
    // Toggle emoji picker
    emojiButton.onclick = (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle('hidden');
    };
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
            emojiPicker.classList.add('hidden');
        }
    });
}

// Dark theme functionality
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        document.documentElement.setAttribute('data-theme', prefersDark.matches ? 'dark' : 'light');
    }
    
    // Toggle theme
    themeToggle.onclick = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    };
    
    // Listen for system theme changes
    prefersDark.addListener((e) => {
        if (!localStorage.getItem('theme')) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });
}

// Profile settings functionality
function initializeProfileSettings() {
    const profileSettingsBtn = document.getElementById('profileSettingsBtn');
    const profileSettingsModal = document.getElementById('profileSettingsModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const saveProfileEdit = document.getElementById('saveProfileEdit');
    const displayNameInput = document.getElementById('displayName');
    
    // Open modal
    profileSettingsBtn.onclick = () => {
        displayNameInput.value = state.currentUser.displayName || '';
        profileSettingsModal.classList.remove('hidden');
    };
    
    // Close modal
    const closeModal = () => {
        profileSettingsModal.classList.add('hidden');
    };
    
    closeProfileModal.onclick = closeModal;
    cancelProfileEdit.onclick = closeModal;
    
    // Save changes
    saveProfileEdit.onclick = async () => {
        const newDisplayName = displayNameInput.value.trim();
        
        if (!newDisplayName) {
            showError('Display name cannot be empty', null);
            return;
        }
        
        try {
            saveProfileEdit.classList.add('btn-loading');
            
            // Update user profile in Firebase Auth
            await updateProfile(auth.currentUser, {
                displayName: newDisplayName
            });
            
            // Update user data in Realtime Database
            const userRef = ref(database, `users/${state.currentUser.uid}`);
            await update(userRef, {
                name: newDisplayName
            });
            
            // Update local state
            state.currentUser.displayName = newDisplayName;
            elements.currentUserName.textContent = newDisplayName;
            
            // Update UI in active chat if it's the current user
            if (state.selectedUser && state.selectedUser.uid === state.currentUser.uid) {
                elements.chatUserName.textContent = newDisplayName;
            }
            
            closeModal();
            showSuccess('Display name updated successfully');
            
        } catch (error) {
            console.error('Error updating display name:', error);
            showError('Failed to update display name. Please try again.', null);
        } finally {
            saveProfileEdit.classList.remove('btn-loading');
        }
    };
}

// Voice recording functionality
async function initializeVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaRecorder = new MediaRecorder(stream);
    
    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        state.audioChunks.push(event.data);
      }
    };
    
    state.mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        
        // Send the voice note
        await sendVoiceNote(base64Audio);
        
        // Clean up
        state.audioChunks = [];
        URL.revokeObjectURL(audioUrl);
      };
    };
    
    // Set up voice button click handler
    elements.voiceButton.onclick = toggleRecording;
    
  } catch (error) {
    console.error('Error initializing voice recording:', error);
    showError('Failed to initialize voice recording. Please check microphone permissions.', null);
  }
}

function toggleRecording() {
  if (!state.mediaRecorder) {
    showError('Voice recording not initialized. Please refresh the page.', null);
    return;
  }
  
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (!state.currentUser || !state.selectedUser) {
    showError('Please select a user to send voice note to.', null);
    return;
  }
  
  state.audioChunks = [];
  state.mediaRecorder.start();
  state.isRecording = true;
  
  // Update UI
  elements.voiceButton.classList.add('recording');
  elements.voiceButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="10" cy="10" r="6" fill="currentColor"/>
    </svg>
  `;
  
  // Show recording indicator
  const recordingIndicator = document.createElement('div');
  recordingIndicator.id = 'recordingIndicator';
  recordingIndicator.className = 'recording-indicator';
  recordingIndicator.innerHTML = 'Recording...';
  elements.messageInput.insertBefore(recordingIndicator, elements.messageInput.firstChild);
}

function stopRecording() {
  if (!state.isRecording) return;
  
  state.mediaRecorder.stop();
  state.isRecording = false;
  
  // Update UI
  elements.voiceButton.classList.remove('recording');
  elements.voiceButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 005 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
    </svg>
  `;
  
  // Remove recording indicator
  const recordingIndicator = document.getElementById('recordingIndicator');
  if (recordingIndicator) {
    recordingIndicator.remove();
  }
}

async function sendVoiceNote(audioData) {
  if (!state.currentUser || !state.selectedUser) return;
  
  try {
    elements.sendBtn.classList.add('btn-loading');
    
    const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
    const messagesRef = ref(database, `messages/${chatId}`);
    
    const messageData = {
      from: state.currentUser.uid,
      to: state.selectedUser.uid,
      timestamp: serverTimestamp(),
      seen: false,
      mediaURL: audioData,
      type: 'voice'
    };
    
    // Add reply data if there's a reply to a message
    if (state.replyingTo) {
      const replyData = {
        messageId: state.replyingTo.messageId,
        from: state.replyingTo.from
      };
      
      // Only add text if it exists
      if (state.replyingTo.text) {
        replyData.text = state.replyingTo.text;
      }
      
      // Only add media-related fields if it's a media message
      if (state.replyingTo.mediaURL) {
        replyData.mediaURL = state.replyingTo.mediaURL;
        replyData.type = state.replyingTo.type || 'image';
      }
      
      messageData.replyTo = replyData;
    }
    
    await push(messagesRef, messageData);
    
    // Clear reply state
    state.replyingTo = null;
    updateReplyUI();
    
    // Stop typing indicator
    await stopTyping();
    
  } catch (error) {
    console.error('Error sending voice note:', error);
    showError('Failed to send voice note. Please try again.', null);
  } finally {
    elements.sendBtn.classList.remove('btn-loading');
  }
}

// Update initializeApp function
function initializeApp() {
    try {
        initializeElements();
        setupEventListeners();
        initializeEmojiPicker();
        initializeTheme();
        initializeProfileSettings();
        initializeVoiceRecording();
        console.log('Chat app initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to initialize app. Please refresh the page.');
    }
}

// Test function to add a sample user (for debugging)
window.addTestUser = async function() {
  if (!state.currentUser) {
    console.log('Please sign in first');
    return;
  }
  
  try {
    await set(ref(database, 'users/test-user-123'), {
      name: 'Test User',
      email: 'test@example.com',
      photoURL: 'https://via.placeholder.com/50',
      online: true,
      lastSeen: serverTimestamp()
    });
    console.log('Test user added successfully');
  } catch (error) {
    console.error('Error adding test user:', error);
  }
};

// Expose debugging functions
window.debugChat = {
  state: () => state,
  users: () => state.users,
  currentUser: () => state.currentUser,
  reloadUsers: loadUsers,
  addTestUser: window.addTestUser
};

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Utility functions
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanupChatListeners() {
  // Remove all message listeners
  Object.keys(state.messageListeners).forEach(chatId => {
    const messagesRef = ref(database, `messages/${chatId}`);
    off(messagesRef, state.messageListeners[chatId]);
    delete state.messageListeners[chatId];
  });

  // Remove all typing listeners
  Object.keys(state.typingListeners).forEach(chatId => {
    const typingRef = ref(database, `typing/${chatId}/${state.selectedUser ? state.selectedUser.uid : ''}`);
    off(typingRef, state.typingListeners[chatId]);
    delete state.typingListeners[chatId];
  });
}

// Add this function anywhere before setupEventListeners is called

async function sendMessage() {
  const messageText = elements.messageText.value.trim();
  if ((!messageText && !state.replyingTo) || !state.currentUser || !state.selectedUser) return;

  try {
    elements.sendBtn.classList.add('btn-loading');

    const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
    const messagesRef = ref(database, `messages/${chatId}`);

    const messageData = {
      from: state.currentUser.uid,
      to: state.selectedUser.uid,
      timestamp: serverTimestamp(),
      seen: false
    };

    if (state.replyingTo) {
      const replyData = {
        messageId: state.replyingTo.messageId,
        from: state.replyingTo.from
      };
      if (state.replyingTo.text) replyData.text = state.replyingTo.text;
      if (state.replyingTo.mediaURL) {
        replyData.mediaURL = state.replyingTo.mediaURL;
        replyData.type = state.replyingTo.type || 'image';
      }
      messageData.replyTo = replyData;
    }

    if (messageText) {
      messageData.text = messageText;
    }

    await push(messagesRef, messageData).catch(console.error);

    elements.messageText.value = '';
    state.replyingTo = null;
    updateReplyUI();

    await stopTyping().catch(console.error);

  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message. Please try again.', null);
  } finally {
    elements.sendBtn.classList.remove('btn-loading');
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

// 2. Debounce typing indicator updates
let typingTimeout;
let typingDebounce;
async function handleTyping() {
  if (!state.currentUser || !state.selectedUser) return;

  // Debounce typing updates to 1 per 500ms
  if (typingDebounce) clearTimeout(typingDebounce);
  typingDebounce = setTimeout(async () => {
    try {
      const typingRef = ref(database, `typing/${state.messagePagination.chatId}/${state.currentUser.uid}`);
      set(typingRef, true);
      
      // Remove typing indicator after 1 second of inactivity
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        set(typingRef, false);
      }, 1000);
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, 500);
}

// Stop typing indicator
async function stopTyping() {
  if (!state.currentUser || !state.selectedUser) return;
  
  try {
    const typingRef = ref(database, `typing/${state.messagePagination.chatId}/${state.currentUser.uid}`);
    await set(typingRef, false);
  } catch (error) {
    console.error('Error stopping typing indicator:', error);
  }
}

// Mark messages as seen
async function markMessagesAsSeen() {
  if (!state.currentUser || !state.selectedUser) return;
  
  try {
    const chatId = getChatId(state.currentUser.uid, state.selectedUser.uid);
    const messages = state.messages[chatId] || {};
    const unseenMessages = Object.values(messages).filter(msg => msg.from !== state.currentUser.uid && !msg.seen);
    
    if (unseenMessages.length === 0) return;
    
    const updates = {};
    unseenMessages.forEach(msg => {
      updates[`messages/${chatId}/${msg.id}/seen`] = true;
    });
    
    await update(ref(database), updates);
    console.log('Messages marked as seen:', unseenMessages.length);
  } catch (error) {
    console.error('Error marking messages as seen:', error);
  }
}

// Create message element
function createMessageElement(messageId, message) {
  const isOwnMessage = message.from === state.currentUser.uid;
  const messageClass = isOwnMessage ? 'message-outgoing' : 'message-incoming';
  
  // Create message div
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${messageClass}`;
  messageDiv.dataset.id = messageId;
  
  // Message content
  let content = '';
  if (message.text) {
    content += `<div class="message-text">${escapeHtml(message.text)}</div>`;
  }
  
  // Media content
  if (message.mediaURL) {
    if (message.type === 'voice') {
      content += `
        <div class="message-media voice-message">
          <audio controls>
            <source src="${message.mediaURL}" type="audio/webm">
            Your browser does not support the audio element.
          </audio>
          <span class="voice-duration">Voice note</span>
        </div>
      `;
    } else if (message.mediaURL.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(message.mediaURL)) {
      content += `
        <div class="message-media">
          <img src="${message.mediaURL}" alt="Shared image" class="message-image">
        </div>
      `;
    }
  }
  
  // Replying message
  if (message.replyTo) {
    const replyToUser = state.users[message.replyTo.from];
    const replyToName = replyToUser ? replyToUser.name : 'User';
    
    let replyContent = '';
    if (message.replyTo.text) {
      replyContent += `<div class="reply-text">${escapeHtml(message.replyTo.text)}</div>`;
    }
    if (message.replyTo.mediaURL) {
      replyContent += `
        <div class="reply-media">
          <img src="${message.replyTo.mediaURL}" alt="Shared image" class="reply-image">
        </div>
      `;
    }
    
    content = `
      <div class="reply-preview">
        <div class="reply-to">Replying to ${replyToName}</div>
        ${replyContent}
      </div>
      ${content}
    `;
  }
  
  messageDiv.innerHTML = content;
  
  return messageDiv;
}

// ...existing code...
