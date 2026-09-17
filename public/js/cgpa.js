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

function gradeFor(marks) {
  const m = Math.max(0, Math.min(100, Number(marks) || 0));
  return SCALE.find(row => m >= row.min);
}

function addMarksRow() {
  const wrap = document.getElementById('marksRows');
  const row = document.createElement('div');
  row.className = 'marks-row';
  row.innerHTML = `
    <input type="text" class="field" style="padding:9px 12px;" placeholder="Subject name" data-role="name">
    <input type="number" min="0" max="100" class="field" style="padding:9px 12px;" placeholder="Marks /100" data-role="marks">
    <button type="button" class="remove" onclick="this.parentElement.remove(); recalcSgpa();">✕</button>
  `;
  wrap.appendChild(row);
}

function recalcSgpa() {
  const rows = Array.from(document.querySelectorAll('#marksRows .marks-row'));
  const resultBody = document.getElementById('gradeTableBody');
  resultBody.innerHTML = '';
  let total = 0, count = 0;

  rows.forEach(row => {
    const name = row.querySelector('[data-role="name"]').value || 'Subject';
    const marksVal = row.querySelector('[data-role="marks"]').value;
    if (marksVal === '') return;
    const g = gradeFor(marksVal);
    total += g.points; count += 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${name}</td><td>${marksVal}</td><td>${g.grade}</td><td>${g.points}</td>`;
    resultBody.appendChild(tr);
  });

  const sgpa = count ? Math.round((total / count) * 100) / 100 : 0;
  document.getElementById('marksSgpaResult').textContent = sgpa;
  window.__lastComputedSgpa = sgpa;
}

function useSgpaForSem() {
  const sem = document.getElementById('applySemSelect').value;
  const sgpa = window.__lastComputedSgpa;
  if (!sgpa) return;
  const target = document.querySelector(`[name="sem${sem}"]`);
  if (target) target.value = sgpa;
}

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('addMarksRowBtn');
  if (addBtn) addBtn.addEventListener('click', addMarksRow);
  document.addEventListener('input', (e) => {
    if (e.target.closest('#marksRows')) recalcSgpa();
  });
  const useBtn = document.getElementById('useSgpaBtn');
  if (useBtn) useBtn.addEventListener('click', useSgpaForSem);
});
