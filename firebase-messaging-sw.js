importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyAgalwqdWByDjBNh0LwCJD4IGVyulxMVy4',
  authDomain:        'subhub-push.firebaseapp.com',
  projectId:         'subhub-push',
  storageBucket:     'subhub-push.firebasestorage.app',
  messagingSenderId: '649761428518',
  appId:             '1:649761428518:web:aef4dccff55a738103c2e7'
});

const messaging = firebase.messaging();

// ── Background notification (app is closed or tab not active) ──
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'SubHub';
  const body  = payload.notification?.body  || '';
  const url   = payload.data?.url || '/app/index.html';

  self.registration.showNotification(title, {
    body,
    icon:  '/logo.png',
    badge: '/favicon/favicon-96x96.png',
    data:  { url }
  });
});

// ── Notification click — open app ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app/index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // If app already open, focus it
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});
