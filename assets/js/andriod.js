(function () {
  alert('SubHub FCM script LOADED');

  if (!window.AndroidPush) {
    alert('FAIL: No AndroidPush\n(Not in WebView app, or interface not added)');
    return;
  }
  alert('OK: AndroidPush exists');

  var keys = ['sh_access_token', 'token', 'accessToken', 'access_token'];
  var accessToken = null;
  var foundKey = null;
  for (var i = 0; i < keys.length; i++) {
    var v = localStorage.getItem(keys[i]);
    if (v) {
      accessToken = v;
      foundKey = keys[i];
      break;
    }
  }

  if (!accessToken) {
    alert('FAIL: Not logged in\nNo token in localStorage\nTried: ' + keys.join(', '));
    return;
  }
  alert('OK: Logged in\nKey: ' + foundKey);

  if (!window.AndroidPush.getFcmToken) {
    alert('FAIL: AndroidPush.getFcmToken missing');
    return;
  }

  var callbackId = 'fcm_' + Date.now();
  var done = false;

  window.__subhubFcmTokenCallback = function (id, token) {
    if (id !== callbackId || done) return;
    done = true;
    if (!token) {
      alert('FAIL: Bridge returned empty token');
      return;
    }
    alert('SUCCESS token:\n' + token.substring(0, 80) + '...');
    console.log('FCM', token);
  };

  try {
    window.AndroidPush.getFcmToken(callbackId);
    alert('Called getFcmToken — waiting...');
  } catch (e) {
    alert('FAIL bridge throw:\n' + e.message);
  }

  setTimeout(function () {
    if (!done) alert('FAIL: Timeout 15s — native did not callback');
  }, 15000);
})();
