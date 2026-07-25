/* ============================================================
   SubHub — sign-up.js
   · New HTML structure · All features version 2.0.0
============================================================ */

const API_BASE = 'https://api.subhub.com.ng/api';

document.addEventListener('DOMContentLoaded', () => {

/* ============================================================
   DOM REFS
============================================================ */
const form         = document.getElementById('signupForm');
const fullnameInp  = document.getElementById('fullname');
const usernameInp  = document.getElementById('username');
const emailInp     = document.getElementById('email');
const phoneInp     = document.getElementById('phone');
const passwordInp  = document.getElementById('password');
const confirmInp   = document.getElementById('confirmPassword');
const referredInp  = document.getElementById('referredBy');
const referredGrp  = document.getElementById('referredGroup');
const agreeTerms   = document.getElementById('agreeTerms');
const submitBtn    = document.getElementById('submitBtn');
const submitIcon   = document.getElementById('submitIcon');
const usernameStatus = document.getElementById('usernameStatus');

// Processing overlay
const overlay       = document.getElementById('procOverlay');
const procLogoWrap  = document.getElementById('procLogoWrap');
const procStatusIcon= document.getElementById('procStatusIcon');
const procTitle     = document.getElementById('procTitle');
const procSub       = document.getElementById('procSub');
const procDots      = document.getElementById('procDots');
const procBtnDone   = document.getElementById('procBtnDone');

// Sidebar
const hamburger      = document.getElementById('hamburgerBtn');
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarClose   = document.getElementById('sidebarClose');

// Toast
const toastContainer = document.getElementById('toastContainer');

// Password strength
const pwSeg1         = document.getElementById('pwSeg1');
const pwSeg2         = document.getElementById('pwSeg2');
const pwSeg3         = document.getElementById('pwSeg3');
const pwSeg4         = document.getElementById('pwSeg4');
const pwStrengthLabel= document.getElementById('pwStrengthLabel');

// Error elements
const nameError     = document.getElementById('nameError');
const usernameError = document.getElementById('usernameError');
const emailError    = document.getElementById('emailError');
const phoneError    = document.getElementById('phoneError');
const passwordError = document.getElementById('passwordError');
const confirmError  = document.getElementById('confirmError');
const termsError    = document.getElementById('termsError');

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
   TOAST SYSTEM
============================================================ */
function showToast(title, message, type = 'blue', duration = 4000) {
  const iconMap = {
    green: 'fa-circle-check',
    red:   'fa-circle-xmark',
    blue:  'fa-circle-info',
    warn:  'fa-triangle-exclamation'
  };
  const icon = iconMap[type] || 'fa-circle-info';

  // Ensure toastContainer is always fixed-positioned (guard against CSS issues)
  toastContainer.style.position = 'fixed';
  toastContainer.style.zIndex   = '99999';

  const el = document.createElement('div');
  el.className = 'toast-item';
  el.innerHTML = `
    <div class="toast-ico ${type}"><i class="fas ${icon}"></i></div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close"><i class="fas fa-xmark"></i></button>
    <div class="toast-progress ${type}" style="width:100%;"></div>
  `;
  toastContainer.appendChild(el);

  const closeBtn  = el.querySelector('.toast-close');
  const progress  = el.querySelector('.toast-progress');

  requestAnimationFrame(() => el.classList.add('show'));

  let startTime = Date.now();
  const timer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const pct = Math.max(0, (duration - elapsed) / duration * 100);
    progress.style.width = pct + '%';
    if (pct <= 0) clearInterval(timer);
  }, 30);

  function dismiss() {
    if (el.classList.contains('hide')) return;
    el.classList.remove('show');
    el.classList.add('hide');
    clearInterval(timer);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 350);
  }

  closeBtn.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

/* ============================================================
   SIDEBAR
============================================================ */
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

hamburger.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

/* ============================================================
   REF PARAM — auto-fill referral from ?ref=username
============================================================ */
function checkRefParam() {
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref && ref.trim().length > 0 && referredInp && referredGrp) {
    referredGrp.classList.add('show');
    referredInp.value    = ref.trim().toLowerCase();
    referredInp.disabled = true;

    // "Invited" badge
    const wrap = referredInp.closest('.input-wrap') || referredInp.parentElement;
    if (wrap && !wrap.querySelector('.ref-badge')) {
      const badge = document.createElement('span');
      badge.className  = 'ref-badge';
      badge.style.cssText = 'position:absolute;right:10px;background:rgba(0,192,122,0.12);color:#00c07a;font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:20px;pointer-events:none;font-family:inherit';
      badge.textContent = 'Invited';
      wrap.style.position = 'relative';
      wrap.appendChild(badge);
    }
  }
}
checkRefParam();

/* ============================================================
   PASSWORD TOGGLE
============================================================ */
document.getElementById('togglePassword').addEventListener('click', function () {
  const type = passwordInp.type === 'password' ? 'text' : 'password';
  passwordInp.type = type;
  this.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
});
document.getElementById('toggleConfirm').addEventListener('click', function () {
  const type = confirmInp.type === 'password' ? 'text' : 'password';
  confirmInp.type = type;
  this.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
});

/* ============================================================
   PASSWORD STRENGTH
============================================================ */
const STRENGTH_CONFIG = [
  { label: '',       colors: ['', '', '', ''] },
  { label: 'Weak',   colors: ['#e8334a', '', '', ''] },
  { label: 'Fair',   colors: ['#f59e0b', '#f59e0b', '', ''] },
  { label: 'Good',   colors: ['#00aaff', '#00aaff', '#00aaff', ''] },
  { label: 'Strong', colors: ['#00c07a', '#00c07a', '#00c07a', '#00c07a'] },
];
const STRENGTH_LABEL_COLORS = ['', '#e8334a', '#f59e0b', '#00aaff', '#00c07a'];
const segs = [pwSeg1, pwSeg2, pwSeg3, pwSeg4];

function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  return score; // 0–4
}

function updatePasswordStrength() {
  const pw  = passwordInp.value;
  if (!pw) {
    segs.forEach(s => s.style.background = '');
    pwStrengthLabel.textContent = '';
    return;
  }
  const score = getStrength(pw);
  const cfg   = STRENGTH_CONFIG[score];
  segs.forEach((s, i) => s.style.background = cfg.colors[i] || 'var(--border)');
  pwStrengthLabel.textContent = cfg.label;
  pwStrengthLabel.style.color = STRENGTH_LABEL_COLORS[score];
}

passwordInp.addEventListener('input', () => {
  updatePasswordStrength();
  if (confirmInp.value.length > 0) validateConfirm();
});





/* ============================================================
   VALIDATION HELPERS
============================================================ */
function setFieldError(groupId, errEl, msg) {
  const grp = document.getElementById(groupId);
  if (grp) { grp.classList.remove('success'); grp.classList.add('error'); }
  if (errEl) errEl.textContent = msg;
}

function setFieldSuccess(groupId) {
  const grp = document.getElementById(groupId);
  if (grp) { grp.classList.remove('error'); grp.classList.add('success'); }
}

function clearFieldState(groupId) {
  const grp = document.getElementById(groupId);
  if (grp) { grp.classList.remove('success', 'error'); }
}

function markValidField(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('valid'); el.classList.remove('invalid'); }
}

/* ============================================================
   VALIDATION FUNCTIONS
============================================================ */

// 1. FULLNAME — 2-3 words, letters only
function validateFullname() {
  const val = fullnameInp.value.trim();
  if (!val) {
    clearFieldState('nameGroup');
    return false;
  }
  if (!/^[A-Za-z\s]+$/.test(val)) {
    setFieldError('nameGroup', nameError, 'Only letters and spaces allowed.');
    return false;
  }
  const words = val.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2 || words.length > 3) {
    setFieldError('nameGroup', nameError, 'Please enter 2–3 words (e.g. "Abdulmalik Ahmad").');
    return false;
  }
  for (const w of words) {
    if (w.length < 2) {
      setFieldError('nameGroup', nameError, 'Each name must be at least 2 characters.');
      return false;
    }
  }
  setFieldSuccess('nameGroup');
  return true;
}

fullnameInp.addEventListener('input',  () => { validateFullname(); });
fullnameInp.addEventListener('blur',   validateFullname);

// 2. USERNAME — real-time local rules + debounced backend check
const RESERVED_USERNAMES = [
  'admin','administrator','test','user','subhub','support','earncial',
  'demo','root','system','moderator','help','info','contact','webmaster',
  'noreply','no-reply','abuse','security','studio','reseller','data','airtime','nigeria','company','subhubng','subhub.ng','subhub.com.ng'
];

let usernameTimer;
let usernameAvailable = false;

function validateUsername() {
  const val = usernameInp.value.trim().toLowerCase();
  clearTimeout(usernameTimer);
  usernameAvailable = false;

  if (!val) {
    usernameStatus.className = 'username-status';
    usernameStatus.innerHTML = '';
    clearFieldState('usernameGroup');
    return false;
  }

  if (val.length < 3) {
    usernameStatus.className = 'username-status';
    usernameStatus.innerHTML = '<i class="fas fa-circle-xmark"></i>';
    setFieldError('usernameGroup', usernameError, 'Username must be at least 3 characters.');
    return false;
  }

  if (val.length > 20) {
    usernameStatus.innerHTML = '<i class="fas fa-circle-xmark"></i>';
    setFieldError('usernameGroup', usernameError, 'Username must be at most 20 characters.');
    return false;
  }

  if (!/^[a-z0-9_]+$/.test(val)) {
    usernameStatus.innerHTML = '<i class="fas fa-circle-xmark"></i>';
    setFieldError('usernameGroup', usernameError, 'Only letters, numbers, and underscore allowed.');
    return false;
  }

  if (/^[0-9_]/.test(val)) {
    usernameStatus.innerHTML = '<i class="fas fa-circle-xmark"></i>';
    setFieldError('usernameGroup', usernameError, 'Username cannot start with a number or underscore.');
    return false;
  }

  if (RESERVED_USERNAMES.includes(val)) {
    usernameStatus.innerHTML = '<i class="fas fa-circle-xmark"></i>';
    setFieldError('usernameGroup', usernameError, 'This username is reserved. Please choose another.');
    return false;
  }

  // Local rules passed — hit backend
  usernameStatus.className = 'username-status';
  usernameStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  clearFieldState('usernameGroup');

  usernameTimer = setTimeout(async () => {
    const data = await apiCall(`/auth/check-username/${val}`);

    if (data && data.available) {
      usernameStatus.innerHTML = '<i class="fas fa-circle-check"></i>';
      setFieldSuccess('usernameGroup');
      usernameError.textContent = '3-20 chars, letters/numbers/underscore only.';
      usernameAvailable = true;
      showToast('Username Available', `"${val}" is available!`, 'green', 2500);
    } else {
      usernameStatus.innerHTML = '<i class="fas fa-circle-xmark"></i>';
      setFieldError('usernameGroup', usernameError, 'Username is taken. Please try another.');
      showToast('Username Taken', `"${val}" is already in use. Try another.`, 'warn', 3000);
      usernameAvailable = false;
    }
  }, 600);

  return false; // async — result comes later
}

usernameInp.addEventListener('input', function () {
  // Force lowercase in real time
  const pos = this.selectionStart;
  const lower = this.value.toLowerCase();
  if (this.value !== lower) {
    this.value = lower;
    this.setSelectionRange(pos, pos);
  }
  validateUsername();
});
usernameInp.addEventListener('blur', validateUsername);

// 3. EMAIL
function validateEmail() {
  const val = emailInp.value.trim();
  if (!val) { clearFieldState('emailGroup'); return false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    setFieldError('emailGroup', emailError, 'Please enter a valid email address (e.g. you@example.com).');
    return false;
  }
  setFieldSuccess('emailGroup');
  return true;
}

emailInp.addEventListener('input', () => { validateEmail(); });
emailInp.addEventListener('blur',  validateEmail);

// 4. PHONE — 11 digits, starts with 0
function validatePhone() {
  const val = phoneInp.value.trim();
  if (!val) { clearFieldState('phoneGroup'); return false; }

  if (val.startsWith('+234') || val.startsWith('234')) {
    setFieldError('phoneGroup', phoneError, 'Use 0 prefix only (e.g. 08012345678). Not +234.');
    return false;
  }
  if (!/^\d+$/.test(val)) {
    setFieldError('phoneGroup', phoneError, 'Only digits allowed.');
    return false;
  }
  if (!val.startsWith('0')) {
    setFieldError('phoneGroup', phoneError, 'Must start with 0 (e.g. 08012345678).');
    return false;
  }
  if (val.length !== 11) {
    setFieldError('phoneGroup', phoneError, 'Must be exactly 11 digits (e.g. 08012345678).');
    return false;
  }
  setFieldSuccess('phoneGroup');
  return true;
}

phoneInp.addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  this.value = v;
  validatePhone();
});
phoneInp.addEventListener('blur', validatePhone);

// 5. PASSWORD
function validatePassword() {
  const pw = passwordInp.value;
  updatePasswordStrength();
  if (!pw) { clearFieldState('passwordGroup'); return false; }
  if (pw.length < 8) {
    setFieldError('passwordGroup', passwordError, 'Password must be at least 8 characters.');
    return false;
  }
  if (getStrength(pw) < 2) {
    setFieldError('passwordGroup', passwordError, 'Password too weak — add numbers or symbols.');
    return false;
  }
  setFieldSuccess('passwordGroup');
  return true;
}

passwordInp.addEventListener('blur', validatePassword);

// 6. CONFIRM PASSWORD
function validateConfirm() {
  const cpw = confirmInp.value;
  if (!cpw) { clearFieldState('confirmGroup'); return false; }
  if (cpw !== passwordInp.value) {
    setFieldError('confirmGroup', confirmError, 'Passwords do not match.');
    return false;
  }
  setFieldSuccess('confirmGroup');
  return true;
}

confirmInp.addEventListener('input',  () => { validateConfirm(); });
confirmInp.addEventListener('blur',   validateConfirm);

// 7. TERMS
function validateTerms() {
  if (!agreeTerms.checked) {
    termsError.classList.add('show');
    return false;
  }
  termsError.classList.remove('show');
  return true;
}

agreeTerms.addEventListener('change', () => { validateTerms(); });

/* ============================================================
   PROCESSING OVERLAY CONTROLS
============================================================ */
function showProcessing() {
  overlay.classList.add('active');
  procLogoWrap.style.display   = 'flex';
  procStatusIcon.className     = 'proc-status-icon';
  procStatusIcon.style.display = 'none';
  procTitle.textContent        = 'Creating your account...';
  procSub.textContent          = 'Please wait while we set up your SubHub account.';
  procDots.style.display       = 'flex';
  procBtnDone.style.display    = 'none';
  submitBtn.disabled           = true;
  submitBtn.classList.add('loading');
  if (submitIcon) submitIcon.style.display = 'none';
}

function showSuccess(firstName) {
  procLogoWrap.style.display   = 'none';
  procStatusIcon.className     = 'proc-status-icon success';
  procStatusIcon.style.display = 'block';
  procStatusIcon.innerHTML     = '<i class="fas fa-circle-check"></i>';
  procTitle.textContent        = `Account created! 🎉`;
  procSub.textContent          = `Welcome to SubHub${firstName ? ', ' + firstName : ''}! Check your email to verify your account.`;
  procDots.style.display       = 'none';
  procBtnDone.textContent      = 'Continue to login';
  procBtnDone.style.display    = 'inline-block';
  submitBtn.disabled           = false;
  submitBtn.classList.remove('loading');
  if (submitIcon) submitIcon.style.display = 'inline-flex';
}

function showOverlayError(msg) {
  procLogoWrap.style.display   = 'none';
  procStatusIcon.className     = 'proc-status-icon error';
  procStatusIcon.style.display = 'block';
  procStatusIcon.innerHTML     = '<i class="fas fa-circle-xmark"></i>';
  procTitle.textContent        = 'Something went wrong';
  procSub.textContent          = msg || 'Please try again or contact support.';
  procDots.style.display       = 'none';
  procBtnDone.textContent      = 'Try again';
  procBtnDone.style.display    = 'inline-block';
  submitBtn.disabled           = false;
  submitBtn.classList.remove('loading');
  if (submitIcon) submitIcon.style.display = 'inline-flex';
}

procBtnDone.addEventListener('click', function () {
  if (this.textContent === 'Continue to login') {
    window.location.href = '/login';
    return;
  }
  // "Try again" — close overlay
  overlay.classList.remove('active');
});

overlay.addEventListener('click', function (e) {
  if (e.target === this && procBtnDone.style.display === 'inline-block') {
    overlay.classList.remove('active');
  }
});

/* ============================================================
   RIPPLE EFFECT — inject required styles from JS (no CSS file changes)
============================================================ */
(function injectRippleStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #submitBtn { overflow: hidden; }
    .ripple {
      position: absolute;
      border-radius: 50%;
      transform: scale(0);
      animation: _ripple 0.6s linear forwards;
      background: rgba(255,255,255,0.35);
      pointer-events: none;
    }
    @keyframes _ripple {
      to { transform: scale(4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();

submitBtn.addEventListener('click', function (e) {
  this.querySelectorAll('.ripple').forEach(r => r.remove());
  const rect   = this.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width  = size + 'px';
  ripple.style.height = size + 'px';
  ripple.style.left   = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top    = (e.clientY - rect.top  - size / 2) + 'px';
  this.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

/* ============================================================
   FORM SUBMIT
============================================================ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const isNameValid    = validateFullname();
  const isEmailValid   = validateEmail();
  const isPhoneValid   = validatePhone();
  const isPassValid    = validatePassword();
  const isConfirmValid = validateConfirm();
  const isTermsValid   = validateTerms();

  // Username: must have passed backend check
  let isUsernameValid = false;
  if (!usernameAvailable) {
    const val = usernameInp.value.trim().toLowerCase();
    if (!val || val.length < 3) {
      setFieldError('usernameGroup', usernameError, 'Please enter a valid username.');
    } else {
      setFieldError('usernameGroup', usernameError, 'Wait for username availability check, or username is taken.');
    }
  } else {
    isUsernameValid = true;
  }

  if (!isNameValid || !isUsernameValid || !isEmailValid ||
      !isPhoneValid || !isPassValid    || !isConfirmValid || !isTermsValid) {
    const firstError = document.querySelector('.form-group.error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (termsError && termsError.classList.contains('show')) {
      termsError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  const fullname = fullnameInp.value.trim();
  const username = usernameInp.value.trim().toLowerCase();
  const email    = emailInp.value.trim().toLowerCase();
  const phone    = phoneInp.value.trim();
  const password = passwordInp.value;
  const referred = referredInp ? referredInp.value.trim().toLowerCase() : '';

  showProcessing();

  const body = { fullName: fullname, username, email, phone, password };
  if (referred) body.referredBy = referred;

  const data = await apiCall('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!data || !data.success) {
    showOverlayError(data?.message || 'Registration failed. Please try again.');
    return;
  }

  // Success — clear form completely
  form.reset();
  document.querySelectorAll('.form-group').forEach(g => g.classList.remove('success', 'error'));
  usernameStatus.innerHTML = '';
  usernameAvailable = false;
  segs.forEach(s => s.style.background = '');
  pwStrengthLabel.textContent = '';
  termsError.classList.remove('show');

  const firstName = fullname.split(' ')[0];
  showSuccess(firstName);
});

/* ============================================================
   AUTO-FOCUS
============================================================ */
setTimeout(() => {
  if (fullnameInp && !fullnameInp.value) fullnameInp.focus();
}, 300);

console.log('✅ SubHub sign-up.js loaded · version 2.0.0');

}); // end DOMContentLoaded
