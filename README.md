# Real-Time Chat Web App

A complete real-time chat application built with vanilla JavaScript, Firebase Realtime Database, and Google Authentication.

## Features

✅ **Authentication**
- Google Sign In/Sign Out
- User profile display (name, photo)

✅ **Real-Time Messaging**
- One-to-one messaging between users
- Real-time chat updates (no page reload required)
- Message timestamps
- Seen/read receipts with checkmarks

✅ **User Experience**
- Typing indicator when users are typing
- Online/offline status using Firebase presence
- User list showing all registered users
- Modern, responsive UI with Tailwind CSS

✅ **Media Support**
- Send image URLs (jpg, png, gif, webp)
- Send audio URLs (mp3, wav, ogg, m4a)
- Support for base64 image/audio data
- Inline media display in chat

✅ **Error Handling**
- Comprehensive error handling for all Firebase operations
- User-friendly error messages
- Connection status monitoring

## Tech Stack

- **Frontend**: HTML, CSS (Tailwind), Vanilla JavaScript (ES6 modules)
- **Backend**: Firebase Realtime Database
- **Authentication**: Firebase Auth with Google provider
- **Real-time**: Firebase onValue listeners
- **Presence**: Firebase .info/connected system

## Project Structure

```
/
├── index.html          # Main HTML file with chat interface
├── style.css           # Custom CSS styles for enhanced UI
├── app.js             # Main application logic
├── firebase-config.js  # Firebase configuration and initialization
└── README.md          # This file
```

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable **Realtime Database**:
   - Go to "Realtime Database" in the left sidebar
   - Click "Create Database"
   - Choose "Start in test mode" (for development)
   - Select your preferred location

4. Enable **Google Authentication**:
   - Go to "Authentication" → "Sign-in method"
   - Enable "Google" provider
   - Add your domain to authorized domains

5. Get your Firebase configuration:
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps"
   - Click "Web app" icon and register your app
   - Copy the configuration object

### 2. Configure the App

1. Open `firebase-config.js`
2. Replace the placeholder values with your actual Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-project-id-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 3. Firebase Security Rules

Set up these security rules in your Realtime Database:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "messages": {
      "$chatId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "typing": {
      "$chatId": {
        "$uid": {
          ".read": "auth != null",
          ".write": "auth != null && auth.uid == $uid"
        }
      }
    }
  }
}
```

### 4. Run the Application

1. Serve the files using a local web server (required for ES6 modules):

   **Option A: Using Python**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```

   **Option B: Using Node.js**
   ```bash
   npx serve .
   ```

   **Option C: Using Live Server (VS Code extension)**
   - Install "Live Server" extension
   - Right-click `index.html` and select "Open with Live Server"

2. Open your browser and navigate to `http://localhost:8000` (or your server's URL)

## Usage

### Getting Started
1. Click "Sign in with Google" to authenticate
2. Once logged in, you'll see the chat interface with:
   - Your profile in the sidebar
   - List of online users
   - Chat area (initially showing "Select a user to start chatting")

### Chatting
1. Click on any user in the sidebar to start a conversation
2. Type your message in the input field at the bottom
3. Press Enter or click "Send" to send the message
4. Messages appear in real-time with timestamps and read receipts

### Media Sharing
1. **Image URLs**: Paste any image URL (ending in .jpg, .png, .gif, .webp)
2. **Audio URLs**: Paste any audio URL (ending in .mp3, .wav, .ogg, .m4a)
3. **Base64 Data**: Paste base64 encoded image or audio data
4. Media will display inline in the chat

### Features in Action
- **Typing Indicator**: See when the other user is typing
- **Online Status**: Green dot shows online users, gray dot shows offline
- **Read Receipts**: Double checkmarks (✓✓) show when messages are read
- **Real-time Updates**: All changes happen instantly without page refresh

## Database Structure

The app uses this Firebase Realtime Database structure:

```
├── users/
│   └── {userId}/
│       ├── name: "User Name"
│       ├── email: "user@example.com"
│       ├── photoURL: "https://..."
│       ├── online: true/false
│       └── lastSeen: timestamp
├── messages/
│   └── {chatId}/
│       └── {messageId}/
│           ├── from: "senderId"
│           ├── to: "receiverId"
│           ├── text: "Message text"
│           ├── mediaURL: "https://..." (optional)
│           ├── timestamp: serverTimestamp
│           └── seen: true/false
└── typing/
    └── {chatId}/
        └── {userId}/
            ├── typing: true/false
            └── timestamp: serverTimestamp
```

## Troubleshooting

### Common Issues

1. **Firebase not initialized error**
   - Check that your Firebase configuration is correct
   - Ensure all required Firebase services are enabled

2. **CORS errors**
   - Make sure you're serving the files through a web server, not opening directly in browser
   - ES6 modules require a server environment

3. **Authentication fails**
   - Verify that Google auth is enabled in Firebase Console
   - Check that your domain is in the authorized domains list

4. **Database permission denied**
   - Ensure your Realtime Database security rules are set up correctly
   - Check that the user is authenticated before trying to access data

5. **Real-time updates not working**
   - Verify your database URL in the configuration
   - Check browser console for any JavaScript errors

### Browser Console
Open browser developer tools (F12) and check the console for detailed error messages.

## Security Notes

- The current security rules allow any authenticated user to read/write data
- For production use, implement more restrictive rules based on your requirements
- Consider adding rate limiting and data validation
- The app is configured for development/testing purposes

## Browser Compatibility

- Modern browsers that support ES6 modules
- Chrome 61+, Firefox 60+, Safari 10.1+, Edge 16+

## License

This project is open source and available under the MIT License.

