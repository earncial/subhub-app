/* ============================================================
   CONFIG
============================================================ */
const API_BASE    = 'https://api.subhub.com.ng/api';
const TOKEN_KEY   = 'sh_access_token';
const REFRESH_KEY = 'sh_refresh_token';
const REMEMBER_KEY= 'sh_remember_cred';

/* ============================================================
   UTILS
============================================================ */
const $ = id => document.getElementById(id);

function showErr(id, txtId, msg) {
  const el = $(id), tx = $(txtId);
  if (tx) tx.textContent = msg;
  if (el) el.classList.add('show');
}
function clearErr(id) {
  const el = $(id);
  if (el) el.classList.remove('show');
}

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

function showToast(title, msg, type = 'info', duration = 4000) {
  const icons = {
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  };
  const id = 'toast_' + Date.now();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.id = id;
  el.innerHTML = `
    <div class="toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${icons[type]||icons.info}</svg></div>
    <div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>
    <button class="toast-close" onclick="dismissToast('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    <div class="toast-progress" style="animation-duration:${duration}ms"></div>
  `;
  el.addEventListener('click', e => { if (!e.target.closest('.toast-close')) dismissToast(id); });
  $('toastContainer').appendChild(el);
  el._t = setTimeout(() => dismissToast(id), duration);
}

function dismissToast(id) {
  const el = $(id); if (!el) return;
  clearTimeout(el._t);
  el.classList.add('hiding');
  setTimeout(() => el.remove(), 300);
}

/* ============================================================
   THEME
============================================================ */
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  $('iconMoon').style.display = dark ? 'none' : 'block';
  $('iconSun').style.display  = dark ? 'block' : 'none';
}
const isDark = () => localStorage.getItem('sh_dark') === '1';
applyTheme(isDark());
$('themeToggle').addEventListener('click', () => {
  const nd = !isDark();
  localStorage.setItem('sh_dark', nd ? '1' : '0');
  applyTheme(nd);
});

/* ============================================================
   INIT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Already logged in
  if (localStorage.getItem(TOKEN_KEY)) {
    window.location.href = '/app/index.html';
    return;
  }

  // Restore remembered credential
  try {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      const { credential } = JSON.parse(saved);
      if (credential) {
        $('credential').value = credential;
        $('rememberMe').checked = true;
      }
    }
  } catch {}

  // Password toggle
  $('togglePwd').addEventListener('click', () => {
    const inp = $('password');
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    $('eyeShow').style.display = isHidden ? 'none'  : 'block';
    $('eyeHide').style.display = isHidden ? 'block' : 'none';
  });

  // Sign In
  $('loginBtn').addEventListener('click', handleSignIn);
  $('password').addEventListener('keydown', e => { if (e.key === 'Enter') handleSignIn(); });
  $('credential').addEventListener('keydown', e => { if (e.key === 'Enter') $('password').focus(); });

  // Forgot password modal
  $('forgotBtn').addEventListener('click', () => {
    $('fpErr').textContent = '';
    $('fpSuccess').style.display = 'none';
    $('fpEmail').value = '';
    $('forgotModal').classList.add('show');
    setTimeout(() => $('fpEmail').focus(), 100);
  });
  $('forgotClose').addEventListener('click', () => $('forgotModal').classList.remove('show'));
  $('forgotModal').addEventListener('click', e => { if (e.target === $('forgotModal')) $('forgotModal').classList.remove('show'); });
  $('fpSubmit').addEventListener('click', handleForgotPassword);
  $('fpEmail').addEventListener('keydown', e => { if (e.key === 'Enter') handleForgotPassword(); });

  // ESC closes modal
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('forgotModal').classList.remove('show'); });
});

/* ============================================================
   SIGN IN
============================================================ */
async function handleSignIn() {
  clearErr('credErr');
  clearErr('pwdErr');

  const credential = $('credential').value.trim();
  const password   = $('password').value;
  const remember   = $('rememberMe').checked;

  if (!credential) { showErr('credErr', 'credErrTxt', 'Please enter your email, username or phone'); return; }
  if (!password)   { showErr('pwdErr',  'pwdErrTxt',  'Please enter your password'); return; }

  const btn = $('loginBtn');
  setLoading(btn, true);

  const data = await apiCall('/auth/signin', {
    method: 'POST',
    body:   JSON.stringify({ credential, password }),
  });

  setLoading(btn, false);

  if (!data || !data.success) {
    // Shake the card
    const card = document.querySelector('.card');
    card.style.animation = 'none';
    requestAnimationFrame(() => { card.style.animation = 'shake .4s ease'; });
    showErr('credErr', 'credErrTxt', data?.message || 'Sign in failed, please try again');
    return;
  }

  // Save tokens
  localStorage.setItem(TOKEN_KEY,   data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);

  // Remember Me
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ credential }));
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }

  showToast('Welcome back!', 'Redirecting to dashboard…', 'success', 2000);
  setTimeout(() => { window.location.href = '/app/index.html'; }, 900);
}

/* ============================================================
   FORGOT PASSWORD
============================================================ */
async function handleForgotPassword() {
  $('fpErr').textContent = '';
  $('fpSuccess').style.display = 'none';

  const email = $('fpEmail').value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $('fpErr').textContent = 'Please enter a valid email address';
    return;
  }

  const btn = $('fpSubmit');
  setLoading(btn, true);

  await apiCall('/auth/forgot-password', {
    method: 'POST',
    body:   JSON.stringify({ email }),
  });

  setLoading(btn, false);

  // Always show success
  $('fpErr').textContent = '';
  $('fpSuccess').style.display = 'flex';
  $('fpEmail').value = '';
}