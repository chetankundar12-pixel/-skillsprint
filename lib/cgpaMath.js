// Mumbai University CBCS 10-point grading scale (Engineering).
// NOTE: exact boundaries can vary slightly by batch/college revision —
// treat this as a close reference, not a guaranteed match to your gazette.
const SCALE = [
  { min: 80, grade: 'O', points: 10 },
  { min: 75, grade: 'A+', points: 9 },
  { min: 70, grade: 'A', points: 8 },
  { min: 65, grade: 'B+', points: 7 },
  { min: 60, grade: 'B', points: 6 },
  { min: 55, grade: 'C', points: 5 },
  { min: 50, grade: 'P', points: 4 },
  { min: 0, grade: 'F', points: 0 }
];

function marksToGrade(marks) {
  const m = Math.max(0, Math.min(100, Number(marks) || 0));
  return SCALE.find(row => m >= row.min);
}

// subjects: [{ name, marks }]  -> simple average of grade points (equal credit weight)
function sgpaFromMarks(subjects) {
  const valid = subjects.filter(s => s.marks !== '' && s.marks !== null && s.marks !== undefined);
  if (valid.length === 0) return { sgpa: 0, rows: [] };
  const rows = valid.map(s => {
    const g = marksToGrade(s.marks);
    return { name: s.name, marks: Number(s.marks), grade: g.grade, points: g.points };
  });
  const sgpa = rows.reduce((sum, r) => sum + r.points, 0) / rows.length;
  return { sgpa: Math.round(sgpa * 100) / 100, rows };
}

// sgpaBySem: { 1: 8.5, 2: 9.0, ... } -> simple average of entered semesters
function overallCgpa(sgpaBySem) {
  const values = Object.values(sgpaBySem).filter(v => v !== '' && v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 100) / 100;
}

module.exports = { SCALE, marksToGrade, sgpaFromMarks, overallCgpa };
