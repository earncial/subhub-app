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

   LOG OUT FROM ALL DEVICES (Settings page):
     Your page shows its own "Are you sure?" and, only if the user agrees, calls:
         const r = await subhubLogoutAll();
         if (!r.ok) showError(r.message);   // on success it goes to the login page by itself
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
async function runLogoutAll() {
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


/* Public: call this ONLY after your own "Are you sure?" was accepted.
   Returns { ok:true } (and goes to the login page) or { ok:false, message } (user stays logged in).
   Pass { redirect:false } if you want to handle the redirect yourself. */
let allRunning = false;
async function subhubLogoutAll(options) {
  if (allRunning) return { ok: false, message: 'Please wait...' };
  allRunning = true;
  const r = await runLogoutAll();
  allRunning = false;
  if (r.ok && !(options && options.redirect === false)) location.replace(LOGIN_URL);
  return r;
}

window.subhubLogout = subhubLogout;
window.subhubLogoutAll = subhubLogoutAll;
if (typeof window.logout !== 'function') window.logout = subhubLogout;
})();