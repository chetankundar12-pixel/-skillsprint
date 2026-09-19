// Grading scale exactly as specified in the app's reference design.
const SCALE = [
  { min: 90, grade: 'O', points: 10 },
  { min: 85, grade: 'A+', points: 9 },
  { min: 75, grade: 'A', points: 8 },
  { min: 70, grade: 'B+', points: 7 },
  { min: 60, grade: 'B', points: 6 },
  { min: 50, grade: 'C', points: 5 },
  { min: 40, grade: 'D', points: 4 },
  { min: 0, grade: 'F', points: 0 }
];

function marksToGrade(marks) {
  const m = Math.max(0, Math.min(100, Number(marks) || 0));
  return SCALE.find(row => m >= row.min);
}

// subjects: [{ name, credits, marks }] -> credit-weighted SGPA
function computeSemester(subjects) {
  const valid = (subjects || []).filter(s => s.marks !== '' && s.marks !== null && s.marks !== undefined && s.credits);
  if (valid.length === 0) return { sgpa: 0, totalCredits: 0, totalPoints: 0, rows: [] };

  let totalCredits = 0;
  let totalPoints = 0; // sum(credits * gradePoints)
  const rows = valid.map(s => {
    const credits = Number(s.credits) || 0;
    const g = marksToGrade(s.marks);
    totalCredits += credits;
    totalPoints += credits * g.points;
    return { name: s.name, credits, marks: Number(s.marks), grade: g.grade, points: g.points };
  });

  const sgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
  return { sgpa: Math.round(sgpa * 100) / 100, totalCredits, totalPoints: Math.round(totalPoints * 100) / 100, rows };
}

// semesters: { [semNumber]: { subjects: [...] } } -> credit-weighted overall CGPA across every semester's subjects
function overallCgpa(semesters) {
  let totalCredits = 0;
  let totalPoints = 0;
  Object.values(semesters || {}).forEach(sem => {
    const result = computeSemester(sem.subjects || []);
    totalCredits += result.totalCredits;
    totalPoints += result.totalPoints;
  });
  if (totalCredits === 0) return 0;
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}

module.exports = { SCALE, marksToGrade, computeSemester, overallCgpa };