// Install-as-app support: (1) fixes the iPad / iPhone "empty strip at the bottom" when the game runs as an installed app,
// (2) the "Install app" button on the title screen, which now always opens a modal.
const btn = document.getElementById('install');
const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
const mobileLike = () => document.body.classList.contains('mobile') || matchMedia('(hover:none)').matches || matchMedia('(pointer:coarse)').matches || matchMedia('(max-width:900px) and (max-height:520px)').matches;
const installed = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
let deferred = null;

/* ---------- 1. Fit the screen when installed ----------
   In an installed iOS/iPadOS app, innerHeight (and 100vh) is often shorter than the real screen, so the canvas is sized too small
   and the game sits at the top with an empty band underneath. A fixed, inset:0 element always covers the real visible area,
   so we measure that and report it as innerWidth / innerHeight (the game sizes its renderer from those). */
if (installed()) {
  // let the page use the whole screen (also under the notch / home bar)
  const vp = document.querySelector('meta[name=viewport]');
  if (vp && !/viewport-fit/.test(vp.content)) vp.content += ', viewport-fit=cover';
  else if (!vp) { const m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'; document.head.appendChild(m); }

  const st = document.createElement('style');
  st.textContent = `
    html, body { position: fixed; inset: 0; width: 100%; height: 100%; margin: 0; overflow: hidden; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    #__fit { position: fixed; inset: 0; width: 100%; height: 100%; visibility: hidden; pointer-events: none; z-index: -1; }
    canvas#c { position: fixed; left: 0; top: 0; }`;
  document.head.appendChild(st);
  const probe = document.createElement('div'); probe.id = '__fit'; document.body.appendChild(probe);

  const native = n => { const d = Object.getOwnPropertyDescriptor(window, n); return d ? (d.get ? d.get.call(window) : d.value) : 0; };
  const measure = n => {
    const r = probe.getBoundingClientRect();
    return Math.round(Math.max(native(n), n === 'innerHeight' ? r.height : r.width, (n === 'innerHeight' ? document.documentElement.clientHeight : document.documentElement.clientWidth) || 0));
  };
  try {
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => measure('innerHeight') });
    Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => measure('innerWidth') });
  } catch (e) {}

  // tell the game to re-measure whenever the real area changes (rotation, first paint, status bar, etc.)
  let t = 0;
  const nudge = () => { cancelAnimationFrame(t); t = requestAnimationFrame(() => dispatchEvent(new Event('resize'))); };
  if ('ResizeObserver' in window) new ResizeObserver(nudge).observe(probe);
  addEventListener('orientationchange', () => { setTimeout(nudge, 100); setTimeout(nudge, 400); });
  addEventListener('pageshow', nudge);
  if (window.visualViewport) visualViewport.addEventListener('resize', nudge);
  [0, 150, 500, 1200].forEach(ms => setTimeout(nudge, ms));
}

/* ---------- 2. Service worker ---------- */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'))
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

/* ---------- 3. Install button + modal ---------- */
function refresh() { if (btn) btn.hidden = !(mobileLike() && !installed()); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); updateModal(); });
addEventListener('appinstalled', () => { deferred = null; refresh(); const m = document.getElementById('installModal'); if (m) m.hidden = true; });
addEventListener('resize', refresh);
addEventListener('orientationchange', () => setTimeout(refresh, 200));
new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
refresh();

function steps() {
  if (isIOS) {
    const share = isIPad ? 'the <b>Share</b> button (square with an arrow) at the top of Safari' : 'the <b>Share</b> button (square with an arrow) at the bottom of Safari';
    return isSafari
      ? [`Tap ${share}`, 'Scroll down and tap <b>Add to Home Screen</b>', 'Tap <b>Add</b>. The game now opens full screen from your home screen']
      : ['Open this page in <b>Safari</b> (other iPhone / iPad browsers cannot install apps)', `Tap ${share}, then <b>Add to Home Screen</b>`, 'Tap <b>Add</b>'];
  }
  return ['Open your browser menu (the <b>⋮</b> or <b>≡</b> button)', 'Tap <b>Install app</b> or <b>Add to Home screen</b>', 'Confirm. The game now opens full screen from your home screen'];
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
    <h2 id="imTitle">Install as an app</h2><p>Play full screen, straight from your home screen, and start it even when offline.</p>
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
  go.hidden = !has;                                   // browsers that allow it: one-tap install
  list.hidden = has;                                  // otherwise: show how to add it by hand
  if (!has) list.innerHTML = steps().map(s => `<li>${s}</li>`).join('');
}

if (btn) btn.addEventListener('click', () => { const el = modal(); updateModal(); el.hidden = false; });
