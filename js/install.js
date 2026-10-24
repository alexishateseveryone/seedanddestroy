// "Install app" button for phones and tablets (title screen).
// Android / Chrome: opens the real install prompt. iPhone / iPad (Safari) and other browsers: shows the 3 steps to add it to the home screen.
const btn = document.getElementById('install');
const mobileLike = () => document.body.classList.contains('mobile') || matchMedia('(hover:none)').matches || matchMedia('(pointer:coarse)').matches || matchMedia('(max-width:900px) and (max-height:520px)').matches;
const installed = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
let deferred = null;

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'))
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

function refresh() { if (btn) btn.hidden = !(mobileLike() && !installed()); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
addEventListener('appinstalled', () => { deferred = null; refresh(); });
addEventListener('resize', refresh);
addEventListener('orientationchange', () => setTimeout(refresh, 200));
new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
refresh();

function help() {
  let el = document.getElementById('installHelp');
  if (!el) {
    el = document.createElement('div'); el.id = 'installHelp'; el.className = 'menu'; el.hidden = true; el.style.zIndex = 3500;
    el.innerHTML = '<div class="card"><h2>Add to Home Screen</h2><ol id="installSteps"></ol><div class="row"><button class="btn green" id="installOk">Got it</button></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.id === 'installOk') el.hidden = true; });
  }
  const steps = isIOS
    ? (isSafari
      ? ['Tap the <b>Share</b> button (the square with an arrow) at the bottom of Safari', 'Scroll down and tap <b>Add to Home Screen</b>', 'Tap <b>Add</b>. The game now opens full screen from your home screen']
      : ['Open this page in <b>Safari</b> (other iPhone browsers cannot install apps)', 'Tap the <b>Share</b> button, then <b>Add to Home Screen</b>', 'Tap <b>Add</b>'])
    : ['Open your browser menu (the <b>⋮</b> or <b>≡</b> button)', 'Tap <b>Install app</b> or <b>Add to Home screen</b>', 'Confirm. The game now opens full screen from your home screen'];
  el.querySelector('#installSteps').innerHTML = steps.map(s => `<li>${s}</li>`).join('');
  el.hidden = false;
}

if (btn) btn.addEventListener('click', async () => {
  if (deferred) {
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) {}
    deferred = null; refresh();
  } else help();
});
