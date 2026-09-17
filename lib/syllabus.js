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

module.exports = { semsForYear, subjectsForYearStream };
