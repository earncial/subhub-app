/* ============================================================
   CONFIG
============================================================ */
const API_BASE     = 'https://api.subhub.com.ng/api';
const TOKEN_KEY    = 'sh_access_token';
const REFRESH_KEY  = 'sh_refresh_token';
const REMEMBER_KEY = 'subhub_login_creds';     // same key + format as before: {"identifier":"..."}
const BIO_OWNER_KEY    = 'sh_bio_owner';       // which account the fingerprint belongs to
const BIO_DECLINED_KEY = 'sh_bio_declined';    // user tapped "Not now" on the fingerprint offer
const BIO_SETUP_KEY    = 'sh_bio_setup';       // user tapped "Set up fingerprint" -> enable right after the next login
const HOME_URL     = '/app/index.html';

// ASSUMPTION: confirm these against your backend refresh route
const REFRESH_ENDPOINT = '/auth/refresh';      // POST { refreshToken } -> { success, accessToken, refreshToken? }

/* ============================================================
   UTILS
============================================================ */
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    return await res.json();
  } catch {
    return { success: false, message: 'Network error, please check your connection' };
  }
}

function showToast(title, msg, type = 'info', duration = 3500) {
  const icons = { success: 'fa-check', error: 'fa-xmark', info: 'fa-info', warn: 'fa-exclamation' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const ico = document.createElement('div'); ico.className = 'toast-ico';
  ico.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i>`;   // static markup only

  const body = document.createElement('div'); body.className = 'toast-body';
  const t = document.createElement('div'); t.className = 'toast-title'; t.textContent = title;
  body.appendChild(t);
  if (msg) { const m = document.createElement('div'); m.className = 'toast-msg'; m.textContent = msg; body.appendChild(m); }

  const close = document.createElement('button');
  close.type = 'button'; close.className = 'toast-close'; close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML = '<i class="fas fa-xmark"></i>';

  const bar = document.createElement('div'); bar.className = 'toast-bar';
  bar.style.animationDuration = duration + 'ms';

  el.append(ico, body, close, bar);
  const dismiss = () => {
    if (el.classList.contains('out')) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  };
  close.addEventListener('click', e => { e.stopPropagation(); dismiss(); });
  el.addEventListener('click', dismiss);
  $('toastContainer').appendChild(el);
  setTimeout(dismiss, duration);
}

/* ============================================================
   THEME
============================================================ */
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  $('iconMoon').hidden = dark;
  $('iconSun').hidden  = !dark;
}
const isDark = () => localStorage.getItem('sh_dark') === '1';

/* ============================================================
   SAVED ACCOUNT (Remember me)
============================================================ */
function readSaved() {
  try {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) return JSON.parse(saved).identifier || null;
  } catch {}
  return null;
}
function writeSaved(identifier) { localStorage.setItem(REMEMBER_KEY, JSON.stringify({ identifier })); }
function clearSaved() { localStorage.removeItem(REMEMBER_KEY); }

function mask(v) {
  if (!v) return '';
  if (v.includes('@')) { const [u, d] = v.split('@'); return u.slice(0, 2) + '***@' + d; }
  if (/^\+?\d{8,}$/.test(v)) return v.slice(0, 4) + '***' + v.slice(-3);
  return v;
}

/* ============================================================
   ANDROID BIOMETRIC BRIDGE (window.AndroidAuth, slot 'login')
   Safe in a normal browser: everything returns "not available".
============================================================ */
const pendingCreds = Object.create(null);
let credCounter = 0;

window.__subhubCredentialCallback = function (id, success, credential, reason) {
  const e = pendingCreds[id];
  if (!e) return;
  clearTimeout(e.timer);
  delete pendingCreds[id];
  e.resolve({ success: success === true || success === 'true', credential: credential || null, reason: reason || null });
};

function bioAvailable() {
  try { return !!(window.AndroidAuth && window.AndroidAuth.isBiometricAvailable && window.AndroidAuth.isBiometricAvailable()); }
  catch { return false; }
}
function hasBio() {
  try { return !!(window.AndroidAuth && window.AndroidAuth.hasBiometricCredential && window.AndroidAuth.hasBiometricCredential('login')); }
  catch { return false; }
}
function enableBio(secret) {
  try {
    return window.AndroidAuth.enableBiometricCredential('login', String(secret), 'Enable fingerprint login', 'Confirm to skip typing your password next time') || true;
  } catch { return false; }
}
function getBioCred() {
  return new Promise(resolve => {
    if (!window.AndroidAuth || !window.AndroidAuth.getBiometricCredential) { resolve({ success: false, reason: 'unavailable' }); return; }
    const id = 'login_' + Date.now() + '_' + (++credCounter);
    const timer = setTimeout(() => {
      if (pendingCreds[id]) { delete pendingCreds[id]; resolve({ success: false, reason: 'timeout' }); }
    }, 60000);
    pendingCreds[id] = { resolve, timer };
    try { window.AndroidAuth.getBiometricCredential('login', id, 'Log in to SubHub', 'Use your fingerprint to log in'); }
    catch { clearTimeout(timer); delete pendingCreds[id]; resolve({ success: false, reason: 'error' }); }
  });
}

/* ============================================================
   BOTTOM SHEET (yes/no question; window.confirm is unreliable in WebView)
============================================================ */
function choiceSheet({ title, message, choices, cancelValue }) {
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'sheet-ov';
    const box = document.createElement('div'); box.className = 'sheet';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h2'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = message;
    const acts = document.createElement('div'); acts.className = 'sheet-actions';
    const done = v => { ov.remove(); resolve(v); };
    choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ' + (c.primary ? 'btn-primary' : 'btn-ghost'); b.textContent = c.label;
      b.addEventListener('click', () => done(c.value));
      acts.appendChild(b);
      if (i === 0) setTimeout(() => b.focus(), 0);
    });
    ov.addEventListener('click', e => { if (e.target === ov) done(cancelValue); });
    box.appendChild(h); box.appendChild(p); box.appendChild(acts);
    ov.appendChild(box); document.body.appendChild(ov);
  });
}
function askSheet({ title, message, yesLabel, noLabel }) {
  return choiceSheet({
    title, message, cancelValue: false,
    choices: [{ label: yesLabel, value: true, primary: true }, { label: noLabel, value: false }],
  });
}

/* DEV ONLY: fake fingerprint on localhost / 127.0.0.1 so you can test the screens in Chrome.
   Real users never get this (hostname check). Add ?mockbio=0 to switch it off. */
if (!window.AndroidAuth
    && ['localhost', '127.0.0.1'].includes(location.hostname)
    && new URLSearchParams(location.search).get('mockbio') !== '0') {
  window.AndroidAuth = {
    isBiometricAvailable: () => true,
    hasBiometricCredential: slot => !!localStorage.getItem('dev_bio_' + slot),
    enableBiometricCredential: (slot, secret, title, sub) =>
      choiceSheet({
        title, message: (sub || '') + ' (mock)', cancelValue: false,
        choices: [{ label: 'Touch sensor', value: true, primary: true }, { label: 'Cancel', value: false }],
      }).then(ok => {
        if (ok) { localStorage.setItem('dev_bio_' + slot, secret); showToast('Fingerprint enabled', 'You can now log in with your fingerprint.', 'success', 2200); }
      }),
    getBiometricCredential: (slot, id, title, sub) =>
      choiceSheet({
        title, message: (sub || '') + ' (mock)', cancelValue: { success: false, reason: 'cancelled' },
        choices: [
          { label: 'Touch sensor (success)', value: { success: true }, primary: true },
          { label: 'Wrong finger (fail)', value: { success: false, reason: 'failed' } },
          { label: 'Cancel', value: { success: false, reason: 'cancelled' } },
        ],
      }).then(r => window.__subhubCredentialCallback(id, r.success, r.success ? localStorage.getItem('dev_bio_' + slot) : null, r.reason || null)),
  };
}

/* ============================================================
   LOADING (centre of page) + RESULT SHEET (success / error)
============================================================ */
const proc = {
  ov: $('procOverlay'), loader: $('procLoader'), loadTitle: $('procLoadTitle'), loadSub: $('procLoadSub'),
  box: $('procBox'), icon: $('procIcon'), title: $('procTitle'), sub: $('procSub'), btn: $('procBtn'),
};
function procShow(title, sub) {
  proc.box.classList.remove('shake');
  proc.box.hidden = true;
  proc.loadTitle.textContent = title;
  proc.loadSub.textContent = sub;
  proc.loader.hidden = false;
  proc.ov.hidden = false;
}
function procResult(state, icon, title, sub, showBtn) {
  proc.loader.hidden = true;
  proc.box.dataset.state = state;
  proc.icon.className = icon;
  proc.title.textContent = title;
  proc.sub.textContent = sub;
  proc.btn.hidden = !showBtn;
  proc.box.hidden = false;
  proc.ov.hidden = false;
}
// Success = just a toast (no modal), then go to the dashboard
function welcomeAndRedirect() {
  procHide();
  showToast('Login successful', 'Welcome back! Taking you to your dashboard\u2026', 'success', 1600);
  setTimeout(() => { window.location.href = HOME_URL; }, 1600);
}
function procError(msg) {
  procResult('error', 'fas fa-lock', 'Login failed', msg, true);
  errorFeedback(proc.box);
  proc.btn.focus();
}
function procHide() { proc.ov.hidden = true; }

/* ============================================================
   STATE + RENDER
   modes: 'first' (full form) | 'bio' (fingerprint) | 'pw' (saved account + password)
============================================================ */
const card = $('card');
const state = { mode: 'first', saved: null, editing: false };
let busy = false;

function zoomIn() {
  card.classList.remove('enter', 'shake'); void card.offsetWidth; card.classList.add('enter');
}

// Strong shake + phone vibration on every error.
// Vibration needs <uses-permission android:name="android.permission.VIBRATE"/> in the Android app.
const ERROR_VIBRATION = [90, 50, 90, 50, 200];
function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}
function errorFeedback(target) {
  target = target || card;
  target.classList.remove('enter', 'shake'); void target.offsetWidth; target.classList.add('shake');
  vibrate(ERROR_VIBRATION);
}
function shakeCard() { errorFeedback(card); }

function render(animate = true) {
  const m = state.mode;
  card.dataset.mode = m;
  card.querySelectorAll('[data-show]').forEach(el => {
    el.hidden = !el.dataset.show.split(' ').includes(m);
  });
  $('credentialGroup').hidden = !(m === 'first' || (m === 'pw' && state.editing));
  $('identity').hidden        = !(m === 'pw' && !state.editing);
  $('bioBtn').hidden          = !(bioAvailable() && (m === 'first' || m === 'pw'));
  $('bioBtnLabel').textContent = hasBio() ? 'Log in with fingerprint' : 'Set up fingerprint login';

  if (m === 'bio') {
    const owner = localStorage.getItem(BIO_OWNER_KEY) || state.saved;
    $('subtitle').textContent = owner ? mask(owner) : 'Log in with your fingerprint';
  } else if (m === 'pw') {
    $('subtitle').textContent = 'Enter your password to continue';
    $('identityText').textContent = state.saved || '';
    $('avatar').textContent = (state.saved || '?').charAt(0).toUpperCase();
  } else {
    $('subtitle').innerHTML = 'Don\u2019t have an account? <a href="/sign-up">Create one</a>';
  }
  if (animate) zoomIn();
}

function clearErrors() {
  ['credential', 'password'].forEach(f => {
    $(f).classList.remove('invalid'); $(f + 'Error').classList.remove('show');
  });
  $('formError').classList.remove('show');
}
function showFormError(msg) {
  const el = $('formError'); el.textContent = msg; el.classList.add('show');
}

function initLogin() {
  busy = false;
  state.saved = readSaved();
  state.editing = false;
  state.mode = hasBio() ? 'bio' : (state.saved ? 'pw' : 'first');
  $('credential').value = '';
  $('password').value = '';
  $('rememberMe').checked = false;
  $('fpHint').textContent = 'Touch the sensor to log in';
  clearErrors();
  setLoading($('loginBtn'), false);
  render();
  if (state.mode === 'bio') {
    setTimeout(() => { if (state.mode === 'bio') loginWithFingerprint(); }, 450);
  }
}

function goPassword() {
  state.mode = state.saved ? 'pw' : 'first';
  state.editing = false;
  render();
  setTimeout(() => ($('credentialGroup').hidden ? $('password') : $('credential')).focus(), 60);
}

/* ============================================================
   FINGERPRINT LOGIN
============================================================ */
async function refreshSession(refreshToken) {
  const data = await apiCall(REFRESH_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  if (data && data.success && data.accessToken) {
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  }
  return false;
}

async function loginWithFingerprint() {
  if (busy) return;
  busy = true;
  const btn = $('fpBtn');
  btn.classList.add('scanning');
  $('fpHint').textContent = 'Waiting for fingerprint\u2026';

  const r = await getBioCred();
  btn.classList.remove('scanning');

  if (!r.success || !r.credential) {
    busy = false;
    showToast(r.reason === 'cancelled' ? 'Fingerprint cancelled' : 'Fingerprint not recognised', 'Enter your password instead.', 'info');
    goPassword();
    if (r.reason !== 'cancelled') errorFeedback(card);
    return;
  }

  procShow('Logging you in...', 'Verifying your fingerprint.');
  const ok = await refreshSession(r.credential);

  if (ok) {
    welcomeAndRedirect();   // busy stays true so nothing can be tapped while redirecting
  } else {
    busy = false;
    procHide();
    showToast('Session expired', 'Please log in with your password.', 'error');
    goPassword();
    errorFeedback(card);
  }
}

function setupFingerprint() {
  localStorage.setItem(BIO_SETUP_KEY, '1');
  localStorage.removeItem(BIO_DECLINED_KEY);
  showToast('Set up fingerprint', 'Log in with your password once, then confirm your fingerprint.', 'info', 4500);
  const credEmpty = !$('credentialGroup').hidden && !$('credential').value.trim();
  (credEmpty ? $('credential') : $('password')).focus();
}

/* ============================================================
   PASSWORD LOGIN
============================================================ */
async function handleSignIn(e) {
  e.preventDefault();
  if (busy) return;
  clearErrors();

  const needsCredential = state.mode === 'first' || state.editing;
  const credential = needsCredential ? $('credential').value.trim() : state.saved;
  const password   = $('password').value;
  const remember   = $('rememberMe').checked;

  let bad = false;
  if (!credential) { $('credential').classList.add('invalid'); $('credentialError').classList.add('show'); bad = true; }
  if (!password)   { $('password').classList.add('invalid');   $('passwordError').classList.add('show');   bad = true; }
  if (bad) { shakeCard(); return; }

  busy = true;
  const btn = $('loginBtn');
  setLoading(btn, true);
  procShow('Logging you in...', 'Please wait while we verify your credentials.');

  const data = await apiCall('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ credential, password }),
  });

  setLoading(btn, false);

  if (!data || !data.success) {
    busy = false;
    const msg = data?.message || 'Invalid credentials. Please try again.';
    showFormError(msg);
    procError(msg);
    return;
  }

  // Save tokens
  localStorage.setItem(TOKEN_KEY,   data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);

  // Remember me: first visit follows the checkbox, returning users keep their saved account
  if (state.mode === 'first') {
    if (remember) writeSaved(credential); else clearSaved();
  } else {
    writeSaved(credential);
  }

  // Fingerprint: user tapped "Set up fingerprint" (enable right away) or we offer it once
  const wantsSetup = localStorage.getItem(BIO_SETUP_KEY) === '1';
  if (bioAvailable() && !hasBio() && data.refreshToken && (wantsSetup || localStorage.getItem(BIO_DECLINED_KEY) !== '1')) {
    procHide();
    let yes = wantsSetup;
    if (!wantsSetup) {
      yes = await askSheet({
        title: 'Turn on fingerprint login?',
        message: 'Next time, log in with your fingerprint instead of typing your password.',
        yesLabel: 'Turn on',
        noLabel: 'Not now',
      });
    }
    localStorage.removeItem(BIO_SETUP_KEY);
    if (yes) {
      localStorage.setItem(BIO_OWNER_KEY, credential);
      await enableBio(data.refreshToken);
    } else {
      localStorage.setItem(BIO_DECLINED_KEY, '1');
    }
  }

  welcomeAndRedirect();
}

/* ============================================================
   FORGOT PASSWORD
============================================================ */
function openForgot() {
  document.querySelector('#forgotModal .sheet').classList.remove('shake');
  $('fpErr').classList.remove('show');
  $('fpForm').hidden = false;
  $('fpSuccess').hidden = true;
  const guess = (state.editing || state.mode === 'first' ? $('credential').value.trim() : state.saved) || '';
  $('fpEmail').value = guess.includes('@') ? guess : '';
  $('forgotModal').hidden = false;
  setTimeout(() => $('fpEmail').focus(), 100);
}
function closeForgot() { $('forgotModal').hidden = true; }

async function handleForgotPassword() {
  $('fpErr').classList.remove('show');
  const email = $('fpEmail').value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $('fpErr').textContent = 'Enter a valid email address.';
    $('fpErr').classList.add('show');
    errorFeedback(document.querySelector('#forgotModal .sheet'));
    return;
  }

  const btn = $('fpSubmit');
  setLoading(btn, true);
  await apiCall('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  setLoading(btn, false);

  // Always show success (does not reveal whether the email exists)
  $('fpSentEmail').textContent = email;
  $('fpForm').hidden = true;
  $('fpSuccess').hidden = false;
}

/* ============================================================
   INIT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  applyTheme(isDark());
  $('themeToggle').addEventListener('click', () => {
    const nd = !isDark();
    localStorage.setItem('sh_dark', nd ? '1' : '0');
    applyTheme(nd);
  });

  // Processing overlay: "Try again" closes it and puts the user back on the password field
  $('procBtn').addEventListener('click', () => {
    procHide();
    ($('credentialGroup').hidden ? $('password') : $('credential')).focus();
  });
  $('procLogo').addEventListener('error', () => { $('procLogo').hidden = true; $('procFb').hidden = false; });

  // Logo fallback
  $('brandLogo').addEventListener('error', () => { $('brandLogo').hidden = true; $('brandMark').hidden = false; });

  // No automatic redirect: the user always logs in (fingerprint or password) to reach the dashboard.

  // Login
  $('loginForm').addEventListener('submit', handleSignIn);
  $('fpBtn').addEventListener('click', loginWithFingerprint);
  $('usePwBtn').addEventListener('click', goPassword);
  $('bioBtn').addEventListener('click', () => {
    if (hasBio()) { state.mode = 'bio'; state.editing = false; render(); loginWithFingerprint(); }
    else setupFingerprint();
  });
  $('changeIdBtn').addEventListener('click', () => {
    state.editing = true; render(false);
    $('credential').value = state.saved || '';
    $('credential').focus(); $('credential').select();
  });
  $('togglePwd').addEventListener('click', function () {
    const inp = $('password');
    const hidden = inp.type === 'password';
    inp.type = hidden ? 'text' : 'password';
    this.innerHTML = hidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    this.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
  });
  ['credential', 'password'].forEach(f => {
    $(f).addEventListener('input', () => {
      $(f).classList.remove('invalid'); $(f + 'Error').classList.remove('show'); $('formError').classList.remove('show');
    });
  });

  // Forgot password modal
  $('forgotBtn').addEventListener('click', openForgot);
  $('forgotClose').addEventListener('click', closeForgot);
  $('fpDone').addEventListener('click', closeForgot);
  $('forgotModal').addEventListener('click', e => { if (e.target === $('forgotModal')) closeForgot(); });
  $('fpSubmit').addEventListener('click', handleForgotPassword);
  $('fpEmail').addEventListener('keydown', e => { if (e.key === 'Enter') handleForgotPassword(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeForgot(); });

  initLogin();
});
