/* ============================================================
   SubHub — sign-up.js
   Signup section of the login page (same card, same look).
   Needs config.js and login.js loaded first.
============================================================ */
(function () {
'use strict';
const { $, ico, setLoading, vibrate, errorFeedback, showToast, apiCall, loaderShow, procHide, errorSheet, app } = window.SubHub;

const su = { name:$('suName'), user:$('suUser'), email:$('suEmail'), phone:$('suPhone'), pass:$('suPass'), confirm:$('suConfirm'), ref:$('suRef'), terms:$('suTerms') };
const suErrEl = { name:$('suNameErr'), user:$('suUserErr'), email:$('suEmailErr'), phone:$('suPhoneErr'), pass:$('suPassErr'), confirm:$('suConfirmErr') };

function suBad(k, msg){ su[k].classList.add('invalid'); suErrEl[k].textContent = msg; suErrEl[k].classList.add('show'); return false; }
function suGood(k){ su[k].classList.remove('invalid'); suErrEl[k].classList.remove('show'); return true; }
function suEmpty(k, strict, msg){ if (strict) return suBad(k, msg); su[k].classList.remove('invalid'); suErrEl[k].classList.remove('show'); return false; }

function vName(strict){
  const v = su.name.value.trim();
  if (!v) return suEmpty('name', strict, 'Enter your full name.');
  if (!/^[A-Za-z\s]+$/.test(v)) return suBad('name', 'Only letters and spaces allowed.');
  const w = v.split(/\s+/);
  if (w.length < 2 || w.length > 3) return suBad('name', 'Enter 2 or 3 names (e.g. Abdulmalik Ahmad).');
  if (w.some(x => x.length < 2)) return suBad('name', 'Each name must be at least 2 letters.');
  return suGood('name');
}

const RESERVED = ['admin','administrator','test','user','subhub','support','earncial','demo','root','system','moderator','help','info','contact','webmaster','noreply','no-reply','abuse','security','studio','reseller','data','airtime','nigeria','company','subhubng','subhub.ng','api','ceo','owner','founder'];
let uTimer, uSeq = 0, uAvail = false, uChecked = '', uChecking = false;
function uStatus(kind){
  const s = $('suUserStatus'); s.className = 'status' + (kind === 'ok' ? ' ok' : kind === 'bad' ? ' bad' : '');
  s.innerHTML = kind === 'ok' ? ico('checkcircle') : kind === 'bad' ? ico('xcircle') : kind === 'wait' ? '<span class="mini-spin"></span>' : '';
}
function vUser(strict){
  const v = su.user.value.trim().toLowerCase();
  clearTimeout(uTimer); uAvail = false; uChecked = ''; uChecking = false; uSeq++;
  uStatus('');
  if (!v) return suEmpty('user', strict, 'Choose a username.');
  if (v.length < 3)  { uStatus('bad'); return suBad('user', 'Username must be at least 3 characters.'); }
  if (!/^[a-z0-9_]+$/.test(v)) { uStatus('bad'); return suBad('user', 'Only letters, numbers and underscore allowed.'); }
  if (/^[0-9_]/.test(v)) { uStatus('bad'); return suBad('user', 'Username cannot start with a number or underscore.'); }
  if (RESERVED.includes(v)) { uStatus('bad'); return suBad('user', 'This username is reserved. Choose another.'); }

  suGood('user'); uStatus('wait'); uChecking = true;
  const seq = uSeq;
  uTimer = setTimeout(async () => {
    const d = await apiCall('/auth/check-username/' + encodeURIComponent(v));
    if (seq !== uSeq) return;
    uChecking = false;
    if (d && d.network) { uStatus(''); suBad('user', 'Could not check username. Check your connection.'); vibrate(); }
    else if (d && d.available) { uStatus('ok'); suGood('user'); uAvail = true; uChecked = v; }
    else { uStatus('bad'); suBad('user', 'Username is taken. Try another.'); vibrate(); }
  }, 600);
  return false;      // result arrives later
}

function vEmail(strict){
  const v = su.email.value.trim();
  if (!v) return suEmpty('email', strict, 'Enter your email address.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return suBad('email', 'Enter a valid email (e.g. you@example.com).');
  return suGood('email');
}
function vPhone(strict){
  const v = su.phone.value.trim();
  if (!v) return suEmpty('phone', strict, 'Enter your phone number.');
  if (v.startsWith('234')) return suBad('phone', 'Start with 0, not 234 (e.g. 08012345678).');
  if (!v.startsWith('0')) return suBad('phone', 'Must start with 0 (e.g. 08012345678).');
  if (v.length !== 11) return suBad('phone', 'Must be exactly 11 digits.');
  return suGood('phone');
}
function strength(pw){ let s = 0; if (pw.length >= 8) s++; if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; return s; }
function updateStrength(){
  const pw = su.pass.value, sc = pw ? strength(pw) : 0;
  $('suStrength').className = 'strength' + (sc ? ' s' + sc : '');
  $('suStrengthLabel').textContent = ['', 'Weak', 'Fair', 'Good', 'Strong'][sc];
}
function vPass(strict){
  const pw = su.pass.value; updateStrength();
  if (!pw) return suEmpty('pass', strict, 'Create a password.');
  if (pw.length < 8) return suBad('pass', 'Password must be at least 8 characters.');
  if (strength(pw) < 2) return suBad('pass', 'Too weak. Add a capital letter, number or symbol.');
  return suGood('pass');
}
function vConfirm(strict){
  const c = su.confirm.value;
  if (!c) return suEmpty('confirm', strict, 'Re-enter your password.');
  if (c !== su.pass.value) return suBad('confirm', 'Passwords do not match.');
  return suGood('confirm');
}
function vTerms(){ const ok = su.terms.checked; $('suTermsErr').classList.toggle('show', !ok); return ok; }

su.name.addEventListener('input', () => vName(false));  su.name.addEventListener('blur', () => vName(false));
su.user.addEventListener('input', function(){ const p = this.selectionStart, l = this.value.toLowerCase(); if (this.value !== l) { this.value = l; this.setSelectionRange(p, p); } vUser(false); });
su.email.addEventListener('input', () => vEmail(false)); su.email.addEventListener('blur', () => vEmail(false));
su.phone.addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 11); vPhone(false); });
su.pass.addEventListener('input', () => { vPass(false); if (su.confirm.value) vConfirm(false); });
su.confirm.addEventListener('input', () => vConfirm(false));
su.terms.addEventListener('change', vTerms);

function suFormError(msg){ const e = $('suFormError'); e.textContent = msg || ''; e.classList.toggle('show', !!msg); }

async function handleSignUp(e){
  e.preventDefault();
  if (app.busy) return;
  suFormError('');

  const okName = vName(true), okEmail = vEmail(true), okPhone = vPhone(true), okPass = vPass(true), okConf = vConfirm(true), okTerms = vTerms();
  const uname = su.user.value.trim().toLowerCase();
  let okUser = false;
  if (uAvail && uChecked === uname) okUser = true;
  else if (!uname) suBad('user', 'Choose a username.');
  else if (uChecking) suBad('user', 'Checking username, please wait a moment.');
  else if (!su.user.classList.contains('invalid')) suBad('user', 'Username is not available.');

  if (!(okName && okUser && okEmail && okPhone && okPass && okConf && okTerms)) {
    errorFeedback($('card'));
    const first = document.querySelector('#signupForm .input.invalid') || ($('suTermsErr').classList.contains('show') ? $('suTermsErr') : null);
    if (first) first.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }

  app.busy = true;
  const btn = $('suBtn'); setLoading(btn, true);
  loaderShow('Creating your account...', 'Please wait while we set up your SubHub account.');
  const payload = { fullName:su.name.value.trim(), username:uname, email:su.email.value.trim().toLowerCase(), phone:su.phone.value.trim(), password:su.pass.value };
  const ref = su.ref.value.trim().toLowerCase(); if (ref) payload.referredBy = ref;

  const data = await apiCall('/auth/signup', { method:'POST', body:JSON.stringify(payload) });
  app.busy = false; setLoading(btn, false); procHide();

  if (!data || !data.success) {
    const msg = (data && data.message) || 'Registration failed. Please try again.';
    suFormError(msg); errorSheet('Sign up failed', msg);
    return;
  }

  resetSignup();
  window.SubHubLogin.showLoginWith(uname);
  showToast('Account created', 'Check your email to verify it, redirecting to log in.', 'success', 4500);
}

function resetSignup(){
  $('signupForm').reset();
  Object.keys(su).forEach(k => { if (suErrEl[k]) suGood(k); });
  uStatus(''); uAvail = false; uChecked = ''; uChecking = false; uSeq++; clearTimeout(uTimer);
  updateStrength(); $('suTermsErr').classList.remove('show'); suFormError('');
  checkRefParam();
}
function checkRefParam(){
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && ref.trim()) {
    $('suRefGroup').hidden = false; su.ref.value = ref.trim().toLowerCase(); su.ref.disabled = true;
    const wrap = su.ref.parentElement;
    if (!wrap.querySelector('.badge')) { const b = document.createElement('span'); b.className = 'badge'; b.textContent = 'Invited'; wrap.appendChild(b); }
  }
}

$('signupForm').addEventListener('submit', handleSignUp);
checkRefParam();
})();
