/* ============================================================
   SubHub — register.js
   Real backend connection (replaces demo/fake code)
============================================================ */

const API_BASE = 'https://api.subhub.com.ng/api';

document.addEventListener('DOMContentLoaded', () => {

/* ============================================================
   THEME TOGGLE
============================================================ */
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
const iconMoon = document.getElementById('iconMoon');
const iconSun = document.getElementById('iconSun');

let isDark = false;
const saved = localStorage.getItem('subhub_theme');
if (saved === 'dark') {
  isDark = true;
  html.setAttribute('data-theme', 'dark');
  iconMoon.style.display = 'none';
  iconSun.style.display = 'block';
}

themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  html.setAttribute('data-theme', isDark ? 'dark' : 'light');
  iconMoon.style.display = isDark ? 'none' : 'block';
  iconSun.style.display = isDark ? 'block' : 'none';
  localStorage.setItem('subhub_theme', isDark ? 'dark' : 'light');
});

/* ============================================================
   TOAST ICONS (SVG)
============================================================ */
const TOAST_ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  warn:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>`
};

/* ============================================================
   TOAST SYSTEM
============================================================ */
const toastContainer = document.getElementById('toastContainer');

function showToast(type, title, message, duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${TOAST_ICONS[type]}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close notification">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="toast-progress" style="animation-duration:${duration}ms"></div>
  `;
  toastContainer.appendChild(toast);

  const close = () => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.toast-close').addEventListener('click', close);
  toast.addEventListener('click', (e) => { if (!e.target.closest('.toast-close')) close(); });
  setTimeout(close, duration);
}

/* ============================================================
   API HELPER
============================================================ */
async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    return await res.json();
  } catch {
    return { success: false, message: 'Network error — check your connection.' };
  }
}

/* ============================================================
   REF — Auto-fill referral from URL ?ref=username
============================================================ */
const refParam = new URLSearchParams(window.location.search).get('ref');
const refInput = document.getElementById('referral');
if (refParam && refInput) {
  refInput.value    = refParam.toLowerCase().trim();
  refInput.readOnly = true;
  refInput.classList.add('valid');
  // Add a small badge to show it's pre-filled
  const wrap = refInput.closest('.input-wrap') || refInput.parentElement;
  if (wrap && !wrap.querySelector('.ref-badge')) {
    const badge = document.createElement('span');
    badge.className = 'ref-badge';
    badge.style.cssText = 'position:absolute;right:10px;background:rgba(0,192,122,0.12);color:#00c07a;font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:20px;pointer-events:none;font-family:inherit';
    badge.textContent = 'Invited';
    wrap.style.position = 'relative';
    wrap.appendChild(badge);
  }
}

/* ============================================================
   USERNAME AVAILABILITY — Real backend check
============================================================ */
const usernameInput  = document.getElementById('username');
const usernameStatus = document.getElementById('usernameStatus');
const usernameErr    = document.getElementById('username-err');

let usernameTimer;
let usernameAvailable = false;

usernameInput.addEventListener('input', () => {
  const val = usernameInput.value.trim().toLowerCase();
  clearTimeout(usernameTimer);
  usernameAvailable = false;

  if (!val) {
    usernameStatus.className = 'username-status';
    usernameStatus.innerHTML = '';
    usernameInput.classList.remove('valid', 'invalid');
    return;
  }

  if (val.length < 3) {
    usernameStatus.className = 'username-status taken';
    usernameStatus.innerHTML = '<span class="dot"></span>Too short';
    usernameInput.classList.add('invalid');
    usernameInput.classList.remove('valid');
    return;
  }

  if (!/^[a-z0-9_]+$/.test(val)) {
    usernameStatus.className = 'username-status taken';
    usernameStatus.innerHTML = '<span class="dot"></span>Invalid chars';
    usernameInput.classList.add('invalid');
    usernameInput.classList.remove('valid');
    return;
  }

  usernameStatus.className = 'username-status checking';
  usernameStatus.innerHTML = '<span class="dot"></span>Checking...';
  usernameInput.classList.remove('valid', 'invalid');

  usernameTimer = setTimeout(async () => {
    const data = await apiCall(`/auth/check-username/${val}`);

    if (data && data.available) {
      usernameStatus.className = 'username-status available';
      usernameStatus.innerHTML = '<span class="dot"></span>Available';
      usernameInput.classList.add('valid');
      usernameInput.classList.remove('invalid');
      usernameErr.classList.remove('show');
      usernameAvailable = true;
    } else {
      usernameStatus.className = 'username-status taken';
      usernameStatus.innerHTML = '<span class="dot"></span>Taken';
      usernameInput.classList.add('invalid');
      usernameInput.classList.remove('valid');
      usernameErr.classList.add('show');
      showToast('warn', 'Username Taken', `"${val}" is already in use. Try another one.`, 3000);
      usernameAvailable = false;
    }
  }, 600);
});

/* ============================================================
   PASSWORD TOGGLE
============================================================ */
function setupToggle(btnId, inputId) {
  document.getElementById(btnId).addEventListener('click', () => {
    const inp = document.getElementById(inputId);
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
}
setupToggle('togglePwd', 'password');
setupToggle('toggleConfirm', 'confirmPassword');

/* ============================================================
   PASSWORD STRENGTH
============================================================ */
const passwordInput = document.getElementById('password');
const segs          = ['s1','s2','s3','s4'].map(id => document.getElementById(id));
const strengthLabel = document.getElementById('strengthLabel');

const STRENGTH_CONFIG = [
  { label: '',       colors: ['','','',''] },
  { label: 'Weak',   colors: ['#e8334a','','',''] },
  { label: 'Fair',   colors: ['#f59e0b','#f59e0b','',''] },
  { label: 'Good',   colors: ['#00aaff','#00aaff','#00aaff',''] },
  { label: 'Strong', colors: ['#00c07a','#00c07a','#00c07a','#00c07a'] },
];
const STRENGTH_COLORS_LABEL = ['','#e8334a','#f59e0b','#00aaff','#00c07a'];

function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

passwordInput.addEventListener('input', () => {
  const val = passwordInput.value;
  if (!val) {
    segs.forEach(s => s.style.background = '');
    strengthLabel.textContent = '';
    return;
  }
  const score = getStrength(val);
  const cfg   = STRENGTH_CONFIG[score];
  segs.forEach((s, i) => s.style.background = cfg.colors[i] || 'var(--border)');
  strengthLabel.textContent = cfg.label;
  strengthLabel.style.color = STRENGTH_COLORS_LABEL[score];
});

/* ============================================================
   VALIDATION HELPERS
============================================================ */
function showError(id, msg) {
  const el  = document.getElementById(id + '-err');
  const inp = document.getElementById(id);
  if (!el || !inp) return;
  el.classList.add('show');
  inp.classList.add('invalid');
  inp.classList.remove('valid');
}

function clearError(id) {
  const el  = document.getElementById(id + '-err');
  const inp = document.getElementById(id);
  if (el)  el.classList.remove('show');
  if (inp) inp.classList.remove('invalid');
}

function markValid(id) {
  clearError(id);
  const inp = document.getElementById(id);
  if (inp) inp.classList.add('valid');
}

/* ============================================================
   RESET FORM
============================================================ */
function resetForm() {
  document.getElementById('signupForm').reset();
  ['fullname','username','email','phone','password','confirm','referral'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('valid','invalid');
  });
  usernameStatus.className  = 'username-status';
  usernameStatus.innerHTML  = '';
  segs.forEach(s => s.style.background = '');
  strengthLabel.textContent = '';
  usernameAvailable         = false;
}

/* ============================================================
   FORM SUBMIT 
============================================================ */
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullname = document.getElementById('fullname').value.trim();
  const username = document.getElementById('username').value.trim().toLowerCase();
  const email    = document.getElementById('email').value.trim().toLowerCase();
  const phone    = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const confirm  = document.getElementById('confirmPassword').value;
  const referral = document.getElementById('referral').value.trim().toLowerCase();
  const terms    = document.getElementById('terms').checked;

  let valid = true;

  if (!fullname || fullname.length < 2) {
    showError('fullname', 'Enter your full name'); valid = false;
  } else markValid('fullname');

  if (!username || username.length < 3) {
    showError('username', 'Username must be at least 3 characters'); valid = false;
  } else if (!usernameAvailable) {
    showError('username', 'Username is taken or not checked yet'); valid = false;
  } else markValid('username');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('email', 'Enter a valid email address'); valid = false;
  } else markValid('email');

  const phoneClean = phone.replace(/\s+/g, '');
  if (!phoneClean || !/^(\+234|0)[789][01]\d{8}$/.test(phoneClean)) {
    showError('phone', 'Enter a valid Nigerian number (e.g. 08123456789)'); valid = false;
  } else markValid('phone');

  if (!password || password.length < 8) {
    showError('password', 'Password must be at least 8 characters'); valid = false;
  } else if (getStrength(password) < 2) {
    showError('password', 'Password too weak — add numbers or symbols'); valid = false;
  } else markValid('password');

  if (!confirm || confirm !== password) {
    showError('confirm', 'Passwords do not match'); valid = false;
  } else markValid('confirm');

  if (!terms) {
    showToast('warn', 'Terms Required', 'Please accept our Terms of Service to continue.', 3500);
    valid = false;
  }

  if (!valid) {
    showToast('error', 'Form Incomplete', 'Please fix the highlighted errors before submitting.', 4000);
    return;
  }

  // Loading
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.classList.add('loading');
  showToast('info', 'Creating Account…', 'Please wait while we set up your SubHub account.', 5000);

  // Build body
  const body = { fullName: fullname, username, email, phone: phoneClean, password };
  if (referral) body.referredBy = referral;

  // Real API call
  const data = await apiCall('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  btn.classList.remove('loading');
  btn.disabled = false;

  if (!data || !data.success) {
    showToast('error', 'Registration Failed', data?.message || 'Something went wrong. Please try again.', 5000);
    return;
  }

  // Success
  showToast('success', 'Account Created!', `Welcome to SubHub, ${fullname.split(' ')[0]}! Check your email to verify your account.`, 6000);
  resetForm();

  setTimeout(() => { window.location.href = '/login.html'; }, 2000);
});

/* ============================================================
   RIPPLE EFFECT
============================================================ */
document.getElementById('submitBtn').addEventListener('click', function (e) {
  const rect   = this.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
  this.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

/* ============================================================
   INLINE VALIDATION (on blur)
============================================================ */
['fullname', 'email', 'phone', 'confirmPassword'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('blur', () => {
    const v = el.value.trim();
    if (!v) return;
    if      (id === 'fullname'        && v.length < 2)                                             showError('fullname', 'Enter your full name');
    else if (id === 'email'           && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))                   showError('email', 'Invalid email format');
    else if (id === 'phone'           && !/^(\+234|0)[789][01]\d{8}$/.test(v.replace(/\s+/g,''))) showError('phone', 'Invalid Nigerian number');
    else if (id === 'confirmPassword' && v !== document.getElementById('password').value)           showError('confirm', 'Passwords do not match');
    else clearError(id === 'confirmPassword' ? 'confirm' : id);
  });
});

}); // end DOMContentLoaded