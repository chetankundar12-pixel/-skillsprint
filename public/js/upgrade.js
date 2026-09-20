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
})();
