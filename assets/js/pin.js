/* ============================================================
   SubHub — pin.js
   Transaction PIN screen (section of the login card).
   Opens after login ONLY when the server says transactionPinSet === false.
   Step 1: create PIN  ->  Step 2: confirm PIN  ->  Set PIN.
   Uses SubHub's own keypad (no phone keyboard).
   Needs config.js and login.js loaded first.
============================================================ */
(function () {
'use strict';
const { $, K, store, setIcon, setLoading, errorFeedback, showToast, apiCall, loaderShow, procHide, errorSheet, app, state, HOME_URL } = window.SubHub;

const SET_PIN_ENDPOINT = '/auth/set-pin';          // POST { pin }  (access token goes in the Authorization header)

const boxes = Array.prototype.slice.call($('pinBoxes').querySelectorAll('.pin-box'));
let step = 1, firstPin = '', cur = '', revealed = false, advancing = false;

/* ---- draw ---- */
function paint(){
  boxes.forEach((b, i) => {
    const filled = i < cur.length;
    b.textContent = filled && revealed ? cur[i] : '';
    b.classList.toggle('filled', filled);
    b.classList.toggle('show', filled && revealed);
    b.classList.toggle('active', i === Math.min(cur.length, 3));
  });
  $('pinBtn').disabled = !(step === 2 && cur.length === 4);
}
function clearError(){
  $('pinError').classList.remove('show'); $('pinError').textContent = '';
  $('pinBoxes').classList.remove('invalid');
}
function fail(msg){
  $('pinError').textContent = msg; $('pinError').classList.add('show');
  $('pinBoxes').classList.add('invalid');
  errorFeedback($('card'));                         // shake + vibrate
}

function setStep(n){
  step = n; cur = ''; advancing = false; clearError();
  $('title').textContent = n === 1 ? 'Create your PIN' : 'Confirm your PIN';
  $('subtitle').textContent = n === 1 ? 'Choose a 4-digit PIN to confirm your purchases.' : 'Enter the same PIN again to finish.';
  $('pinDot1').classList.toggle('on', n === 1);
  $('pinDot2').classList.toggle('on', n === 2);
  $('pinBtn').hidden = n !== 2;
  paint();
  window.SubHubLogin.updateBack();                  // back arrow only on step 2
}

/* ---- PIN rules: not 0000 / 1111 / 1234 / 4321 ---- */
function weak(p){
  if (/^(\d)\1{3}$/.test(p)) return true;
  const d = p.split('').map(Number);
  return d.every((x, i) => i === 0 || x === d[i - 1] + 1) || d.every((x, i) => i === 0 || x === d[i - 1] - 1);
}

/* ---- keypad ---- */
function press(d){
  if (app.busy || advancing || cur.length >= 4) return;
  clearError();
  cur += d; paint();
  if (cur.length < 4) return;
  if (step === 1) {
    if (weak(cur)) { fail('Choose a less obvious PIN (not 0000, 1111 or 1234).'); cur = ''; paint(); return; }
    advancing = true;                               // let the 4th dot show, then go to step 2
    setTimeout(() => { firstPin = cur; setStep(2); }, 180);
  }
}
function del(){
  if (app.busy || advancing || !cur) return;
  clearError(); cur = cur.slice(0, -1); paint();
}
$('keypad').addEventListener('click', e => {
  const b = e.target.closest('.key'); if (!b) return;
  if (b.dataset.k !== undefined) press(b.dataset.k);
  else if (b.id === 'keyDel') del();
  else if (b.id === 'keyEye') {
    revealed = !revealed;
    setIcon(b.querySelector('svg'), revealed ? 'eyeoff' : 'eye');
    b.setAttribute('aria-label', revealed ? 'Hide PIN' : 'Show PIN');
    paint();
  }
});
document.addEventListener('keydown', e => {          // computer keyboard works too
  if (state.mode !== 'pin') return;
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') del();
});

/* ---- set PIN ---- */
$('pinForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (app.busy || step !== 2 || cur.length !== 4) return;
  clearError();

  if (cur !== firstPin) {
    fail('PINs do not match. Try again.');
    cur = ''; paint();
    return;
  }

  app.busy = true;
  const btn = $('pinBtn'); setLoading(btn, true);
  loaderShow('Setting your PIN...', 'Please wait a moment.');   // same logo loader as fingerprint login

  const data = await apiCall(SET_PIN_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (store.get(K.access) || '') },
    body: JSON.stringify({ pin: firstPin })
  });

  app.busy = false; setLoading(btn, false); procHide();

  const ok = data && (data.success === true || (data.success === undefined && data.ok));
  if (!ok) {
    const expired = data && (data.status === 401 || data.status === 403);
    errorSheet('Could not set PIN', expired ? 'Your session expired. Please log in again.' : ((data && data.message) || 'Something went wrong. Please try again.'));
    return;
  }

  app.busy = true;                                             // stay locked while redirecting
  firstPin = ''; cur = ''; paint();
  showToast('PIN created', 'Taking you to your dashboard\u2026', 'success', 1200);
  setTimeout(() => { window.location.href = HOME_URL; }, 1200);
});

/* ---- called by login.js ---- */
function show(){
  app.busy = false; setLoading($('loginBtn'), false);
  window.SubHubLogin.resetNav();
  state.mode = 'pin';
  window.SubHubLogin.render();
  firstPin = ''; revealed = false;
  setIcon($('keyEye').querySelector('svg'), 'eye');
  setStep(1);
}
function canBack(){ return step === 2 && !app.busy; }
function back(){ if (!canBack()) return false; firstPin = ''; setStep(1); return true; }

window.SubHubPin = { show, canBack, back };
})();
