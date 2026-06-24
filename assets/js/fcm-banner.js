(async function SubHubFCM() {
  // ─── CONFIG ────────────────────────────────────────────────
  const API_BASE     = 'https://api.subhub.com.ng/api';
  const TOKEN_KEY    = 'sh_access_token';
  const VAPID_KEY    = 'BDTlAyCJ-SaTzRQ-nZPshiqnw7fEMUWHX95Sn7S_UQLheNuObThz0nhYpYtc4W0WR7Bf24MMjN1RpHmulCcNzHc';
  const SW_PATH      = '/firebase-messaging-sw.js';
  const FIREBASE_CFG = {
    apiKey:            'AIzaSyAgalwqdWByDjBNh0LwCJD4IGVyulxMVy4',
    authDomain:        'subhub-push.firebaseapp.com',
    projectId:         'subhub-push',
    storageBucket:     'subhub-push.firebasestorage.app',
    messagingSenderId: '649761428518',
    appId:             '1:649761428518:web:aef4dccff55a738103c2e7'
  };

  // ─── GUARDS ────────────────────────────────────────────────
  const userToken = localStorage.getItem(TOKEN_KEY);
  if (!userToken) return;                                          // Not logged in
  if (!('Notification' in window)) return;                        // Browser no support
  if (!('serviceWorker' in navigator)) return;

  const notifDisabled = localStorage.getItem('sh_notif_enabled') === 'false';
  if (notifDisabled) return;                                       // User manually disabled

  // If already granted, skip banner and just init silently
  if (Notification.permission === 'granted') {
    await initMessaging(userToken);
    return;
  }

  // If permanently denied by browser, nothing we can do
  if (Notification.permission === 'denied') return;

  // ─── SHOW BANNER ───────────────────────────────────────────
  showBanner(userToken);

})();


// ═══════════════════════════════════════════════════════════════
//  BANNER UI
// ═══════════════════════════════════════════════════════════════
function showBanner(userToken) {
  if (document.getElementById('sh-fcm-banner')) return; // Already shown

  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const styles = `
    #sh-fcm-banner {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      background: ${dark ? '#0f1923' : '#ffffff'};
      border-top: 2px solid #00aaff;
      box-shadow: 0 -4px 24px rgba(0,170,255,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: sh-slide-up 0.35s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes sh-slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    #sh-fcm-banner .sh-banner-icon {
      width: 38px; height: 38px; flex-shrink: 0;
      background: linear-gradient(135deg, #00aaff22, #00aaff44);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    #sh-fcm-banner .sh-banner-icon svg {
      width: 18px; height: 18px; fill: #00aaff;
    }
    #sh-fcm-banner .sh-banner-text {
      flex: 1;
    }
    #sh-fcm-banner .sh-banner-title {
      font-size: 13px;
      font-weight: 700;
      color: ${dark ? '#ffffff' : '#0d1117'};
      margin: 0 0 2px 0;
      letter-spacing: 0.1px;
    }
    #sh-fcm-banner .sh-banner-sub {
      font-size: 11.5px;
      color: ${dark ? '#8b9ab0' : '#6b7280'};
      margin: 0;
      line-height: 1.4;
    }
    #sh-fcm-banner .sh-banner-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    #sh-fcm-banner .sh-btn-allow {
      background: #00aaff;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      white-space: nowrap;
    }
    #sh-fcm-banner .sh-btn-allow:hover  { background: #0090dd; }
    #sh-fcm-banner .sh-btn-allow:active { transform: scale(0.97); }
    #sh-fcm-banner .sh-btn-later {
      background: transparent;
      color: ${dark ? '#8b9ab0' : '#6b7280'};
      border: 1px solid ${dark ? '#2a3a4a' : '#e5e7eb'};
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.2s;
      white-space: nowrap;
    }
    #sh-fcm-banner .sh-btn-later:hover { border-color: #00aaff; color: #00aaff; }

    @media (max-width: 420px) {
      #sh-fcm-banner { flex-wrap: wrap; }
      #sh-fcm-banner .sh-banner-actions { width: 100%; justify-content: flex-end; margin-top: 4px; }
    }
  `;

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // Build banner HTML
  const banner = document.createElement('div');
  banner.id = 'sh-fcm-banner';
  banner.innerHTML = `
    <div class="sh-banner-icon">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
    </div>
    <div class="sh-banner-text">
      <p class="sh-banner-title">Stay on top of every transaction</p>
      <p class="sh-banner-sub">Get instant alerts on data, airtime &amp; bill status. You can disable anytime.</p>
    </div>
    <div class="sh-banner-actions">
      <button class="sh-btn-later" id="sh-btn-later">Not now</button>
      <button class="sh-btn-allow" id="sh-btn-allow">Enable alerts</button>
    </div>
  `;

  document.body.appendChild(banner);

  // ── Button handlers ──────────────────────────────────────
  document.getElementById('sh-btn-allow').addEventListener('click', async () => {
    removeBanner();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('sh_notif_enabled', 'true');
      await initMessaging(userToken);
    }
  });

  document.getElementById('sh-btn-later').addEventListener('click', () => {
    removeBanner();
    // Don't save 'false' — just dismiss for this session, ask again next visit
  });
}

function removeBanner() {
  const b = document.getElementById('sh-fcm-banner');
  if (b) {
    b.style.animation = 'none';
    b.style.transform = 'translateY(100%)';
    b.style.opacity   = '0';
    b.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
    setTimeout(() => b.remove(), 260);
  }
}


// ═══════════════════════════════════════════════════════════════
//  FIREBASE MESSAGING INIT
// ═══════════════════════════════════════════════════════════════
async function initMessaging(userToken) {
  try {
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey:            'AIzaSyAgalwqdWByDjBNh0LwCJD4IGVyulxMVy4',
        authDomain:        'subhub-push.firebaseapp.com',
        projectId:         'subhub-push',
        storageBucket:     'subhub-push.firebasestorage.app',
        messagingSenderId: '649761428518',
        appId:             '1:649761428518:web:aef4dccff55a738103c2e7'
      });
    }

    const messaging = firebase.messaging();
    const swReg     = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const fcmToken  = await messaging.getToken({
      vapidKey: 'BDTlAyCJ-SaTzRQ-nZPshiqnw7fEMUWHX95Sn7S_UQLheNuObThz0nhYpYtc4W0WR7Bf24MMjN1RpHmulCcNzHc',
      serviceWorkerRegistration: swReg
    });

    if (!fcmToken) return;

    // Only send to backend if token changed
    const saved = localStorage.getItem('sh_fcm_token');
    if (saved !== fcmToken) {
      const res = await fetch('https://api.subhub.com.ng/api/notifications/register-token', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ fcmToken })
      });
      if (res.ok) localStorage.setItem('sh_fcm_token', fcmToken);
    }

    // Foreground notification (app is open)
    messaging.onMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title) showToast(title, body || '');
    });

  } catch (err) {
    console.error('[SubHub FCM]', err.message);
  }
}


// ═══════════════════════════════════════════════════════════════
//  IN-APP TOAST  (when app is open + foreground)
// ═══════════════════════════════════════════════════════════════
function showToast(title, body) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 16px; right: 16px; left: 16px;
    z-index: 999999;
    background: ${dark ? '#0f1923' : '#ffffff'};
    color: ${dark ? '#ffffff' : '#0d1117'};
    border-left: 4px solid #00aaff;
    border-radius: 10px;
    padding: 12px 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.25);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: sh-toast-in 0.3s cubic-bezier(0.16,1,0.3,1);
    max-width: 420px;
    margin: 0 auto;
  `;

  const styleId = 'sh-toast-style';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      @keyframes sh-toast-in {
        from { transform: translateY(-20px); opacity: 0; }
        to   { transform: translateY(0);     opacity: 1; }
      }
    `;
    document.head.appendChild(s);
  }

  toast.innerHTML = `
    <div style="font-size:13px;font-weight:700;margin-bottom:3px;">${title}</div>
    <div style="font-size:12px;opacity:0.75;">${body}</div>
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  }, 5000);
}


// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}


// ═══════════════════════════════════════════════════════════════
//  PUBLIC API  — expose so user settings page can call these
//  Usage:  SubHubNotif.disable()  /  SubHubNotif.enable()
// ═══════════════════════════════════════════════════════════════
window.SubHubNotif = {
  disable() {
    localStorage.setItem('sh_notif_enabled', 'false');
    // Tell backend to clear token
    const userToken = localStorage.getItem('sh_access_token');
    const fcmToken  = localStorage.getItem('sh_fcm_token');
    if (userToken && fcmToken) {
      fetch('https://api.subhub.com.ng/api/notifications/disable', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      }).catch(() => {});
    }
    localStorage.removeItem('sh_fcm_token');
    console.log('[SubHub] Push notifications disabled');
  },

  enable() {
    localStorage.setItem('sh_notif_enabled', 'true');
    const userToken = localStorage.getItem('sh_access_token');
    if (userToken) initMessaging(userToken);
  },

  isEnabled() {
    return localStorage.getItem('sh_notif_enabled') !== 'false'
        && Notification.permission === 'granted';
  }
};
