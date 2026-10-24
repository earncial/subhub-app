/* ============================================================
   SubHub — login.js
   Login screen: fingerprint, password, forgot password.
   Needs config.js loaded first. Signup lives in sign-up.js, PIN in pin.js.
============================================================ */
(function () {
'use strict';
const { $, K, store, ico, setIcon, setLoading, errorFeedback, showToast, apiCall,
        loaderShow, procHide, errorSheet, proc, app, state, REFRESH_ENDPOINT, HOME_URL, getDeviceId } = window.SubHub;

/* ============================================================
   FINGERPRINT BRIDGE (window.AndroidAuth, slot 'login')
   Shown only when the phone has a fingerprint AND it belongs to the account on screen.
============================================================ */
const pendingCreds = Object.create(null);
let credCounter = 0;
window.__subhubCredentialCallback = function (id, success, credential, reason) {
  const e = pendingCreds[id]; if (!e) return;
  clearTimeout(e.timer); delete pendingCreds[id];
  e.resolve({ success: success === true || success === 'true', credential: credential || null, reason: reason || null });
};
function bioAvailable(){ try { return !!(window.AndroidAuth && window.AndroidAuth.isBiometricAvailable && window.AndroidAuth.isBiometricAvailable()); } catch(e){ return false; } }
function hasBio(){ try { return !!(window.AndroidAuth && window.AndroidAuth.hasBiometricCredential && window.AndroidAuth.hasBiometricCredential('login')); } catch(e){ return false; } }
/* 'ready' = fingerprint already saved for this account.
   'enroll' = phone has fingerprint and it will be saved at the next touch (same touch also logs in). */
function bioMode(){
  const s = state.saved;
  if (!s || !bioAvailable()) return null;
  if (hasBio() && store.get(K.bioOwner) === s.username) return 'ready';
  if (store.get(K.bioDeclined) !== s.username && store.get(K.refresh)) return 'enroll';
  return null;
}
function bioReady(){ return bioMode() === 'ready'; }
function disableBio(){ try { window.AndroidAuth.disableBiometricCredential('login'); } catch(e){} store.del(K.bioOwner); }

function enableBio(secret){
  return new Promise(resolve => {
    let r;
    try { r = window.AndroidAuth.enableBiometricCredential('login', String(secret), 'Turn on fingerprint login', 'Confirm to log in faster next time'); }
    catch(e){ resolve(false); return; }
    if (r && typeof r.then === 'function') { r.then(v => resolve(!!v), () => resolve(false)); return; }
    const start = Date.now();                       // real app: wait until the phone has stored it
    (function check(){ if (hasBio()) return resolve(true); if (Date.now() - start > 20000) return resolve(false); setTimeout(check, 300); })();
  });
}
function getBioCred(){
  return new Promise(resolve => {
    if (!window.AndroidAuth || !window.AndroidAuth.getBiometricCredential) { resolve({ success:false, reason:'unavailable' }); return; }
    const id = 'login_' + Date.now() + '_' + (++credCounter);
    const timer = setTimeout(() => { if (pendingCreds[id]) { delete pendingCreds[id]; resolve({ success:false, reason:'timeout' }); } }, 60000);
    pendingCreds[id] = { resolve, timer };
    try { window.AndroidAuth.getBiometricCredential('login', id, 'Log in to SubHub', 'Use your fingerprint to log in'); }
    catch(e){ clearTimeout(timer); delete pendingCreds[id]; resolve({ success:false, reason:'error' }); }
  });
}

/* ============================================================
   LOGIN
============================================================ */
const card = $('card');

/* ---- back button: remembers which section the user came from ---- */
const navStack = [];
function backAvailable(){
  if (state.mode === 'pin') return !!(window.SubHubPin && window.SubHubPin.canBack());
  if (state.mode === 'pw' && state.editing) return true;
  return navStack.length > 0;
}
function updateBack(){
  const on = backAvailable();
  $('backBtn').hidden = !on;
  card.classList.toggle('has-back', on);
}
function go(mode){                                   // open a section and remember the one we left
  if (state.mode !== mode) navStack.push(state.mode);
  state.mode = mode; state.editing = false; render();
}
function goBack(){
  if (state.mode === 'pin') { if (window.SubHubPin && window.SubHubPin.back()) updateBack(); return true; }
  if (state.mode === 'pw' && state.editing) { state.editing = false; render(); return true; }
  const prev = navStack.pop();
  if (!prev) return false;
  state.mode = prev; state.editing = false; render();
  return true;
}

function readSaved(){
  try { const j = JSON.parse(store.get(K.remember)); if (j && j.identifier) return { username:j.identifier, fullName:j.fullName || '', avatar:j.avatar || '' }; } catch(e){}
  return null;
}
function writeSaved(username, fullName, avatar){
  const old = readSaved();                                   // keep the old photo if the server sent none
  if (avatar === undefined && old && old.username === username) avatar = old.avatar;
  store.set(K.remember, JSON.stringify({ identifier:username, fullName:fullName || '', avatar:avatar || '' }));
}
/* Profile photo: the API may call it avatar / profilePicture / profileImage / photo */
function userPhoto(u){ return (u && (u.avatar || u.profilePicture || u.profileImage || u.photo)) || undefined; }
/* Avatar order: user's photo -> /avatar.png (SubHub default) -> initials (only if avatar.png is missing too) */
const DEFAULT_AVATAR = '/avatar.png';
function setAvatar(el, s){
  el.textContent = initials(displayName(s));
  const id = (el._av = (el._av || 0) + 1);                  // ignore late loads from an older render
  const sources = [s.avatar, DEFAULT_AVATAR].filter(Boolean);
  (function next(i){
    if (i >= sources.length) return;
    const img = new Image();
    img.alt = '';
    img.onload = () => { if (el._av === id) { el.textContent = ''; el.appendChild(img); } };
    img.onerror = () => next(i + 1);
    img.src = sources[i];
  })(0);
}
function initials(n){ const w = String(n || '?').trim().split(/\s+/); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase(); }
function displayName(s){ return s.fullName || s.username; }

function zoomIn(){ card.classList.remove('enter','shake'); void card.offsetWidth; card.classList.add('enter'); }

function render(animate){
  const m = state.mode, s = state.saved;
  card.dataset.mode = m;
  card.querySelectorAll('[data-show]').forEach(el => { el.hidden = !el.dataset.show.split(' ').includes(m); });
  $('credentialGroup').hidden = !(m === 'first' || (m === 'pw' && state.editing));
  $('identity').hidden = !(m === 'pw' && !state.editing);

  /* fingerprint button on the password screen: only if the phone has it */
  let label = null;
  if (m === 'pw' && !state.editing && s && bioAvailable()) {
    if (bioMode()) label = 'Log in with fingerprint';
    else if (store.get(K.bioDeclined) === s.username) label = 'Turn on fingerprint login';
  }
  $('bioBtn').hidden = !label;
  if (label) $('bioBtnLabel').textContent = label;

  if (m === 'bio' && s) {
    setAvatar($('whoAvatar'), s);
    $('whoName').textContent = displayName(s);
    $('whoUser').textContent = s.fullName ? '@' + s.username : '';
  } else if (m === 'pw' && s) {
    $('title').textContent = 'Welcome back';
    $('subtitle').textContent = 'Enter your password to continue';
    setAvatar($('avatar'), s);
    $('identityName').textContent = displayName(s);
    $('identityHandle').textContent = s.fullName ? '@' + s.username : '';
  } else if (m === 'pin') {
    $('title').textContent = 'Create your PIN';
    $('subtitle').textContent = 'This 4-digit PIN confirms every purchase on SubHub.';
  } else if (m === 'signup') {
    $('title').textContent = 'Create your account';
    $('subtitle').innerHTML = 'Already have an account? <button type="button" class="link" data-go="login">Log in</button>';
  } else {
    $('title').textContent = 'Welcome back';
    $('subtitle').textContent = 'Log in to your SubHub account';
  }
  updateBack();
  if (animate !== false) zoomIn();
}

function clearErrors(){
  ['credential','password'].forEach(f => { $(f).classList.remove('invalid'); $(f + 'Error').classList.remove('show'); });
  $('formError').classList.remove('show');
}
function showFormError(msg){ const e = $('formError'); e.textContent = msg; e.classList.add('show'); }

function initLogin(opts){
  const auto = !(opts && opts.auto === false);
  app.busy = false; navStack.length = 0;
  state.saved = readSaved(); state.editing = false;
  state.mode = bioMode() ? 'bio' : (state.saved ? 'pw' : 'first');
  $('credential').value = ''; $('password').value = ''; $('rememberMe').checked = false;
  $('fpHint').textContent = 'Touch the sensor to log in';
  clearErrors(); setLoading($('loginBtn'), false);
  render();
  if (state.mode === 'bio' && auto) setTimeout(() => { if (state.mode === 'bio' && !app.busy) loginWithFingerprint(); }, 450);
}
function goPassword(){
  go(state.saved ? 'pw' : 'first');
  setTimeout(() => ($('credentialGroup').hidden ? $('password') : $('credential')).focus(), 60);
}
function goSection(name){
  if (name === 'signup') { go('signup'); setTimeout(() => $('suName').focus(), 80); }
  else if (!goBack()) { state.mode = state.saved ? 'pw' : 'first'; state.editing = false; render(); }
}

/* ---- fingerprint login ---- */
async function loginWithFingerprint(){
  if (app.busy) return; app.busy = true;
  const btn = $('fpBtn'); btn.classList.add('scanning');
  $('fpHint').textContent = 'Waiting for fingerprint\u2026';

  const kind = bioMode();
  let r;
  if (kind === 'enroll') {
    /* first time on this phone: save the fingerprint AND log in with this one touch */
    const owner = state.saved.username;
    const token = store.get(K.refresh);
    if (hasBio()) disableBio();                       // it belonged to another account
    const ok = await enableBio(token);
    if (ok) { store.set(K.bioOwner, owner); r = { success:true, credential:token }; }
    else { store.set(K.bioDeclined, owner); r = { success:false, reason:'cancelled' }; }
  } else {
    r = await getBioCred();
  }
  btn.classList.remove('scanning');

  if (!r.success || !r.credential) {
    app.busy = false;
    if (r.reason === 'cancelled') showToast('Fingerprint cancelled', 'Enter your password instead.', 'info');
    else if (r.reason === 'unavailable') showToast('Fingerprint not available', 'Enter your password instead.', 'info');
    else showToast('Fingerprint not recognised', 'Enter your password instead.', 'error');
    goPassword();
    return;
  }

  loaderShow('Logging you in...', 'Verifying your fingerprint.');
  const data = await apiCall(REFRESH_ENDPOINT, { method:'POST', body:JSON.stringify({ refreshToken:r.credential }) });

  if (data && data.success && data.accessToken) {
    store.set(K.access, data.accessToken);
    if (data.refreshToken) store.set(K.refresh, data.refreshToken);
    if (data.user) { writeSaved(data.user.username, data.user.fullName, userPhoto(data.user)); state.saved = readSaved(); }
    finishLogin(data);                                         // app.busy stays true while redirecting
    return;
  }

  app.busy = false; procHide();
  if (data && data.network) {                         // no internet: keep the fingerprint, let them retry
    $('fpHint').textContent = 'No connection. Tap the sensor to try again.';
    showToast('No connection', 'Check your internet and try again.', 'error');
    return;
  }
  if (data && (data.status === 401 || data.status === 403)) {   // server really rejected it
    disableBio();
    showToast('Fingerprint expired', 'Log in with your password to turn it on again.', 'error');
    store.del(K.refresh);
    initLogin({ auto:false });
    return;
  }
  showToast('Could not log in', (data && data.message) || 'Please try again.', 'error');
  goPassword();
}

/* ---- password login ---- */
async function handleSignIn(e){
  e.preventDefault();
  if (app.busy) return;
  clearErrors();

  const needsCred = state.mode === 'first' || state.editing;
  const credential = needsCred ? $('credential').value.trim() : state.saved.username;
  const password = $('password').value;
  const remember = $('rememberMe').checked;

  let bad = false;
  if (!credential) { $('credential').classList.add('invalid'); $('credentialError').classList.add('show'); bad = true; }
  if (!password)   { $('password').classList.add('invalid');   $('passwordError').classList.add('show');   bad = true; }
  if (bad) { errorFeedback(card); return; }

  app.busy = true;
  const btn = $('loginBtn'); setLoading(btn, true);            // button disabled + spinner, no overlay

  let data;
  try {
    data = await apiCall('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ credential, password, deviceId: getDeviceId() })
    });
  } catch (err) {
    console.error('SignIn error:', err);
    data = { success: false, message: err.message };
  }

  if (!data || !data.success) {
    app.busy = false; setLoading(btn, false);
    const msg = (data && data.message) || 'Invalid credentials. Please try again.';
    showFormError(msg); errorSheet('Login failed', msg);
    return;
  }

  store.set(K.access, data.accessToken);
  store.set(K.refresh, data.refreshToken);
  const user = data.user || {};
  const username = String(user.username || credential).toLowerCase();
  const fullName = user.fullName || '';

  /* No fingerprint question here. Fingerprint is set up at the next app open (one touch). */
  if (state.mode !== 'first' || remember || bioAvailable()) writeSaved(username, fullName, userPhoto(user)); else store.del(K.remember);

  finishLogin(data);
}

/* ---- after login ---- */
/* Runs after BOTH password login and fingerprint login.
   No extra request: the PIN flag (transactionPinSet) comes inside the login response.
   Slow things (warming up the dashboard page) run in the background. */
function prefetchHome(){
  try { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = HOME_URL; document.head.appendChild(l); } catch(e){}
}
function finishLogin(data){
  prefetchHome();
  const u = (data && data.user) || {};
  const flag = u.transactionPinSet !== undefined ? u.transactionPinSet : (data ? data.transactionPinSet : undefined);
  if (flag === false && window.SubHubPin) {          // only a real `false` opens the PIN screen
    procHide();
    showToast('Login successful', 'One more step: create your transaction PIN.', 'success', 2200);
    window.SubHubPin.show();
    return;
  }
  goHome();
}

function goHome(){
  procHide();
  showToast('Login successful', 'Welcome back! Taking you to your dashboard\u2026', 'success', 1400);
  setTimeout(() => { window.location.href = HOME_URL; }, 1400);
}

/* ============================================================
   FORGOT PASSWORD
============================================================ */
function openForgot(){
  document.querySelector('#forgotModal .sheet').classList.remove('shake');
  $('fpErr').classList.remove('show'); $('fpForm').hidden = false; $('fpSuccess').hidden = true;
  const guess = (state.mode === 'first' || state.editing ? $('credential').value.trim() : (state.saved ? state.saved.username : '')) || '';
  $('fpEmail').value = guess.includes('@') ? guess : '';
  $('forgotModal').hidden = false; setTimeout(() => $('fpEmail').focus(), 100);
}
function closeForgot(){ $('forgotModal').hidden = true; }
async function handleForgot(){
  $('fpErr').classList.remove('show');
  const email = $('fpEmail').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $('fpErr').textContent = 'Enter a valid email address.'; $('fpErr').classList.add('show');
    errorFeedback(document.querySelector('#forgotModal .sheet')); return;
  }
  const b = $('fpSubmit'); setLoading(b, true);
  await apiCall('/auth/forgot-password', { method:'POST', body:JSON.stringify({ email }) });
  setLoading(b, false);
  $('fpSentEmail').textContent = email; $('fpForm').hidden = true; $('fpSuccess').hidden = false;
}

/* ============================================================
   INIT
============================================================ */
function applyTheme(dark){
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  $('iconMoon').hidden = dark; $('iconSun').hidden = !dark;
}
const isDark = () => store.get(K.dark) === '1';


applyTheme(isDark());
$('themeToggle').addEventListener('click', () => { const nd = !isDark(); store.set(K.dark, nd ? '1' : '0'); applyTheme(nd); });

$('brandLogo').addEventListener('error', () => { $('brandLogo').hidden = true; $('brandMark').hidden = false; });
$('procLogo').addEventListener('error', () => { $('procLogo').hidden = true; $('procFb').hidden = false; });

proc.btn.addEventListener('click', () => { procHide(); if (state.mode === 'pin') return; (state.mode === 'signup' ? $('suName') : ($('credentialGroup').hidden ? $('password') : $('credential'))).focus(); });

card.addEventListener('click', e => { const t = e.target.closest('[data-go]'); if (t) goSection(t.dataset.go); });
$('loginForm').addEventListener('submit', handleSignIn);
$('fpBtn').addEventListener('click', loginWithFingerprint);
$('usePwBtn').addEventListener('click', goPassword);
$('switchAccBtn').addEventListener('click', () => { go('first'); $('credential').value = ''; setTimeout(() => $('credential').focus(), 60); });
$('bioBtn').addEventListener('click', () => {
  store.del(K.bioDeclined);
  if (bioMode()) { go('bio'); loginWithFingerprint(); }
  else showToast('Log in first', 'Log in with your password once, then open the app again.', 'info', 4500);
});
$('changeIdBtn').addEventListener('click', () => {
  state.editing = true; render(false);
  $('credential').value = state.saved ? state.saved.username : ''; $('credential').focus(); $('credential').select();
});
document.querySelectorAll('[data-eye]').forEach(btn => btn.addEventListener('click', () => {
  const inp = $(btn.dataset.eye), hide = inp.type === 'password';
  inp.type = hide ? 'text' : 'password';
  setIcon(btn.querySelector('svg'), hide ? 'eyeoff' : 'eye');
  btn.setAttribute('aria-label', hide ? 'Hide password' : 'Show password');
}));
['credential','password'].forEach(f => $(f).addEventListener('input', () => {
  $(f).classList.remove('invalid'); $(f + 'Error').classList.remove('show'); $('formError').classList.remove('show');
}));

$('forgotBtn').addEventListener('click', openForgot);
$('forgotClose').addEventListener('click', closeForgot);
$('fpDone').addEventListener('click', closeForgot);
$('forgotModal').addEventListener('click', e => { if (e.target === $('forgotModal')) closeForgot(); });
$('fpSubmit').addEventListener('click', handleForgot);
$('fpEmail').addEventListener('keydown', e => { if (e.key === 'Enter') handleForgot(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeForgot(); } });

/* sign-up.js uses this after a successful signup */
function showLoginWith(username){
  navStack.length = 0;
  state.mode = 'first'; state.editing = false; render();
  $('credential').value = username; $('password').value = '';
  setTimeout(() => $('password').focus(), 80);
}
window.SubHubLogin = { showLoginWith, render, goHome, updateBack, resetNav(){ navStack.length = 0; } };
$('backBtn').addEventListener('click', goBack);
/* Android: in onBackPressed call  webView.evaluateJavascript("window.SubHubBack()", ...)  -> "true" means the page handled it */
window.SubHubBack = () => backAvailable() ? goBack() : false;

initLogin();

/* Open the signup section directly: /#signup (from the welcome page) or ?ref=username (referral links) */
(function openSignupFromLink(){
  const q = new URLSearchParams(location.search);
  if (q.get('ref') || q.get('mode') === 'signup' || location.hash === '#signup') goSection('signup');
})();

})();
