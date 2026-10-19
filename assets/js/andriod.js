/**
 * SubHub FCM — Android WebView only
 * Requires: window.AndroidPush.getFcmToken(callbackId)
 */
(async function SubHubAndroidFCM() {
  // ─── CONFIG ───────────────────────────────────────────────
  // Sandbox (test) — canza zuwa production idan ready:
  // const API_BASE = 'https://api.subhub.com.ng';
  const API_BASE  = 'https://subhub-sandbox.onrender.com';
  const TOKEN_KEY = 'sh_access_token'; // ko 'token' idan naka daban ne

  // ─── GUARDS ───────────────────────────────────────────────
  if (!window.AndroidPush || !window.AndroidPush.getFcmToken) {
    console.log('[SubHub FCM] Not inside Android app — skip');
    return;
  }

  const accessToken = localStorage.getItem(TOKEN_KEY);
  if (!accessToken) {
    console.log('[SubHub FCM] Not logged in — skip');
    return;
  }

  // ─── GET TOKEN FROM NATIVE ────────────────────────────────
  const fcmToken = await getFcmTokenFromAndroid();

  if (!fcmToken) {
    alert('SubHub FCM\n\nNo token received.\nCheck Firebase / AndroidPush bridge.');
    console.error('[SubHub FCM] getFcmToken returned null');
    return;
  }

  // Show token (debug — cire alert bayan test)
  alert(
    'SubHub FCM Token\n\n' +
      fcmToken.slice(0, 60) +
      '...\n\n(Length: ' +
      fcmToken.length +
      ')'
  );
  console.log('[SubHub FCM] token:', fcmToken);

  // ─── REGISTER ON BACKEND ──────────────────────────────────
  try {
    const res = await fetch(API_BASE + '/api/notifications/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({
        token: fcmToken,
        platform: 'android',
        label: 'SubHub Android',
      }),
    });

    const data = await res.json().catch(() => ({}));
    console.log('[SubHub FCM] register', res.status, data);

    if (!res.ok) {
      alert(
        'Register failed\n\n' +
          res.status +
          '\n' +
          (data.message || JSON.stringify(data))
      );
    }
  } catch (err) {
    console.error('[SubHub FCM] register error', err);
    alert('Register error\n\n' + (err.message || String(err)));
  }

  // Native may call this when Firebase refreshes token
  window.__subhubFcmTokenRefreshed = function () {
    SubHubAndroidFCM();
  };
})();

// ═══════════════════════════════════════════════════════════
function getFcmTokenFromAndroid() {
  return new Promise(function (resolve) {
    if (!window.AndroidPush || !window.AndroidPush.getFcmToken) {
      resolve(null);
      return;
    }

    var callbackId = 'fcm_' + Date.now();
    var done = false;

    window.__subhubFcmTokenCallback = function (id, token) {
      if (id !== callbackId || done) return;
      done = true;
      resolve(token || null);
    };

    try {
      window.AndroidPush.getFcmToken(callbackId);
    } catch (e) {
      console.error('[SubHub FCM] bridge error', e);
      resolve(null);
      return;
    }

    // timeout 15s
    setTimeout(function () {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, 15000);
  });
}
