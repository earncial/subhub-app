/* ============================================================
   SubHub — logout.js      ONE logout for EVERY page

   Add to any page:      <script src="/assets/js/logout.js" defer></script>
   Call from a button:   <button onclick="subhubLogout()">Log out</button>
   (window.logout is also pointed here if your page does not define its own.)

   What it does, in this order:
     1. Unlinks this phone's push token from the user   (DELETE /notifications/devices)
     2. Revokes the session on the server               (POST /auth/logout)
        ...but NOT on a phone that can use fingerprint, because the saved
        refresh token is what fingerprint login uses next time.
     3. Clears the access token (and the refresh token when it was revoked)
     4. Goes to the login page
   Both requests run together and the page waits at most MAX_WAIT_MS,
   so logout always feels instant even on a slow network.

   LOG OUT FROM ALL DEVICES (e.g. a button in Settings):
     <button onclick="subhubLogoutAll()">Log out from all devices</button>
     subhubLogoutAll()     asks "Are you sure?" first; only if the user agrees it runs
     subhubLogoutAllNow()  the real work, no question asked
============================================================ */
(function () {
'use strict';

/* ---- settings (change here only) ---- */
const LOGIN_URL   = '/';          // index.html = login page
const MAX_WAIT_MS = 1500;         // never keep the user waiting longer than this
const FALLBACK_API = 'https://subhub-sandbox.onrender.com/api';
const ACCESS_KEYS  = ['sh_access_token', 'accessToken'];     // first one that has a value is used
const REFRESH_KEYS = ['sh_refresh_token', 'refreshToken'];

/* API address: login page (SubHub.API_BASE), other pages (API), or the fallback above */
function apiBase() {
  if (window.SubHub && window.SubHub.API_BASE) return window.SubHub.API_BASE;
  if (window.SUBHUB_API) return window.SUBHUB_API;
  try { if (typeof API !== 'undefined' && API) return API; } catch (e) {}
  return FALLBACK_API;
}

const read  = keys => { for (const k of keys) { const v = localStorage.getItem(k); if (v) return v; } return null; };
const wipe  = keys => keys.forEach(k => localStorage.removeItem(k));

/* Does this phone have a fingerprint, and has the user NOT refused it? */
function keepTokenForFingerprint() {
  try {
    if (!(window.AndroidAuth && window.AndroidAuth.isBiometricAvailable && window.AndroidAuth.isBiometricAvailable())) return false;
  } catch (e) { return false; }
  try {
    const saved = JSON.parse(localStorage.getItem('subhub_login_creds') || 'null');
    const declined = localStorage.getItem('sh_bio_declined');
    if (saved && declined && declined === saved.identifier) return false;   // this user cancelled fingerprint
  } catch (e) {}
  return true;
}

/* Ask the phone for its push token (restores any other handler afterwards) */
function getPushToken() {
  return new Promise(resolve => {
    if (!window.AndroidPush) return resolve(null);
    const id = 'logout_' + Date.now();
    const prev = window.__subhubFcmTokenCallback;
    let timer;
    const done = t => { clearTimeout(timer); window.__subhubFcmTokenCallback = prev; resolve(t || null); };
    timer = setTimeout(() => done(null), 1200);
    window.__subhubFcmTokenCallback = function (cbId, token) {
      if (cbId === id) done(token);
      else if (typeof prev === 'function') prev(cbId, token);
    };
    try { window.AndroidPush.getFcmToken(id); } catch (e) { done(null); }
  });
}

/* keepalive lets the request finish even while the page is already leaving */
function call(method, path, accessToken, body) {
  return fetch(apiBase() + path, {
    method,
    keepalive: true,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
    body: JSON.stringify(body)
  }).catch(() => {});
}

async function unlinkPush(accessToken) {
  const token = await getPushToken();
  if (!token) return;
  await call('DELETE', '/notifications/devices', accessToken, { token });
}

let running = false;
async function subhubLogout() {
  if (running) return;
  running = true;

  const access  = read(ACCESS_KEYS);
  const refresh = read(REFRESH_KEYS);
  const keep    = keepTokenForFingerprint();
  const jobs    = [];

  if (access) {
    jobs.push(unlinkPush(access));
    /* Only send the server logout WITH a refresh token. Without one, the backend would
       clear every session of this user on every device. */
    if (!keep && refresh) jobs.push(call('POST', '/auth/logout', access, { refreshToken: refresh }));
  }

  await Promise.race([
    Promise.all(jobs.map(p => p.catch(() => {}))),
    new Promise(r => setTimeout(r, MAX_WAIT_MS))
  ]);

  wipe(ACCESS_KEYS);
  if (!keep) wipe(REFRESH_KEYS);                 // kept on fingerprint phones so fingerprint can log in next time
  try { sessionStorage.clear(); } catch (e) {}
  location.replace(LOGIN_URL);
}


/* ============================================================
   LOG OUT FROM ALL DEVICES
============================================================ */
/* request with a time limit, always returns { ok, status, data, network } */
async function request(method, path, accessToken, body, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms || 8000);
  try {
    const res = await fetch(apiBase() + path, {
      method,
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = {}; try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: {}, network: true };
  } finally { clearTimeout(timer); }
}

/* The real work. Returns { ok:true } or { ok:false, message }.
   Nothing is cleared on this phone unless the server confirmed it. */
async function subhubLogoutAllNow() {
  const access = read(ACCESS_KEYS);
  if (!access) return { ok: true };                              // not logged in: nothing to revoke

  /* 1) revoke every session. No refreshToken in the body = ALL sessions of this user */
  const r = await request('POST', '/auth/logout', access, {}, 10000);
  if (!r.ok) {
    return { ok: false, message:
      r.network ? 'No connection. Check your internet and try again.' :
      r.status === 401 ? 'Your session has expired. Log in again, then try once more.' :
      ((r.data && r.data.message) || 'Something went wrong. Please try again.') };
  }

  /* 2) stop push notifications on every device (best effort, never blocks the logout) */
  try {
    const list = await request('GET', '/notifications/devices', access, undefined, 3000);
    const devices = (list.data && list.data.devices) || [];
    await Promise.all(devices.map(d => d && d.token
      ? request('DELETE', '/notifications/devices', access, { token: d.token }, 3000) : null));
  } catch (e) {}

  /* 3) this phone: the saved fingerprint token is dead now, remove it and clear everything */
  try { if (window.AndroidAuth && window.AndroidAuth.disableBiometricCredential) window.AndroidAuth.disableBiometricCredential('login'); } catch (e) {}
  localStorage.removeItem('sh_bio_owner');
  wipe(ACCESS_KEYS); wipe(REFRESH_KEYS);
  try { sessionStorage.clear(); } catch (e) {}
  return { ok: true };
}

/* ---- the "Are you sure?" sheet (styles are added by this file, so it looks right on any page) ---- */
const SHEET_CSS = `
.shlo-ov{--s:var(--surface,#fff);--t:var(--text,#0d1a2e);--m:var(--sub,#4d6480);--b:var(--border,rgba(0,100,200,.14));--g:var(--surface2,#f7faff);
  position:fixed;inset:0;z-index:99999;background:rgba(8,20,40,.55);display:flex;align-items:flex-end;justify-content:center;font-family:'Sora',system-ui,sans-serif}
[data-theme="dark"] .shlo-ov{--s:var(--surface,#111820);--t:var(--text,#eef2ff);--m:var(--sub,#8fa0bf);--b:var(--border,rgba(255,255,255,.09));--g:var(--surface2,#161e2a)}
.shlo-sheet{width:100%;max-width:460px;background:var(--s);color:var(--t);border-radius:34px 34px 0 0;padding:14px 24px calc(24px + env(safe-area-inset-bottom));text-align:center;animation:shloUp .2s cubic-bezier(.2,.9,.3,1.1)}
@keyframes shloUp{from{transform:translateY(50px);opacity:.4}to{transform:none;opacity:1}}
.shlo-handle{display:block;width:44px;height:5px;border-radius:3px;background:var(--m);opacity:.35;margin:0 auto 20px}
.shlo-icon{width:64px;height:64px;margin:0 auto 14px;border-radius:50%;background:rgba(232,51,74,.12);color:#e8334a;display:grid;place-items:center}
.shlo-icon.ok{background:rgba(0,192,122,.14);color:#00c07a}
.shlo-icon svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.shlo-sheet h2{font-size:1.2rem;font-weight:800;letter-spacing:-.3px;margin-bottom:8px}
.shlo-sheet p{font-size:.9rem;line-height:1.55;color:var(--m);margin-bottom:18px}
.shlo-err{margin:-6px 0 14px;padding:10px 12px;border-radius:10px;background:rgba(232,51,74,.08);color:#e8334a;font-size:.82rem;font-weight:600;line-height:1.4}
.shlo-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;border-radius:999px;border:0;font:700 .95rem 'Sora',system-ui,sans-serif;cursor:pointer;margin-top:10px}
.shlo-btn:disabled{opacity:.65;cursor:not-allowed}
.shlo-danger{background:linear-gradient(135deg,#ef4458,#c2182f);color:#fff;box-shadow:0 6px 20px rgba(232,51,74,.32)}
.shlo-ghost{background:var(--g);color:var(--t);border:1.5px solid var(--b)}
.shlo-spin{display:none;width:20px;height:20px;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:shloSpin .6s linear infinite}
.shlo-btn.loading .shlo-spin{display:block}.shlo-btn.loading .shlo-lbl{display:none}
@keyframes shloSpin{to{transform:rotate(360deg)}}
.shlo-ov.done .shlo-btn{display:none}
`;
const ICON_OUT = '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
const ICON_OK  = '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7"/></svg>';

function subhubLogoutAll() {
  if (document.getElementById('shlo-ov')) return;                // already open
  if (!document.getElementById('shlo-style')) {
    const st = document.createElement('style'); st.id = 'shlo-style'; st.textContent = SHEET_CSS; document.head.appendChild(st);
  }
  const ov = document.createElement('div');
  ov.className = 'shlo-ov'; ov.id = 'shlo-ov';
  ov.innerHTML =
    '<div class="shlo-sheet" role="dialog" aria-modal="true" aria-labelledby="shlo-t">' +
      '<span class="shlo-handle"></span>' +
      '<div class="shlo-icon" id="shlo-i">' + ICON_OUT + '</div>' +
      '<h2 id="shlo-t">Log out from all devices?</h2>' +
      '<p id="shlo-m">You will be signed out on every phone and browser where you are logged in, including this one. You will need your password to log in again.</p>' +
      '<div class="shlo-err" id="shlo-e" role="alert" hidden></div>' +
      '<button type="button" class="shlo-btn shlo-danger" id="shlo-yes"><span class="shlo-spin"></span><span class="shlo-lbl">Log out everywhere</span></button>' +
      '<button type="button" class="shlo-btn shlo-ghost" id="shlo-no">Cancel</button>' +
    '</div>';
  document.body.appendChild(ov);

  const $ = id => document.getElementById(id);
  const yes = $('shlo-yes'), no = $('shlo-no'), err = $('shlo-e');
  let working = false;
  const close = () => { if (working) return; ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  no.addEventListener('click', close);

  yes.addEventListener('click', async () => {
    if (working) return;
    working = true; err.hidden = true;
    yes.disabled = true; no.disabled = true; yes.classList.add('loading');

    const r = await subhubLogoutAllNow();                        // <- only runs after the user agreed

    if (!r.ok) {                                                 // nothing was cleared, user stays logged in
      working = false; yes.disabled = false; no.disabled = false; yes.classList.remove('loading');
      err.textContent = r.message; err.hidden = false;
      try { if (navigator.vibrate) navigator.vibrate([90, 50, 90, 50, 200]); } catch (e) {}
      return;
    }
    $('shlo-i').className = 'shlo-icon ok'; $('shlo-i').innerHTML = ICON_OK;
    $('shlo-t').textContent = 'Logged out everywhere';
    $('shlo-m').textContent = 'Taking you to login...';
    ov.classList.add('done');
    setTimeout(() => location.replace(LOGIN_URL), 900);
  });
  setTimeout(() => no.focus(), 60);                              // Cancel is focused first: safer
}

window.subhubLogout = subhubLogout;
window.subhubLogoutAll = subhubLogoutAll;
window.subhubLogoutAllNow = subhubLogoutAllNow;
if (typeof window.logout !== 'function') window.logout = subhubLogout;
})();
