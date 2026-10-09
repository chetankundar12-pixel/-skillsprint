require('dotenv').config();
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const universities = require('./data/universities');
const subjectsData = require('./data/subjects');
const store = require('./lib/store');
const attendanceMath = require('./lib/attendanceMath');
const cgpaMath = require('./lib/cgpaMath');
const syllabus = require('./lib/syllabus');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'skillsprint-dev-secret',
  resave: false,
  saveUninitialized: false
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// ---------------- Owner / announcements ----------------
// Owner = anyone whose login email is listed in ADMIN_EMAILS (comma separated) in .env
const fs = require('fs');
const ANNOUNCE_FILE = path.join(__dirname, 'data', 'announcements.json');
const adminEmails = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean);
console.log('Owner emails:', adminEmails.length ? adminEmails.join(', ') : '(none - set ADMIN_EMAILS in .env)');
function isAdminUser(u) { return !!(u && u.email && adminEmails.includes(String(u.email).toLowerCase())); }
function readAnnouncements() {
  try { return JSON.parse(fs.readFileSync(ANNOUNCE_FILE, 'utf8')); } catch (e) { return []; }
}
function writeAnnouncements(list) {
  try { fs.writeFileSync(ANNOUNCE_FILE, JSON.stringify(list, null, 2)); } catch (e) { console.error('Could not save announcements', e.message); }
}
// Study library (syllabus / PYQ / notes links, e.g. Google Drive), managed by the owner
const RESOURCE_FILE = path.join(__dirname, 'data', 'resources.json');
const SCHEMES = ['NEP 2020', 'R-19'];
const RES_TYPES = ['Syllabus', 'PYQ', 'Notes'];
function readResources() {
  try { return JSON.parse(fs.readFileSync(RESOURCE_FILE, 'utf8')); } catch (e) { return []; }
}
function writeResources(list) {
  try { fs.writeFileSync(RESOURCE_FILE, JSON.stringify(list, null, 2)); } catch (e) { console.error('Could not save resources', e.message); }
}
app.use((req, res, next) => {
  res.locals.isAdmin = isAdminUser(req.session && req.session.user);
  next();
});
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (isAdminUser(req.session.user)) return next();
  const mine = req.session.user.email || '(no email on this account)';
  res.status(403).type('text').send(
    'Owner access only.\n\nYou are logged in as: ' + mine + '\n' +
    (adminEmails.length
      ? 'Owner emails set in .env: ' + adminEmails.join(', ') + '\n\nThey must match exactly. Log in with one of those emails.'
      : 'ADMIN_EMAILS is empty. Create a file named .env (not .env.example) in the project root, add:  ADMIN_EMAILS=' + mine + '  then restart the server.')
  );
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

function id() { return crypto.randomBytes(8).toString('hex'); }

// ---------------- Time zone ----------------
// A hosted server (Render and similar) keeps its clock in UTC, 5.5 hours
// behind India. Reading the date/time straight off the server clock is what
// made attendance dates look random (and a lecture marked after 6:30 PM land
// on the wrong day). Everything date-related now goes through this zone.
// Override with APP_TIMEZONE in .env if you ever need a different one.
const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';

// Year / month (1-12) / day / hour / minute of a moment, as seen in APP_TZ.
function tzParts(date) {
  const out = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'
  }).formatToParts(date).forEach(p => { if (p.type !== 'literal') out[p.type] = Number(p.value); });
  return out;
}
function fmtDate(date) {
  return date.toLocaleDateString('en-IN', { timeZone: APP_TZ, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(date) {
  return date.toLocaleTimeString('en-IN', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function communityRoomKey(user) {
  return `${user.college}|${user.year}|${user.stream}`;
}

// Keeps "which semester am I looking at" in sync across Dashboard,
// Attendance and CGPA. If the URL has a valid ?sem=, that becomes the
// new session-wide choice. Otherwise it falls back to whatever was
// last picked (on any of those pages), and only falls back to the
// first available semester if nothing's been picked yet or the saved
// choice isn't valid on this particular page (e.g. Attendance only
// has real subjects for the student's own year, so a semester chosen
// on Dashboard that isn't in Attendance's own range just falls back
// gracefully instead of erroring).
function resolveSem(req, availableSems) {
  const requested = Number(req.query.sem);
  if (availableSems.includes(requested)) {
    req.session.currentSem = requested;
    return requested;
  }
  if (availableSems.includes(req.session.currentSem)) {
    return req.session.currentSem;
  }
  return availableSems[0] || null;
}

// --- Google OAuth (activates once you add real keys to .env) ---
const googleReady = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

if (googleReady) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://skillsprint-wjwb.onrender.com/auth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    const existing = email && store.getUser(email);
    const user = existing || {
      id: email || profile.id,
      fullName: profile.displayName,
      email,
      avatar: profile.photos && profile.photos[0] && profile.photos[0].value,
      authProvider: 'google',
      onboarded: false
    };
    return done(null, user);
  }));

  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      if (req.user.onboarded) {
        req.session.user = req.user;
        return res.redirect('/dashboard');
      }
      res.redirect('/onboarding');
    }
  );
} else {
  app.get('/auth/google', (req, res) => res.redirect('/login?google=not-configured'));
}

// ---------------- Public pages ----------------
app.get('/', (req, res) => res.render('landing'));

app.get('/login', (req, res) => res.render('login', { googleReady, notice: req.query.google || req.query.signup }));

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = email && store.getUser(email);
  if (!user || !user.passwordHash || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.render('login', { googleReady, notice: 'invalid' });
  }
  req.session.user = user;
  res.redirect('/dashboard');
});

app.get('/signup', (req, res) => res.render('signup', {
  universities: universities.universities,
  collegesByUniversity: universities.collegesByUniversity,
  years: universities.years,
  streams: universities.streams,
  subjects: subjectsData
}));

app.post('/signup', (req, res) => {
  const { fullName, university, college, collegeOther, year, stream, email, password } = req.body;
  const finalCollege = college || collegeOther;
  const user = {
    id: email,
    fullName, university, college: finalCollege, year, stream, email,
    passwordHash: bcrypt.hashSync(password, 10),
    authProvider: 'local',
    onboarded: true
  };
  store.saveUser(user);
  req.session.user = user;
  res.redirect('/dashboard');
});

app.get('/onboarding', (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.render('onboarding', {
    universities: universities.universities,
    collegesByUniversity: universities.collegesByUniversity,
    years: universities.years,
    streams: universities.streams,
    subjects: subjectsData,
    user: req.user
  });
});

app.post('/onboarding', (req, res) => {
  if (!req.user) return res.redirect('/login');
  const { university, college, collegeOther, year, stream } = req.body;
  const user = {
    ...req.user,
    university, college: college || collegeOther, year, stream,
    authProvider: 'google',
    onboarded: true
  };
  store.saveUser(user);
  req.session.user = user;
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------------- Edit Profile ----------------
// Lets a student update college/year/stream after onboarding — until
// now there was no way to do this at all once onboarded was true, which
// is what caused the year field to be permanently frozen at whatever
// was picked once (this is what blocked Community access for anyone
// past Second Year, and forced the semester workarounds elsewhere).
app.get('/profile', requireAuth, (req, res) => {
  const user = req.session.user;
  res.render('profile', {
    user,
    universities: universities.universities,
    collegesByUniversity: universities.collegesByUniversity,
    years: universities.years,
    streams: universities.streams,
    subjects: subjectsData,
    saved: req.query.saved === '1'
  });
});

app.post('/profile', requireAuth, (req, res) => {
  const { fullName, university, college, collegeOther, year, stream } = req.body;
  const finalCollege = (college || collegeOther || '').trim();
  const updated = {
    ...req.session.user,
    fullName: (fullName || req.session.user.fullName || '').trim(),
    university, college: finalCollege, year, stream
  };
  store.saveUser(updated);
  req.session.user = updated;
  res.redirect('/profile?saved=1');
});

// ---------------- Dashboard ----------------
app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  // Full Sem 1-8 range, same as the CGPA page — CGPA data isn't tied to
  // the student's current year (they may want to check a past or future
  // semester), so this shouldn't be limited to syllabus.semsForYear
  // the way Attendance is (Attendance is limited on purpose, since it
  // only has real subjects loaded for the student's actual year).
  const availableSems = [1, 2, 3, 4, 5, 6, 7, 8];
  const currentSem = resolveSem(req, availableSems);

  const attendance = store.getAttendance(user.id);
  let overall = null;
  if (attendance) {
    const visible = currentSem
      ? Object.fromEntries(Object.entries(attendance.subjects || {}).filter(([, s]) => s.sem === currentSem || s.sem == null))
      : (attendance.subjects || {});
    overall = attendanceMath.overallStats(visible);
  }

  const reminders = store.getReminders(user.id).filter(r => !r.done).slice(0, 4);
  const cgpa = store.getCgpa(user.id);
  const semesters = cgpa.semesters || {};
  const overallCgpaVal = cgpaMath.overallCgpa(semesters);
  const semSgpaVal = (currentSem && semesters[currentSem] && semesters[currentSem].subjects && semesters[currentSem].subjects.length)
    ? cgpaMath.computeSemester(semesters[currentSem].subjects).sgpa
    : null;
  const notesCount = store.getNotes(user.id).length;

  res.render('dashboard', {
    user, overall, reminders, overallCgpaVal, semSgpaVal, notesCount,
    currentSem, availableSems
  });
});

// ---------------- Progress (real, combined view) ----------------
app.get('/progress', requireAuth, (req, res) => {
  const user = req.session.user;
  const attendance = store.getAttendance(user.id);
  const overallAttendance = attendance ? attendanceMath.overallStats(attendance.subjects || {}) : attendanceMath.overallStats({});
  const subjectRows = attendance ? Object.entries(attendance.subjects).map(([name, s]) => ({
    name, ...attendanceMath.subjectStats(s.attended, s.missed)
  })) : [];

  const cgpa = store.getCgpa(user.id);
  const semesters = cgpa.semesters || {};
  const overallCgpaVal = cgpaMath.overallCgpa(semesters);
  const semTrend = [];
  for (let i = 1; i <= 8; i++) {
    if (semesters[i] && semesters[i].subjects && semesters[i].subjects.length) {
      semTrend.push({ sem: i, sgpa: cgpaMath.computeSemester(semesters[i].subjects).sgpa });
    }
  }

  const notes = store.getNotes(user.id);
  const notesBySubject = {};
  notes.forEach(n => { notesBySubject[n.subject] = (notesBySubject[n.subject] || 0) + 1; });

  const reminders = store.getReminders(user.id);
  const remindersDone = reminders.filter(r => r.done).length;
  const remindersTotal = reminders.length;
  const remindersOnTrack = remindersTotal > 0 ? Math.round((remindersDone / remindersTotal) * 100) : 100;

  res.render('progress', {
    user, overallAttendance, subjectRows, overallCgpaVal, semTrend,
    notesCount: notes.length, notesBySubject,
    remindersDone, remindersTotal, remindersOnTrack
  });
});


// ---------------- Attendance ----------------
app.get('/attendance', requireAuth, (req, res) => {
  const user = req.session.user;
  // Was syllabus.semsForYear(user.year) — but "year" is set once at
  // onboarding and can never change (signing in with Google after that
  // skips straight to /dashboard), so a First Year student would be
  // stuck on Sem 1-2 forever, even though the switcher itself offers
  // up to Sem 8. Same full range as Dashboard/CGPA now, so the
  // switcher — not the frozen year field — decides what's available.
  const availableSems = [1, 2, 3, 4, 5, 6, 7, 8];
  const currentSem = resolveSem(req, availableSems);

  let attendance = store.getAttendance(user.id);
  if (!attendance) {
    const seeded = syllabus.subjectsForYearStream(user.year, user.stream);
    const subjects = {};
    seeded.forEach(s => { subjects[s.name] = { sem: s.sem, attended: 0, missed: 0, history: [] }; });
    attendance = { subjects };
    store.saveAttendance(user.id, attendance);
  }

  // Migrate any subjects saved before semesters existed on this record:
  // fill in history arrays, and look up which semester a subject belongs
  // to by name so nothing the student already marked disappears.
  let migrated = false;
  Object.entries(attendance.subjects).forEach(([name, s]) => {
    if (!s.history) { s.history = []; migrated = true; }
    if (s.sem === undefined) {
      s.sem = syllabus.semForSubjectName(user.stream, name);
      migrated = true;
    }
  });
  if (migrated) store.saveAttendance(user.id, attendance);

  // Subjects with a known, matching semester show for that semester.
  // Subjects with no known semester (e.g. a custom elective typed in
  // before this feature existed) stay visible in every semester rather
  // than silently disappearing.
  const visibleEntries = Object.entries(attendance.subjects).filter(([, s]) =>
    !currentSem || s.sem === currentSem || s.sem === null
  );
  const visibleSubjects = Object.fromEntries(visibleEntries);

  const rows = visibleEntries.map(([name, s]) => ({
    name, ...attendanceMath.subjectStats(s.attended, s.missed)
  }));
  const overall = attendanceMath.overallStats(visibleSubjects);

  const history = [];
  visibleEntries.forEach(([name, s]) => {
    (s.history || []).forEach(h => {
      const ts = new Date(h.timestamp);
      // Older entries were saved with the server's UTC clock, but each one also
      // stored an exact timestamp, so the right India date/time can be rebuilt.
      const shown = isNaN(ts) ? {} : { date: fmtDate(ts), time: fmtTime(ts) };
      history.push({ subject: name, ...h, ...shown });
    });
  });
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Build this month's calendar (in APP_TZ), marking each day present/absent/none from real history
  const nowDate = new Date();
  const today = tzParts(nowDate);
  const year = today.year, month = today.month - 1;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const dayStatus = {}; // 1-31 -> 'present' | 'absent'
  history.forEach(h => {
    const ts = new Date(h.timestamp);
    if (isNaN(ts)) return;
    const p = tzParts(ts);
    if (p.year === year && p.month - 1 === month) {
      // present wins if mixed that day
      if (h.status === 'Present') dayStatus[p.day] = 'present';
      else if (!dayStatus[p.day]) dayStatus[p.day] = 'absent';
    }
  });
  const calendarDays = [];
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  const monthLabel = new Date(Date.UTC(year, month, 15)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const todayDate = today.day;
  const liveDate = nowDate.toLocaleDateString('en-IN', { timeZone: APP_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const liveTime = nowDate.toLocaleTimeString('en-IN', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase();

  res.render('attendance', {
    user, rows, overall, history, calendarDays, monthLabel, todayDate, dayStatus,
    currentSem, availableSems, liveDate, liveTime, tz: APP_TZ
  });
});

app.post('/attendance/mark', requireAuth, (req, res) => {
  const user = req.session.user;
  const { subject, action, note, sem } = req.body;
  const attendance = store.getAttendance(user.id) || { subjects: {} };
  if (!attendance.subjects[subject]) attendance.subjects[subject] = { sem: sem ? Number(sem) : null, attended: 0, missed: 0, history: [] };
  if (!attendance.subjects[subject].history) attendance.subjects[subject].history = [];

  if (action === 'present') attendance.subjects[subject].attended += 1;
  if (action === 'absent') attendance.subjects[subject].missed += 1;

  const now = new Date();
  attendance.subjects[subject].history.push({
    timestamp: now.toISOString(),
    date: fmtDate(now),
    time: fmtTime(now),
    status: action === 'present' ? 'Present' : 'Absent',
    note: (note || '').trim()
  });

  store.saveAttendance(user.id, attendance);
  res.redirect('/attendance' + (sem ? '?sem=' + sem : ''));
});

app.post('/attendance/add-subject', requireAuth, (req, res) => {
  const user = req.session.user;
  const { newSubject, sem } = req.body;
  if (newSubject && newSubject.trim()) {
    const attendance = store.getAttendance(user.id) || { subjects: {} };
    if (!attendance.subjects[newSubject.trim()]) {
      attendance.subjects[newSubject.trim()] = { sem: sem ? Number(sem) : null, attended: 0, missed: 0, history: [] };
      store.saveAttendance(user.id, attendance);
    }
  }
  res.redirect('/attendance' + (sem ? '?sem=' + sem : ''));
});

// ---------------- Notes ----------------
app.get('/notes', requireAuth, (req, res) => {
  const user = req.session.user;
  const notes = store.getNotes(user.id);
  const mySubjects = syllabus.subjectsForYearStream(user.year, user.stream).map(s => s.name);
  const allSems = [1, 2, 3, 4, 5, 6, 7, 8];
  const libSem = resolveSem(req, allSems);
  if (SCHEMES.includes(req.query.scheme)) req.session.scheme = req.query.scheme;
  const libScheme = SCHEMES.includes(req.session.scheme) ? req.session.scheme : SCHEMES[0];
  const library = readResources().filter(r => r.sem === libSem && r.scheme === libScheme);
  res.render('notes', { user, notes, mySubjects, allSems, libSem, libScheme, schemes: SCHEMES, resTypes: RES_TYPES, library });
});

app.post('/notes/add', requireAuth, (req, res) => {
  const user = req.session.user;
  const { subject, title, content } = req.body;
  store.addNote(user.id, { id: id(), subject, title, content, createdAt: new Date().toISOString() });
  res.redirect('/notes');
});

app.post('/notes/delete', requireAuth, (req, res) => {
  store.deleteNote(req.session.user.id, req.body.noteId);
  res.redirect('/notes');
});

// ---------------- Reminders ----------------
// Feeds the notification bell in the top bar: pending reminders, soonest first
app.get('/api/notifications', requireAuth, (req, res) => {
  const t = tzParts(new Date());
  const pad = n => String(n).padStart(2, '0');
  const todayStr = t.year + '-' + pad(t.month) + '-' + pad(t.day);
  const items = store.getReminders(req.session.user.id)
    .filter(r => !r.done)
    .map(r => ({
      subject: r.subject || 'Reminder',
      task: r.task || '',
      dueDate: r.dueDate || '',
      state: !r.dueDate ? 'none' : (r.dueDate < todayStr ? 'overdue' : (r.dueDate === todayStr ? 'today' : 'upcoming'))
    }))
    .sort((x, y) => (x.dueDate || '9999').localeCompare(y.dueDate || '9999'));
  const me = req.session.user;
  const announcements = readAnnouncements()
    .filter(n => n.audience === 'all' || (n.audience === 'year' && n.year === me.year))
    .slice(0, 6)
    .map(n => ({ type: 'announcement', id: n.id, subject: n.title, task: n.message, dueDate: '', state: 'announce', when: n.createdLabel }));
  res.json({ count: items.length, items: announcements.concat(items.slice(0, 8)) });
});

// Owner panel: post a message that appears in every student's bell
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin', { user: req.session.user, resources: readResources(), schemes: SCHEMES, resTypes: RES_TYPES, announcements: readAnnouncements(), years: ['First Year', 'Second Year', 'Third Year', 'Fourth Year'], sent: req.query.sent === '1', added: req.query.added === '1', bad: req.query.bad === '1' });
});
app.post('/admin/announce', requireAdmin, (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 80);
  const message = String(req.body.message || '').trim().slice(0, 400);
  if (!title) return res.redirect('/admin');
  const audience = req.body.audience === 'year' ? 'year' : 'all';
  const list = readAnnouncements();
  const now = new Date();
  list.unshift({ id: id(), title, message, audience, year: audience === 'year' ? String(req.body.year || '') : '', createdAt: now.toISOString(), createdLabel: fmtDate(now) + ', ' + fmtTime(now) });
  writeAnnouncements(list.slice(0, 100));
  res.redirect('/admin?sent=1');
});
// File uploads for the study library (needs:  npm install multer)
let multer = null;
try { multer = require('multer'); } catch (e) { console.warn('multer is not installed - run "npm install multer" to enable library uploads.'); }
const LIBRARY_DIR = path.join(__dirname, 'public', 'library');
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.zip', '.jpg', '.jpeg', '.png'];
let libraryUpload = null;
if (multer) {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  libraryUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, LIBRARY_DIR),
      filename: (req, file, cb) => cb(null, id() + path.extname(file.originalname).toLowerCase())
    }),
    limits: { fileSize: 25 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => cb(null, ALLOWED_EXT.includes(path.extname(file.originalname).toLowerCase()))
  }).array('files', 10);
}
app.post('/admin/resource', requireAdmin, (req, res) => {
  if (!libraryUpload) return res.status(500).type('text').send('File upload needs one extra package. Stop the server, run:  npm install multer  and start it again.');
  libraryUpload(req, res, err => {
    const files = (req.files || []);
    const discard = () => files.forEach(f => fs.unlink(f.path, () => {}));
    const sem = Number(req.body.sem);
    if (err || !files.length || !(sem >= 1 && sem <= 8)) { discard(); return res.redirect('/admin?bad=1'); }
    const title = String(req.body.title || '').trim().slice(0, 100);
    const list = readResources();
    files.forEach(f => {
      const base = path.basename(f.originalname, path.extname(f.originalname)).slice(0, 100);
      list.push({
        id: id(),
        title: files.length === 1 && title ? title : (title ? title + ' - ' + base : base),
        url: '/library/' + f.filename,
        file: f.filename,
        ext: path.extname(f.filename).slice(1).toUpperCase(),
        scheme: SCHEMES.includes(req.body.scheme) ? req.body.scheme : SCHEMES[0],
        type: RES_TYPES.includes(req.body.type) ? req.body.type : 'Notes',
        sem, subject: String(req.body.subject || '').trim().slice(0, 80)
      });
    });
    writeResources(list);
    res.redirect('/admin?added=1');
  });
});
app.post('/admin/resource/delete', requireAdmin, (req, res) => {
  const list = readResources();
  const hit = list.find(r => r.id === req.body.resourceId);
  if (hit && hit.file) fs.unlink(path.join(LIBRARY_DIR, path.basename(hit.file)), () => {});
  writeResources(list.filter(r => r.id !== req.body.resourceId));
  res.redirect('/admin');
});
app.post('/admin/announce/delete', requireAdmin, (req, res) => {
  writeAnnouncements(readAnnouncements().filter(n => n.id !== req.body.announceId));
  res.redirect('/admin');
});

app.post('/reminders/add', requireAuth, (req, res) => {
  const user = req.session.user;
  const { subject, task, dueDate } = req.body;
  store.addReminder(user.id, { id: id(), subject, task, dueDate, done: false });
  res.redirect(req.get('referer') || '/dashboard');
});

app.post('/reminders/toggle', requireAuth, (req, res) => {
  store.toggleReminder(req.session.user.id, req.body.reminderId);
  res.redirect(req.get('referer') || '/dashboard');
});

app.post('/reminders/delete', requireAuth, (req, res) => {
  store.deleteReminder(req.session.user.id, req.body.reminderId);
  res.redirect(req.get('referer') || '/dashboard');
});

app.get('/reminders', requireAuth, (req, res) => {
  const user = req.session.user;
  const reminders = store.getReminders(user.id);
  const mySubjects = syllabus.subjectsForYearStream(user.year, user.stream).map(s => s.name);
  res.render('reminders', { user, reminders, mySubjects });
});

// ---------------- CGPA ----------------
app.get('/cgpa', requireAuth, (req, res) => {
  const user = req.session.user;
  const currentSem = resolveSem(req, [1, 2, 3, 4, 5, 6, 7, 8]);
  const cgpa = store.getCgpa(user.id);
  const semesters = cgpa.semesters || {};
  const subjects = (semesters[currentSem] && semesters[currentSem].subjects) || [];
  const semStats = cgpaMath.computeSemester(subjects);
  const overallCgpaVal = cgpaMath.overallCgpa(semesters);
  res.render('cgpa', { user, currentSem, subjects, semStats, overallCgpaVal, scale: cgpaMath.SCALE });
});

app.post('/cgpa/save-semester', requireAuth, (req, res) => {
  const user = req.session.user;
  const sem = Math.min(8, Math.max(1, parseInt(req.body.sem, 10) || 1));
  const names = [].concat(req.body.name || []);
  const credits = [].concat(req.body.credits || []);
  const marks = [].concat(req.body.marks || []);

  const subjects = names.map((n, i) => ({
    id: id(),
    name: n,
    credits: credits[i],
    marks: marks[i]
  })).filter(s => s.name && s.name.trim());

  const cgpa = store.getCgpa(user.id);
  const semesters = cgpa.semesters || {};
  semesters[sem] = { subjects };
  store.saveCgpa(user.id, { semesters });
  res.redirect('/cgpa?sem=' + sem);
});

// ---------------- Community ----------------
app.get('/community', requireAuth, (req, res) => {
  const user = req.session.user;
  const supported = user.year === 'First Year' || user.year === 'Second Year';
  const roomKey = communityRoomKey(user);
  const messages = supported ? store.getMessages(roomKey) : [];
  res.render('community', { user, supported, roomKey, messages });
});

// Socket.io wiring for community chat
io.engine.use(sessionMiddleware);
io.on('connection', (socket) => {
  const req = socket.request;
  const user = req.session && req.session.user;
  if (!user) return;
  if (user.year !== 'First Year' && user.year !== 'Second Year') return;

  const roomKey = communityRoomKey(user);
  socket.join(roomKey);

  socket.on('chat:send', (text) => {
    if (!text || !text.trim()) return;
    const message = { id: id(), name: user.fullName, text: text.trim(), ts: Date.now() };
    store.addMessage(roomKey, message);
    io.to(roomKey).emit('chat:message', message);
  });
});

// ---------------- 404 + error handling ----------------
// Must be registered AFTER every other route — Express checks them in
// order, so anything that falls through to here matched no real route.
app.use((req, res) => {
  res.status(404).render('error', {
    code: 404,
    title: 'Page not found',
    message: "That page doesn't exist — check the link, or head back to your dashboard.",
    user: req.session.user || null
  });
});

// 4-argument function is what makes Express treat this as an error
// handler specifically, rather than a normal middleware — it only runs
// when something earlier calls next(err) or throws. Without this,
// Express's own default handler takes over and prints a raw stack
// trace straight to the browser, file paths and all (this is exactly
// what happened with the "availableSems is not defined" error earlier).
app.use((err, req, res, next) => {
  console.error(err); // full detail stays in your own terminal/logs
  const isDev = process.env.NODE_ENV !== 'production';
  if (res.headersSent) return next(err);
  const message = isDev
    ? err.message // only shown to you locally, never in production
    : "That's on us, not you — try again in a moment.";
  res.status(500).render('error', {
    code: 500,
    title: 'Something went wrong',
    message,
    user: req.session.user || null
  }, (renderErr, html) => {
    // If the error page itself can't render (e.g. views/error.ejs is missing),
    // fall back to plain text so the REAL error is visible instead of a second one.
    if (renderErr) return res.type('text').send('Something went wrong: ' + message);
    res.send(html);
  });
});

server.listen(PORT, () => {
  console.log(`SkillSprint running at http://localhost:${PORT}`);
  if (!googleReady) {
    console.log('Google login is not configured yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to enable it.');
  }
});