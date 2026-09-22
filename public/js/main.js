// Ripple animation on every .btn click
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

// Dependent University -> College dropdown, and subject preview
function initUniversityForm() {
  const uniSelect = document.getElementById('university');
  const collegeSelect = document.getElementById('college');
  const collegeText = document.getElementById('collegeOther');
  const yearSelect = document.getElementById('year');
  const streamSelect = document.getElementById('stream');
  const semSelect = document.getElementById('semester');
  const preview = document.getElementById('subjectPreview');
  const previewList = document.getElementById('subjectList');
  const previewTitle = document.getElementById('subjectTitle');

  if (!uniSelect) return;

  const colleges = window.__collegesByUniversity || {};
  const subjects = window.__subjects || {};

  function refreshColleges() {
    const uni = uniSelect.value;
    const list = colleges[uni];
    collegeSelect.innerHTML = '';
    if (list) {
      collegeSelect.style.display = '';
      collegeText.style.display = 'none';
      list.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        collegeSelect.appendChild(opt);
      });
    } else {
      collegeSelect.style.display = 'none';
      collegeText.style.display = '';
    }
  }

  // Was only defined for First/Second Year — Third and Fourth Year
  // fell through to [] and silently showed no subjects at all.
  function yearToSem(yearLabel) {
    if (yearLabel === 'First Year')  return [1, 2];
    if (yearLabel === 'Second Year') return [3, 4];
    if (yearLabel === 'Third Year')  return [5, 6];
    if (yearLabel === 'Fourth Year') return [7, 8];
    return [];
  }

  // Fills the Semester dropdown with just the two semesters that
  // belong to the selected Year (e.g. Second Year -> Sem 3, Sem 4),
  // keeping the previously chosen semester if it's still valid.
  function refreshSemesterOptions() {
    if (!semSelect) return;
    const sems = yearToSem(yearSelect.value);
    const prevValue = semSelect.value;
    semSelect.innerHTML = '';
    sems.forEach(sem => {
      const opt = document.createElement('option');
      opt.value = sem;
      opt.textContent = `Semester ${sem}`;
      semSelect.appendChild(opt);
    });
    if (sems.map(String).includes(prevValue)) semSelect.value = prevValue;
  }

  // Previously rendered BOTH semesters of the selected year at once.
  // Now renders only the one semester picked in the dropdown, and drops
  // the "Sem N:" prefix from each line since the dropdown already says
  // which semester this is.
  function refreshSubjects() {
    const stream = streamSelect.value;
    const streamData = subjects[stream];
    const sem = semSelect ? Number(semSelect.value) : null;

    if (!streamData || !sem) {
      preview.classList.remove('show');
      return;
    }

    previewTitle.textContent = `${stream} — Semester ${sem} subjects`;
    previewList.innerHTML = '';
    (streamData[sem] || []).forEach(sub => {
      const li = document.createElement('li');
      li.textContent = sub;
      previewList.appendChild(li);
    });
    preview.classList.add('show');
  }

  uniSelect.addEventListener('change', refreshColleges);
  yearSelect.addEventListener('change', () => {
    refreshSemesterOptions();
    refreshSubjects();
  });
  streamSelect.addEventListener('change', refreshSubjects);
  if (semSelect) semSelect.addEventListener('change', refreshSubjects);

  refreshColleges();
  refreshSemesterOptions();
  refreshSubjects();
}

document.addEventListener('DOMContentLoaded', initUniversityForm);