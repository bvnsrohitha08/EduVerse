// ============================================================
//  firebase-config.js — EduVerse Firebase Initialization
// ============================================================
//
//  HOW TO SET UP YOUR FIREBASE PROJECT:
//  ─────────────────────────────────────
//  1. Go to https://console.firebase.google.com
//  2. Click "Add Project" → name it "EduVerse" → Create
//  3. In the left menu: Authentication → Get Started
//     → Enable "Email/Password" provider
//  4. In the left menu: Firestore Database → Create Database
//     → Start in "Test Mode" (for development) → Choose region
//  5. In Project Settings (gear icon) → General → Your Apps
//     → Click </> (Web) → Register app → Copy the config below
//  6. Replace the placeholder values below with YOUR actual config
//
//  IMPORTANT: Until you replace these values, the app runs in
//  "Demo Mode" — login, signup, and dashboards all work using
//  localStorage sessions instead of Firebase Auth/Firestore.
//
// ============================================================

// ⚠️  REPLACE THESE VALUES WITH YOUR FIREBASE PROJECT CONFIG ⚠️
var firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase safely — wrapped in try/catch so placeholder
// credentials don't break the page. Auth.js will detect the missing
// config and fall back to localStorage-based demo mode automatically.
var auth, db;

try {
    // Prevent re-initialization if already done (e.g., on hot reload)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
} catch (e) {
    // Firebase failed to initialize (likely placeholder credentials).
    // Provide stub objects so auth.js doesn't throw ReferenceErrors.
    console.warn(
        '[EduVerse] Firebase not configured. Running in Demo Mode. ' +
        'Replace the placeholder values in firebase-config.js to enable full auth.'
    );
    // Stub auth — isFirebaseConfigured() in auth.js will return false
    // and all functions will use localStorage sessions instead.
    auth = { onAuthStateChanged: function (cb) { return function () { }; }, signOut: function () { return Promise.resolve(); } };
    db = { collection: function () { return { doc: function () { return { get: function () { return Promise.reject(new Error('Firebase not configured')); }, set: function () { return Promise.reject(); }, update: function () { return Promise.reject(); } }; }, add: function () { return Promise.reject(); }, where: function () { return { orderBy: function () { return { onSnapshot: function (ok, err) { if (err) err(new Error('Firebase not configured')); }, limit: function () { return { get: function () { return Promise.reject(); } }; } }; } }; }, orderBy: function () { return { limit: function () { return { get: function () { return Promise.reject(); } }; } }; } }; } };
}
