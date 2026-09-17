# SkillSprint (Node.js) — Full Build

**Phase 1** (landing, login, signup, Google OAuth scaffold, onboarding) +
**Phase 2** (everything below) are both in this build now.

## What's in Phase 2
- **Real accounts** — signup now hashes passwords with bcrypt and actually
  persists users (to a local JSON file — see "About the database" below).
  Login verifies against that.
- **Dashboard** — welcome banner, attendance/CGPA snapshot, pending reminders,
  quick links. Every section has a 🎯 **Focus** toggle that dims the rest of
  the page so you can concentrate on one card at a time.
- **Attendance tracker** — subjects are pre-filled from the Mumbai University
  syllabus based on your year + stream. Mark each lecture ✓ Present / ✕ Absent;
  it recalculates your % live and tells you:
  - if you're above the 75% rule (exam-eligible) or not
  - if you're above 75%, exactly how many more classes you can miss and stay compliant
  - if you're below 75%, exactly how many classes in a row you need to attend to get back to 75%
  - both per-subject and overall
- **Notes** — write and browse lecture notes per subject.
- **CGPA Calculator** — two tools:
  1. Enter SGPA for Semesters 1–7 (max 10 each) → overall CGPA.
  2. Enter subject-wise marks for a semester → auto-computed SGPA using the
     Mumbai University CBCS 10-point scale, with a button to drop that result
     straight into the Semester 1–7 table above.
- **Reminders** — log what a teacher assigned, per subject, with a due date and a done/undo toggle.
- **Community chat** — real-time chat (Socket.io) auto-scoped to your
  college + year + stream. Only First Year and Second Year groups are live
  for now, per your request; other years show a "coming soon" message.

## Run it in VS Code
```
npm install
npm start
```
Visit `http://localhost:3000`. Sign up once, then explore the sidebar:
Dashboard, Attendance, Notes, CGPA Calculator, Reminders, Community.

## About the "database"
There's no real database yet — data is persisted to plain JSON files in a
`data-store/` folder that's created automatically the first time you run the
app (users, attendance, notes, reminders, CGPA, chat messages). This is
genuinely persistent (survives restarts) and fine for you + a few friends
testing it, but it is **not** how you'd want it in production — it doesn't
handle concurrent writes safely at scale. When you're ready, swapping in a
real database (e.g. MongoDB via Mongoose, or Postgres via Prisma) is a
contained change mostly inside `lib/store.js` — every route calls `store.xxx()`
functions, so the rest of the app wouldn't need to change much.

## Enabling Google Login
Same as before — Google requires you to create real OAuth credentials:
1. https://console.cloud.google.com/apis/credentials → Create OAuth client ID → Web application
2. Authorized redirect URI: `http://localhost:3000/auth/google/callback`
3. Copy `.env.example` to `.env`, paste in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
4. Restart the server

## Getting a permanent public link
Still true: I can't host this myself. Deploy to **Render** (or Railway/Vercel)
for a real always-on URL — full steps are the same as before:
1. Push to GitHub
2. Render → New → Web Service → connect repo
3. Build: `npm install` · Start: `npm start`
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` as environment variables in Render's dashboard
5. Add your Render URL + `/auth/google/callback` as a second Authorized redirect URI in Google Cloud Console

One extra note for this phase: since chat uses Socket.io (WebSockets), make
sure whichever host you pick supports WebSocket connections — Render and
Railway both do; some strict free static hosts don't.

## Project structure
```
skillsprint-node/
├── server.js                 (routes, sessions, Socket.io, Google OAuth)
├── lib/
│   ├── store.js               (JSON file persistence — swap this for a real DB later)
│   ├── attendanceMath.js       (75% rule calculations)
│   ├── cgpaMath.js             (grading scale + SGPA/CGPA math)
│   └── syllabus.js             (year -> semester -> subjects lookup)
├── data/
│   ├── subjects.js             (Mumbai University Comp Eng syllabus, Sem 1-4)
│   └── universities.js         (university + college lists)
├── data-store/                 (auto-created JSON "database" — gitignored)
├── views/
│   ├── landing.ejs, login.ejs, signup.ejs, onboarding.ejs
│   ├── dashboard.ejs, attendance.ejs, notes.ejs, reminders.ejs, cgpa.ejs, community.ejs
│   └── partials/sidebar.ejs
├── public/
│   ├── css/style.css, dashboard.css
│   └── js/main.js, focus.js, cgpa.js
└── .env.example
```

## Known simplifications (worth knowing about)
- CGPA is a simple average of the semesters you enter — real CGPA is usually
  credit-weighted per subject. Good enough to track your own progress; not
  guaranteed to match your official transcript to the decimal.
- The Mumbai University grading boundaries in `lib/cgpaMath.js` are a close
  reference; a few third-party sources show slightly different bands
  (e.g. the F cutoff). Worth checking your own gazette if precision matters.
- Attendance is marked as simple +1 counters per click, not tied to a real
  timetable or calendar — fine for daily use, not a substitute for your
  college's official attendance record.
- Community chat messages are stored per college+year+stream in a JSON file
  with no moderation — fine for a small trusted group, not ready for a large
  public rollout.

## Note on images
The landing page hero image is a hotlinked Unsplash photo (free to use, no
attribution required) — swap it for your own photography before shipping
this for real.
