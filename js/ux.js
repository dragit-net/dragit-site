/* ================================================================
   dragIT — shared UX layer (Phase 4, 8.1 -> 10.0)
   Runs AFTER js/site.js on the pages that include it.
   1. STICKY MOBILE CTA — fixed bar that slides up once the
      hero's primary actions have scrolled past the fold.
      Only on <=860px viewports (CSS gates the display).
      Adds <body class="has-sticky-cta"> so the CTA is shown.
   2. DESKTOP EXIT-INTENT — a single, non-intrusive bottom nudge
      when the pointer leaves the top of the viewport while the
      primary CTA is still on screen; never more than once/session,
      and only on pointer-capable (mouse) desktops.
   3. REDUCED-MOTION aware — if the user prefers reduced motion we
      still reveal the sticky bar / nudge but without the slide
      transition (CSS handles the animation; we only toggle the
      .show class).
   No tracking or GA dependency — pure progressive enhancement.
   ================================================================ */
(function () {
  'use strict';

  var reduce = false;
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  // 1) Sticky mobile CTA bar
  var sticky = document.querySelector('.sticky-cta');
  if (sticky) {
    document.body.classList.add('has-sticky-cta');
    // Trigger target: the main hero actions row (or the first CTA block).
    var trigger = document.querySelector('.hero-actions') ||
                  document.querySelector('.cta-block');
    var ctaSection = document.querySelector('#cta');
    var shown = false;
    function setState(show) {
      if (show !== shown) { shown = show; sticky.classList.toggle('show', show); }
    }
    function onScroll() {
      if (!trigger) return;
      var r = trigger.getBoundingClientRect();
      setState(r.bottom < 0 && !(ctaSection && ctaSection.getBoundingClientRect().top < window.innerHeight));
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function () { onScroll(); }, { threshold: 0.15 });
      if (ctaSection) io.observe(ctaSection);
      if (trigger) io.observe(trigger);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // 2) Desktop exit-intent nudge (mouse only, once per session, off-site links)
  var nudge = document.querySelector('.exit-nudge');
  var hasMouse = (window.matchMedia &&
                  window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var SESS_KEY = 'dragit_exit_shown_v1';
  if (nudge && hasMouse && window.innerWidth > 860 &&
      !sessionStorage.getItem(SESS_KEY)) {
    var fired = false;
    document.addEventListener('mouseout', function (ev) {
      if (ev.relatedTarget || ev.clientY <= 0) {
        // Pointer left the window from the top edge.
        if (!fired) {
          fired = true;
          sessionStorage.setItem(SESS_KEY, '1');
          nudge.classList.add('show');
        }
      }
    });
    var closeBtn = nudge.querySelector('.en-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        nudge.classList.remove('show');
      });
    }
  }

  // 3) FAQ: native <details>/<summary> already work; add optional
  //    "close siblings" behaviour so only one item is open at a time
  //    (cleaner scan), while remaining fully keyboard/screen-reader
  //    friendly (summary is focusable, Enter/Space toggle natively).
  var faqItems = Array.prototype.slice.call(
    document.querySelectorAll('.faq-list .faq-item')
  );
  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        faqItems.forEach(function (other) {
          if (other !== item && other.open) other.open = false;
        });
      }
    });
  });

  // 4) Tabs (book_meeting): keyboard roving tabindex + arrow keys.
  var tablist = document.querySelector('.tabs[role="tablist"]');
  if (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('.tab'));
    tabs.forEach(function (t, i) {
      t.setAttribute('role', 'tab');
      t.setAttribute('tabindex', i === 0 ? '0' : '-1');
      t.addEventListener('keydown', function (e) {
        var idx = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') idx = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') idx = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') idx = 0;
        else if (e.key === 'End') idx = tabs.length - 1;
        else return;
        e.preventDefault();
        tabs[idx].focus();
        // activate the tab on focus (WAI-APG "automatic activation")
        var target = tabs[idx].getAttribute('aria-controls') ||
                     document.getElementById('panel-' + tabs[idx].id.replace('tab-', ''));
        // reuse the inline showTab if present, else toggle manually
        if (window.showTab) window.showTab(tabs[idx].id.replace('tab-', ''));
      });
    });
  }
})();
