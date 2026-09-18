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
  var html = document.documentElement;
  var params = new URLSearchParams(location.search);

  function facePath() {
    var seg = location.pathname.split('/').filter(Boolean);
    var isSr = seg[0] === 'sr';
    if (isSr) seg.shift();
    return { isSr: isSr, file: seg.length ? seg.join('/') : 'index.html' };
  }

  function fireEvents() {
    if (window.gtag) {
      var f = facePath();
      gtag('event', 'face_reached', {
        face: f.isSr ? 'sr' : 'en',
        page: '/' + (f.file === 'index.html' ? 'home' : f.file)
      });
      if (document.querySelector('.cta-calendly iframe')) {
        gtag('event', 'calendly_embed', { page: location.pathname });
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
        // Regional visitor on the EN face → SR equivalent
        var sr = f.file === 'index.html' ? '/sr/' : '/sr/' + f.file;
        location.replace(sr + hash);
        return;
      }
      reveal();
    })
    .catch(function () { clearTimeout(timer); reveal(); });
})();
