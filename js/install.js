// "Install app" button + modal for phones and tablets (title screen).
// No layout code in here on purpose: this file never touches sizes, the canvas, html or body.
const btn = document.getElementById('install');
const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);   // the install feature is Android-only: iPhone / iPad / desktop never get the button, the modal or the service worker
const mobileLike = () => document.body.classList.contains('mobile') || matchMedia('(hover:none)').matches || matchMedia('(pointer:coarse)').matches || matchMedia('(max-width:900px) and (max-height:520px)').matches;
const installed = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
let deferred = null;

/* ---------- Web app manifest: NOT for iPhone / iPad ----------
   Since iOS 26 the iPad reads the manifest when you add to the home screen and opens the app in its own window mode, which leaves the empty strip.
   Without a manifest it uses the classic apple-mobile-web-app-* tags from index.html (full screen, no strip). Android / Chrome still get the manifest.
   (The <link rel="manifest"> was removed from index.html; it is added here instead.) */
if (!isIOS && !document.querySelector('link[rel=manifest]')) {
  const l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.webmanifest'; document.head.appendChild(l);
}

/* ---------- Safety net for installed iPhone / iPad apps ----------
   Only acts if a gap really exists: if the page's bottom edge is more than a few px above the real screen bottom, everything is stretched to the real screen.
   When there is no gap this does nothing at all. */
(function () {
  if (!(isIOS && navigator.standalone === true)) return;
  const de = document.documentElement;
  const desc = { innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'), innerWidth: Object.getOwnPropertyDescriptor(window, 'innerWidth') };
  const nat = n => { const d = desc[n]; return d ? ((d.get ? d.get.call(window) : d.value) || 0) : 0; };
  let applied = false, size = { w: 0, h: 0 }, lastGap = 0, probe = null;
  const real = () => {
    const land = matchMedia('(orientation: landscape)').matches, big = Math.max(screen.width, screen.height), small = Math.min(screen.width, screen.height);
    return { w: land ? big : small, h: land ? small : big };
  };
  function apply(r) {
    if (!applied) {
      applied = true;
      const st = document.createElement('style');
      // a transform on <body> makes every position:fixed child (canvas, HUD, menus, touch buttons) use <body> as its box
      st.textContent = 'html{position:fixed;top:0;left:0;right:auto;bottom:auto;width:var(--fw);height:var(--fh);overflow:visible}' +
        'html body{position:fixed;top:0;left:0;right:auto;bottom:auto;width:var(--fw);height:var(--fh);transform:translateZ(0);overflow:hidden}';
      document.head.appendChild(st);
      try {
        if (desc.innerHeight && desc.innerWidth) {
          Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => size.h || nat('innerHeight') });
          Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => size.w || nat('innerWidth') });
        }
      } catch (e) {}
    }
    if (r.w !== size.w || r.h !== size.h) {
      size = r;
      de.style.setProperty('--fw', r.w + 'px'); de.style.setProperty('--fh', r.h + 'px');
      dispatchEvent(new Event('resize'));          // main.js re-measures the canvas
    }
  }
  function check() {
    if (!document.body) return;
    if (!probe) { probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;visibility:hidden;pointer-events:none'; document.body.appendChild(probe); }
    const r = real();
    if (applied) return apply(r);
    lastGap = Math.round(r.h - probe.getBoundingClientRect().bottom);
    if (lastGap >= 6 && lastGap <= 90) apply(r);   // a strip of that size = the bug; anything else is left alone
  }
  window.__fitGap = () => ({ applied, gap: lastGap });
  [0, 100, 300, 800, 1600, 3000].forEach(ms => setTimeout(check, ms));
  addEventListener('load', check); addEventListener('pageshow', check); addEventListener('resize', check);
  addEventListener('orientationchange', () => { setTimeout(check, 100); setTimeout(check, 400); setTimeout(check, 900); });
})();

/* ---------- Service worker ----------
   Android only (Chrome needs it for the install prompt). Everywhere else we make sure no worker or cache is left over from earlier versions. */
if ('serviceWorker' in navigator) {
  if (isAndroid) {
    if (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  } else {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
  }
}

/* ---------- Install button + modal ---------- */
function refresh() { if (btn) btn.hidden = !(isAndroid && mobileLike() && !installed()); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); updateModal(); });
addEventListener('appinstalled', () => { deferred = null; refresh(); const m = document.getElementById('installModal'); if (m) m.hidden = true; });
addEventListener('resize', refresh);
addEventListener('orientationchange', () => setTimeout(refresh, 200));
new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
refresh();

function steps() {
  return ['Open your browser menu (the <b>⋮</b> button)', 'Tap <b>Install app</b> or <b>Add to Home screen</b>', 'Confirm. The game now opens full screen from your home screen'];
}

function modal() {
  let el = document.getElementById('installModal');
  if (el) return el;
  const css = document.createElement('style');
  css.textContent = `
    #installModal { position: fixed; inset: 0; z-index: 4000; display: flex; align-items: center; justify-content: center; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: rgba(0,0,0,.65); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
    #installModal[hidden] { display: none; }
    #installModal .im-card { width: min(440px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; padding: 22px 22px 18px; border-radius: 18px; background: #1b1b22; color: #fff; font: 16px/1.45 system-ui, -apple-system, sans-serif; box-shadow: 0 20px 60px rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.12); position: relative; }
    #installModal h2 { margin: 0 0 4px; font-size: 22px; }
    #installModal p { margin: 0 0 12px; opacity: .75; font-size: 14px; }
    #installModal ol { margin: 0 0 16px; padding-left: 22px; } #installModal li { margin: 6px 0; }
    #installModal .im-row { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
    #installModal button { font: inherit; font-weight: 700; border: 0; border-radius: 12px; padding: 11px 18px; cursor: pointer; color: #fff; background: rgba(255,255,255,.14); }
    #installModal button.im-go { background: #2ea043; }
    #installModal .im-x { position: absolute; top: 8px; right: 10px; padding: 4px 10px; font-size: 22px; line-height: 1; background: transparent; opacity: .7; }`;
  document.head.appendChild(css);
  el = document.createElement('div'); el.id = 'installModal'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'imTitle');
  el.innerHTML = `<div class="im-card"><button class="im-x" id="imClose" aria-label="Close">×</button>
    <h2 id="imTitle">Install as an app</h2><p>Play full screen, straight from your home screen.</p>
    <ol id="imSteps"></ol>
    <div class="im-row"><button id="imLater">Not now</button><button class="im-go" id="imGo" hidden>Install now</button></div></div>`;
  document.body.appendChild(el);
  const close = () => { el.hidden = true; };
  el.addEventListener('click', e => { if (e.target === el || e.target.id === 'imClose' || e.target.id === 'imLater') close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) close(); });
  el.querySelector('#imGo').addEventListener('click', async () => {
    if (!deferred) return;
    const d = deferred; deferred = null;
    close();
    d.prompt();
    try { await d.userChoice; } catch (e) {}
    refresh();
  });
  return el;
}

function updateModal() {
  const el = document.getElementById('installModal'); if (!el) return;
  const go = el.querySelector('#imGo'), list = el.querySelector('#imSteps'), has = !!deferred;
  go.hidden = !has;
  list.hidden = has;
  if (!has) list.innerHTML = steps().map(s => `<li>${s}</li>`).join('');
}

if (btn) btn.addEventListener('click', () => { const el = modal(); updateModal(); el.hidden = false; });


/* ---------- Diagnostics: tap the top-left corner 5 times quickly to show / hide ---------- */
(function () {
  let taps = [], box = null, timer = 0;
  const px = v => Math.round(v * 10) / 10, rc = el => { if (!el) return 'none'; const r = el.getBoundingClientRect(); return `${px(r.left)},${px(r.top)} ${px(r.width)}x${px(r.height)}`; };
  function read() {
    const de = document.documentElement, vv = window.visualViewport, g = window.__fitGap ? window.__fitGap() : null;
    return ['build: all-out-1', 'standalone: ' + (navigator.standalone === true) + '  ios: ' + isIOS + '  manifest link: ' + !!document.querySelector('link[rel=manifest]'),
      'inner: ' + innerWidth + 'x' + innerHeight, 'screen: ' + screen.width + 'x' + screen.height, 'visualViewport: ' + (vv ? px(vv.width) + 'x' + px(vv.height) : 'n/a'),
      'html: ' + rc(de), 'body: ' + rc(document.body), 'canvas: ' + rc(document.getElementById('c')),
      'fix: ' + (g ? 'gap ' + g.gap + 'px, applied ' + g.applied : 'not needed / not iOS app')].join('\n');
  }
  function toggle() {
    if (box) { clearInterval(timer); box.remove(); box = null; return; }
    box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:8px;top:40px;z-index:99999;margin:0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.82);color:#7CFC9A;font:12px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre-wrap;max-width:92vw';
    document.body.appendChild(box); const u = () => { box.textContent = read(); }; u(); timer = setInterval(u, 500);
  }
  addEventListener('pointerdown', e => {
    if (e.clientX > 90 || e.clientY > 90) { taps = []; return; }
    const n = Date.now(); taps = taps.filter(t => n - t < 2000); taps.push(n);
    if (taps.length >= 5) { taps = []; toggle(); }
  }, true);
})();
