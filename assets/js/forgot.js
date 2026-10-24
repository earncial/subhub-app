/* ============================================================
   SubHub — forgot.js
   Forgot password with a 6-digit code, inside a bottom sheet:

     1) email  ->  2) 6-digit code  ->  3) new password  ->  success modal  ->  login

   * The step is remembered. If the user closes the app and opens it again,
     the sheet comes back on the same step (code / new password).
   * Verify code and Set password show the logo loader (same as fingerprint login).
   * Everything (markup + styles) is created by this file. Just add ONE script tag:
       <script src="/assets/js/forgot.js?v=1" defer></script>      (after login.js)
   * It replaces the old forgot-password modal. The old one may stay in index.html
     and in login.js; it is never opened again.

   Needs config.js + login.js loaded first.
============================================================ */
(function () {
'use strict';
const { $, K, store, ico, setIcon, setLoading, vibrate, errorFeedback, showToast, apiCall, loaderShow, procHide, app } = window.SubHub;

/* ---- settings ---- */
const USE_MOCK        = false;                       // true = test the screens with fake answers (code 123456)
const FORGOT_ENDPOINT = '/auth/forgot-password';     // POST { email }              -> sends the 6-digit code
const VERIFY_ENDPOINT = '/auth/verify-reset-code';   // POST { email, code }        -> { success, resetToken, expiresIn? }   <- NEW, confirm with backend
const RESET_ENDPOINT  = '/auth/reset-password/';     // POST /:resetToken { password }
const RESEND_SECONDS  = 45;                          // wait before "Resend code"
const CODE_SCREEN_TTL = 30 * 60 * 1000;              // how long the code screen is remembered after closing the app

/* ============================================================
   SMALL HELPERS
============================================================ */
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isOk = d => !!(d && (d.success === true || (d.success === undefined && d.ok)));
function mask(e){ const [u, d] = String(e).split('@'); return (u.length <= 2 ? u[0] : u.slice(0, 2)) + '***@' + d; }
const wait = ms => new Promise(r => setTimeout(r, ms));

let mockTries = 5;
async function api(endpoint, options){
  if (!USE_MOCK) return apiCall(endpoint, options);
  await wait(900);
  const b = options && options.body ? JSON.parse(options.body) : {};
  if (endpoint === FORGOT_ENDPOINT) return { success: true, status: 200 };
  if (endpoint === VERIFY_ENDPOINT) {
    if (b.code === '123456') return { success: true, status: 200, resetToken: 'mock-token', expiresIn: 900 };
    mockTries--;
    if (mockTries <= 0) { mockTries = 5; return { success: false, status: 429, message: 'Too many wrong attempts. Request a new code.' }; }
    return { success: false, status: 400, message: 'Incorrect code. ' + mockTries + ' attempts left.' };
  }
  if (endpoint.indexOf(RESET_ENDPOINT) === 0) return { success: true, status: 200 };
  return { success: false, message: 'Not found' };
}

/* ============================================================
   REMEMBERED STEP  { step:'code'|'password', email, sentAt, resetToken, exp }
============================================================ */
const STORE_KEY = 'sh_forgot';
function readState(){
  try {
    const s = JSON.parse(store.get(STORE_KEY) || 'null');
    if (s && s.email) {
      if (s.step === 'code' && Date.now() - s.sentAt < CODE_SCREEN_TTL) return s;
      if (s.step === 'password' && s.code && s.exp > Date.now()) return s;
    }
  } catch (e) {}
  store.del(STORE_KEY);
  return null;
}
let st = readState();
function saveState(s){ st = s; if (s) store.set(STORE_KEY, JSON.stringify(s)); else store.del(STORE_KEY); }

/* ============================================================
   STYLES + MARKUP (built once, the first time the sheet opens)
============================================================ */
const CSS = `
.proc-ov{z-index:1100!important}
.fg-sheet{max-height:94vh;overflow-y:auto}
.fg-sheet .sheet-close{z-index:5}
.fg-back{left:16px;right:auto}
.fg-step{animation:fgIn .35s cubic-bezier(.22,1,.36,1) both}
@keyframes fgIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
.fg-otp{display:flex;justify-content:center;gap:8px;max-width:340px;margin:4px auto}
.fg-box{flex:1;min-width:0;max-width:48px;height:56px;border-radius:14px;background:var(--surface2);border:1.5px solid var(--border);display:grid;place-items:center;font-size:1.45rem;font-weight:800;color:var(--text);transition:border-color .15s,box-shadow .15s,background .15s}
.fg-box:nth-child(3){margin-right:8px}
.fg-box.filled{border-color:rgba(0,170,255,.55);background:var(--surface)}
.fg-box.active{border-color:var(--brand);background:var(--surface);box-shadow:0 0 0 3px var(--brand-dim)}
.fg-box.pop{animation:fgPop .3s cubic-bezier(.22,1,.36,1)}
@keyframes fgPop{0%{transform:scale(.8)}55%{transform:scale(1.14)}100%{transform:scale(1)}}
.fg-otp.err .fg-box{border-color:var(--error);background:rgba(232,51,74,.06)}
.fg-err{min-height:1.4em;margin:6px 0 8px;text-align:center;font-size:.8rem;font-weight:600;color:var(--error)}
.fg-resend{text-align:center;font-size:.82rem;color:var(--muted);margin:14px 0 2px;min-height:1.6em}
.fg-resend .link{padding:2px 4px}
.fg-links{display:flex;justify-content:center;margin-top:4px}
.fg-links .link{color:var(--muted);font-weight:600}
@media (max-height:700px){.fg-sheet .key{height:46px}.fg-sheet .keypad{gap:7px}}
`;

const PASTE_ICON = '<svg class="i" viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>';
const keyBtns = '123456789'.split('').map(n => '<button type="button" class="key" data-k="' + n + '">' + n + '</button>').join('');

const HTML = `
<div class="sheet-ov" id="fgOv" hidden>
  <div class="sheet fg-sheet" id="fgSheet" role="dialog" aria-modal="true" aria-label="Forgot password">
    <button type="button" class="sheet-close fg-back" id="fgBack" aria-label="Back" hidden>${ico('back')}</button>
    <button type="button" class="sheet-close" id="fgClose" aria-label="Close">${ico('x')}</button>

    <!-- 1) email -->
    <div class="fg-step" id="fgStepEmail">
      <h2>Forgot password?</h2>
      <p><p>Don't worry, it happens! Enter the email address associated with your <b>SubHub</b> account, and we'll send you a 6-digit code to reset your password.</p>
      <div class="field">
        <label for="fgEmailInput">Email address</label>
        <div class="input-wrap">
          <span class="input-icon">${ico('mail')}</span>
          <input class="input" type="email" id="fgEmailInput" placeholder="you@example.com" autocomplete="email" autocapitalize="none">
        </div>
        <div class="error-text" id="fgEmailErr"></div>
      </div>
      <button type="button" class="btn btn-primary" id="fgSend"><span class="spinner"></span><span class="btn-label">Send code</span></button>
    </div>

    <!-- 2) code -->
    <div class="fg-step" id="fgStepCode" hidden>
      <h2>Enter the code</h2>
      <p>We sent a 6-digit code to <b id="fgMask"></b>. It expires in 15 minutes.</p>
      <div class="fg-otp" id="fgOtp" aria-live="polite">
        <span class="fg-box"></span><span class="fg-box"></span><span class="fg-box"></span><span class="fg-box"></span><span class="fg-box"></span><span class="fg-box"></span>
      </div>
      <div class="fg-err" id="fgCodeErr" role="alert"></div>
      <div class="keypad" id="fgKeypad">
        ${keyBtns}
        <button type="button" class="key key-icon" id="fgPaste" aria-label="Paste code">${PASTE_ICON}</button>
        <button type="button" class="key" data-k="0">0</button>
        <button type="button" class="key key-icon" id="fgDel" aria-label="Delete">${ico('backspace')}</button>
      </div>
      <button type="button" class="btn btn-primary" id="fgVerify" disabled><span class="spinner"></span><span class="btn-label">Verify code</span></button>
      <div class="fg-resend" id="fgResend"></div>
      <div class="fg-links"><button type="button" class="link" id="fgOther">Use a different email</button></div>
    </div>

    <!-- 3) new password -->
    <div class="fg-step" id="fgStepPass" hidden>
      <h2>Create a new password</h2>
      <p>Choose a strong password that you have not used before.</p>
      <div class="field">
        <label for="fgPass">New password</label>
        <div class="input-wrap">
          <span class="input-icon">${ico('lock')}</span>
          <input class="input" type="password" id="fgPass" placeholder="Min. 8 characters" autocomplete="new-password">
          <button type="button" class="eye" data-fg-eye="fgPass" aria-label="Show password">${ico('eye')}</button>
        </div>
        <div class="strength" id="fgStrength" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="strength-label" id="fgStrengthLbl"></div>
      </div>
      <div class="field">
        <label for="fgPass2">Re-enter new password</label>
        <div class="input-wrap">
          <span class="input-icon">${ico('lock')}</span>
          <input class="input" type="password" id="fgPass2" placeholder="Re-enter your password" autocomplete="new-password">
          <button type="button" class="eye" data-fg-eye="fgPass2" aria-label="Show password">${ico('eye')}</button>
        </div>
      </div>
      <div class="error-text" id="fgPassErr" style="margin:-6px 0 12px"></div>
      <button type="button" class="btn btn-primary" id="fgReset"><span class="spinner"></span><span class="btn-label">Reset password</span></button>
    </div>
  </div>
</div>

<!-- success modal: same shape as the error modal, green icon -->
<div class="proc-ov" id="fgDone" hidden>
  <div class="proc-sheet" style="--st:#00c07a;--st2:#00a067" role="alert">
    <span class="proc-handle"></span>
    <div class="orb">
      <span class="orb-ring o1"></span><span class="orb-ring o2"></span><span class="orb-ripple"></span>
      <span class="orb-core">${ico('check')}</span>
    </div>
    <div class="proc-title">Password changed</div>
    <div class="proc-sub">Your password was reset successfully. Log in with your new password.</div>
    <button type="button" class="btn btn-primary proc-btn" id="fgGoLogin">Log in</button>
  </div>
</div>`;

let built = false;
function build(){
  if (built) return;
  built = true;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const holder = document.createElement('div'); holder.innerHTML = HTML;
  while (holder.firstChild) document.body.appendChild(holder.firstChild);
  bind();
}

/* ============================================================
   SHEET OPEN / CLOSE / STEPS
============================================================ */
let busy = false, lockedApp = false;
function lockApp(){ if (!lockedApp) { lockedApp = true; app.busy = true; } }     // also stops the automatic fingerprint prompt behind the sheet
function unlockApp(){ if (lockedApp) { lockedApp = false; app.busy = false; } }

function open(){
  build();
  $('fgOv').hidden = false;
  lockApp();
  if (st && st.step === 'code') showStep('code');
  else if (st && st.step === 'password') showStep('pass');
  else {
    showStep('email');
    const typed = ($('credential') && $('credential').value || '').trim();
    if (!$('fgEmailInput').value && typed.indexOf('@') > 0) $('fgEmailInput').value = typed;
  }
}
function close(){                                   // closing keeps the step, so the user can continue later
  if (busy || !built) return;
  $('fgOv').hidden = true;
  clearInterval(resendTimer);
  unlockApp();
}

function showStep(name){
  ['Email', 'Code', 'Pass'].forEach(n => { $('fgStep' + n).hidden = n.toLowerCase() !== name; });
  $('fgBack').hidden = name !== 'code';
  const el = $('fgStep' + name.charAt(0).toUpperCase() + name.slice(1));
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  if (name !== 'code') clearInterval(resendTimer);

  if (name === 'email') setTimeout(() => $('fgEmailInput').focus(), 250);
  if (name === 'code') {
    $('fgMask').textContent = mask(st.email);
    code = ''; paintBoxes(); clearCodeErr(); startResendTimer();
  }
  if (name === 'pass') setTimeout(() => $('fgPass').focus(), 250);
}

/* ============================================================
   STEP 1: EMAIL
============================================================ */
function emailErr(msg){
  $('fgEmailErr').textContent = msg; $('fgEmailErr').classList.add('show'); $('fgEmailInput').classList.add('invalid');
  errorFeedback($('fgSheet'));
}
async function sendCode(){
  if (busy) return;
  $('fgEmailErr').classList.remove('show'); $('fgEmailInput').classList.remove('invalid');
  const email = $('fgEmailInput').value.trim().toLowerCase();
  if (!validEmail(email)) return emailErr('Enter a valid email address.');

  busy = true; setLoading($('fgSend'), true);
  const d = await api(FORGOT_ENDPOINT, { method: 'POST', body: JSON.stringify({ email }) });
  busy = false; setLoading($('fgSend'), false);

  if (!isOk(d)) return emailErr((d && d.message) || 'Could not send the code. Please try again.');
  saveState({ step: 'code', email, sentAt: Date.now() });
  showStep('code');
  showToast('Code sent', 'If ' + mask(email) + ' has a SubHub account, a 6-digit code is on its way.', 'success', 4500);
}

/* ============================================================
   STEP 2: CODE (6 boxes + keypad)
============================================================ */
let code = '', autoTimer = null, filling = false, resendTimer = null;
const boxes = () => Array.prototype.slice.call(document.querySelectorAll('#fgOtp .fg-box'));

function paintBoxes(){
  boxes().forEach((b, i) => {
    const f = i < code.length;
    b.textContent = f ? code[i] : '';
    b.classList.toggle('filled', f);
    b.classList.toggle('active', i === Math.min(code.length, 5));
  });
  $('fgVerify').disabled = code.length !== 6 || busy;
}
function popBox(i){ const b = boxes()[i]; if (!b) return; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
function clearCodeErr(){ $('fgCodeErr').textContent = ''; $('fgOtp').classList.remove('err'); }
function codeErr(msg){
  $('fgCodeErr').textContent = msg; $('fgOtp').classList.add('err');
  errorFeedback($('fgSheet'));
}

function press(d){
  if (busy || filling || code.length >= 6) return;
  clearCodeErr(); code += d; paintBoxes(); popBox(code.length - 1);
  if (code.length === 6) { clearTimeout(autoTimer); autoTimer = setTimeout(verify, 320); }
}
function del(){
  if (busy || filling || !code) return;
  clearTimeout(autoTimer); clearCodeErr(); code = code.slice(0, -1); paintBoxes();
}
async function fill(digits){
  if (busy || filling) return;
  filling = true; clearCodeErr(); code = ''; paintBoxes();
  for (const ch of digits.slice(0, 6)) { code += ch; paintBoxes(); popBox(code.length - 1); await wait(70); }
  filling = false;
  if (code.length === 6) { clearTimeout(autoTimer); autoTimer = setTimeout(verify, 320); }
}
async function pasteCode(){
  try {
    const t = await navigator.clipboard.readText();
    const digits = (String(t).match(/\d/g) || []).join('');
    if (digits.length >= 6) fill(digits.slice(0, 6));
    else showToast('No code found', 'Copy the 6-digit code from your email first.', 'info');
  } catch (e) { showToast('Cannot paste here', 'Type the code with the keypad.', 'info'); }
}

function startResendTimer(){
  clearInterval(resendTimer);
  const tick = () => {
    if (!st) return clearInterval(resendTimer);
    const left = Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - st.sentAt) / 1000));
    const el = $('fgResend');
    if (left > 0) { el.textContent = 'Resend code in 0:' + String(left).padStart(2, '0'); return; }
    clearInterval(resendTimer);
    el.innerHTML = 'Did not get it? <button type="button" class="link" id="fgResendBtn">Resend code</button>';
    $('fgResendBtn').addEventListener('click', resend);
  };
  tick(); resendTimer = setInterval(tick, 1000);
}
async function resend(){
  if (busy || !st) return;
  busy = true; $('fgResend').textContent = 'Sending...';
  const d = await api(FORGOT_ENDPOINT, { method: 'POST', body: JSON.stringify({ email: st.email }) });
  busy = false;
  if (!isOk(d)) { showToast('Could not send code', (d && d.message) || 'Please try again.', 'error'); startResendTimer(); return; }
  saveState({ step: 'code', email: st.email, sentAt: Date.now() });
  code = ''; paintBoxes(); clearCodeErr(); startResendTimer();
  showToast('Code sent', 'Check ' + mask(st.email) + ' (and your spam folder).', 'success');
}

async function verify(){
  if (busy || code.length !== 6 || !st) return;
  busy = true; clearCodeErr(); setLoading($('fgVerify'), true);
  loaderShow('Verifying code...', 'Please wait a moment.');           // logo loader

  const d = await api(VERIFY_ENDPOINT, { method: 'POST', body: JSON.stringify({ email: st.email, code }) });

  procHide(); setLoading($('fgVerify'), false); busy = false;

  if (isOk(d)) {
    saveState({ step: 'password', email: st.email, code, exp: (st.sentAt || Date.now()) + 15 * 60 * 1000 });
    showStep('pass');
    return;
  }
  codeErr((d && d.message) || 'Incorrect code. Please try again.');

/* ============================================================
   STEP 3: NEW PASSWORD
============================================================ */
function strength(pw){ let s = 0; if (pw.length >= 8) s++; if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; return s; }
function updateStrength(){
  const pw = $('fgPass').value, sc = pw ? strength(pw) : 0;
  $('fgStrength').className = 'strength' + (sc ? ' s' + sc : '');
  $('fgStrengthLbl').textContent = ['', 'Weak', 'Fair', 'Good', 'Strong'][sc];
}
function passErr(msg){
  $('fgPassErr').textContent = msg; $('fgPassErr').classList.add('show');
  errorFeedback($('fgSheet'));
}
async function resetPassword(){
  if (busy || !st || !st.code) return;
  $('fgPassErr').classList.remove('show');
  const p1 = $('fgPass').value, p2 = $('fgPass2').value;
  if (p1.length < 8) return passErr('Password must be at least 8 characters.');
  if (strength(p1) < 2) return passErr('Too weak. Add a capital letter, number or symbol.');
  if (p1 !== p2) return passErr('Passwords do not match.');

  busy = true; setLoading($('fgReset'), true);
  loaderShow('Updating your password...', 'Please wait a moment.');   // logo loader

  const d = await api(RESET_ENDPOINT, { method: 'POST', body: JSON.stringify({ email: st.email, code: st.code, password: p1 }) });

  procHide(); setLoading($('fgReset'), false); busy = false;

  if (isOk(d)) return success();
  if (d && (d.status === 400 || d.status === 401 || d.status === 404 || d.status === 410 || d.status === 429)) {          // the reset session is no longer valid
    saveState(null); $('fgPass').value = ''; $('fgPass2').value = '';
    showStep('email');
    emailErr('This reset session expired. Please start again.');
    return;
  }
  passErr((d && d.message) || 'Could not change your password. Please try again.');
}

/* ============================================================
   SUCCESS -> LOGIN
============================================================ */
function success(){
  const email = st.email;
  saveState(null);
  $('fgPass').value = ''; $('fgPass2').value = ''; updateStrength();

  /* The password changed, so any old login on this phone must start fresh */
  store.del(K.access); store.del(K.refresh); store.del(K.bioOwner);
  try { if (window.AndroidAuth && window.AndroidAuth.disableBiometricCredential) window.AndroidAuth.disableBiometricCredential('login'); } catch (e) {}
  try { if (window.AndroidFeedback) window.AndroidFeedback.play('success'); } catch (e) {}

  $('fgOv').hidden = true;
  $('fgDone').dataset.email = email;
  $('fgDone').hidden = false;
}
function goLogin(){
  const email = $('fgDone').dataset.email || '';
  $('fgDone').hidden = true;
  unlockApp();
  if (window.SubHubLogin && window.SubHubLogin.showLoginWith) window.SubHubLogin.showLoginWith(email);   // login screen, email filled, cursor on password
}

/* ============================================================
   EVENTS
============================================================ */
function bind(){
  $('fgClose').addEventListener('click', close);
  $('fgOv').addEventListener('click', e => { if (e.target === $('fgOv')) close(); });
  $('fgBack').addEventListener('click', startOver);
  $('fgOther').addEventListener('click', startOver);
  $('fgSend').addEventListener('click', sendCode);
  $('fgEmailInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendCode(); });
  $('fgEmailInput').addEventListener('input', () => { $('fgEmailErr').classList.remove('show'); $('fgEmailInput').classList.remove('invalid'); });

  $('fgKeypad').addEventListener('click', e => {
    const b = e.target.closest('.key'); if (!b) return;
    if (b.dataset.k !== undefined) press(b.dataset.k);
    else if (b.id === 'fgDel') del();
    else if (b.id === 'fgPaste') pasteCode();
  });
  $('fgVerify').addEventListener('click', () => { clearTimeout(autoTimer); verify(); });

  $('fgPass').addEventListener('input', () => { updateStrength(); $('fgPassErr').classList.remove('show'); });
  $('fgPass2').addEventListener('input', () => $('fgPassErr').classList.remove('show'));
  $('fgPass2').addEventListener('keydown', e => { if (e.key === 'Enter') resetPassword(); });
  $('fgReset').addEventListener('click', resetPassword);
  document.querySelectorAll('[data-fg-eye]').forEach(btn => btn.addEventListener('click', () => {
    const inp = $(btn.dataset.fgEye), hide = inp.type === 'password';
    inp.type = hide ? 'text' : 'password';
    setIcon(btn.querySelector('svg'), hide ? 'eyeoff' : 'eye');
    btn.setAttribute('aria-label', hide ? 'Hide password' : 'Show password');
  }));

  $('fgGoLogin').addEventListener('click', goLogin);

  document.addEventListener('keydown', e => {                       // computer keyboard on the code step
    if ($('fgOv').hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if ($('fgStepCode').hidden) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') del();
  });
  document.addEventListener('paste', e => {                         // Ctrl+V on the code step
    if ($('fgOv').hidden || $('fgStepCode').hidden) return;
    const digits = ((e.clipboardData || window.clipboardData).getData('text').match(/\d/g) || []).join('');
    if (digits.length >= 6) { e.preventDefault(); fill(digits.slice(0, 6)); }
  });
}
function startOver(){                                              // "Use a different email" / back arrow
  if (busy) return;
  saveState(null); clearInterval(resendTimer);
  showStep('email');
}

/* ---- the "Forgot password?" link: drop the old click handler, use this one ---- */
const link = $('forgotBtn');
if (link) {
  const fresh = link.cloneNode(true);                               // a clone has no old event listeners
  link.parentNode.replaceChild(fresh, link);
  fresh.addEventListener('click', open);
}

/* ---- came back after closing the app: show the same step again ---- */
if (st) open();
})();
