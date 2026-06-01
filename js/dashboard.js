// ============================================================
//  dashboard.js — EduVerse Dashboard Logic
//
//  DEPENDS ON:
//    - firebase-config.js (auth, db globals)
//    - auth.js (guardDashboard, logoutUser)
//
//  SECTIONS:
//    1. Student Dashboard
//    2. Teacher Dashboard
//    3. Shared Utilities
// ============================================================

'use strict';

// ════════════════════════════════════════════════════════════
//  1. STUDENT DASHBOARD
// ════════════════════════════════════════════════════════════

// Called from student-dashboard.html once Firebase is ready
function initStudentDashboard() {
    guardDashboard('student', function (user, userData) {
        // Populate profile info
        populateStudentProfile(userData);
        // Log general attendance automatically on dashboard load
        logAttendance(user.uid, userData, null);
        // Load course progress bars
        loadCourseProgress(userData.course);
        // Initialize VR session chat (Live)
        initStudentChat(user.uid, userData.name, null, false);
        // Initialize Standalone chat (Contact Teacher panel)
        initStudentChat(user.uid, userData.name, null, true);
        // Set up sidebar navigation
        initSidebarNav();
        // Update header username
        setHeaderUser(userData.name);
        // Animate attendance circle
        animateAttendanceCircle(userData.attendanceCount, userData.totalClasses);
        // Load latest VR classroom info
        loadVRClassroomInfo();
        // ✅ Phase 3: Initialize join classroom feature
        initJoinClassroom(user.uid, userData);
        // ✅ Phase 4: Load attendance history into Attendance panel
        loadStudentAttendanceHistory(user.uid);
    });
}

// ── Populate profile section ─────────────────────────────────
function populateStudentProfile(userData) {
    setText('student-name', userData.name || 'Student');
    setText('student-course', userData.course || 'N/A');
    setText('student-year', userData.yearOfStudy || 'N/A');
    setText('student-email', userData.email || '');
    setText('sidebar-name', userData.name || 'Student');
    setText('sidebar-role', userData.course || 'Student');
    // Avatar initials
    const initials = (userData.name || 'S').charAt(0).toUpperCase();
    setText('sidebar-avatar', initials);
    setText('profile-avatar', initials);
}

// ── Log attendance in Firestore ──────────────────────────────
// classroomId is optional — 'general' is used when joining from dashboard load
async function logAttendance(uid, userData, classroomId) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const classKey = classroomId || 'general';
    const docId = uid + '_' + today + '_' + classKey;

    try {
        const ref = db.collection('attendance').doc(docId);
        const snap = await ref.get();

        if (!snap.exists) {
            // ✅ Log attendance with classroomId field
            await ref.set({
                studentId: uid,
                studentName: userData.name || '',
                course: userData.course || '',
                classroomId: classroomId || 'general',
                date: today,
                loginTime: firebase.firestore.FieldValue.serverTimestamp()
            });

            // ✅ Atomic increment — safe for concurrent updates
            await db.collection('users').doc(uid).update({
                attendanceCount: firebase.firestore.FieldValue.increment(1),
                totalClasses: firebase.firestore.FieldValue.increment(1)
            });

            // Refresh circle with latest data from Firestore
            const updatedUser = await db.collection('users').doc(uid).get();
            if (updatedUser.exists) {
                const d = updatedUser.data();
                animateAttendanceCircle(d.attendanceCount || 0, d.totalClasses || 0);
            }
        }
    } catch (err) {
        // Demo mode: Firebase not configured — still animate with local data
        const count = (userData.attendanceCount || 0);
        const total = (userData.totalClasses || 0);
        animateAttendanceCircle(count, total);
        console.warn('[EduVerse] Attendance log (demo mode):', err.message);
    }
}

// ════════════════════════════════════════════════════════════
//  ✅ PHASE 4: STUDENT ATTENDANCE HISTORY
//  Reads the last 10 attendance records for this student from
//  Firestore and renders them in the #attendance-history container.
//  Falls back to a demo list when Firebase is not configured.
// ════════════════════════════════════════════════════════════
async function loadStudentAttendanceHistory(uid) {
    var container = document.getElementById('attendance-history');
    if (!container) return;

    // ── Demo fallback ─────────────────────────────────────────
    if (!isFirebaseConfigured()) {
        var demoHistory = [
            { date: '2026-02-25', classroomId: 'Biology — Cell Division', status: 'present' },
            { date: '2026-02-24', classroomId: 'Biology — Photosynthesis', status: 'present' },
            { date: '2026-02-23', classroomId: 'Biology — Genetics Intro', status: 'present' },
            { date: '2026-02-21', classroomId: 'general', status: 'present' }
        ];
        renderAttendanceHistory(container, demoHistory);
        return;
    }

    // ── Firebase mode ─────────────────────────────────────────
    try {
        var snap = await db.collection('attendance')
            .where('studentId', '==', uid)
            .orderBy('date', 'desc')
            .limit(10)
            .get();

        if (snap.empty) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:20px">'
                + 'No attendance records yet. Join a classroom to start! 🚀</div>';
            return;
        }

        var records = [];
        snap.forEach(function (doc) { records.push(doc.data()); });
        renderAttendanceHistory(container, records);

    } catch (err) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px">'
            + 'Could not load history. Check your connection.</div>';
        console.warn('[EduVerse] Attendance history error:', err.message);
    }
}

// Helper — renders attendance records as styled row cards
function renderAttendanceHistory(container, records) {
    container.innerHTML = '';
    records.forEach(function (rec) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:14px;padding:10px 14px;'
            + 'background:var(--bg-card);border-radius:10px;border:1px solid var(--border-color);';

        // Date chip
        var dateEl = document.createElement('div');
        dateEl.style.cssText = 'flex-shrink:0;padding:6px 10px;border-radius:8px;'
            + 'background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));'
            + 'color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:0.05em;white-space:nowrap;';
        dateEl.textContent = rec.date || '—';

        // Classroom label
        var labelEl = document.createElement('div');
        labelEl.style.cssText = 'flex:1;font-size:0.85rem;color:var(--text-primary);font-weight:500;';
        var classroom = (rec.classroomId && rec.classroomId !== 'general')
            ? '🏫 ' + (rec.classroomId.length > 30 ? rec.classroomId.slice(0, 30) + '…' : rec.classroomId)
            : '🖥️ General Login';
        labelEl.textContent = classroom;

        // Status badge
        var badgeEl = document.createElement('span');
        badgeEl.className = 'badge badge-success';
        badgeEl.textContent = rec.status ? (rec.status.charAt(0).toUpperCase() + rec.status.slice(1)) : 'Present';

        row.appendChild(dateEl);
        row.appendChild(labelEl);
        row.appendChild(badgeEl);
        container.appendChild(row);
    });
}



// ── Animate SVG attendance circle ───────────────────────────
function animateAttendanceCircle(count, total) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const circumference = 251; // 2 * PI * r (r = 40)
    const offset = circumference - (pct / 100) * circumference;

    // Update SVG ring
    const ring = document.querySelector('.ring-fill');
    if (ring) {
        setTimeout(function () {
            ring.style.strokeDashoffset = offset;
        }, 400);
    }

    // Update percentage text
    setText('attendance-pct', pct + '%');
    setText('attendance-count', count + ' / ' + total + ' classes');
}

// ── Load course progress bars ────────────────────────────────
function loadCourseProgress(course) {
    // Static demo data — in production, load from Firestore
    const topics = {
        'Biology': [{ name: 'Cell Biology', pct: 85 }, { name: 'Genetics', pct: 60 }, { name: 'Ecology', pct: 30 }, { name: 'Evolution', pct: 10 }],
        'Maths': [{ name: 'Calculus', pct: 75 }, { name: 'Algebra', pct: 90 }, { name: 'Statistics', pct: 50 }, { name: 'Trigonometry', pct: 40 }],
        'Chemistry': [{ name: 'Organic Chemistry', pct: 70 }, { name: 'Inorganic Chemistry', pct: 55 }, { name: 'Physical Chemistry', pct: 35 }, { name: 'Biochemistry', pct: 20 }],
        'Physics': [{ name: 'Mechanics', pct: 80 }, { name: 'Thermodynamics', pct: 65 }, { name: 'Optics', pct: 45 }, { name: 'Quantum Physics', pct: 15 }],
        'Computer': [{ name: 'Data Structures', pct: 90 }, { name: 'Algorithms', pct: 75 }, { name: 'Databases', pct: 60 }, { name: 'Networking', pct: 40 }]
    };

    const courseKey = Object.keys(topics).find(function (k) {
        return (course || '').toLowerCase().includes(k.toLowerCase());
    }) || 'Biology';
    const data = topics[courseKey];

    const container = document.getElementById('progress-list');
    if (!container) return;
    container.innerHTML = '';

    data.forEach(function (topic) {
        const item = document.createElement('div');
        item.className = 'progress-item reveal';
        item.innerHTML = `
      <div class="progress-top">
        <span class="progress-name">${topic.name}</span>
        <span class="progress-pct">${topic.pct}%</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: 0%" data-pct="${topic.pct}"></div>
      </div>
    `;
        container.appendChild(item);
    });

    // Animate bars after insertion
    setTimeout(function () {
        document.querySelectorAll('.progress-bar-fill').forEach(function (bar) {
            bar.style.width = bar.dataset.pct + '%';
        });
        triggerReveal();
    }, 300);
}

// ── Load VR classroom current topic ─────────────────────────
async function loadVRClassroomInfo() {
    try {
        // Get the most recently created classroom
        const snap = await db.collection('classrooms')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (!snap.empty) {
            const cls = snap.docs[0].data();
            setText('vr-subject', '📚 ' + (cls.subject || 'General Science'));
            setText('vr-topic', cls.topic || 'Welcome Session');
            if (cls.schedule) setText('vr-schedule', '🗓 ' + new Date(cls.schedule).toLocaleString());
        }
    } catch (err) {
        // Not critical — classroom may not exist yet (Firestore not configured)
        console.log('[EduVerse] No classroom loaded yet (demo mode).');
    }
}

// ════════════════════════════════════════════════════════════
//  ✅ PHASE 3: JOIN CLASSROOM (Join Code System)
// ════════════════════════════════════════════════════════════
function initJoinClassroom(uid, userData) {
    const btn = document.getElementById('join-btn');
    const input = document.getElementById('join-code-input');
    const errEl = document.getElementById('join-error');
    const joinCard = document.getElementById('join-card');
    const joinedInfo = document.getElementById('joined-info');
    if (!btn || !input) return;

    // Auto-uppercase letters as user types
    input.addEventListener('input', function () {
        var pos = input.selectionStart;
        input.value = input.value.toUpperCase();
        input.setSelectionRange(pos, pos);
    });

    // Allow Enter key to submit
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') btn.click();
    });

    btn.addEventListener('click', async function () {
        var code = (input.value || '').trim().toUpperCase();

        // Validate code format
        if (code.length !== 6) {
            errEl.textContent = 'Please enter a valid 6-character code.';
            errEl.classList.add('show'); return;
        }
        errEl.classList.remove('show');

        var originalText = btn.textContent;
        btn.textContent = 'Joining…'; btn.disabled = true;

        // ── Demo mode fallback (Firebase not configured) ─────
        if (!isFirebaseConfigured()) {
            // Simulate successful join with demo data
            setTimeout(function () {
                var demoSubject = 'Biology (Demo)';
                var demoTopic = 'Cell Division — Part 1';
                setText('vr-subject', '📚 ' + demoSubject);
                setText('vr-topic', demoTopic);
                setText('info-topic', demoTopic);
                if (joinedInfo) {
                    setText('joined-subject', demoSubject);
                    setText('joined-topic', demoTopic);
                    joinedInfo.style.display = 'block';
                }
                if (joinCard) joinCard.style.display = 'none';
                showToast('✅ Joined demo classroom! (Firebase not configured yet)');
                btn.textContent = originalText; btn.disabled = false;
            }, 800);
            return;
        }

        // ── Firebase mode ─────────────────────────────────────
        try {
            // 1. Find classroom by join code
            var classSnap = await db.collection('classrooms')
                .where('joinCode', '==', code)
                .limit(1)
                .get();

            if (classSnap.empty) {
                throw new Error('No classroom found with code "' + code + '". Double-check with your teacher.');
            }

            var classDoc = classSnap.docs[0];
            var classData = classDoc.data();
            var classId = classDoc.id;

            // 2. Check if already enrolled (avoid duplicates)
            var existingEnrollment = await db.collection('enrollments')
                .where('studentId', '==', uid)
                .where('classroomId', '==', classId)
                .limit(1)
                .get();

            if (existingEnrollment.empty) {
                // 3. Write enrollment record to Firestore
                await db.collection('enrollments').add({
                    studentId: uid,
                    studentName: userData.name || '',
                    course: userData.course || '',
                    classroomId: classId,
                    joinCode: code,
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // 4. Log attendance linked to this specific classroom
            await logAttendance(uid, userData, classId);

            // 5. Update VR room UI with classroom info
            var subject = classData.subject || 'General Science';
            var topic = classData.topic || 'Welcome Session';
            setText('vr-subject', '📚 ' + subject);
            setText('vr-topic', topic);
            setText('info-topic', topic);
            if (classData.schedule) setText('vr-schedule', '🗓 ' + new Date(classData.schedule).toLocaleString());

            // 6. Show joined confirmation banner
            if (joinedInfo) {
                setText('joined-subject', subject);
                setText('joined-topic', topic);
                joinedInfo.style.display = 'block';
            }

            // 7. Hide join code input card
            if (joinCard) joinCard.style.display = 'none';

            // 8. Re-initialize chat for the newly joined classroom (Live session only)
            initStudentChat(uid, userData.name, classId, false);

            showToast('✅ Joined ' + subject + ' classroom successfully!');

        } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.add('show');
        }

        btn.textContent = originalText; btn.disabled = false;
    });
}

// ── Initialize student chat (contact teacher) ✅ Phase 7 ─────────
function initStudentChat(uid, name, classroomId, isStandalone) {
    const inputId = isStandalone ? 'doubt-input' : 'chat-input';
    const btnId = isStandalone ? 'doubt-send' : 'send-btn';
    const msgId = isStandalone ? 'teacher-standalone-messages' : 'chat-messages';
    const unsubKey = isStandalone ? 'unsubStandaloneChat' : 'unsubSessionChat';

    const input = document.getElementById(inputId);
    const sendBtn = document.getElementById(btnId);
    const messages = document.getElementById(msgId);
    if (!input || !sendBtn || !messages) return;

    // Unsubscribe from previous classroom listener if any
    if (window[unsubKey]) window[unsubKey]();

    // Real-time listener — last 30 messages, ordered by time
    window[unsubKey] = db.collection('messages')
        .where('classroomId', '==', classroomId || 'general')
        .orderBy('timestamp', 'asc')
        .limitToLast(30)
        .onSnapshot(function (snap) {
            messages.innerHTML = '';
            snap.forEach(function (doc) {
                const d = doc.data();
                const type = d.senderId === uid ? 'sent' : 'received';
                const text = type === 'received' ? `<strong>${d.senderName || 'Teacher'}:</strong> ${d.message}` : d.message;
                appendChatMessage(messages, text, type, d.timestamp);
            });
            messages.scrollTop = messages.scrollHeight;
        }, function (err) {
            // Index may not be created yet or Firebase disconnected — show static demo messages
            showDemoChatMessages(messages);
        });

    function doSend() {
        const text = (input.value || '').trim();
        if (!text) return;
        db.collection('messages').add({
            classroomId: classroomId || 'general',
            senderId: uid,
            senderName: name,
            role: 'student',
            message: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () {
            appendChatMessage(messages, text, 'sent', null);
        });
        input.value = '';
    }

    // Use onclick/onkeydown to allow safe re-initialization when joining a classroom
    sendBtn.onclick = doSend;
    input.onkeydown = function (e) { if (e.key === 'Enter') doSend(); };
}

function appendChatMessage(container, text, type, timestamp) {
    const div = document.createElement('div');
    div.className = 'chat-msg ' + type;
    const time = timestamp && timestamp.toDate ? timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
    div.innerHTML = `${text}<div class="msg-time">${time}</div>`;
    container.appendChild(div);
}

function showDemoChatMessages(container) {
    const demos = [
        { msg: '<strong>Teacher:</strong> 👋 Hello! Ask your questions here.', type: 'received' },
        { msg: 'When is the next live session?', type: 'sent' },
        { msg: '<strong>Teacher:</strong> Tomorrow at 3:00 PM. Topic: Cell Division 🔬', type: 'received' }
    ];
    container.innerHTML = '';
    demos.forEach(function (d) {
        appendChatMessage(container, d.msg, d.type, null);
    });
}

// ════════════════════════════════════════════════════════════
//  2. TEACHER DASHBOARD
// ════════════════════════════════════════════════════════════

function initTeacherDashboard() {
    guardDashboard('teacher', function (user, userData) {
        populateTeacherProfile(userData);
        setHeaderUser(userData.name);
        initSidebarNav();
        loadAttendanceTable(user.uid);
        initCreateClassroom(user.uid, userData);
        initSyllabus(user.uid);      // ✅ Phase 5: pass teacherId
        initExamSchedule(user.uid); // ✅ Phase 6: pass teacherId (prepared)
        initTeacherChat(user.uid, userData.name);
    });
}

// ── Teacher profile ──────────────────────────────────────────
function populateTeacherProfile(userData) {
    setText('teacher-name', userData.name || 'Teacher');
    setText('teacher-subject', userData.subject || 'General');
    setText('sidebar-name', userData.name || 'Teacher');
    setText('sidebar-role', userData.subject || 'Teacher');
    const initials = (userData.name || 'T').charAt(0).toUpperCase();
    setText('sidebar-avatar', initials);
}

// ── Create Classroom ─────────────────────────────────────────
function initCreateClassroom(uid, userData) {
    const form = document.getElementById('classroom-form');
    const codeBox = document.getElementById('join-code-value');

    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const subject = document.getElementById('cls-subject').value;
        const topic = document.getElementById('cls-topic').value;
        const schedule = document.getElementById('cls-schedule').value;

        // Generate a random 6-character join code
        const code = generateCode(6);
        if (codeBox) codeBox.textContent = code;

        try {
            await db.collection('classrooms').add({
                subject: subject,
                topic: topic,
                schedule: schedule,
                teacherId: uid,
                teacherName: userData.name || '',
                joinCode: code,
                active: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Classroom created! Share code: ' + code);
            document.getElementById('code-display').style.display = 'flex';
        } catch (err) {
            showToast('Error creating classroom: ' + err.message, 'error');
        }
    });
}

// ── Load Attendance Table ────────────────────────────────────
async function loadAttendanceTable(teacherId) {
    const tbody = document.getElementById('attendance-tbody');
    if (!tbody) return;

    try {
        const snap = await db.collection('attendance')
            .orderBy('date', 'desc')
            .limit(20)
            .get();

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No attendance records yet.</td></tr>';
            return;
        }

        // Group by student
        const students = {};
        snap.forEach(function (doc) {
            const d = doc.data();
            if (!students[d.studentId]) {
                students[d.studentId] = { name: d.studentName || 'Student', course: d.course || '', count: 0 };
            }
            students[d.studentId].count++;
        });

        tbody.innerHTML = '';
        Object.entries(students).forEach(function ([uid, s], idx) {
            const pct = Math.round((s.count / Math.max(s.count + 2, 10)) * 100);
            const badgeClass = pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger';
            const row = document.createElement('tr');
            row.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td>${s.course}</td>
        <td>${s.count} days</td>
        <td><span class="badge ${badgeClass}">${pct}%</span></td>
      `;
            tbody.appendChild(row);
        });

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Loading records...</td></tr>';
        console.error('Attendance table error:', err);
    }
}

// ── Syllabus Management (Firestore, real-time) ✅ Phase 5 ───────
function initSyllabus(teacherId) {
    var form = document.getElementById('syllabus-form');
    var list = document.getElementById('syllabus-list');
    if (!form || !list) return;

    // ── Demo / no-Firebase fallback ───────────────────────────────
    if (!isFirebaseConfigured()) {
        var defaultTopics = [
            { text: 'Introduction to the Course', done: false },
            { text: 'Core Concepts — Part 1', done: false },
            { text: 'Core Concepts — Part 2', done: true }
        ];
        var syllabus = loadFromStorage('eduverse-syllabus', defaultTopics);

        function renderLocal() {
            list.innerHTML = '';
            syllabus.forEach(function (item, idx) {
                var el = document.createElement('div');
                el.className = 'syllabus-item' + (item.done ? ' done' : '');
                el.innerHTML =
                    '<div class="syllabus-check" data-idx="' + idx + '" title="' +
                    (item.done ? 'Mark incomplete' : 'Mark complete') + '">' +
                    (item.done ? '✓' : '') + '</div>' +
                    '<span style="flex:1;font-size:0.9rem;color:var(--text-primary)">' + item.text + '</span>' +
                    '<button class="btn btn-sm btn-danger" data-del="' + idx + '" style="padding:4px 10px;border-radius:8px">✕</button>';
                list.appendChild(el);
            });
            saveToStorage('eduverse-syllabus', syllabus);
        }

        list.addEventListener('click', function (e) {
            var chk = e.target.closest('.syllabus-check');
            var del = e.target.closest('[data-del]');
            if (chk) { var i = parseInt(chk.dataset.idx); syllabus[i].done = !syllabus[i].done; renderLocal(); }
            if (del) { syllabus.splice(parseInt(del.dataset.del), 1); renderLocal(); }
        });
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var inp = document.getElementById('topic-input');
            var t = (inp.value || '').trim(); if (!t) return;
            syllabus.push({ text: t, done: false }); inp.value = ''; renderLocal();
        });
        renderLocal();
        return;
    }

    // ── Firebase mode: real-time onSnapshot listener ──────────────
    db.collection('syllabus')
        .where('teacherId', '==', teacherId)
        .orderBy('order', 'asc')
        .onSnapshot(function (snap) {
            list.innerHTML = '';
            var count = 0;
            snap.forEach(function (doc) {
                count++;
                var d = doc.data();
                var id = doc.id;
                var el = document.createElement('div');
                el.className = 'syllabus-item' + (d.done ? ' done' : '');
                el.setAttribute('data-id', id);
                el.innerHTML =
                    '<div class="syllabus-check" data-id="' + id + '" data-done="' + !!d.done + '">' +
                    (d.done ? '✓' : '') + '</div>' +
                    '<span style="flex:1;font-size:0.9rem;color:var(--text-primary)">' + (d.topic || d.text || '') + '</span>' +
                    '<button class="btn btn-sm btn-danger" data-del="' + id + '" style="padding:4px 10px;border-radius:8px">✕</button>';
                list.appendChild(el);
            });
            if (count === 0) {
                list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px">No topics yet — add one below.</div>';
            }
        }, function (err) {
            console.warn('[EduVerse] Syllabus listener error:', err.message);
            list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px">Could not load syllabus. Check Firestore index.</div>';
        });

    // ✅ Toggle / delete via event delegation (runs after each snapshot)
    list.addEventListener('click', async function (e) {
        var chk = e.target.closest('.syllabus-check[data-id]');
        var del = e.target.closest('[data-del]');
        if (chk) {
            var isDone = chk.dataset.done === 'true';
            await db.collection('syllabus').doc(chk.dataset.id)
                .update({ done: !isDone }).catch(function (err) {
                    showToast('Could not update topic: ' + err.message, 'error');
                });
        }
        if (del) {
            await db.collection('syllabus').doc(del.dataset.del)
                .delete().catch(function (err) {
                    showToast('Could not delete topic: ' + err.message, 'error');
                });
        }
    });

    // ✅ Add new topic to Firestore
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var input = document.getElementById('topic-input');
        var text = (input.value || '').trim();
        if (!text) return;
        try {
            var countSnap = await db.collection('syllabus')
                .where('teacherId', '==', teacherId).get();
            await db.collection('syllabus').add({
                teacherId: teacherId,
                topic: text,
                done: false,
                order: countSnap.size,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            input.value = '';
        } catch (err) {
            showToast('Error adding topic: ' + err.message, 'error');
        }
    });
}



// ── Exam Schedule (Firestore, real-time) ✅ Phase 6 ───────────────
function initExamSchedule(teacherId) {
    var form = document.getElementById('exam-form');
    var list = document.getElementById('exam-list');
    if (!form || !list) return;

    // ── Demo / no-Firebase fallback ──────────────────────────────────
    if (!isFirebaseConfigured()) {
        var defaultExams = [
            { subject: 'Mid-Term Exam', date: '2026-03-10', syllabus: 'Chapters 1–4' },
            { subject: 'Final Exam', date: '2026-05-20', syllabus: 'Full Syllabus' }
        ];
        var exams = loadFromStorage('eduverse-exams', defaultExams);

        function renderLocalExams() {
            list.innerHTML = '';
            exams.forEach(function (exam, idx) {
                var d = new Date(exam.date);
                if (isNaN(d)) d = new Date();
                var mon = d.toLocaleString('en', { month: 'short' }).toUpperCase();
                var day = d.getDate();
                var el = document.createElement('div');
                el.className = 'exam-item reveal';
                el.innerHTML =
                    '<div class="exam-date"><div>' + mon + '</div><strong>' + day + '</strong></div>' +
                    '<div style="flex:1">' +
                    '<div style="font-weight:700;color:var(--text-primary)">' + (exam.subject || '') + '</div>' +
                    '<div style="font-size:0.82rem;color:var(--text-muted);margin-top:3px">📋 ' + (exam.syllabus || '') + '</div>' +
                    '</div>' +
                    '<button class="btn btn-sm" style="background:var(--color-danger);color:#fff;border-radius:8px" data-del="' + idx + '">Remove</button>';
                list.appendChild(el);
            });
            saveToStorage('eduverse-exams', exams);
            triggerReveal();
        }

        list.addEventListener('click', function (e) {
            var delEl = e.target.closest('[data-del]');
            if (delEl) {
                exams.splice(parseInt(delEl.dataset.del), 1);
                renderLocalExams();
            }
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var subject = document.getElementById('exam-subject').value.trim();
            var date = document.getElementById('exam-date').value;
            var syl = document.getElementById('exam-syllabus').value.trim();
            if (!subject || !date) return;
            exams.push({ subject: subject, date: date, syllabus: syl });
            exams.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
            form.reset();
            renderLocalExams();
        });

        renderLocalExams();
        return;
    }

    // ── Firebase mode: real-time onSnapshot listener ──────────────────
    db.collection('exams')
        .where('teacherId', '==', teacherId)
        .orderBy('date', 'asc')
        .onSnapshot(function (snap) {
            list.innerHTML = '';
            var count = 0;
            snap.forEach(function (doc) {
                count++;
                var d = doc.data();
                var id = doc.id;
                var dt = new Date(d.date);
                if (isNaN(dt)) dt = new Date();
                var mon = dt.toLocaleString('en', { month: 'short' }).toUpperCase();
                var day = dt.getDate();

                var el = document.createElement('div');
                el.className = 'exam-item reveal visible';
                el.setAttribute('data-id', id);
                el.innerHTML =
                    '<div class="exam-date"><div>' + mon + '</div><strong>' + day + '</strong></div>' +
                    '<div style="flex:1">' +
                    '<div style="font-weight:700;color:var(--text-primary)">' + (d.subject || '') + '</div>' +
                    '<div style="font-size:0.82rem;color:var(--text-muted);margin-top:3px">📋 ' + (d.syllabus || '') + '</div>' +
                    '</div>' +
                    '<button class="btn btn-sm" style="background:var(--color-danger);color:#fff;border-radius:8px" data-del="' + id + '">Remove</button>';
                list.appendChild(el);
            });

            if (count === 0) {
                list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px;text-align:center">No scheduled exams yet.</div>';
            }
        }, function (err) {
            console.warn('[EduVerse] Exam listener error:', err.message);
            list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px">Could not load exams. Check Firestore index.</div>';
        });

    // ✅ Delete via event delegation
    list.addEventListener('click', async function (e) {
        var del = e.target.closest('[data-del]');
        if (del) {
            await db.collection('exams').doc(del.dataset.del)
                .delete().catch(function (err) {
                    showToast('Could not delete exam: ' + err.message, 'error');
                });
        }
    });

    // ✅ Add new exam to Firestore
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var subject = document.getElementById('exam-subject').value.trim();
        var dateVal = document.getElementById('exam-date').value;
        var sylVal = document.getElementById('exam-syllabus').value.trim();

        if (!subject || !dateVal) return;

        try {
            await db.collection('exams').add({
                teacherId: teacherId,
                subject: subject,
                date: dateVal,
                syllabus: sylVal,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            form.reset();
        } catch (err) {
            showToast('Error adding exam: ' + err.message, 'error');
        }
    });
}

// ── Teacher Chat (Real-time Broadcast) ✅ Phase 7 ─────────────
function initTeacherChat(uid, name, classroomId) {
    const input = document.getElementById('teacher-chat-input');
    const sendBtn = document.getElementById('teacher-send-btn');
    const messages = document.getElementById('teacher-chat-messages');
    if (!input || !sendBtn || !messages) return;

    // Load latest classroom messages in real time
    db.collection('messages')
        .where('classroomId', '==', classroomId || 'general')
        .orderBy('timestamp', 'asc')
        .limitToLast(50)
        .onSnapshot(function (snap) {
            messages.innerHTML = '';
            snap.forEach(function (doc) {
                const d = doc.data();
                const type = d.senderId === uid ? 'sent' : 'received';
                const text = type === 'received' ? `<strong>${d.senderName || 'Student'} (${d.role || 'student'}):</strong> ${d.message}` : d.message;
                appendChatMessage(messages, text, type, d.timestamp);
            });
            messages.scrollTop = messages.scrollHeight;
        }, function () {
            showDemoChatMessages(messages);
        });

    function doSend() {
        const text = (input.value || '').trim();
        if (!text) return;
        db.collection('messages').add({
            classroomId: classroomId || 'general',
            senderId: uid,
            senderName: name,
            role: 'teacher',
            message: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () {
            appendChatMessage(messages, text, 'sent', null);
        });
        input.value = '';
    }

    sendBtn.onclick = doSend;
    input.onkeydown = function (e) { if (e.key === 'Enter') doSend(); };
}

// ════════════════════════════════════════════════════════════
//  3. SHARED UTILITIES
// ════════════════════════════════════════════════════════════

// ── Sidebar Navigation ───────────────────────────────────────
function initSidebarNav() {
    const navItems = document.querySelectorAll('.nav-item[data-panel]');
    const panels = document.querySelectorAll('.panel');
    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.querySelector('.sidebar');

    function showPanel(id) {
        panels.forEach(function (p) { p.classList.remove('active'); });
        navItems.forEach(function (n) { n.classList.remove('active'); });
        const target = document.getElementById(id);
        const navEl = document.querySelector('.nav-item[data-panel="' + id + '"]');
        if (target) target.classList.add('active');
        if (navEl) navEl.classList.add('active');
        triggerReveal();
    }

    navItems.forEach(function (item) {
        item.addEventListener('click', function () {
            showPanel(item.dataset.panel);
            // Auto-close sidebar on mobile
            if (window.innerWidth < 768 && sidebar) {
                sidebar.classList.remove('open');
            }
        });
    });

    // Hamburger toggle
    if (hamburger && sidebar) {
        hamburger.addEventListener('click', function () {
            sidebar.classList.toggle('open');
        });
    }

    // Show first panel by default
    if (navItems.length > 0) showPanel(navItems[0].dataset.panel);
}

// ── Scroll reveal ────────────────────────────────────────────
function triggerReveal() {
    setTimeout(function () {
        document.querySelectorAll('.reveal').forEach(function (el) {
            el.classList.add('visible');
        });
    }, 100);
}

// ── Helper: Set text content safely ─────────────────────────
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ── Helper: Set header username ──────────────────────────────
function setHeaderUser(name) {
    setText('header-username', name);
    setText('header-initials', (name || 'U').charAt(0).toUpperCase());
}

// ── Helper: Generate random alphanumeric code ─────────────────
function generateCode(length) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ── Helper: Toast notification ────────────────────────────────
function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === 'error' ? '#EF4444' : 'var(--color-primary)'};
    color:#fff;padding:12px 22px;border-radius:12px;
    font-size:0.88rem;font-weight:600;
    box-shadow:0 8px 32px rgba(0,0,0,0.2);
    animation:fadeInUp 0.3s ease;
  `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 4000);
}

// ── localStorage helpers ─────────────────────────────────────
function loadFromStorage(key, defaultVal) {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultVal;
    } catch (e) {
        return defaultVal;
    }
}

function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* ignore */ }
}

// ── Scroll-reveal observer ────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.reveal').forEach(function (el) {
            obs.observe(el);
        });
    } else {
        // Fallback: just show all
        document.querySelectorAll('.reveal').forEach(function (el) {
            el.classList.add('visible');
        });
    }
});
