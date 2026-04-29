const API_BASE = 'https://api.subhub.com.ng/api';
const $ = id => document.getElementById(id);

// Get token from URL
const urlParams = new URLSearchParams(window.location.search);
const RESET_TOKEN = urlParams.get('token');

// THEME
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

// TOAST
function showToast(title, msg, type = 'error') {
  const icons = {
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  };
  const id = 'toast_' + Date.now();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.id = id;
  el.innerHTML = `<div class="toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${icons[type]||icons.error}</svg></div><div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div><div class="toast-progress"></div>`;
  $('toastContainer').appendChild(el);
  el._t = setTimeout(() => {
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

function showErr(id, txtId, msg) { const e=$(id),t=$(txtId); if(t)t.textContent=msg; if(e)e.classList.add('show'); }
function clearErr(id) { const e=$(id); if(e)e.classList.remove('show'); }
function setLoading(btn, on) { btn.disabled=on; btn.classList.toggle('loading',on); }

// INIT
document.addEventListener('DOMContentLoaded', () => {
  // No token → show invalid
  if (!RESET_TOKEN) {
    $('formState').classList.add('hide');
    $('invalidState').classList.add('show');
    return;
  }

  // Password strength
  $('newPwd').addEventListener('input', checkStrength);
  $('confPwd').addEventListener('input', checkMatch);

  // Eye toggles
  setupEye('toggleNew', 'newPwd', 'eyeNewShow', 'eyeNewHide');
  setupEye('toggleConf', 'confPwd', 'eyeConfShow', 'eyeConfHide');

  // Submit
  $('resetBtn').addEventListener('click', handleReset);
  $('confPwd').addEventListener('keydown', e => { if(e.key==='Enter') handleReset(); });
  $('newPwd').addEventListener('keydown',  e => { if(e.key==='Enter') $('confPwd').focus(); });
});

function setupEye(btnId, inputId, showId, hideId) {
  $(btnId)?.addEventListener('click', () => {
    const inp = $(inputId);
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    $(showId).style.display = isHidden ? 'none'  : 'block';
    $(hideId).style.display = isHidden ? 'block' : 'none';
  });
}

// PASSWORD STRENGTH
function checkStrength() {
  const pwd = $('newPwd').value;
  const segs = [1,2,3,4,5].map(i => $('seg'+i));
  const lbl = $('strengthLbl');
  if (!pwd) { segs.forEach(s => s && (s.style.background='')); if(lbl) lbl.textContent=''; return; }

  let score = 0;
  if (pwd.length >= 6)               score++;
  if (pwd.length >= 10)              score++;
  if (/[A-Z]/.test(pwd))            score++;
  if (/[0-9]/.test(pwd))            score++;
  if (/[^A-Za-z0-9]/.test(pwd))     score++;

  const levels = [
    {color:'#e8334a', txt:'Very Weak'},
    {color:'#f97316', txt:'Weak'},
    {color:'#f59e0b', txt:'Fair'},
    {color:'#00c07a', txt:'Strong'},
    {color:'#00aaff', txt:'Very Strong'},
  ];
  const lvl = levels[Math.min(score-1, 4)] || levels[0];
  segs.forEach((s, i) => { if(s) s.style.background = i < score ? lvl.color : ''; });
  if (lbl) { lbl.textContent = lvl.txt; lbl.style.color = lvl.color; }
  checkMatch();
}

// CONFIRM MATCH
function checkMatch() {
  const pwd  = $('newPwd').value;
  const conf = $('confPwd').value;
  const st   = $('confirmStatus');
  if (!st || !conf) { st.innerHTML=''; st.className='confirm-status'; return; }
  if (pwd === conf) {
    st.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    st.className = 'confirm-status ok';
  } else {
    st.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    st.className = 'confirm-status err';
  }
}

// HANDLE RESET
async function handleReset() {
  clearErr('newPwdErr');
  clearErr('confPwdErr');

  const newPwd  = $('newPwd').value;
  const confPwd = $('confPwd').value;

  if (!newPwd || newPwd.length < 6) {
    showErr('newPwdErr', 'newPwdErrTxt', 'Password must be at least 6 characters');
    return;
  }
  if (newPwd !== confPwd) {
    showErr('confPwdErr', 'confPwdErrTxt', 'Passwords do not match');
    return;
  }

  const btn = $('resetBtn');
  setLoading(btn, true);

  let data;
  try {
    const res = await fetch(`${API_BASE}/auth/reset-password/${RESET_TOKEN}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: newPwd }),
    });
    data = await res.json();
  } catch {
    setLoading(btn, false);
    showToast('Network Error', 'Please check your connection', 'error');
    return;
  }

  setLoading(btn, false);

  if (!data || !data.success) {
    // Token expired or invalid
    if (data?.message?.toLowerCase().includes('invalid') || data?.message?.toLowerCase().includes('expired')) {
      $('formState').classList.add('hide');
      $('invalidState').classList.add('show');
      return;
    }
    showToast('Error', data?.message || 'Failed to reset password', 'error');
    return;
  }

  // Success
  $('formState').classList.add('hide');
  $('successState').classList.add('show');
}