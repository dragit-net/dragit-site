/* ================================================================
   dragIT — shared site script
   ----------------------------------------------------------------
   1. REGION GATE (two-faces mechanism, no visible switch):
      - EN face  = personal brand (Zoran Dragičević, PhD)
      - SR face  = dragIT corporate (regional: RS/ME/HR/BA/MK)
      Geolocation via api.country.is routes the visitor to the
      correct face — on every page, deep links included:
        * non-regional visitor on /sr/…  → redirects to EN equivalent
        * regional visitor on EN page   → redirects to /sr/… equivalent
      Fail-open: if the lookup fails or times out, stay where you are.
      The country is resolved once per browser session (sessionStorage
      `dragit_geo`); every later page routes without a network call.
      No-JS: each page carries a <noscript> reveal + a 4.5 s inline
      safety timer, so the content is never left hidden behind the gate.
      Bypass for testing: ?lang=en or ?lang=sr keeps the current face.
   2. GA4: fires `face_reached` (which face was shown) and
      `calendly_embed` (when the visitor deliberately loads the Calendly iframe).
   ================================================================ */
(function () {
  'use strict';
  var faceFired = false;
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

  // Clean page_location for GA4: the internal ?lang= QA pin must not
  // create phantom pages in analytics (routing itself still uses it).
  function cleanLocation() {
    var q = new URLSearchParams(location.search);
    q.delete('lang');
    var s = q.toString();
    return location.origin + location.pathname + (s ? '?' + s : '');
  }

  function fireEvents() {
    if (window.gtag && !faceFired) {
      faceFired = true;
      var f = facePath();
      gtag('event', 'face_reached', {
        face: f.isSr ? 'sr' : 'en',
        page: '/' + (f.file === 'index.html' ? 'home' : f.file),
        source: sourceDim()
      });
    }
  }

  function reveal() {
    if (html.classList) html.classList.remove('region-gate');
    var o = document.getElementById('regionLoading');
    if (o) o.style.display = 'none';
    fireEvents();
  }

  // Language pin (dev/QA override): ?lang=en or ?lang=sr keeps the chosen
  // face for the ENTIRE browser session, so internal links (nav, footer,
  // CTAs) that carry no query string stay on the pinned face. The pin is
  // stored in sessionStorage and cleared automatically when the tab closes.
  // Production visitors are unaffected: the key is only written when the
  // ?lang param is present; without it, geo-routing works as designed.
  var LANG_KEY = 'dragit_lang';
  var GEO_KEY = 'dragit_geo';
  var langParam = params.get('lang');
  var pinned = null;
  try { pinned = sessionStorage.getItem(LANG_KEY); } catch (e) { /* ignore */ }

  // Routing decision for a resolved country code (2-letter, uppercase).
  function route(cc) {
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
  }

  // The country is resolved once per browser session: every following page
  // routes from sessionStorage — no geo API call, no hidden wait.
  var geo = null;
  try { geo = sessionStorage.getItem(GEO_KEY); } catch (e) { /* ignore */ }

  if (langParam === 'en' || langParam === 'sr') {
    try { sessionStorage.setItem(LANG_KEY, langParam); } catch (e) { /* private mode */ }
    reveal();
  } else if (pinned === 'en' || pinned === 'sr') {
    reveal();
  } else if (geo) {
    route(geo.toUpperCase());
  } else {
    // Safety: never keep the page hidden for more than 4 seconds
    var timer = setTimeout(reveal, 4000);

    fetch('https://api.country.is/')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        var cc = (d.country || '').toUpperCase();
        try { if (cc) sessionStorage.setItem(GEO_KEY, cc); } catch (e) { /* ignore */ }
        route(cc);
      })
      .catch(function () { clearTimeout(timer); reveal(); });
  }
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
  // ===== Calendly consent facade =====
  // The Calendly iframe carries data-src and stays hidden until the visitor
  // deliberately loads it, so no third-party cookies are set before that.
  var calBlocks = document.querySelectorAll('.cta-calendly');
  Array.prototype.forEach.call(calBlocks, function (block) {
    var frame = block.querySelector('iframe[data-src]');
    var btn = block.querySelector('.cal-load');
    if (!frame || !btn) return;
    btn.addEventListener('click', function () {
      frame.setAttribute('src', frame.getAttribute('data-src'));
      frame.removeAttribute('data-src');
      frame.hidden = false;
      block.classList.add('cal-loaded');
      if (window.gtag) {
        gtag('event', 'calendly_embed', {
          page: location.pathname,
          source: sourceDim()
        });
        gtag('event', 'book_call', {
          page: location.pathname,
          source: sourceDim()
        });
      }
    });
  });

  // ===== GA4 CTA click tracking =====
  // One delegated listener: primary buttons and CTA links report
  // `cta_click` with a readable label (booking CTAs, hero CTAs, sticky CTA).
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest
      ? e.target.closest('a.btn, button.btn, .nav-cta, .sc-btn, .cta-link')
      : null;
    if (!el || !window.gtag || el.closest('#consentBanner')) return;
    var label = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    gtag('event', 'cta_click', {
      cta: label,
      href: el.getAttribute('href') || '',
      page: location.pathname,
      source: sourceDim()
    });
  });

  // ===== GA4 consent (deferred loading, Consent Mode v2 semantics) =====
  // GA4 is NOT loaded on page load. It loads only after the visitor allows
  // analytics in the consent banner (or on a later visit when the stored
  // choice is "granted"). Declining means Google is never contacted at all.
  // Pages without the banner (privacy, 404) never load GA4.
  var CONSENT_KEY = 'dragit_consent';
  var GA4_ID = 'G-BTF2W65KZB';
  var consentBanner = document.getElementById('consentBanner');
  if (consentBanner) {
    var storedConsent = null;
    try { storedConsent = localStorage.getItem(CONSENT_KEY); } catch (e) { /* private mode */ }

    var loadGA4 = function () {
      if (document.getElementById('ga4-script') || window.gtag) return; // QA stub respected
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      gtag('consent', 'default', {
        analytics_storage: 'granted', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied'
      });
      var s = document.createElement('script');
      s.id = 'ga4-script';
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
      document.head.appendChild(s);
      gtag('js', new Date());
      gtag('config', GA4_ID, { page_location: cleanLocation() });
      fireEvents();
    };

    if (storedConsent === 'granted') {
      loadGA4();
    } else if (storedConsent !== 'denied') {
      consentBanner.hidden = false;
      var consentYes = document.getElementById('consentYes');
      var consentNo = document.getElementById('consentNo');
      if (consentYes) consentYes.addEventListener('click', function () {
        try { localStorage.setItem(CONSENT_KEY, 'granted'); } catch (e) { /* ignore */ }
        consentBanner.hidden = true;
        loadGA4();
      });
      if (consentNo) consentNo.addEventListener('click', function () {
        try { localStorage.setItem(CONSENT_KEY, 'denied'); } catch (e) { /* ignore */ }
        consentBanner.hidden = true;
      });
    }
  }

  // ===== GDPR art. 7(3): withdrawing consent as easily as giving it =====
  // Every footer carries a [data-consent-revoke] link. It drops the stored
  // choice, tells GA4 to stop (Consent Mode update), clears the _ga cookies and
  // reloads, so the banner is offered again and nothing is measured until the
  // visitor makes a new explicit choice.
  var revokeLink = document.querySelector('[data-consent-revoke]');
  if (revokeLink) {
    revokeLink.addEventListener('click', function (ev) {
      ev.preventDefault();
      try { localStorage.removeItem(CONSENT_KEY); } catch (e) { /* private mode */ }
      if (window.gtag) {
        gtag('consent', 'update', {
          analytics_storage: 'denied', ad_storage: 'denied',
          ad_user_data: 'denied', ad_personalization: 'denied'
        });
      }
      document.cookie.split(';').forEach(function (cookie) {
        var name = cookie.split('=')[0].trim();
        if (name === '_ga' || name.indexOf('_ga_') === 0) {
          document.cookie = name + '=; Max-Age=0; path=/';
          document.cookie = name + '=; Max-Age=0; path=/; domain=' +
            location.hostname.replace(/^www\./, '');
        }
      });
      location.reload();
    });
  }

})();
