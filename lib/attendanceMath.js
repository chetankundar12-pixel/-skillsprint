// All the "can I bunk / do I need to attend" math for the 75% attendance rule.

function subjectStats(attended, missed) {
  const total = attended + missed;
  const pct = total === 0 ? 100 : (attended / total) * 100;
  const eligible = pct >= 75;

  let canBunk = 0;
  let mustAttend = 0;

  if (total > 0) {
    if (eligible) {
      // Largest n such that attended / (total + n) >= 0.75
      canBunk = Math.max(0, Math.floor(attended / 0.75 - total));
    } else {
      // Smallest x such that (attended + x) / (total + x) >= 0.75
      mustAttend = Math.max(0, Math.ceil((0.75 * total - attended) / 0.25));
    }
  }

  return {
    attended,
    missed,
    total,
    pct: Math.round(pct * 10) / 10,
    eligible,
    canBunk,
    mustAttend
  };
}

function overallStats(subjectsMap) {
  let attended = 0, missed = 0;
  Object.values(subjectsMap || {}).forEach(s => {
    attended += s.attended || 0;
    missed += s.missed || 0;
  });
  return subjectStats(attended, missed);
}

module.exports = { subjectStats, overallStats };
