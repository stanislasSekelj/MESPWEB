/* MESP site — hero demo: a simplified scene editor.
   The world is a fixed 1600×1000 box (the scene image) scaled to cover the stage;
   every position below is in those world units. */
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  if (!stage || !window.MESP) return;
  var MESP = window.MESP;
  var world = document.getElementById('world');
  var itemsEl = document.getElementById('items');
  var maskEl = document.getElementById('mask');
  var frame = document.getElementById('frame');
  var maskSvg = document.getElementById('mask-edit');
  var maskPoly = maskSvg.querySelector('polygon');
  var maskPtsEl = document.getElementById('mask-pts');
  var readout = document.getElementById('readout');
  var hint = document.getElementById('stage-hint');
  var W = 1600, H = 1000, FOCAL_X = 960;

  /* Labels are the app's own (src/i18n/translations.ts). w,h = file pixels; u = default width in world units. */
  var A = {
    'fire-body': { l: 'Corps en feu', c: 'fire', w: 300, h: 278, u: 330 },
    'fire-door-1': { l: 'Porte en feu 1', c: 'fire', w: 210, h: 340, u: 170 },
    'fire-door-2': { l: 'Porte en feu 2', c: 'fire', w: 167, h: 340, u: 150 },
    'fire-ground-1': { l: 'Feu au sol 1', c: 'fire', w: 260, h: 227, u: 400 },
    'fire-ground-2': { l: 'Feu au sol 2', c: 'fire', w: 300, h: 239, u: 420 },
    'fire-window-1': { l: 'Fenêtre en feu 1', c: 'fire', w: 214, h: 340, u: 150 },
    'fire-window-2': { l: 'Fenêtre en feu 2', c: 'fire', w: 261, h: 340, u: 170 },
    'smoke-1': { l: 'Panache 1', c: 'smoke', w: 320, h: 252, u: 400 },
    'smoke-2': { l: 'Panache 2', c: 'smoke', w: 330, h: 340, u: 380 },
    'smoke-3': { l: 'Panache 3', c: 'smoke', w: 340, h: 267, u: 400 },
    'lightning-1': { l: 'Éclair 1', c: 'explosions', w: 340, h: 212, u: 360 },
    'lightning-2': { l: 'Éclair 2', c: 'explosions', w: 340, h: 226, u: 360 },
    'explosion-aerial': { l: 'Explosion aérienne', c: 'explosions', w: 244, h: 260, u: 400 },
    'explosion-night': { l: 'Explosion nocturne', c: 'explosions', w: 340, h: 248, u: 440 },
    'victim-male-back': { l: 'Victime', c: 'people', w: 360, h: 87, u: 300, still: 1 },
    'victim-male-prone': { l: 'Victime', c: 'people', w: 360, h: 124, u: 300, still: 1 },
    'victim-male-standing': { l: 'Victime', c: 'people', w: 360, h: 86, u: 300, still: 1 },
    'victim-female-prone': { l: 'Victime', c: 'people', w: 135, h: 349, u: 95, still: 1 },
    'victim-female-standing': { l: 'Victime', c: 'people', w: 137, h: 349, u: 95, still: 1 }
  };
  var CATS = [['fire', 'Feu'], ['smoke', 'Fumée'], ['explosions', 'Explosions'], ['people', 'Personnel']];
  var MASK0 = [[891, 684], [1321, 674], [1335, 690], [1345, 812], [905, 826], [900, 700]];
  var SCENE0 = [
    { key: 'smoke-2', x: 835, y: 140, s: 1, r: 0 },
    { key: 'fire-door-2', x: 740, y: 512, s: 0.9, r: 0 },
    { key: 'fire-ground-2', x: 1110, y: 612, s: 1.07, r: 0 }
  ];

  var items = [], sel = null, seq = 0, tint = '', maskOn = true, maskEdit = false, maskPts = [];
  var view = { s: 1, tx: 0, ty: 0 };
  var drag = null, ptrs = new Map();
  var visible = true, started = false;

  function still(key) { return A[key].still ? 'assets/people/' + key + '.webp' : MESP.poster(key); }
  function bw(it) { return A[it.key].u; }
  function bh(it) { var a = A[it.key]; return a.u * a.h / a.w; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function fr(n, d) { return n.toFixed(d).replace('.', ','); }

  /* ── view ── */
  function layout() {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || !sh) return;
    var s = Math.max(sw / W, sh / H);
    view.s = s;
    view.tx = clamp(sw / 2 - FOCAL_X * s, sw - W * s, 0);
    view.ty = (sh - H * s) / 2;
    world.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + s + ')';
    world.style.setProperty('--inv', 1 / s);
  }
  function toWorld(e) {
    var r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.tx) / view.s, y: (e.clientY - r.top - view.ty) / view.s };
  }

  /* ── items ── */
  function draw(it) {
    it.el.style.transform = 'translate(' + (it.x - bw(it) / 2) + 'px,' + (it.y - bh(it) / 2) + 'px) rotate(' + it.r + 'deg) scale(' + it.s + ')';
    if (it === sel) drawFrame();
  }
  function drawFrame() {
    if (!sel) { frame.hidden = true; return; }
    var w = bw(sel) * sel.s, h = bh(sel) * sel.s;
    frame.hidden = false;
    frame.style.width = w + 'px'; frame.style.height = h + 'px';
    frame.style.transform = 'translate(' + (sel.x - w / 2) + 'px,' + (sel.y - h / 2) + 'px) rotate(' + sel.r + 'deg)';
    readout.textContent = A[sel.key].l + ' · ×' + fr(sel.s, 2) + ' · ' + Math.round(sel.r) + '°';
  }
  function add(key, x, y, s, r) {
    var a = A[key];
    var it = { id: ++seq, key: key, x: x, y: y, s: s || 1, r: r || 0 };
    var el = it.el = document.createElement('button');
    el.type = 'button';
    el.className = 'item item--' + a.c;
    el.dataset.id = it.id;
    el.setAttribute('aria-label', a.l + ' — flèches pour déplacer, plus et moins pour la taille, R pour tourner, Suppr pour retirer');
    el.style.width = bw(it) + 'px'; el.style.height = bh(it) + 'px';
    var img = it.img = document.createElement('img');
    img.alt = ''; img.draggable = false; img.src = still(key);
    el.appendChild(img);
    itemsEl.appendChild(el);
    items.push(it);
    applyTint(it);
    draw(it);
    animate(it);
    return it;
  }
  function remove(it) {
    if (!it) return;
    items.splice(items.indexOf(it), 1);
    it.el.remove();
    if (sel === it) select(null);
  }
  function select(it) {
    if (sel === it) return;
    if (sel) sel.el.classList.remove('is-selected');
    sel = it;
    if (it) it.el.classList.add('is-selected'); else readout.textContent = 'Aucun';
    document.querySelectorAll('[data-act]').forEach(function (b) { b.disabled = !it; });
    drawFrame();
  }
  function byEl(el) { var id = +el.dataset.id; return items.find(function (i) { return i.id === id; }); }
  function setScale(it, s) { it.s = clamp(s, 0.3, 3); draw(it); }
  function setRot(it, r) { it.r = ((r % 360) + 540) % 360 - 180; draw(it); }
  function moveTo(it, x, y) { it.x = clamp(x, 0, W); it.y = clamp(y, 0, H); draw(it); }

  /* ── animated playback: only while the stage is on screen and the tab is visible ── */
  function canPlay() { return started && visible && !document.hidden && !MESP.reduced(); }
  function animate(it) {
    if (A[it.key].still || !canPlay()) return;
    MESP.preload(it.key).then(function () {
      if (items.indexOf(it) >= 0 && canPlay()) it.img.src = MESP.anim(it.key);
    });
  }
  function refreshPlayback() {
    items.forEach(function (it) {
      if (A[it.key].still) return;
      if (canPlay()) animate(it);
      else if (it.img.src.indexOf('.poster.') < 0) it.img.src = MESP.poster(it.key);
    });
  }

  /* ── tint ── */
  function applyTint(it) { if (A[it.key].c === 'smoke') it.img.style.filter = tint ? 'url(#tint-' + tint + ')' : ''; }

  /* ── mask ── */
  function drawMask() {
    var poly = maskPts.map(function (p) { return p[0] + 'px ' + p[1] + 'px'; }).join(',');
    maskEl.style.clipPath = 'polygon(' + poly + ')';
    maskEl.hidden = !maskOn;
    maskPoly.setAttribute('points', maskPts.map(function (p) { return p.join(','); }).join(' '));
    maskSvg.hidden = maskPtsEl.hidden = !maskEdit;
    Array.prototype.forEach.call(maskPtsEl.children, function (b, i) {
      b.style.left = maskPts[i][0] + 'px'; b.style.top = maskPts[i][1] + 'px';
    });
    document.getElementById('mask-toggle').setAttribute('aria-pressed', String(maskOn));
    document.getElementById('mask-edit-toggle').setAttribute('aria-pressed', String(maskEdit));
  }
  function buildMaskPts() {
    maskPtsEl.textContent = '';
    maskPts.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'handle mask-pt'; b.dataset.pt = i;
      b.setAttribute('aria-label', 'Coin ' + (i + 1) + ' du masque — glisser ou flèches pour déplacer');
      maskPtsEl.appendChild(b);
    });
  }

  /* ── reset ── */
  function reset() {
    items.slice().forEach(remove);
    select(null);
    tint = ''; maskOn = true; maskEdit = false;
    maskPts = MASK0.map(function (p) { return p.slice(); });
    SCENE0.forEach(function (d) { add(d.key, d.x, d.y, d.s, d.r); });
    document.querySelectorAll('#tints [role=radio]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.tint === '')); });
    drawMask();
  }

  /* ── pointer interaction ── */
  function hideHint() { hint.classList.add('is-off'); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function ang(a, b) { return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; }

  itemsEl.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.item');
    if (!el || drag) return;
    var it = byEl(el);
    /* Touch: an unselected element lets the page scroll; the tap (click) selects it. */
    if (e.pointerType === 'touch' && sel !== it) return;
    if (e.button) return;
    select(it); hideHint();
    var p = toWorld(e);
    ptrs.set(e.pointerId, p);
    drag = { mode: 'move', it: it, id: e.pointerId, ox: it.x - p.x, oy: it.y - p.y };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  itemsEl.addEventListener('click', function (e) {
    var el = e.target.closest('.item');
    if (el) { select(byEl(el)); hideHint(); }
  });
  itemsEl.addEventListener('focusin', function (e) {
    var el = e.target.closest('.item');
    if (el) select(byEl(el));
  });

  frame.addEventListener('pointerdown', function (e) {
    var h = e.target.closest('[data-handle]');
    if (!h || !sel || drag || e.button) return;
    var kind = h.dataset.handle;
    if (kind === 'del') return;
    e.preventDefault();
    var p = toWorld(e), c = { x: sel.x, y: sel.y };
    ptrs.set(e.pointerId, p);
    drag = kind === 'scale'
      ? { mode: 'scale', it: sel, id: e.pointerId, d0: Math.max(1, dist(c, p)), s0: sel.s }
      : { mode: 'rot', it: sel, id: e.pointerId, a0: ang(c, p), r0: sel.r };
    try { h.setPointerCapture(e.pointerId); } catch (_) {}
  });
  frame.addEventListener('click', function (e) {
    var h = e.target.closest('[data-handle="del"]');
    if (h) remove(sel);
  });
  frame.addEventListener('keydown', function (e) {
    var h = e.target.closest('[data-handle]');
    if (!h || !sel) return;
    var k = h.dataset.handle, d = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -1 : 0;
    if (!d || k === 'del') return;
    e.preventDefault();
    if (k === 'rot') setRot(sel, sel.r + d * 5); else setScale(sel, sel.s * (1 + d * 0.05));
  });

  maskPtsEl.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('[data-pt]');
    if (!b || drag || e.button) return;
    e.preventDefault();
    drag = { mode: 'pt', i: +b.dataset.pt, id: e.pointerId };
    try { b.setPointerCapture(e.pointerId); } catch (_) {}
  });
  maskPtsEl.addEventListener('keydown', function (e) {
    var b = e.target.closest('[data-pt]');
    var d = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key];
    if (!b || !d) return;
    e.preventDefault();
    var p = maskPts[+b.dataset.pt];
    p[0] = clamp(p[0] + d[0], 0, W); p[1] = clamp(p[1] + d[1], 0, H);
    drawMask();
  });

  /* Second finger anywhere on the stage while an element is held: pinch = scale + rotate. */
  stage.addEventListener('pointerdown', function (e) {
    if (!drag || drag.mode !== 'move' || e.pointerId === drag.id || e.pointerType !== 'touch' || ptrs.size !== 1) return;
    var p = toWorld(e), q = ptrs.get(drag.id);
    ptrs.set(e.pointerId, p);
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    drag = { mode: 'pinch', it: drag.it, id: drag.id, id2: e.pointerId, d0: Math.max(1, dist(q, p)), a0: ang(q, p), s0: drag.it.s, r0: drag.it.r };
  }, true);

  stage.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var p = toWorld(e);
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
    var it = drag.it;
    if (drag.mode === 'move' && e.pointerId === drag.id) {
      moveTo(it, p.x + drag.ox, p.y + drag.oy);
    } else if (drag.mode === 'pinch' && ptrs.has(drag.id) && ptrs.has(drag.id2)) {
      var a = ptrs.get(drag.id), b = ptrs.get(drag.id2);
      it.s = clamp(drag.s0 * dist(a, b) / drag.d0, 0.3, 3);
      setRot(it, drag.r0 + ang(a, b) - drag.a0);
    } else if (drag.mode === 'scale' && e.pointerId === drag.id) {
      setScale(it, drag.s0 * dist({ x: it.x, y: it.y }, p) / drag.d0);
    } else if (drag.mode === 'rot' && e.pointerId === drag.id) {
      setRot(it, drag.r0 + ang({ x: it.x, y: it.y }, p) - drag.a0);
    } else if (drag.mode === 'pt' && e.pointerId === drag.id) {
      maskPts[drag.i] = [Math.round(clamp(p.x, 0, W)), Math.round(clamp(p.y, 0, H))];
      drawMask();
    }
  });
  function endPointer(e) {
    ptrs.delete(e.pointerId);
    if (!drag) return;
    if (drag.mode === 'pinch' && (e.pointerId === drag.id || e.pointerId === drag.id2)) {
      var rest = e.pointerId === drag.id ? drag.id2 : drag.id, q = ptrs.get(rest), it = drag.it;
      drag = q ? { mode: 'move', it: it, id: rest, ox: it.x - q.x, oy: it.y - q.y } : null;
    } else if (e.pointerId === drag.id) {
      drag = null; ptrs.clear();
    }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  /* While an element is held, the page must not scroll under the fingers. Otherwise scrolling is free. */
  stage.addEventListener('touchmove', function (e) { if (drag && e.cancelable) e.preventDefault(); }, { passive: false });
  stage.addEventListener('click', function (e) {
    if (!e.target.closest('.item, .handle')) select(null);
  });
  stage.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* ── keyboard on elements ── */
  itemsEl.addEventListener('keydown', function (e) {
    var el = e.target.closest('.item');
    if (!el) return;
    var it = byEl(el), step = e.shiftKey ? 48 : 12, k = e.key;
    if (k === 'ArrowLeft') moveTo(it, it.x - step, it.y);
    else if (k === 'ArrowRight') moveTo(it, it.x + step, it.y);
    else if (k === 'ArrowUp') moveTo(it, it.x, it.y - step);
    else if (k === 'ArrowDown') moveTo(it, it.x, it.y + step);
    else if (k === '+' || k === '=') setScale(it, it.s * 1.1);
    else if (k === '-' || k === '_') setScale(it, it.s / 1.1);
    else if (k === 'r') setRot(it, it.r + 15);
    else if (k === 'R') setRot(it, it.r - 15);
    else if (k === 'Delete' || k === 'Backspace') { remove(it); stage.focus(); }
    else if (k === 'Escape') { select(null); el.blur(); }
    else return;
    e.preventDefault();
  });
  stage.tabIndex = -1;

  /* ── panel ── */
  document.querySelector('.panel').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var act = b.dataset.act;
    if (act && sel) {
      if (act === 'smaller') setScale(sel, sel.s / 1.15);
      if (act === 'bigger') setScale(sel, sel.s * 1.15);
      if (act === 'ccw') setRot(sel, sel.r - 15);
      if (act === 'cw') setRot(sel, sel.r + 15);
      if (act === 'del') remove(sel);
    } else if (b.id === 'mask-toggle') {
      maskOn = !maskOn; if (!maskOn) maskEdit = false; drawMask();
    } else if (b.id === 'mask-edit-toggle') {
      maskEdit = !maskEdit; if (maskEdit) maskOn = true; drawMask();
    } else if (b.hasAttribute('data-tint')) {
      tint = b.dataset.tint;
      document.querySelectorAll('#tints [role=radio]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      items.forEach(applyTint);
    } else if (b.id === 'reset') {
      reset();
    }
    hideHint();
  });

  /* ── tray ── */
  var tabsEl = document.getElementById('tabs'), listsEl = document.getElementById('tray-lists');
  CATS.forEach(function (c, ci) {
    var keys = Object.keys(A).filter(function (k) { return A[k].c === c[0]; });
    var tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'tab'; tab.id = 'tab-' + c[0];
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'list-' + c[0]);
    tab.setAttribute('aria-selected', String(ci === 0)); tab.tabIndex = ci === 0 ? 0 : -1;
    tab.innerHTML = c[1] + '<span class="num">' + keys.length + '</span>';
    tabsEl.appendChild(tab);
    var list = document.createElement('div');
    list.className = 'tray-list'; list.id = 'list-' + c[0];
    list.setAttribute('role', 'tabpanel'); list.setAttribute('aria-labelledby', tab.id);
    list.hidden = ci !== 0;
    keys.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tray-item'; b.dataset.key = k;
      b.setAttribute('aria-label', 'Ajouter : ' + A[k].l);
      b.innerHTML = '<img src="' + still(k) + '" alt="" width="72" height="72" loading="lazy" draggable="false"><span>' + A[k].l + '</span>';
      list.appendChild(b);
    });
    listsEl.appendChild(list);
  });
  function showTab(tab) {
    tabsEl.querySelectorAll('.tab').forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabsEl.addEventListener('click', function (e) { var t = e.target.closest('.tab'); if (t) showTab(t); });
  tabsEl.addEventListener('keydown', function (e) {
    var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    var tabs = Array.prototype.slice.call(tabsEl.children), i = tabs.indexOf(document.activeElement);
    var n = tabs[(i + d + tabs.length) % tabs.length];
    showTab(n); n.focus(); e.preventDefault();
  });

  function addAtCentre(key) {
    var r = stage.getBoundingClientRect(), n = items.length % 5;
    var p = toWorld({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    var it = add(key, clamp(p.x + (n - 2) * 36, 0, W), clamp(p.y + (n - 2) * 22, 0, H));
    select(it);
    return it;
  }
  /* Mouse / pen: drag a thumbnail onto the photo. Touch and keyboard: a tap adds it to the centre. */
  var tdrag = null, swallow = false;
  listsEl.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.tray-item');
    if (!b || e.pointerType === 'touch' || e.button) return;
    tdrag = { key: b.dataset.key, x: e.clientX, y: e.clientY, ghost: null, id: e.pointerId, b: b };
  });
  window.addEventListener('pointermove', function (e) {
    if (!tdrag || e.pointerId !== tdrag.id) return;
    if (!tdrag.ghost) {
      if (Math.hypot(e.clientX - tdrag.x, e.clientY - tdrag.y) < 8) return;
      var g = tdrag.ghost = document.createElement('img');
      g.className = 'tray-ghost'; g.alt = ''; g.src = still(tdrag.key);
      document.body.appendChild(g);
    }
    tdrag.ghost.style.transform = 'translate(' + (e.clientX - 60) + 'px,' + (e.clientY - 60) + 'px)';
  });
  window.addEventListener('pointerup', function (e) {
    if (!tdrag || e.pointerId !== tdrag.id) return;
    var t = tdrag; tdrag = null;
    if (!t.ghost) return;
    t.ghost.remove();
    swallow = true; setTimeout(function () { swallow = false; }, 0);
    var r = stage.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      var p = toWorld(e);
      select(add(t.key, clamp(p.x, 0, W), clamp(p.y, 0, H)));
      hideHint();
    }
  });
  listsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.tray-item');
    if (!b || swallow) return;
    addAtCentre(b.dataset.key); hideHint();
  });

  /* ── lifecycle ── */
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(stage);
  window.addEventListener('resize', layout);
  layout();
  buildMaskPts();
  maskPts = MASK0.map(function (p) { return p.slice(); });
  reset();
  buildMaskPts();
  drawMask();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; refreshPlayback(); }, { threshold: 0.05 }).observe(stage);
  }
  document.addEventListener('visibilitychange', refreshPlayback);
  /* Heavy animated files start only after the page itself has loaded. */
  function start() { started = true; refreshPlayback(); }
  if (document.readyState === 'complete') setTimeout(start, 300);
  else window.addEventListener('load', function () { setTimeout(start, 300); });
  setTimeout(hideHint, 9000);
})();
