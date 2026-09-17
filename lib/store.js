const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data-store');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function file(name) { return path.join(DIR, name + '.json'); }

function read(name, fallback) {
  try {
    const raw = fs.readFileSync(file(name), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(name, data) {
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2));
}

// ---- Users ----
function getUser(email) {
  const users = read('users', {});
  return users[email.toLowerCase()];
}
function saveUser(user) {
  const users = read('users', {});
  users[user.email.toLowerCase()] = user;
  write('users', users);
  return user;
}

// ---- Attendance ----
// attendance[userId] = { [subjectName]: { attended, missed } }
function getAttendance(userId) {
  const all = read('attendance', {});
  return all[userId] || null;
}
function saveAttendance(userId, data) {
  const all = read('attendance', {});
  all[userId] = data;
  write('attendance', all);
}

// ---- Notes ----
function getNotes(userId) {
  const all = read('notes', {});
  return all[userId] || [];
}
function addNote(userId, note) {
  const all = read('notes', {});
  if (!all[userId]) all[userId] = [];
  all[userId].unshift(note);
  write('notes', all);
  return all[userId];
}
function deleteNote(userId, noteId) {
  const all = read('notes', {});
  if (!all[userId]) return [];
  all[userId] = all[userId].filter(n => n.id !== noteId);
  write('notes', all);
  return all[userId];
}

// ---- Reminders ----
function getReminders(userId) {
  const all = read('reminders', {});
  return all[userId] || [];
}
function addReminder(userId, reminder) {
  const all = read('reminders', {});
  if (!all[userId]) all[userId] = [];
  all[userId].push(reminder);
  write('reminders', all);
  return all[userId];
}
function toggleReminder(userId, reminderId) {
  const all = read('reminders', {});
  if (!all[userId]) return [];
  const r = all[userId].find(x => x.id === reminderId);
  if (r) r.done = !r.done;
  write('reminders', all);
  return all[userId];
}
function deleteReminder(userId, reminderId) {
  const all = read('reminders', {});
  if (!all[userId]) return [];
  all[userId] = all[userId].filter(x => x.id !== reminderId);
  write('reminders', all);
  return all[userId];
}

// ---- CGPA ----
function getCgpa(userId) {
  const all = read('cgpa', {});
  return all[userId] || { sgpa: {} };
}
function saveCgpa(userId, data) {
  const all = read('cgpa', {});
  all[userId] = data;
  write('cgpa', all);
}

// ---- Community messages ----
function getMessages(roomKey) {
  const all = read('messages', {});
  return all[roomKey] || [];
}
function addMessage(roomKey, message) {
  const all = read('messages', {});
  if (!all[roomKey]) all[roomKey] = [];
  all[roomKey].push(message);
  if (all[roomKey].length > 200) all[roomKey] = all[roomKey].slice(-200);
  write('messages', all);
  return all[roomKey];
}

module.exports = {
  getUser, saveUser,
  getAttendance, saveAttendance,
  getNotes, addNote, deleteNote,
  getReminders, addReminder, toggleReminder, deleteReminder,
  getCgpa, saveCgpa,
  getMessages, addMessage
};
