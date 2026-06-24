// FCM Push Notification Initialization
// Include this script in app/index.html after login confirmed

(async function initFCM() {
  // Only run if user is logged in
  const token = localStorage.getItem('token');
  if (!token) return;

  // Check browser support
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  try {
    // Load Firebase compat scripts dynamically
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

    // Init Firebase (safe to call multiple times)
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: "AIzaSyAgalwqdWByDjBNh0LwCJD4IGVyulxMVy4",
        authDomain: "subhub-push.firebaseapp.com",
        projectId: "subhub-push",
        storageBucket: "subhub-push.firebasestorage.app",
        messagingSenderId: "649761428518",
        appId: "1:649761428518:web:aef4dccff55a738103c2e7"
      });
    }

    const messaging = firebase.messaging();

    // Register service worker
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Get FCM token — replace YOUR_VAPID_KEY below
    const fcmToken = await messaging.getToken({
      vapidKey: 'BDTlAyCJ-SaTzRQ-nZPshiqnw7fEMUWHX95Sn7S_UQLheNuObThz0nhYpYtc4W0WR7Bf24MMjN1RpHmulCcNzHc',
      serviceWorkerRegistration: swReg
    });

    if (!fcmToken) return;

    // Save token to backend only if changed
    const savedToken = localStorage.getItem('fcmToken');
    if (savedToken === fcmToken) return;

    const res = await fetch('https://api.subhub.com.ng/api/notifications/register-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fcmToken })
    });

    if (res.ok) {
      localStorage.setItem('fcmToken', fcmToken);
    }

    // Foreground notification handler
    messaging.onMessage((payload) => {
      const { title, body } = payload.notification;
      showToastNotification(title, body);
    });

  } catch (err) {
    console.error('FCM init error:', err);
  }
})();

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// In-app toast when app is open
function showToastNotification(title, body) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; top:16px; right:16px; left:16px; z-index:9999;
    background:#1a1a2e; color:#fff; padding:12px 16px; border-radius:10px;
    box-shadow:0 4px 20px rgba(0,0,0,0.3); font-family:inherit;
    border-left: 4px solid #4CAF50;
  `;
  toast.innerHTML = `<strong>${title}</strong><br><small>${body}</small>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
