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

  function yearToSem(yearLabel) {
    if (yearLabel === 'First Year') return [1, 2];
    if (yearLabel === 'Second Year') return [3, 4];
    return [];
  }

  function refreshSubjects() {
    const stream = streamSelect.value;
    const sems = yearToSem(yearSelect.value);
    const streamData = subjects[stream];
    if (!streamData || sems.length === 0) {
      preview.classList.remove('show');
      return;
    }
    previewTitle.textContent = `${stream} — ${yearSelect.value} subjects`;
    previewList.innerHTML = '';
    sems.forEach(sem => {
      (streamData[sem] || []).forEach(sub => {
        const li = document.createElement('li');
        li.textContent = `Sem ${sem}: ${sub}`;
        previewList.appendChild(li);
      });
    });
    preview.classList.add('show');
  }

  uniSelect.addEventListener('change', refreshColleges);
  yearSelect.addEventListener('change', refreshSubjects);
  streamSelect.addEventListener('change', refreshSubjects);

  refreshColleges();
  refreshSubjects();
}

document.addEventListener('DOMContentLoaded', initUniversityForm);
