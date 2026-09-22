const subjects = require('../data/subjects');

function semsForYear(year) {
  if (year === 'First Year') return [1, 2];
  if (year === 'Second Year') return [3, 4];
  return []; // Third/Final Year syllabus not loaded yet
}

function subjectsForYearStream(year, stream) {
  const sems = semsForYear(year);
  const streamData = subjects[stream];
  if (!streamData || sems.length === 0) return [];
  const list = [];
  sems.forEach(sem => {
    (streamData[sem] || []).forEach(name => list.push({ name, sem }));
  });
  return list;
}

// NEW: just one semester's subjects, for the sem-wise Attendance view.
function subjectsForSemester(sem, stream) {
  const streamData = subjects[stream];
  if (!streamData) return [];
  return (streamData[sem] || []).map(name => ({ name, sem }));
}

// NEW: used to migrate attendance records created before subjects were
// tagged with a semester — looks up which semester a subject name
// belongs to, so existing marked attendance isn't lost.
function semForSubjectName(stream, name) {
  const streamData = subjects[stream];
  if (!streamData) return null;
  const semKeys = Object.keys(streamData);
  for (let i = 0; i < semKeys.length; i++) {
    if ((streamData[semKeys[i]] || []).includes(name)) return Number(semKeys[i]);
  }
  return null; // e.g. a custom elective the student typed in themselves
}

module.exports = { semsForYear, subjectsForYearStream, subjectsForSemester, semForSubjectName };