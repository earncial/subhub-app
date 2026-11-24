/* ============================================================
   SubHub push-install.js
   1. Before login: sends this phone's Firebase (FCM) token to the backend
      (POST /notifications/install) so phones without an account are known.
   2. After login: links the same token to the logged in account
      (POST /notifications/register) so push can reach this phone.
   3. On logout: window.SubHubPush.unlink() removes the link
      (DELETE /notifications/devices).

   Load it on EVERY page that can run inside the app (login, sign up and
   dashboard), after config.js (it provides SubHub.API_BASE).
   Works only inside the Android app (window.AndroidPush exists there).

   Public helpers:
     window.SubHubPush.link()    call right after a successful login
     window.SubHubPush.unlink()  call BEFORE clearing tokens on logout
============================================================ */
(function () {
'use strict';
if (!window.AndroidPush) return;                        // normal browser: nothing to do

const ACCESS_KEY = 'sh_access_token';
const REFRESH_KEY = 'sh_refresh_token';
const SYNC_KEY = 'subhubInstallSync';
const LINK_KEY = 'subhubPushLink';
const INSTALL_EVERY = 24 * 60 * 60 * 1000;              // install ping at most once a day per token
const LINK_EVERY = 6 * 60 * 60 * 1000;                  // account link refresh every 6 hours
const waiting = Object.create(null);                    // callbackId -> resolve

function apiBase() {
  return (window.SubHub && window.SubHub.API_BASE) || '';
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}

/* ---------- FCM token from the phone ---------- */

/* The phone answers through window.__subhubFcmTokenCallback.
   Our own requests are handled here; anything else goes to the old handler. */
const prevCallback = window.__subhubFcmTokenCallback;
window.__subhubFcmTokenCallback = function (id, token) {
  if (waiting[id]) { const done = waiting[id]; delete waiting[id]; done(token); }
  else if (typeof prevCallback === 'function') prevCallback(id, token);
};

function getToken() {
  return new Promise(resolve => {
    const id = 'install_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const timer = setTimeout(() => { delete waiting[id]; resolve(null); }, 10000);
    waiting[id] = t => { clearTimeout(timer); resolve(t || null); };
    try { window.AndroidPush.getFcmToken(id); }
    catch (e) { clearTimeout(timer); delete waiting[id]; resolve(null); }
  });
}

/* ---------- 1. Install ping (no login needed) ---------- */

async function registerAppInstall() {
  const token = await getToken();
  if (!token) return null;

  const base = apiBase();
  if (!base) return token;

  const last = readJson(SYNC_KEY);
  if (last && last.token === token && Date.now() - last.at < INSTALL_EVERY) return token;

  try {
    const res = await fetch(base + '/notifications/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: 'android' })
    });
    if (res.ok) localStorage.setItem(SYNC_KEY, JSON.stringify({ token, at: Date.now() }));   // remember only real success
  } catch (e) {}

  return token;
}

/* ---------- 2. Link the token to the logged in account ---------- */

function userIdFromJwt(jwt) {
  try {
    const p = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p)).id || null;
  } catch (e) { return null; }
}

/* Gets a fresh access token with the refresh token (the server does not rotate it). */
async function refreshAccessToken() {
  const base = apiBase();
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!base || !refresh) return null;
  try {
    const res = await fetch(base + '/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.accessToken) {
      localStorage.setItem(ACCESS_KEY, data.accessToken);
      return data.accessToken;
    }
  } catch (e) {}
  return null;
}

let linking = false;

async function linkPushToAccount(force, knownToken) {
  if (linking) return;
  const base = apiBase();
  if (!base || !localStorage.getItem(ACCESS_KEY)) return;     // not logged in
  linking = true;

  try {
    const token = knownToken || await getToken();
    if (!token) return;

    let access = localStorage.getItem(ACCESS_KEY);
    const uid = userIdFromJwt(access);

    const last = readJson(LINK_KEY);
    if (!force && last && last.token === token && last.uid === uid && Date.now() - last.at < LINK_EVERY) return;

    const send = (bearer) => fetch(base + '/notifications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bearer },
      body: JSON.stringify({ token, platform: 'android', label: 'Android app' })
    });

    let res = await send(access);

    // Access token expired: refresh once and try again
    if (res.status === 401) {
      const fresh = await refreshAccessToken();
      if (fresh) { access = fresh; res = await send(fresh); }
    }

    if (res.ok) {
      localStorage.setItem(LINK_KEY, JSON.stringify({ token, uid: userIdFromJwt(access), at: Date.now() }));
    }
  } catch (e) {
    /* offline or server error: the "online" event and the next page load try again */
  } finally {
    linking = false;
  }
}

/* ---------- 3. Unlink on logout ---------- */

async function unlinkPush() {
  const base = apiBase();
  const link = readJson(LINK_KEY);
  localStorage.removeItem(LINK_KEY);                    // always forget locally
  if (!base) return;

  const token = (link && link.token) || await getToken();
  const access = localStorage.getItem(ACCESS_KEY);
  if (!token || !access) return;

  try {
    await fetch(base + '/notifications/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access },
      body: JSON.stringify({ token })
    });
  } catch (e) {}
}

window.SubHubPush = {
  link: function () { return linkPushToAccount(true); },
  unlink: unlinkPush
};

/* ---------- Triggers ---------- */

/* Firebase rotated the token: send the new one (and still call any older handler) */
const prevRefreshed = window.__subhubFcmTokenRefreshed;
window.__subhubFcmTokenRefreshed = function (t) {
  localStorage.removeItem(SYNC_KEY);                    // new token must not be skipped by the daily limit
  registerAppInstall().then(tok => linkPushToAccount(true, tok));
  if (typeof prevRefreshed === 'function') prevRefreshed(t);
};

/* The first try failed because of no internet? Try again. */
window.addEventListener('online', function () {
  registerAppInstall().then(tok => linkPushToAccount(false, tok));
});

/* Page opened: ping the install, then link if the user is logged in */
registerAppInstall().then(tok => linkPushToAccount(false, tok));
})();
