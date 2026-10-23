/* ============================================================
   SubHub — push-install.js
   Sends this phone's Firebase (FCM) token to the backend BEFORE login,
   so phones that installed the app but have no account yet are known.
   After login, your dashboard's registerAndroidPush() links the same
   token to the user (POST /notifications/register) - that is unchanged.

   Needs config.js loaded first (it provides SubHub.API_BASE).
   Works only inside the Android app (window.AndroidPush exists there).
============================================================ */
(function () {
'use strict';
if (!window.AndroidPush) return;                        // normal browser: nothing to do

const SYNC_KEY = 'subhubInstallSync';
const EVERY_MS = 24 * 60 * 60 * 1000;                   // send at most once a day per token
const waiting = Object.create(null);                    // callbackId -> resolve

/* The phone answers through window.__subhubFcmTokenCallback.
   Our own requests are handled here; anything else goes to the old handler. */
const prevCallback = window.__subhubFcmTokenCallback;
window.__subhubFcmTokenCallback = function (id, token) {
  if (waiting[id]) { const done = waiting[id]; delete waiting[id]; done(token); }
  else if (typeof prevCallback === 'function') prevCallback(id, token);
};

function getToken() {
  return new Promise(resolve => {
    const id = 'install_' + Date.now();
    const timer = setTimeout(() => { delete waiting[id]; resolve(null); }, 10000);
    waiting[id] = t => { clearTimeout(timer); resolve(t || null); };
    try { window.AndroidPush.getFcmToken(id); }
    catch (e) { clearTimeout(timer); delete waiting[id]; resolve(null); }
  });
}

async function registerAppInstall() {
  const token = await getToken();
  if (!token) return;

  try {
    const last = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null');
    if (last && last.token === token && Date.now() - last.at < EVERY_MS) return;
  } catch (e) {}

  const base = window.SubHub && window.SubHub.API_BASE;
  if (!base) return;

  try {
    const res = await fetch(base + '/notifications/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: 'android' })
    });
    if (res.ok) localStorage.setItem(SYNC_KEY, JSON.stringify({ token, at: Date.now() }));   // remember only real success
  } catch (e) {}
}

/* Firebase rotated the token -> send the new one (and still call any older handler) */
const prevRefreshed = window.__subhubFcmTokenRefreshed;
window.__subhubFcmTokenRefreshed = function (t) {
  registerAppInstall();
  if (typeof prevRefreshed === 'function') prevRefreshed(t);
};

window.addEventListener('online', registerAppInstall);  // first try failed because of no internet? try again
registerAppInstall();
})();
