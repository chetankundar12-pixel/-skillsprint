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
    var labels = { announce: 'Announcement', overdue: 'Overdue', today: 'Due today', upcoming: 'Upcoming', none: 'No due date' };
    var loadNotifs = function () {
      fetch('/api/notifications', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var seen = [];
          try { seen = JSON.parse(localStorage.getItem('ss_seen_announce') || '[]'); } catch (e) {}
          var unseen = d.items.filter(function (n) { return n.type === 'announcement' && seen.indexOf(n.id) === -1; }).length;
          var total = unseen + d.items.filter(function (n) { return n.type !== 'announcement'; }).length;
          window.__ssAnnounceIds = d.items.filter(function (n) { return n.type === 'announcement'; }).map(function (n) { return n.id; });
          notifBadge.hidden = !total;
          notifBadge.textContent = total > 9 ? '9+' : total;
          if (!d.items.length) {
            notifList.innerHTML = '<li class="notif-empty">You\u2019re all caught up.</li>';
            return;
          }
          notifList.innerHTML = d.items.map(function (n) {
            return '<li><a href="' + (n.type === 'announcement' ? '#' : '/reminders') + '" class="notif-item is-' + n.state + '">' +
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
})();