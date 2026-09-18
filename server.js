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
app.set('trust proxy', 1);

// Render (and most hosts like Heroku/Railway) terminate HTTPS at a proxy in
// front of your app, then forward the request to your app as plain HTTP.
// Without this line, Express thinks every request is http://, which makes
// Passport build the Google OAuth callback URL as http://... instead of
// https://... — causing Google's redirect_uri_mismatch error. This tells
// Express to trust the proxy's X-Forwarded-Proto header instead.
app.set('trust proxy', 1);

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

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

function id() { return crypto.randomBytes(8).toString('hex'); }

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function communityRoomKey(user) {
  return `${user.college}|${user.year}|${user.stream}`;
}

// --- Google OAuth (activates once you add real keys to .env) ---
const googleReady = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

if (googleReady) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
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
      req.session.user = req.user;
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

// NOTE: these two routes used to check `req.user` (Passport's session), but
// every other route in this file checks `req.session.user` instead — the one
// place Passport actually sets `req.user` on later requests is the Google
// login flow, so an email/password user landing here always had `req.user`
// undefined and got bounced to /login even while fully logged in. Both
// routes below now check `req.session.user`, matching the rest of the app.
app.get('/onboarding', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('onboarding', {
    universities: universities.universities,
    collegesByUniversity: universities.collegesByUniversity,
    years: universities.years,
    streams: universities.streams,
    subjects: subjectsData,
    user: req.session.user
  });
});

app.post('/onboarding', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const { university, college, collegeOther, year, stream } = req.body;
  const user = {
    ...req.session.user,
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

// ---------------- Dashboard ----------------
app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  const attendance = store.getAttendance(user.id);
  const overall = attendance ? attendanceMath.overallStats(attendance.subjects || {}) : null;
  const reminders = store.getReminders(user.id).filter(r => !r.done).slice(0, 4);
  const cgpa = store.getCgpa(user.id);
  const overallCgpaVal = cgpaMath.overallCgpa(cgpa.sgpa || {});
  res.render('dashboard', { user, overall, reminders, overallCgpaVal });
});

// ---------------- Attendance ----------------
app.get('/attendance', requireAuth, (req, res) => {
  const user = req.session.user;
  let attendance = store.getAttendance(user.id);
  if (!attendance) {
    const seeded = syllabus.subjectsForYearStream(user.year, user.stream);
    const subjects = {};
    seeded.forEach(s => { subjects[s.name] = { attended: 0, missed: 0 }; });
    attendance = { subjects };
    store.saveAttendance(user.id, attendance);
  }
  const rows = Object.entries(attendance.subjects).map(([name, s]) => ({
    name, ...attendanceMath.subjectStats(s.attended, s.missed)
  }));
  const overall = attendanceMath.overallStats(attendance.subjects);
  res.render('attendance', { user, rows, overall });
});

app.post('/attendance/mark', requireAuth, (req, res) => {
  const user = req.session.user;
  const { subject, action } = req.body;
  const attendance = store.getAttendance(user.id) || { subjects: {} };
  if (!attendance.subjects[subject]) attendance.subjects[subject] = { attended: 0, missed: 0 };
  if (action === 'present') attendance.subjects[subject].attended += 1;
  if (action === 'absent') attendance.subjects[subject].missed += 1;
  store.saveAttendance(user.id, attendance);
  res.redirect('/attendance');
});

app.post('/attendance/add-subject', requireAuth, (req, res) => {
  const user = req.session.user;
  const { newSubject } = req.body;
  if (newSubject && newSubject.trim()) {
    const attendance = store.getAttendance(user.id) || { subjects: {} };
    if (!attendance.subjects[newSubject.trim()]) {
      attendance.subjects[newSubject.trim()] = { attended: 0, missed: 0 };
      store.saveAttendance(user.id, attendance);
    }
  }
  res.redirect('/attendance');
});

// ---------------- Notes ----------------
app.get('/notes', requireAuth, (req, res) => {
  const user = req.session.user;
  const notes = store.getNotes(user.id);
  const mySubjects = syllabus.subjectsForYearStream(user.year, user.stream).map(s => s.name);
  res.render('notes', { user, notes, mySubjects });
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
  const cgpa = store.getCgpa(user.id);
  const overall = cgpaMath.overallCgpa(cgpa.sgpa || {});
  res.render('cgpa', { user, sgpa: cgpa.sgpa || {}, overall, scale: cgpaMath.SCALE });
});

app.post('/cgpa/save', requireAuth, (req, res) => {
  const user = req.session.user;
  const sgpa = {};
  for (let i = 1; i <= 7; i++) {
    const val = req.body['sem' + i];
    if (val !== '' && val !== undefined) sgpa[i] = Number(val);
  }
  store.saveCgpa(user.id, { sgpa });
  res.redirect('/cgpa');
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

server.listen(PORT, () => {
  console.log(`SkillSprint running at http://localhost:${PORT}`);
  if (!googleReady) {
    console.log('Google login is not configured yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to enable it.');
  }
});