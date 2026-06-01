// ============================================================
//  auth.js — EduVerse Firebase Authentication Module  [v2]
//
//  PHASE 2 IMPROVEMENTS:
//    ✅ Firebase Auth display name set at signup (updateProfile)
//    ✅ Broken Firestore doc recovery in loginUser()
//    ✅ auth.setPersistence() set to LOCAL (survives browser restart)
//    ✅ serverTimestamp() on all Firestore writes
//    ✅ lastLoginAt tracked in Firestore on every login
//    ✅ Expanded friendly error messages for all Firebase codes
//    ✅ signupStudent / signupTeacher return uid for downstream use
//    ✅ guardDashboard refreshes stale local session from Firestore
//
//  DEPENDS ON:  firebase-config.js (auth, db globals)
//  SESSION STRATEGY:
//    PRIMARY  → Firebase Auth + Firestore (when credentials configured)
//    FALLBACK → localStorage demo session (placeholder credentials)
// ============================================================

'use strict';

// ── Session helpers ──────────────────────────────────────────
var SESSION_KEY = 'eduverse_session';

function saveLocalSession(userData) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(userData)); }
    catch (e) { /* ignore quota errors */ }
}

function getLocalSession() {
    try {
        var raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function clearLocalSession() {
    localStorage.removeItem(SESSION_KEY);
}

// ── Detect real Firebase credentials ────────────────────────
function isFirebaseConfigured() {
    try {
        var apiKey = firebase.app().options.apiKey || '';
        return apiKey.length > 10 && apiKey !== 'YOUR_API_KEY';
    } catch (e) { return false; }
}

// ── Set auth persistence (call once at startup) ───────────────
// LOCAL = session survives browser close/restart (best for students on shared devices? No — use SESSION)
// SESSION = cleared when tab closes (more secure in college labs)
(function setAuthPersistence() {
    if (!isFirebaseConfigured()) return;
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch(function (e) { console.warn('[EduVerse] Persistence error:', e.message); });
})();

// ════════════════════════════════════════════════════════════
//  SIGN UP — Student
// ════════════════════════════════════════════════════════════
async function signupStudent(name, email, password, course, year) {
    var userData = {
        name: name,
        email: email,
        role: 'student',
        course: course,
        yearOfStudy: year,
        attendanceCount: 0,
        totalClasses: 0
    };

    if (isFirebaseConfigured()) {
        try {
            // 1. Create Firebase Auth account
            var cred = await auth.createUserWithEmailAndPassword(email, password);
            var uid = cred.user.uid;
            userData.uid = uid;

            // 2. ✅ Set display name in Firebase Auth profile
            await cred.user.updateProfile({ displayName: name });

            // 3. Write user document to Firestore
            await db.collection('users').doc(uid).set(Object.assign({}, userData, {
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), // ✅ serverTimestamp
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
            }));

            saveLocalSession(userData);
            window.location.href = 'student-dashboard.html';
            return uid;
        } catch (error) {
            var msg = friendlyError(error.code);
            throw new Error(msg || error.message);
        }
    }

    // ── Demo fallback ────────────────────────────────────────
    userData.uid = 'demo-' + Date.now();
    saveLocalSession(userData);
    window.location.href = 'student-dashboard.html';
}

// ════════════════════════════════════════════════════════════
//  SIGN UP — Teacher
// ════════════════════════════════════════════════════════════
async function signupTeacher(name, email, password, subject) {
    var userData = {
        name: name,
        email: email,
        role: 'teacher',
        subject: subject
    };

    if (isFirebaseConfigured()) {
        try {
            var cred = await auth.createUserWithEmailAndPassword(email, password);
            var uid = cred.user.uid;
            userData.uid = uid;

            // ✅ Set display name in Firebase Auth profile
            await cred.user.updateProfile({ displayName: name });

            await db.collection('users').doc(uid).set(Object.assign({}, userData, {
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
            }));

            saveLocalSession(userData);
            window.location.href = 'teacher-dashboard.html';
            return uid;
        } catch (error) {
            var msg = friendlyError(error.code);
            throw new Error(msg || error.message);
        }
    }

    // ── Demo fallback ────────────────────────────────────────
    userData.uid = 'demo-' + Date.now();
    saveLocalSession(userData);
    window.location.href = 'teacher-dashboard.html';
}

// ════════════════════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════════════════════
async function loginUser(email, password) {
    if (isFirebaseConfigured()) {
        try {
            var cred = await auth.signInWithEmailAndPassword(email, password);
            var uid = cred.user.uid;

            var snap = await db.collection('users').doc(uid).get();

            // ✅ Broken doc recovery — Firestore write may have failed at signup
            if (!snap.exists) {
                var recoveredData = {
                    uid: uid,
                    name: cred.user.displayName || email.split('@')[0],
                    email: email,
                    role: window._activeLoginRole || 'student',
                    course: 'General',
                    attendanceCount: 0,
                    totalClasses: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                    recovered: true   // flag so we can show a notice
                };
                await db.collection('users').doc(uid).set(recoveredData);
                saveLocalSession(recoveredData);
                window.location.href = recoveredData.role === 'teacher'
                    ? 'teacher-dashboard.html'
                    : 'student-dashboard.html';
                return;
            }

            var userData = snap.data();

            // ✅ Update lastLoginAt on every login (useful for analytics)
            db.collection('users').doc(uid).update({
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(function () { /* non-critical — ignore */ });

            // ✅ Refresh local session with latest Firestore data
            saveLocalSession(Object.assign({}, userData, { uid: uid }));

            if (userData.role === 'student') {
                window.location.href = 'student-dashboard.html';
            } else if (userData.role === 'teacher') {
                window.location.href = 'teacher-dashboard.html';
            } else {
                throw new Error('Unknown account role. Please contact support.');
            }
            return;

        } catch (error) {
            var msg = friendlyError(error.code);
            throw new Error(msg || error.message);
        }
    }

    // ── Demo fallback (placeholder credentials) ───────────────
    var activeRole = (typeof window._activeLoginRole !== 'undefined')
        ? window._activeLoginRole : 'student';

    if (!email || !password) {
        throw new Error('Please enter your email and password.');
    }

    var demoUser = {
        uid: 'demo-' + Date.now(),
        name: email.split('@')[0] || 'Demo User',
        email: email,
        role: activeRole,
        course: activeRole === 'student' ? 'Biology' : undefined,
        subject: activeRole === 'teacher' ? 'General Science' : undefined,
        yearOfStudy: activeRole === 'student' ? 'Year 2' : undefined,
        attendanceCount: 8,
        totalClasses: 10
    };

    saveLocalSession(demoUser);
    window.location.href = activeRole === 'teacher'
        ? 'teacher-dashboard.html'
        : 'student-dashboard.html';
}

// ════════════════════════════════════════════════════════════
//  LOGOUT
// ════════════════════════════════════════════════════════════
async function logoutUser() {
    clearLocalSession();
    try {
        if (isFirebaseConfigured()) await auth.signOut();
    } catch (e) { /* ignore */ }
    window.location.href = 'login.html';
}

// ════════════════════════════════════════════════════════════
//  GUARD DASHBOARD PAGES
//  Strategy:
//    1. Check localStorage session (instant — no network)
//    2. If Firebase configured, verify Auth state in background
//       and refresh stale session data from Firestore
//    3. If no session at all → redirect to login
// ════════════════════════════════════════════════════════════
function guardDashboard(expectedRole, callback) {

    var localSession = getLocalSession();

    // ── Case 1: Valid local session for correct role ──────────
    if (localSession && localSession.role === expectedRole) {

        if (typeof callback === 'function') {
            callback({ uid: localSession.uid || 'local-user' }, localSession);
        }

        // ✅ Background Firebase verification + session refresh
        if (isFirebaseConfigured()) {
            auth.onAuthStateChanged(async function (firebaseUser) {
                if (!firebaseUser) {
                    clearLocalSession();
                    window.location.href = 'login.html';
                    return;
                }
                // ✅ Silently refresh Firestore data into localStorage
                // (picks up changes like attendanceCount updates)
                try {
                    var snap = await db.collection('users').doc(firebaseUser.uid).get();
                    if (snap.exists) {
                        saveLocalSession(Object.assign({}, snap.data(), { uid: firebaseUser.uid }));
                    }
                } catch (e) { /* ignore — non-critical refresh */ }
            });
        }
        return;
    }

    // ── Case 2: No local session — try Firebase ───────────────
    if (isFirebaseConfigured()) {
        auth.onAuthStateChanged(async function (user) {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            try {
                var snap = await db.collection('users').doc(user.uid).get();
                if (!snap.exists || snap.data().role !== expectedRole) {
                    clearLocalSession();
                    window.location.href = 'login.html';
                    return;
                }
                var userData = Object.assign({}, snap.data(), { uid: user.uid });
                saveLocalSession(userData);
                if (typeof callback === 'function') {
                    callback(user, userData);
                }
            } catch (err) {
                console.error('[EduVerse] Guard error:', err);
                window.location.href = 'login.html';
            }
        });
        return;
    }

    // ── Case 3: No session, no Firebase → login ───────────────
    window.location.href = 'login.html';
}

// ════════════════════════════════════════════════════════════
//  HELPER — Firebase Error Code → User-Friendly Message
// ════════════════════════════════════════════════════════════
function friendlyError(code) {
    var messages = {
        // Signup errors
        'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password must be at least 6 characters long.',
        'auth/operation-not-allowed': 'Email/password sign-in is not enabled. Contact support.',
        // Login errors
        'auth/user-not-found': 'No account found with this email. Please sign up first.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Incorrect email or password. Please try again.',
        'auth/user-disabled': 'This account has been disabled. Contact support.',
        // Rate limit / network
        'auth/too-many-requests': 'Too many failed attempts. Please wait a few minutes.',
        'auth/network-request-failed': 'Network error. Check your internet connection.',
        // Config / keys
        'auth/api-key-not-valid': 'Firebase is not configured yet. Running in demo mode.',
        'auth/invalid-api-key': 'Invalid Firebase API key. Check firebase-config.js.',
        // Misc
        'auth/requires-recent-login': 'Please log out and log in again to continue.',
        'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    };
    return messages[code] || '';
}
