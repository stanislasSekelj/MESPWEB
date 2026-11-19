/* MESP site — shared behaviour: reveals, cropped scene figures, lazy effect playback. */
(function () {
  'use strict';
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var FX = 'assets/fx/';
  var MESP = window.MESP = {
    reduced: function () { return RM.matches; },
    anim: function (n) { return FX + n + '.webp'; },
    poster: function (n) { return FX + n + '.poster.webp'; },
    /* Fetch an animated effect, then resolve. One download at a time. */
    queue: Promise.resolve(),
    preload: function (n) {
      MESP.queue = MESP.queue.then(function () {
        return new Promise(function (res) {
          var im = new Image();
          im.onload = im.onerror = function () { res(); };
          im.src = MESP.anim(n);
        });
      });
      return MESP.queue;
    }
  };
  var hasIO = 'IntersectionObserver' in window;

  /* Reveal on scroll (opacity + transform only). */
  var reveals = document.querySelectorAll('.reveal');
  if (hasIO && !RM.matches) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { rio.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* Figures that show a crop of the 1600×1000 scene: data-crop="x,y,w,h". */
  function fit(shot) {
    var c = shot.getAttribute('data-crop').split(',').map(Number);
    var inner = shot.querySelector('.world-crop');
    var w = shot.clientWidth, h = shot.clientHeight;
    if (!w || !h) return;
    var s = Math.max(w / c[2], h / c[3]);
    inner.style.transform = 'translate(' + (-c[0] * s + (w - c[2] * s) / 2) + 'px,' + (-c[1] * s + (h - c[3] * s) / 2) + 'px) scale(' + s + ')';
  }
  var shots = document.querySelectorAll('.shot[data-crop]');
  shots.forEach(function (s) {
    fit(s);
    if ('ResizeObserver' in window) new ResizeObserver(function () { fit(s); }).observe(s);
  });

  /* Effects inside figures: animated only while on screen and the tab is visible. */
  var live = new Set();
  function play(img, on) {
    var n = img.getAttribute('data-fx');
    if (on && !RM.matches && !document.hidden) {
      MESP.preload(n).then(function () { if (live.has(img) && !document.hidden) img.src = MESP.anim(n); });
    } else if (img.src.indexOf('.poster.') < 0) {
      img.src = MESP.poster(n);
    }
  }
  if (hasIO) {
    var fio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) live.add(e.target); else live.delete(e.target);
        play(e.target, e.isIntersecting);
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('.shot img.fx[data-fx]').forEach(function (i) { fio.observe(i); });
  }

  /* Catalog: one effect plays at a time, on request. */
  var catalog = document.getElementById('catalog');
  var playing = null;
  function stopCell() {
    if (!playing) return;
    playing.setAttribute('aria-pressed', 'false');
    playing.querySelector('img').src = MESP.poster(playing.getAttribute('data-fx'));
    playing = null;
  }
  if (catalog) {
    catalog.addEventListener('click', function (e) {
      var cell = e.target.closest('button.cell');
      if (!cell) return;
      var same = cell === playing;
      stopCell();
      if (same) return;
      playing = cell;
      cell.setAttribute('aria-pressed', 'true');
      var n = cell.getAttribute('data-fx');
      MESP.preload(n).then(function () { if (playing === cell) cell.querySelector('img').src = MESP.anim(n); });
    });
    if (hasIO) new IntersectionObserver(function (es) { if (!es[0].isIntersecting) stopCell(); }).observe(catalog);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopCell();
    live.forEach(function (img) { play(img, !document.hidden); });
  });

  /* Mask figure: switch on once when scrolled into view, then leave it to the visitor. */
  var mShot = document.getElementById('mask-shot');
  if (mShot) {
    var mBtn = document.getElementById('mask-shot-toggle');
    var mCap = document.getElementById('mask-shot-cap');
    var mMask = mShot.querySelector('.mask');
    var touched = false;
    var setMask = function (on) {
      mMask.hidden = !on;
      mBtn.setAttribute('aria-pressed', String(on));
      mCap.textContent = on ? 'Avec masque sur le muret' : 'Sans masque';
    };
    mBtn.addEventListener('click', function () { touched = true; setMask(mMask.hidden); });
    if (hasIO && !RM.matches) {
      var mio = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        mio.disconnect();
        setTimeout(function () { if (!touched) setMask(true); }, 1400);
      }, { threshold: 0.6 });
      mio.observe(mShot);
    } else {
      setMask(true);
    }
  }

  /* Water figure: opacity ("murkiness"). */
  var range = document.getElementById('water-range');
  if (range) {
    var water = document.getElementById('water'), out = document.getElementById('water-out');
    var upd = function () { water.style.opacity = range.value / 100; out.textContent = range.value + ' %'; };
    range.addEventListener('input', upd); upd();
  }
})();
