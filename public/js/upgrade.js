/* SkillSprint — upgrade layer JS. Load on every page, after main.js. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Reveal sections when they actually enter the viewport ---------
     Your .reveal class animates on page load, so anything below the fold
     had already finished animating before the user scrolled to it. */
  var targets = document.querySelectorAll('.reveal-on-scroll');
  if (targets.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
      targets.forEach(function (el) { io.observe(el); });
    }
  }

  /* --- Mobile navigation --------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* --- Header gets a border only once you've scrolled ----------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Mascot poke ----------------------------------------------------
     The old landing.ejs called this.getBBox() on an <img>. getBBox is an
     SVG-only method, so every click threw "getBBox is not a function"
     and the animation never restarted. offsetWidth is the correct
     reflow trigger for an HTML element. */
  var mascot = document.querySelector('.mascot-wrap .mascot-img');
  if (mascot && !reduced) {
    var poke = function () {
      mascot.classList.remove('mascot-poke');
      void mascot.offsetWidth;
      mascot.classList.add('mascot-poke');
    };
    mascot.addEventListener('click', poke);
    mascot.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); }
    });
  }

  /* --- App shell mobile sidebar ---------------------------------------
     dashboard.css used to just hide .sidebar below 1100px with nothing
     to replace it, so there was no way to navigate at all on a phone.
     This is the hamburger-in-topbar version of the same pattern used
     on the marketing site's nav-toggle, but for the app pages
     (dashboard, attendance, cgpa, etc.) — separate elements, so it's
     kept as its own block rather than merged with the one above. */
  var sidebarToggle = document.querySelector('.mobile-nav-toggle');
  var sidebar = document.getElementById('appSidebar');
  var sidebarBackdrop = document.getElementById('sidebarBackdrop');
  if (sidebarToggle && sidebar && sidebarBackdrop) {
    var closeSidebar = function () {
      sidebar.classList.remove('is-open');
      sidebarBackdrop.classList.remove('is-open');
      sidebarToggle.setAttribute('aria-expanded', 'false');
    };
    var openSidebar = function () {
      sidebar.classList.add('is-open');
      sidebarBackdrop.classList.add('is-open');
      sidebarToggle.setAttribute('aria-expanded', 'true');
    };
    sidebarToggle.addEventListener('click', function () {
      var isOpen = sidebar.classList.contains('is-open');
      if (isOpen) closeSidebar(); else openSidebar();
    });
    sidebarBackdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        closeSidebar();
        sidebarToggle.focus();
      }
    });
  }

  /* --- Topbar user menu (Edit Profile / Logout) ----------------------- */
  var userMenuBtn = document.querySelector('.user-menu-btn');
  var userMenu = document.getElementById('userMenu');
  if (userMenuBtn && userMenu) {
    var closeUserMenu = function () {
      userMenu.classList.remove('is-open');
      userMenuBtn.setAttribute('aria-expanded', 'false');
    };
    userMenuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = userMenu.classList.toggle('is-open');
      userMenuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#userMenuTrigger')) closeUserMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeUserMenu();
    });
  }

  /* --- Notification bell ---------------------------------------------
     Loads pending reminders from /api/notifications, shows a count badge,
     and opens a dropdown on click. */
  var notifBtn = document.getElementById('notifBtn');
  var notifPanel = document.getElementById('notifPanel');
  if (notifBtn && notifPanel) {
    var notifList = document.getElementById('notifList');
    var notifBadge = document.getElementById('notifBadge');
    var esc = function (v) {
      return String(v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    var labels = { warn: 'Low attendance', exam: 'Exam', announce: 'Announcement', overdue: 'Overdue', today: 'Due today', upcoming: 'Upcoming', none: 'No due date' };
    var loadNotifs = function () {
      fetch('/api/notifications', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var seen = [];
          try { seen = JSON.parse(localStorage.getItem('ss_seen_announce') || '[]'); } catch (e) {}
          var unseen = d.items.filter(function (n) { return n.type && seen.indexOf(n.id) === -1; }).length;
          var total = unseen + d.items.filter(function (n) { return !n.type; }).length;
          window.__ssAnnounceIds = d.items.filter(function (n) { return n.type; }).map(function (n) { return n.id; });
          notifBadge.hidden = !total;
          notifBadge.textContent = total > 9 ? '9+' : total;
          if (!d.items.length) {
            notifList.innerHTML = '<li class="notif-empty">You\u2019re all caught up.</li>';
            return;
          }
          notifList.innerHTML = d.items.map(function (n) {
            return '<li><a href="' + (n.type === 'announcement' ? '#' : (n.type === 'exam' ? '/dashboard' : (n.type === 'warning' ? '/attendance' : '/reminders'))) + '" class="notif-item is-' + n.state + '">' +
              '<span class="notif-dot" aria-hidden="true"></span><span class="notif-text">' +
              '<b>' + esc(n.subject) + '</b>' + (n.task ? '<span>' + esc(n.task) + '</span>' : '') +
              '<em>' + labels[n.state] + (n.when ? ' \u00b7 ' + esc(n.when) : '') + (n.dueDate ? ' \u00b7 ' + esc(n.dueDate) : '') + '</em></span></a></li>';
          }).join('');
        })
        .catch(function () { notifList.innerHTML = '<li class="notif-empty">Couldn\u2019t load notifications.</li>'; });
    };
    var closeNotifs = function () {
      notifPanel.classList.remove('is-open');
      notifBtn.setAttribute('aria-expanded', 'false');
    };
    notifBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = notifPanel.classList.toggle('is-open');
      notifBtn.setAttribute('aria-expanded', String(open));
      if (open) {
        loadNotifs();
        // opening the bell marks announcements as seen so the badge clears
        try { localStorage.setItem('ss_seen_announce', JSON.stringify((window.__ssAnnounceIds || []).slice(0, 50))); } catch (err) {}
        setTimeout(function () { notifBadge.hidden = true; }, 400);
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#notifWrap')) closeNotifs();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNotifs(); });
    loadNotifs();
  }

  /* --- Top-bar search --------------------------------------------------
     Debounced calls to /api/search, arrow-key navigation, "/" to focus. */
  var sInput = document.getElementById('searchInput');
  var sList = document.getElementById('searchResults');
  if (sInput && sList) {
    var sTimer = null, sItems = [], sIdx = -1, sSeq = 0;
    var sEsc = function (v) {
      return String(v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    var sClose = function () { sList.hidden = true; sIdx = -1; };
    var sMark = function () {
      Array.prototype.forEach.call(sList.querySelectorAll('li[data-href]'), function (li, i) {
        li.classList.toggle('is-active', i === sIdx);
      });
    };
    var sRender = function (results, q) {
      sItems = results;
      sIdx = -1;
      if (!results.length) {
        sList.innerHTML = '<li class="search-empty">No results for \u201c' + sEsc(q) + '\u201d</li>';
      } else {
        sList.innerHTML = results.map(function (r) {
          return '<li role="option" data-href="' + sEsc(r.href) + '"' + (r.external ? ' data-ext="1"' : '') + '>' +
            '<span class="search-kind">' + sEsc(r.kind) + '</span>' +
            '<span class="search-text"><b>' + sEsc(r.label) + '</b>' + (r.sub ? '<em>' + sEsc(r.sub) + '</em>' : '') + '</span></li>';
        }).join('');
      }
      sList.hidden = false;
    };
    var sGo = function (li) {
      if (!li) return;
      if (li.getAttribute('data-ext')) window.open(li.getAttribute('data-href'), '_blank', 'noopener');
      else window.location.href = li.getAttribute('data-href');
    };
    sInput.addEventListener('input', function () {
      clearTimeout(sTimer);
      var q = sInput.value.trim();
      if (q.length < 2) { sClose(); return; }
      sTimer = setTimeout(function () {
        var mine = ++sSeq;
        fetch('/api/search?q=' + encodeURIComponent(q), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (d) { if (mine === sSeq) sRender(d.results || [], q); })
          .catch(function () {});
      }, 200);
    });
    sInput.addEventListener('keydown', function (e) {
      var rows = sList.querySelectorAll('li[data-href]');
      if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); sIdx = (sIdx + 1) % rows.length; sMark(); }
      else if (e.key === 'ArrowUp' && rows.length) { e.preventDefault(); sIdx = (sIdx - 1 + rows.length) % rows.length; sMark(); }
      else if (e.key === 'Enter') { e.preventDefault(); sGo(rows[sIdx >= 0 ? sIdx : 0]); }
      else if (e.key === 'Escape') { sClose(); sInput.blur(); }
    });
    sInput.addEventListener('focus', function () { if (sList.innerHTML && sInput.value.trim().length >= 2) sList.hidden = false; });
    sList.addEventListener('mousedown', function (e) { var li = e.target.closest('li[data-href]'); if (li) { e.preventDefault(); sGo(li); } });
    document.addEventListener('click', function (e) { if (!e.target.closest('#searchWrap')) sClose(); });
    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag)) { e.preventDefault(); sInput.focus(); }
    });
  }

  /* --- Light / dark mode ----------------------------------------------
     The choice is kept in a cookie (ss_theme) so the server can render the
     right theme on the very first paint, with no flash. */
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { document.cookie = 'ss_theme=' + next + '; path=/; max-age=31536000; SameSite=Lax'; } catch (e) {}
    });
  }

  /* --- Show / hide password -------------------------------------------- */
  var eyeOn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var eyeOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.1-5.9M9.9 4.2A10.5 10.5 0 0 1 12 4c7 0 11 7 11 7a19.7 19.7 0 0 1-3.2 4.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  document.querySelectorAll('input[type="password"]').forEach(function (inp) {
    var box = inp.closest('.field');
    if (!box || box.querySelector('.eye-btn')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'eye-btn';
    b.setAttribute('aria-label', 'Show password'); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = eyeOn;
    b.addEventListener('click', function () {
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = show ? eyeOff : eyeOn;
      b.setAttribute('aria-pressed', String(show));
      b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    box.appendChild(b);
  });
})();