/* ================================================================
   dragIT — shared site script
   ----------------------------------------------------------------
   1. REGION GATE (two-faces mechanism, no visible switch):
      - EN face  = personal brand (Dr Zoran Dragićević)
      - SR face  = dragIT corporate (regional: RS/ME/HR/BA/MK)
      Geolocation via api.country.is routes the visitor to the
      correct face — on every page, deep links included:
        * non-regional visitor on /sr/…  → redirects to EN equivalent
        * regional visitor on EN page   → redirects to /sr/… equivalent
      Fail-open: if the lookup fails or times out, stay where you are.
      Bypass for testing: ?lang=en or ?lang=sr keeps the current face.
   2. GA4: fires `face_reached` (which face was shown) and
      `calendly_embed` (when a page embeds the Calendly CTA).
   ================================================================ */
(function () {
  'use strict';
  var REGION = ['RS', 'ME', 'HR', 'BA', 'MK'];
  // EN-only pages that have NO /sr/ equivalent — regional visitors stay on EN.
  var EN_ONLY = ['about.html'];
  var html = document.documentElement;
  var params = new URLSearchParams(location.search);

  function facePath() {
    var seg = location.pathname.split('/').filter(Boolean);
    var isSr = seg[0] === 'sr';
    if (isSr) seg.shift();
    return { isSr: isSr, file: seg.length ? seg.join('/') : 'index.html' };
  }

  // Channel signal: ?src=email (or utm_source) marks an email/social link.
  // Google/organic traffic carries no such param and gets source='direct'.
  // (referrer is NOT used as a hard signal — many mail clients strip it.)
  function sourceDim() {
    var s = params.get('src');
    if (s) return s;
    var utm = params.get('utm_source');
    if (utm) return utm;
    var ref = document.referrer || '';
    if (ref && /mail\.google|gmail\.com|linkedin\.com|wa\.me/i.test(ref)) return 'email_or_social';
    return 'direct';
  }

  function fireEvents() {
    if (window.gtag) {
      var f = facePath();
      gtag('event', 'face_reached', {
        face: f.isSr ? 'sr' : 'en',
        page: '/' + (f.file === 'index.html' ? 'home' : f.file),
        source: sourceDim()
      });
      if (document.querySelector('.cta-calendly iframe')) {
        gtag('event', 'calendly_embed', {
          page: location.pathname,
          source: sourceDim()
        });
      }
    }
  }

  function reveal() {
    if (html.classList) html.classList.remove('region-gate');
    var o = document.getElementById('regionLoading');
    if (o) o.style.display = 'none';
    fireEvents();
  }

  // Explicit bypass — used for testing and pinned language
  if (params.get('lang') === 'en' || params.get('lang') === 'sr') {
    reveal();
    return;
  }

  // Safety: never keep the page hidden for more than 4 seconds
  var timer = setTimeout(reveal, 4000);

  fetch('https://api.country.is/')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      clearTimeout(timer);
      var cc = (d.country || '').toUpperCase();
      var regional = REGION.indexOf(cc) !== -1;
      var f = facePath();
      var hash = location.hash;

      if (f.isSr && !regional) {
        // Non-regional visitor on the SR face → EN equivalent
        var en = f.file === 'index.html' ? '/' : '/' + f.file;
        location.replace(en + hash);
        return;
      }
      if (!f.isSr && regional) {
        // EN-only pages (e.g. the personal about page) have no /sr/ twin:
        // a regional visitor stays on EN rather than hitting a 404.
        if (EN_ONLY.indexOf(f.file) !== -1) {
          reveal();
          return;
        }
        // Regional visitor on the EN face → SR equivalent
        var sr = f.file === 'index.html' ? '/sr/' : '/sr/' + f.file;
        location.replace(sr + hash);
        return;
      }
      reveal();
    })
    .catch(function () { clearTimeout(timer); reveal(); });
})();
  // ===== Mobile burger nav toggle =====
  var burger = document.querySelector('.nav-burger');
  if (burger) {
    burger.addEventListener('click', function () {
      document.querySelector('.nav').classList.toggle('open');
    });
    // close the mobile menu after tapping a link
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () {
        document.querySelector('.nav').classList.remove('open');
      });
    });
  }
