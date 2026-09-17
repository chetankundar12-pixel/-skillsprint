// Focus mode: clicking a section's focus toggle dims every other .section-card
// within the same .dcontent container and expands this one.
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.focus-toggle');
  if (!btn) return;
  const card = btn.closest('.section-card');
  const container = card.closest('.dcontent');
  const allCards = container.querySelectorAll('.section-card');
  const alreadyOn = btn.classList.contains('on');

  allCards.forEach(c => c.classList.remove('dimmed'));
  container.querySelectorAll('.focus-toggle').forEach(b => { b.classList.remove('on'); b.textContent = '🎯 Focus'; });

  if (!alreadyOn) {
    allCards.forEach(c => { if (c !== card) c.classList.add('dimmed'); });
    btn.classList.add('on');
    btn.textContent = '✕ Exit focus';
  }
});
