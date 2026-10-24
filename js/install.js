// "Install app" button + modal for phones and tablets (title screen).
// No layout code in here on purpose: this file never touches sizes, the canvas, html or body.
const btn = document.getElementById('install');
const ua = navigator.userAgent;
const isAndroid = /Android/i.test(ua);   // the install feature is Android-only: iPhone / iPad / desktop never get the button, the modal or the service worker
const mobileLike = () => document.body.classList.contains('mobile') || matchMedia('(hover:none)').matches || matchMedia('(pointer:coarse)').matches || matchMedia('(max-width:900px) and (max-height:520px)').matches;
const installed = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
let deferred = null;

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
