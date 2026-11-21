/* ============================================================================
   SubHub dashboard  |  app.js  (production, real API)

   Runs inside the SubHub Android WebView and in a normal browser.
   Every native call is feature-detected (window.AndroidX), so both work.

   BACKEND CONTRACT: see BACKEND_NEEDS.md. Short version:
     existing  /auth/*  /data  /airtime  /cable  /electricity  /epin  /transfer  /wallet
     assumed   /transactions  /exam/plans  /exam/buy  /sms/send   (confirm the names)
     new       /notifications  /content/dashboard  /loan/eligibility
   Change any endpoint name in the EP block below, nothing else needs touching.
============================================================================ */
(function () {
'use strict';

/* ============================================================================
   1. CONFIG
============================================================================ */
const API_BASE = 'https://api.subhub.ng/api';                 // logout.js reads this
const TOKEN_KEY = 'sh_access_token';
const REFRESH_KEY = 'sh_refresh_token';
const LOGIN_URL = '/';
const PLACEHOLDER = '/placeholder.png';
const DEFAULT_AVATAR = '/avatar.png';
const EXAMPLE_PHONE = '08012345678';           // the placeholder number shown in the phone boxes, not a real phone
const EXAMPLE_PHONE_MSG = 'This is just an example number, not a real phone number. Enter your own number.';
const CACHE_KEY = 'sh_cache_v1';              // last known account data, shown at once on the next visit
const IMG_KEY = 'sh_img_ok_v1';               // image files that loaded before
const REFERRAL_BONUS = 50;                    // shown in text only

const ROUTES = {
  transactions: '/app/transactions.html',
  profile: '/app/profile.html',
  security: '/app/profile.html#security',
  referrals: '/app/referrals.html',
  deposit: '/app/deposit.html',
  engage: '/app/engage.html',
  analytics: '/app/analytics.html',
  loanInfo: 'https://subhub.ng/loan.html'
};

const EP = {
  me: '/auth/me',
  refresh: '/auth/refresh-token',
  verifyEmail: '/auth/verify-email',
  resendEmail: '/auth/resend-verification',

  transactions: '/transactions',                       // ASSUMED, confirm

  dataPlans: (net) => '/data/plans/' + net,
  dataBuy: '/data/buy',
  airtimeBuy: '/airtime/buy',
  cablePlans: (p) => '/cable/plans/' + p,
  cableVerify: '/cable/verify',
  cableBuy: '/cable/buy',
  elecPlans: '/electricity/plans',
  elecVerify: '/electricity/verify',
  elecBuy: '/electricity/buy',
  examPlans: '/exam/plans',                            // ASSUMED, confirm
  examBuy: '/exam/buy',                                // ASSUMED, confirm
  epinPlans: '/epin/plans',
  epinBuy: '/epin/buy',
  smsSend: '/sms/send',                                // ASSUMED, confirm

  transferLookup: '/transfer/lookup',
  transfer: '/transfer',

  notifications: '/notifications',                     // NEW
  notifUnread: '/notifications/unread-count',          // NEW
  notifReadAll: '/notifications/read-all',             // NEW
  content: '/content/dashboard',                       // NEW
  loan: '/loan/eligibility'                            // NEW
};

/* ----------------------------------------------------------------------------
   VIRTUAL ACCOUNT PROVIDERS
   To ADD a provider: copy a block, set id / name / endpoint / banks.
   To REMOVE one: set active:false (its card is not built).
   One provider can have many banks and every bank gets its own card.

     endpoint     exact POST route that creates the account
     aliases      names the backend stores in user.virtualAccounts[].provider
     banks[].id   sent to the backend as  { bank: id }
     match        text found in user.virtualAccounts[].bankName (to find the card's account)
     requiresId   true  -> the user must enter BVN or NIN first
                          body becomes { bank, idType:'BVN'|'NIN', idNumber:'11 digits' }
     idTypes      which ID types the user can pick
     benefits     "why we need it" lines shown on the identity screen
     body         optional extra fixed fields merged into the request body
---------------------------------------------------------------------------- */
const VA_PROVIDERS = [
  { id: 'paymentpoint', name: 'PaymentPoint', active: true,
    endpoint: '/wallet/virtual-account/paymentpoint',
    aliases: ['paymentpoint', 'payment-point', 'pp'],
    banks: [
      { id: 'palmpay', bank: 'PalmPay', match: 'palmpay', color: '#7c3aed', fee: '',
        requiresId: true, idTypes: ['BVN', 'NIN'], active: true,
        benefits: ['Your own account number to fund your wallet', 'Funds reach your wallet automatically', 'Required by the bank to keep your account safe'] }
    ] },
  { id: 'xixapay', name: 'Xixapay', active: true,
    endpoint: '/wallet/virtual-account/xixa',
    aliases: ['xixa', 'xixapay'],
    banks: [
      { id: 'kolomoni', bank: 'Kolomoni MFB', match: 'kolomoni', color: '#0d9488', fee: '',
        requiresId: false, idTypes: [], active: true,
        benefits: ['No ID needed', 'Quick setup', 'Great for small top-ups'] },
      { id: 'palmpay', bank: 'PalmPay', match: 'palmpay', color: '#6d28d9', fee: '',
        requiresId: true, idTypes: ['BVN', 'NIN'], active: false,
        benefits: ['Instant credit', 'Required by the bank to keep your account safe'] }
    ] },
  { id: 'flutterwave', name: 'Flutterwave', active: false,
    endpoint: null,                                    // no backend route yet
    aliases: ['flutterwave', 'flw'],
    banks: [
      { id: 'flutterwave', bank: 'Flutterwave', match: 'flutterwave', color: '#f97316', fee: '',
        requiresId: true, idTypes: ['BVN', 'NIN'], active: true,
        benefits: ['Reliable bank transfers', 'Instant wallet funding'] }
    ] }
];

/* Networks. Logos: /mtn.png /airtel.png /glo.png /9mobile.png */
const NETWORKS = [
  { id: 'MTN',     name: 'MTN',     api: 'MTN',     color: '#FFC403', fg: '#111111', logo: '/assets/images/mtn.png' },
  { id: 'Airtel',  name: 'Airtel',  api: 'AIRTEL',  color: '#E30613', fg: '#ffffff', logo: '/assets/images/airtel.png' },
  { id: 'Glo',     name: 'Glo',     api: 'GLO',     color: '#00A651', fg: '#ffffff', logo: '/assets/images/glo.png' },
  { id: '9Mobile', name: '9Mobile', api: '9MOBILE', color: '#006F51', fg: '#ffffff', logo: '/assets/images/9mobile.png' }
];
/* Cable providers. Logos: /dstv.png /gotv.png /startimes.png */
const CABLES = [
  { id: 'dstv',      name: 'DStv',      api: 'DSTV',      short: 'DSTV', color: '#003087', fg: '#ffffff', logo: '/assets/images/cables/dstv.png' },
  { id: 'gotv',      name: 'GOtv',      api: 'GOTV',      short: 'GOTV', color: '#00a651', fg: '#ffffff', logo: '/assets/images/cables/gotv.png' },
  { id: 'startimes', name: 'StarTimes', api: 'STARTIMES', short: 'STAR', color: '#cc0000', fg: '#ffffff', logo: '/assets/images/cables/startimes.png' }
];
/* DISCO logo files: first  /<discoCode lowercase>.png  then  /<first word of discoName lowercase>.png  */
const DISCO_COLORS = { ikeja: '#e11d48', eko: '#0284c7', kano: '#16a34a', port: '#7c3aed', phed: '#7c3aed', jos: '#f59e0b',
  ibadan: '#2563eb', kaduna: '#0d9488', abuja: '#dc2626', enugu: '#9333ea', yola: '#ea580c', benin: '#0891b2', aba: '#65a30d' };

const AIRTIME_MIN = 50;
const AIRTIME_MAX = 50000;
const SMS_RATE = 100;

/* ============================================================================
   2. SMALL HELPERS
============================================================================ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const isNum = (v) => typeof v === 'number' && isFinite(v);
const naira = (n) => '\u20A6' + num(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const naira0 = (n) => '\u20A6' + num(n).toLocaleString('en-NG');
const DOT = ' \u2022 ';
const ARROW = ' \u2192 ';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fmtClock = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\u202f/g, ' ');
const fmtDate = (ts) => { const d = new Date(ts); if (isNaN(d)) return ''; return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + fmtClock(d); };
const fmtRel = (ts) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (isNaN(s)) return '';
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return fmtDate(ts);
};
const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  setRaw(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
const goLogin = () => { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} window.location.replace(LOGIN_URL); };
const go = (url) => { window.location.href = url; };
const isApp = () => !!window.AndroidAuth;
const sourceTag = () => (isApp() ? 'app' : 'web');

/* phones */
function normalizePhone(raw) {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.slice(0, 3) === '234' && d.length >= 13) { d = d.slice(3); if (d[0] !== '0') d = '0' + d; }
  else if (d.length === 10 && /^[789]/.test(d)) d = '0' + d;
  return d;
}
const digitsOnly = (v, max) => String(v || '').replace(/\D/g, '').slice(0, max || 20);
const validPhone = (p) => /^0[789][01]\d{8}$/.test(String(p || '').trim());
const validLocal11 = (p) => /^0\d{10}$/.test(String(p || '').trim());
const isExamplePhone = (p) => String(p || '').trim() === EXAMPLE_PHONE;
/* What the user types or pastes into a phone box: removes spaces, dashes and +, turns
   234803... and +234 803... into 0803..., adds a missing 0 and keeps at most 11 digits. */
function cleanPhoneInput(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.slice(0, 3) === '234') { d = d.slice(3); if (d[0] !== '0') d = '0' + d; }
  else if (/^[789]/.test(d)) d = '0' + d;
  return d.slice(0, 11);
}
function bindPhoneInput(id, after) {
  const el = document.getElementById(id); if (!el) return;
  el.removeAttribute('maxlength');            // a pasted +234... is longer than 11 characters, we cut it to 11 ourselves
  el.addEventListener('input', e => {
    const v = cleanPhoneInput(e.target.value);
    if (v !== e.target.value) e.target.value = v;
    if (after) after(e);
  });
}
const PREFIX = { '0803': 'MTN', '0806': 'MTN', '0703': 'MTN', '0706': 'MTN', '0813': 'MTN', '0816': 'MTN', '0810': 'MTN', '0814': 'MTN', '0903': 'MTN', '0906': 'MTN', '0913': 'MTN', '0916': 'MTN', '0704': 'MTN', '07025': 'MTN', '07026': 'MTN',
  '0707': 'MTN',
  '0802': 'Airtel', '0808': 'Airtel', '0708': 'Airtel', '0812': 'Airtel', '0701': 'Airtel', '0902': 'Airtel', '0901': 'Airtel', '0907': 'Airtel', '0912': 'Airtel',
    '0911': 'Airtel', '0904': 'Airtel',
  '0805': 'Glo', '0807': 'Glo', '0705': 'Glo', '0815': 'Glo', '0811': 'Glo', '0905': 'Glo', '0915': 'Glo',
  '0809': '9Mobile', '0817': '9Mobile', '0818': '9Mobile', '0908': '9Mobile', '0909': '9Mobile', '0702': 'Smile', '0804': 'M-Tel', '0801': 'MAFAB' };
function detectNetwork(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  if (p.length < 4) return null;
  return PREFIX[p.slice(0, 5)] || PREFIX[p.slice(0, 4)] || null;
}
function netOf(v) {
  if (!v) return null;
  const k = String(v).toUpperCase();
  return NETWORKS.find(n => n.id.toUpperCase() === k || n.api === k || n.name.toUpperCase() === k) || null;
}

/* ============================================================================
   3. NATIVE BRIDGES  (Android WebView, see README)
============================================================================ */
/* 3.1 vibration + sound */
const lastFb = {};
function feedback(type) {
  const now = Date.now();
  if (lastFb[type] && now - lastFb[type] < 80) return;
  lastFb[type] = now;
  try {
    if (window.AndroidFeedback && window.AndroidFeedback.play) { window.AndroidFeedback.play(type); return; }
    if (navigator.vibrate) navigator.vibrate(type === 'error' ? [90, 50, 90, 50, 200] : type === 'success' ? [35, 60, 35] : type === 'notification' ? [60, 80, 60] : 15);
  } catch (e) {}
}

/* 3.2 clipboard.  Native needs the AndroidClipboard bridge (see BACKEND_NEEDS.md, "Native app") */
function copyText(text, msg) {
  text = String(text == null ? '' : text);
  let ok = false;
  try { if (window.AndroidClipboard && window.AndroidClipboard.setText) { window.AndroidClipboard.setText(text); ok = true; } } catch (e) {}
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px';
      document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { ok = false; }
  }
  if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('green', 'Copied', msg || 'Copied to clipboard'), () => window.prompt('Copy this:', text));
    return true;
  }
  if (ok) toast('green', 'Copied', msg || 'Copied to clipboard'); else window.prompt('Copy this:', text);
  return ok;
}
function readClipboard() {
  return new Promise(resolve => {
    if (window.AndroidClipboard && typeof window.AndroidClipboard.getText === 'function') {
      const id = 'clip_' + Date.now();
      const prev = window.__subhubClipboardCallback;
      let done = false, timer;
      const finish = (t) => { if (done) return; done = true; clearTimeout(timer); window.__subhubClipboardCallback = prev; resolve(t == null ? null : String(t)); };
      timer = setTimeout(() => finish(null), 1500);
      window.__subhubClipboardCallback = function (cb, text) { if (cb === id) finish(text); else if (typeof prev === 'function') prev(cb, text); };
      try { window.AndroidClipboard.getText(id); } catch (e) { finish(null); }
      return;
    }
    if (navigator.clipboard && navigator.clipboard.readText) { navigator.clipboard.readText().then(t => resolve(t), () => resolve(null)); return; }
    resolve(null);
  });
}

/* 3.3 fingerprint */
function bioAvailable() { try { return !!(window.AndroidAuth && window.AndroidAuth.isBiometricAvailable && window.AndroidAuth.isBiometricAvailable()); } catch (e) { return false; } }
/* Why fingerprint can or cannot be used: ok | none-enrolled | no-hardware | hw-unavailable | weak-only | unsupported | no-bridge.
   Older app builds have no biometricStatus(), so we fall back to the yes/no answer. */
function bioStatus() {
  try {
    if (!window.AndroidAuth) return 'no-bridge';
    if (typeof window.AndroidAuth.biometricStatus === 'function') return String(window.AndroidAuth.biometricStatus() || 'unsupported');
    return bioAvailable() ? 'ok' : 'unsupported';
  } catch (e) { return 'unsupported'; }
}
const BIO_MSG = {
  'no-bridge': 'Fingerprint payment works in the SubHub Android app.',
  'none-enrolled': 'No fingerprint is saved on this phone yet. Add one in your phone settings, then try again.',
  'no-hardware': "This phone doesn't support fingerprint.",
  'hw-unavailable': 'Fingerprint is not available right now. Please try again in a moment.',
  'weak-only': "This phone's fingerprint sensor can't be used to protect payments, so fingerprint payment isn't supported on this phone.",
  'unsupported': "This phone doesn't support fingerprint payment."
};
function bioHas(slot) { try { return !!(window.AndroidAuth && window.AndroidAuth.hasBiometricCredential && window.AndroidAuth.hasBiometricCredential(slot)); } catch (e) { return false; } }
/* Turn fingerprint on for a slot. Resolves { success, reason }. */
function bioEnable(slot, secret, title, subtitle) {
  return new Promise(resolve => {
    const A = window.AndroidAuth;
    if (!A) return resolve({ success: false, reason: 'no-bridge' });
    if (typeof A.enableBiometricCredentialCb !== 'function') {        // older app build: no answer comes back, so look again after a moment
      try { A.enableBiometricCredential(slot, secret, title, subtitle); } catch (e) { return resolve({ success: false, reason: 'error' }); }
      setTimeout(() => resolve({ success: bioHas(slot), reason: 'legacy' }), 2500);
      return;
    }
    const id = 'en_' + Date.now() + Math.random().toString(36).slice(2, 6);
    const prev = window.__subhubEnableCallback;
    let done = false, timer;
    const finish = (res) => { if (done) return; done = true; clearTimeout(timer); window.__subhubEnableCallback = prev; resolve(res); };
    timer = setTimeout(() => finish({ success: false, reason: 'timeout' }), 60000);
    window.__subhubEnableCallback = function (cbId, success, reason) {
      if (cbId === id) finish({ success: success === true || success === 'true', reason: reason });
      else if (typeof prev === 'function') prev(cbId, success, reason);
    };
    try { A.enableBiometricCredentialCb(slot, secret, title, subtitle, id); } catch (e) { finish({ success: false, reason: 'error' }); }
  });
}
function bioGet(slot, title, subtitle) {
  return new Promise(resolve => {
    const id = 'cred_' + Date.now() + Math.random().toString(36).slice(2, 6);
    const prev = window.__subhubCredentialCallback;
    let done = false, timer;
    const finish = (res) => { if (done) return; done = true; clearTimeout(timer); window.__subhubCredentialCallback = prev; resolve(res); };
    timer = setTimeout(() => finish({ success: false, reason: 'timeout' }), 60000);
    window.__subhubCredentialCallback = function (cbId, success, credential, reason) {
      if (cbId === id) finish({ success: success === true || success === 'true', credential: credential, reason: reason });
      else if (typeof prev === 'function') prev(cbId, success, credential, reason);
    };
    try { window.AndroidAuth.getBiometricCredential(slot, id, title, subtitle); } catch (e) { finish({ success: false, reason: 'error' }); }
  });
}

/* 3.4 phone contacts (read on the phone only, never sent anywhere) */
function getDeviceContacts() {
  return new Promise(resolve => {
    if (!window.AndroidContacts) return resolve({ success: false, contacts: [], noBridge: true });
    const id = 'contacts_' + Date.now();
    const prev = window.__subhubContactsCallback;
    let done = false, timer;
    const finish = (res) => { if (done) return; done = true; clearTimeout(timer); window.__subhubContactsCallback = prev; resolve(res); };
    timer = setTimeout(() => finish({ success: false, contacts: [], timeout: true }), 45000);
    window.__subhubContactsCallback = function (cbId, success, list) {
      if (cbId === id) {
        let arr = list;
        if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } }
        finish({ success: success === true || success === 'true', contacts: Array.isArray(arr) ? arr : [] });
      } else if (typeof prev === 'function') prev(cbId, success, list);
    };
    try { window.AndroidContacts.getContacts(id); } catch (e) { finish({ success: false, contacts: [] }); }
  });
}

/* ============================================================================
   4. UI PRIMITIVES
============================================================================ */
/* toast */
function toast(kind, title, msg, duration) {
  const c = $('#toastContainer'); if (!c) return;
  duration = duration || 3600;
  const icons = { green: 'fa-check', red: 'fa-xmark', blue: 'fa-info', warn: 'fa-triangle-exclamation' };
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.innerHTML = '<div class="toast-ico ' + kind + '"><i class="fas ' + (icons[kind] || 'fa-info') + '"></i></div>' +
    '<div class="toast-body"><div class="toast-title">' + esc(title) + '</div>' + (msg ? '<div class="toast-msg">' + esc(msg) + '</div>' : '') + '</div>' +
    '<button class="toast-close"><i class="fas fa-times"></i></button>' +
    '<div class="toast-progress ' + kind + '" style="width:100%"></div>';
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const prog = el.querySelector('.toast-progress');
  prog.style.transitionDuration = duration + 'ms';
  requestAnimationFrame(() => { prog.style.width = '0%'; });
  const close = () => { el.classList.add('hide'); setTimeout(() => el.remove(), 320); };
  el.querySelector('.toast-close').onclick = close;
  setTimeout(close, duration);
  if (kind === 'green') feedback('success'); else if (kind === 'red' || kind === 'warn') feedback('error');
}

/* modal manager. Every open overlay is remembered so the Android back button closes the top one. */
const Modal = {
  stack: [], hooks: {},
  open(id, center) {
    const el = document.getElementById(id); if (!el) return;
    el.classList.add('show');
    if (center) el.classList.add('center');
    const i = this.stack.indexOf(id); if (i > -1) this.stack.splice(i, 1);
    this.stack.push(id);
    document.body.style.overflow = 'hidden';
  },
  close(id) {
    const el = document.getElementById(id); if (!el) return;
    const wasOpen = el.classList.contains('show');
    el.classList.remove('show');
    const i = this.stack.indexOf(id); if (i > -1) this.stack.splice(i, 1);
    if (!this.stack.length) document.body.style.overflow = '';
    if (wasOpen && this.hooks[id]) this.hooks[id]();
  }
};
function showProc(title, sub) {
  $('#procTitle').textContent = title || 'Processing...';
  const s = $('#procSub'); s.textContent = sub || ''; s.style.display = sub ? '' : 'none';
  let w = $('#procWait');
  if (!w) { w = document.createElement('div'); w.id = 'procWait'; w.className = 'proc-wait'; s.insertAdjacentElement('afterend', w); }
  w.textContent = 'Please wait...';
  w.style.display = /wait/i.test(title || '') ? 'none' : '';
  $('#procOv').classList.add('show');
}
function hideProc() { $('#procOv').classList.remove('show'); }
const procOpen = () => $('#procOv').classList.contains('show');

/* alert dialog. opts: icon(ok|err|info|warn) title message okLabel cancelLabel onOk onCancel */
function showAlert(o) {
  o = o || {};
  const icon = o.icon || 'info';
  const icons = { ok: 'fa-check', err: 'fa-xmark', info: 'fa-info', warn: 'fa-triangle-exclamation' };
  $('#alertBody').innerHTML = '<div class="alert-ico ' + icon + '"><i class="fas ' + (icons[icon] || 'fa-info') + '"></i></div>' +
    '<div class="alert-ttl">' + esc(o.title || '') + '</div><div class="alert-msg">' + esc(o.message || '') + '</div>';
  const btns = $('#alertBtns');
  if (o.cancelLabel) {
    btns.className = 'alert-btns';
    btns.innerHTML = '<button class="btn-cancel" id="alertCancelBtn">' + esc(o.cancelLabel) + '</button><button class="btn-confirm" id="alertOkBtn">' + esc(o.okLabel || 'OK') + '</button>';
    $('#alertOkBtn').onclick = () => { Modal.close('alertModal'); if (o.onOk) o.onOk(); };
    $('#alertCancelBtn').onclick = () => { Modal.close('alertModal'); if (o.onCancel) o.onCancel(); };
  } else {
    btns.className = 'alert-btns single';
    btns.innerHTML = '<button class="btn-p" id="alertOkBtn" style="margin-top:0"><span>' + esc(o.okLabel || 'OK') + '</span></button>';
    $('#alertOkBtn').onclick = () => { Modal.close('alertModal'); if (o.onOk) o.onOk(); };
  }
  Modal.open('alertModal');
  if (icon === 'err') feedback('error'); else if (icon === 'ok') feedback('success');
}
function setBtnLoading(btn, text) {
  if (!btn || btn.dataset.orig !== undefined) return;
  btn.dataset.orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>' + esc(text || 'Please wait') + '</span>';
  btn.disabled = true;
}
function resetBtn(btn) {
  if (!btn || btn.dataset.orig === undefined) return;
  btn.innerHTML = btn.dataset.orig; btn.disabled = false; delete btn.dataset.orig;
}
function fieldErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('on'); }
  toast('warn', 'Check your details', msg);
}
function clearErr(id) { const el = document.getElementById(id); if (el) el.classList.remove('on'); }
function skeleton(el, n) {
  el.innerHTML = Array.from({ length: n || 4 }).map(() =>
    '<div class="skel-card"><div class="skeleton skel-ico"></div><div class="skel-info"><div class="skeleton skel-line"></div><div class="skeleton skel-line sm"></div></div><div class="skeleton skel-price"></div></div>').join('');
}
const emptyHTML = (icon, msg, retryId) =>
  '<div class="empty"><i class="fas ' + icon + '"></i><p>' + esc(msg) + '</p>' +
  (retryId ? '<button class="btn-sec" id="' + retryId + '" style="width:auto;margin:10px auto 0;padding:9px 20px"><i class="fas fa-rotate-right"></i><span>Try again</span></button>' : '') + '</div>';

/* ---------- images: /placeholder.png first, real image replaces it when loaded ---------- */
/* Image files that loaded once are remembered on the phone, so logos and avatars show at once
   on the next visit instead of flashing the placeholder first. */
const IMG_TTL = 2 * 86400000;
const imgMem = (function () { const m = store.get(IMG_KEY, {}); return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {}; })();
const imgKnown = (u) => { const t = imgMem[u]; return !!(t && Date.now() - t < IMG_TTL); };
let imgSaveT = null;
function imgRemember(u, ok) {
  if (ok) imgMem[u] = Date.now(); else delete imgMem[u];
  clearTimeout(imgSaveT); imgSaveT = setTimeout(() => store.set(IMG_KEY, imgMem), 800);
}
function imgBox(cls, sources, fb) {
  const list = [].concat(sources || []).filter(Boolean);
  const meta = ' data-srcs="' + esc(list.join('|')) + '"' +
    (fb ? ' data-fb="' + esc(fb.text || '') + '" data-fbbg="' + esc(fb.bg || '') + '" data-fbfg="' + esc(fb.fg || '') + '"' : '');
  for (const u of list) {
    if (imgKnown(u)) return '<span class="imgbox loaded ' + (cls || '') + '" data-h="1"' + meta + '><img src="' + esc(u) + '" alt=""/></span>';
  }
  return '<span class="imgbox ' + (cls || '') + '"' + meta + '><img src="' + PLACEHOLDER + '" alt=""/></span>';
}
const imgCache = new Map();
function probeImage(url) {
  if (!imgCache.has(url)) imgCache.set(url, new Promise(res => { const i = new Image(); i.onload = () => { imgRemember(url, true); res(true); }; i.onerror = () => res(false); i.src = url; }));
  return imgCache.get(url);
}
async function hydrateBox(el) {
  if (el.dataset.h) return;
  el.dataset.h = '1';
  const srcs = (el.dataset.srcs || '').split('|').filter(Boolean);
  for (const u of srcs) {
    if (await probeImage(u)) { const im = el.querySelector('img'); if (im) im.src = u; el.classList.add('loaded'); return; }
  }
  if (el.dataset.fb) {                                    // the file does not exist: text fallback
    el.classList.add('fb');
    if (el.dataset.fbbg) el.style.background = el.dataset.fbbg;
    if (el.dataset.fbfg) el.style.color = el.dataset.fbfg;
    el.innerHTML = '<span class="imgbox-t">' + esc(el.dataset.fb) + '</span>';
  }
}
let hydrateQueued = false;
function hydrateImages() { $$('.imgbox:not([data-h])').forEach(hydrateBox); }
function watchImages() {
  document.addEventListener('error', e => {        // a remembered image that no longer loads: check it again
    const im = e.target;
    if (!im || im.tagName !== 'IMG') return;
    const box = im.closest ? im.closest('.imgbox.loaded[data-h]') : null;
    const src = im.getAttribute('src');
    if (!box || !src || src === PLACEHOLDER) return;
    imgRemember(src, false); imgCache.delete(src);
    im.src = PLACEHOLDER; box.classList.remove('loaded'); box.removeAttribute('data-h');
    hydrateImages();
  }, true);
  new MutationObserver(() => {
    if (hydrateQueued) return;
    hydrateQueued = true;
    requestAnimationFrame(() => { hydrateQueued = false; hydrateImages(); });
  }).observe(document.body, { childList: true, subtree: true });
  hydrateImages();
}
const avatarBox = (pic, name, cls) => imgBox(cls || '', [pic, DEFAULT_AVATAR], { text: initials(name).slice(0, 2), bg: '#00aaff', fg: '#ffffff' });
const netLogo = (n, cls) => imgBox(cls, n.logo, { text: n.name.slice(0, 3).toUpperCase(), bg: n.color, fg: n.fg });

/* ============================================================================
   5. API  (tokens, refresh, session expiry)  -  unit tested
============================================================================ */
/*API-START*/
function timedFetch(url, init, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, Object.assign({}, init, { signal: ctl.signal })).finally(() => clearTimeout(t));
}

let sessionEnded = false;
function endSession(title, message) {
  if (sessionEnded) return;
  sessionEnded = true;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
  toast('red', title || 'Session Expired', message || 'Please login again');
  setTimeout(goLogin, 2500);
}

// Only ONE refresh runs at a time. Other requests wait for the same result.
let refreshing = null;
function refreshAccess() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return { ok: false, expired: true };
    try {
      const res = await timedFetch(API_BASE + EP.refresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt })
      }, 20000);
      let data = {};
      try { data = await res.json(); } catch (e) {}
      if (res.ok && data.success && data.accessToken) {
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        if (data.refreshToken) { localStorage.setItem(REFRESH_KEY, data.refreshToken); retagCache(); }
        if (data.user) onUserFromRefresh(data.user);
        return { ok: true };
      }
      if (res.status === 401 || data.code === 'REFRESH_TOKEN_EXPIRED' || data.code === 'INVALID_TOKEN') {
        return { ok: false, expired: true };
      }
      return { ok: false, expired: false };        // server error: do NOT log the user out
    } catch (e) {
      return { ok: false, expired: false };        // no connection: do NOT log the user out
    }
  })();
  const clear = () => { refreshing = null; };
  refreshing.then(clear, clear);
  return refreshing;
}

const netFail = (e) => ({
  ok: false, status: 0, network: true, timeout: !!(e && e.name === 'AbortError'),
  data: { success: false, message: 'Connection problem. Please check your internet and try again.' }
});

async function api(path, opts) {
  opts = opts || {};
  const method = opts.method || 'GET';
  const timeout = opts.timeout || 30000;
  const useAuth = opts.auth !== false;

  const send = async () => {
    const headers = { 'Accept': 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const t = localStorage.getItem(TOKEN_KEY);
    if (useAuth && t) headers['Authorization'] = 'Bearer ' + t;
    const res = await timedFetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    }, timeout);
    let data = {};
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data: data || {} };
  };

  let r;
  try { r = await send(); } catch (e) { return netFail(e); }

  if (useAuth && r.status === 401) {
    const code = r.data && r.data.code;
    if (code === 'ACCOUNT_SUSPENDED') {
      endSession('Account suspended', r.data.message || 'Your account has been suspended, contact support');
      return r;
    }
    if (code === 'ACCESS_TOKEN_EXPIRED' || code === 'INVALID_TOKEN') {
      const rf = await refreshAccess();
      if (rf.ok) {
        try { r = await send(); } catch (e) { return netFail(e); }
        const c2 = r.data && r.data.code;
        if (r.status === 401 && (c2 === 'ACCESS_TOKEN_EXPIRED' || c2 === 'INVALID_TOKEN')) { endSession(); }
      } else if (rf.expired) {
        endSession();
      } else {
        return netFail();                         // could not refresh right now, keep the session
      }
    }
    // any other 401 (wrong PIN, etc.) is returned to the caller untouched
  }
  return r;
}
/*API-END*/

/* ============================================================================
   6. STATE
============================================================================ */
const S = {
  user: null,
  wallet: { balance: 0, totalFunded: 0, totalSpent: 0, isLocked: false },
  txns: [],
  notifs: [], unread: 0,
  content: { banner: null, notices: {}, popups: [], slides: [] },
  recents: [],
  balHidden: store.raw('sh_bal_hidden') === '1',
  busy: false,
  lastMe: 0,
  offerPin: null,
  autoBio: false,
  balFresh: false,           // false while the balance on screen is the one saved on the phone
  balNote: '',
  checking: false,
  balKnown: false            // true once a balance (saved or fresh) can be shown; before that no 0.00 is shown
};
function onUserFromRefresh(u) { if (S.user && u) Object.assign(S.user, u); }

/* ----- local cache: the last known account data is shown at once, the API then updates it.
   It is tied to the login (the tail of the refresh token), so another user never sees it. ----- */
const CACHE_USER_FIELDS = ['fullName', 'email', 'phone', 'username', 'profilePicture', 'accountType', 'isVerified', 'transactionPinSet', 'virtualAccounts', 'totalDataPurchasedMB'];
/* The cache belongs to one user: tagged with the user id inside the access token (it does not change when the token is
   renewed). Fingerprint sign-in keeps no refresh token on the page, so the refresh token alone cannot be the tag. */
function jwtUserId(t) {
  try {
    const p = JSON.parse(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(p.id || p._id || p.userId || p.sub || '');
  } catch (e) { return ''; }
}
const sessionTag = () => jwtUserId(localStorage.getItem(TOKEN_KEY)) || String(localStorage.getItem(REFRESH_KEY) || '').slice(-24);
function saveCache() {
  if (!S.user) return;
  const u = {};
  CACHE_USER_FIELDS.forEach(k => { if (S.user[k] !== undefined) u[k] = S.user[k]; });
  store.set(CACHE_KEY, {
    t: Date.now(), tag: sessionTag(), user: u,
    wallet: { balance: S.wallet.balance, totalFunded: S.wallet.totalFunded, totalSpent: S.wallet.totalSpent },
    txns: S.txns.slice(0, 6)
  });
}
function retagCache() { const c = store.get(CACHE_KEY, null); if (c) { c.tag = sessionTag(); store.set(CACHE_KEY, c); } }
function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }
function loadCache() {
  const c = store.get(CACHE_KEY, null);
  if (!c || !c.user || c.tag !== sessionTag()) { if (c) clearCache(); return false; }
  S.user = c.user;
  S.wallet = Object.assign({}, S.wallet, c.wallet || {});
  S.txns = Array.isArray(c.txns) ? c.txns : [];
  S.balFresh = false; S.balKnown = true;
  return true;
}
const planCache = {};
const fresh = (k) => planCache[k] && Date.now() - planCache[k].t < 5 * 60 * 1000 ? planCache[k].v : null;

/* ============================================================================
   7. ACCOUNT, WALLET, VIRTUAL ACCOUNTS
============================================================================ */
async function loadMe(quiet) {
  const r = await api(EP.me);
  if (!r.ok || !r.data.success) {
    if (!quiet) toast('warn', r.network ? 'No connection' : 'Account', r.network ? 'Could not reach SubHub. Check your internet.' : (r.data.message || 'Could not load your account'));
    if (!S.balFresh) { S.balNote = 'Last saved balance'; renderWallet(); }
    return false;
  }
  S.user = r.data.user;
  S.wallet = Object.assign({}, S.wallet, r.data.wallet || {});
  S.lastMe = Date.now();
  S.balFresh = true; S.balKnown = true; S.balNote = '';
  renderAccount();
  saveCache();
  return true;
}
function setBalance(n) { if (isNum(n)) { S.wallet.balance = n; S.balFresh = true; S.balKnown = true; S.balNote = ''; renderWallet(); saveCache(); } }

function renderAccount() {
  const u = S.user; if (!u) return;
  $('#userName').textContent = String(u.fullName || 'User').split(' ')[0];
  const avk = String(u.profilePicture || '') + '|' + String(u.fullName || '');
  if (renderAccount._av !== avk) { renderAccount._av = avk; $('#avBtn').innerHTML = avatarBox(u.profilePicture, u.fullName, 'fill'); }
  $('#ddName').textContent = u.fullName || '';
  $('#ddPhone').textContent = u.phone || u.email || '';
  renderRank(); renderWallet(); renderStats(); renderEmailBanner();
}

const RANKS = {
  bronze:   { label: 'Bronze',   color: '#b45309', bg: 'rgba(205,127,50,.16)',  icon: 'fa-medal' },
  silver:   { label: 'Silver',   color: '#64748b', bg: 'rgba(148,163,184,.22)', icon: 'fa-medal' },
  gold:     { label: 'Gold',     color: '#d97706', bg: 'rgba(245,158,11,.18)',  icon: 'fa-medal' },
  platinum: { label: 'Platinum', color: '#6366f1', bg: 'rgba(99,102,241,.15)',  icon: 'fa-crown' }
};
function renderRank() {
  const r = RANKS[String((S.user && S.user.accountType) || 'bronze').toLowerCase()] || RANKS.bronze;
  const el = $('#rankBadge');
  el.style.color = r.color; el.style.background = r.bg;
  el.innerHTML = '<i class="fas ' + r.icon + '"></i>' + r.label + ' Account';
}
function renderStats() {
  $('#statSpent').textContent = num(S.wallet.totalSpent).toLocaleString('en-NG');
  $('#statFunds').textContent = num(S.wallet.totalFunded).toLocaleString('en-NG');
  $('#statGB').textContent = Number((num(S.user && S.user.totalDataPurchasedMB) / 1024).toFixed(2));
}
/*function renderReferral() {
  const code = (S.user && S.user.username) || '';
  $('#refLinkInput').value = code;
  $('#refLinkBtn').onclick = () => {
    if (!code) return;
    copyText(code, 'Referral code copied');
    const b = $('#refLinkBtn');
    b.classList.add('copied'); $('#refCopyIco').className = 'fas fa-check'; $('#refCopyTxt').textContent = 'Copied';
    setTimeout(() => { b.classList.remove('copied'); $('#refCopyIco').className = 'fas fa-copy'; $('#refCopyTxt').textContent = 'Copy'; }, 1800);
  };
}*/
function updateGreeting() {
  const now = new Date(), h = now.getHours();
  const greet = h < 12 ? 'Good morning!' : h < 17 ? 'Good afternoon!' : 'Good evening!';
  $('#greetMsg').innerHTML = esc(greet) + '<span class="greet-s">Explore all our services</span>';
  $('#wDate').textContent = now.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  $('#wTime').textContent = 'Time: ' + fmtClock(now);
}

/* ----- slider helper ----- */
const SLIDE_TRANS = 'transform .3s cubic-bezier(.25,.8,.25,1)';      // fast, not slow
const WAUTO = { t: 0, timer: null };                                  // t = last time the user touched the slider
/* Drag slider: the cards follow the finger, then snap to the nearest card.
   Vertical scrolling is left alone; only a mostly horizontal drag moves the cards. */
function attachSwipe(el, track, kind, countFn) {
  if (!el || !track || el.dataset.swipe) return;
  el.dataset.swipe = '1';
  el.style.touchAction = 'pan-y';
  let x0 = 0, y0 = 0, t0 = 0, dx = 0, drag = false, lock = null;
  el.addEventListener('touchstart', e => {
    const t = e.touches[0];
    WAUTO.t = Date.now(); x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); dx = 0; lock = null; drag = true;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!drag) return;
    const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (!lock) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (lock === 'x') track.style.transition = 'none';
    }
    if (lock !== 'x') return;
    dx = mx;
    track.style.transform = 'translateX(calc(-' + (Sl[kind] * 100) + '% + ' + dx + 'px))';
  }, { passive: true });
  const end = () => {
    if (!drag) return;
    drag = false;
    track.style.transition = SLIDE_TRANS; WAUTO.t = Date.now();
    if (lock !== 'x') return;
    const n = countFn(), w = el.offsetWidth || 300;
    const fast = Math.abs(dx) / Math.max(1, Date.now() - t0) > 0.4 && Math.abs(dx) > 20;
    let i = Sl[kind];
    if (Math.abs(dx) > w * 0.2 || fast) i = Math.max(0, Math.min(n - 1, i + (dx < 0 ? 1 : -1)));
    slideTo(kind, i, n);
  };
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('touchcancel', end, { passive: true });
}
const Sl = { wallet: 0, fund: 0 };
function slideTo(kind, i, count) {
  const sel = kind === 'wallet' ? { t: '#walletTrack', d: '#walletDots' } : { t: '#fundVATrack', d: '#fundVADots' };
  if (!count) return;
  i = ((i % count) + count) % count; Sl[kind] = i;
  const t = $(sel.t); if (t) t.style.transform = 'translateX(-' + (i * 100) + '%)';
  $$(sel.d + ' .wd').forEach((d, k) => d.classList.toggle('on', k === i));
}

/* ----- virtual account cards ----- */
const vaKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function matchAcc(a, p, b) {
  const prov = vaKey(a.provider);
  const okProv = vaKey(p.id) === prov || (p.aliases || []).some(x => vaKey(x) === prov);
  if (!okProv) return false;
  if (p.banks.filter(x => x.active !== false).length <= 1) return true;
  return vaKey(a.bankName).indexOf(vaKey(b.match || b.bank)) !== -1;
}
function buildVaCards() {
  const accs = ((S.user && S.user.virtualAccounts) || []).filter(a => a && a.accountNumber);
  const used = new Set(), have = [], missing = [];
  VA_PROVIDERS.forEach(p => {
    if (!p.active) return;
    p.banks.forEach(b => {
      if (b.active === false) return;
      const idx = accs.findIndex((a, i) => !used.has(i) && matchAcc(a, p, b));
      const acc = idx > -1 ? accs[idx] : null;
      if (idx > -1) used.add(idx);
      const card = { key: p.id + ':' + b.id, provider: p, bank: b, bankName: b.bank, color: b.color, fee: (acc && acc.fee) || b.fee || '', acc: acc };
      (acc ? have : missing).push(card);
    });
  });
  accs.forEach((a, i) => {                       // accounts we have no card config for are still shown
    if (used.has(i)) return;
    have.push({ key: 'acc:' + i, provider: null, bank: null, bankName: a.bankName || a.provider || 'Bank', color: '#0ea5e9', fee: a.fee || '', acc: a });
  });
  have.sort((x, y) => (y.acc.isDefault ? 1 : 0) - (x.acc.isDefault ? 1 : 0) || num(y.acc.priority) - num(x.acc.priority));
  return have.concat(missing);
}
function shade(hex, p) {
  const n = parseInt(String(hex).slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = p < 0 ? 0 : 255, k = Math.abs(p);
  r = Math.round((t - r) * k + r); g = Math.round((t - g) * k + g); b = Math.round((t - b) * k + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
const vaGradient = (c) => 'linear-gradient(145deg,' + shade(c, -.55) + ' 0%,' + shade(c, -.25) + ' 55%,' + c + ' 100%)';
function vaCardHTML(card, copyAttr, genAttr) {
  const a = card.acc, has = !!(a && a.accountNumber);
  const inactive = !has || String(a.status || 'active').toLowerCase() === 'inactive';
  const top = '<div class="va-top"><div class="va-bank"><i class="fas fa-building-columns"></i>' + esc(card.bankName) + '</div>' +
    (card.fee ? '<div class="va-fee">Fee ' + esc(card.fee) + '</div>' : '') + '</div>';
  const body = has
    ? '<div class="va-body"><div class="va-acct-row"><div class="va-acct">' + esc(a.accountNumber) + '</div>' +
      '<button class="va-copy" ' + copyAttr + '="' + esc(a.accountNumber) + '" aria-label="Copy account number"><i class="fas fa-copy"></i></button></div>' +
      '<div class="va-name-row"><div class="va-name">' + esc(a.accountName || '') + '</div><span class="va-chip ' + (inactive ? 'off' : 'on') + '">' + (inactive ? 'Inactive' : 'Active') + '</span></div></div>'
    : '<div class="va-body center"><span class="va-chip off">Inactive</span>' +
      '<button class="va-gen" ' + genAttr + '="' + esc(card.key) + '"><i class="fas fa-plus"></i>Generate Account</button></div>';
  return '<div class="wallet-card" style="background:' + vaGradient(card.color) + '"><div class="wc-ring1"></div><div class="wc-ring2"></div><div class="wc-blob"></div><div class="wc-in">' + top + body + '</div></div>';
}
function bindVaButtons(root, copyAttr, genAttr) {
  $$('[' + copyAttr + ']', root).forEach(b => {
    b.onclick = () => {
      copyText(b.getAttribute(copyAttr), 'Account number copied');
      b.classList.add('copied'); b.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => { b.classList.remove('copied'); b.innerHTML = '<i class="fas fa-copy"></i>'; }, 1600);
    };
  });
  $$('[' + genAttr + ']', root).forEach(b => { b.onclick = () => generateVA(b.getAttribute(genAttr)); });
}
/* The wallet cards are built once. When only the balance, the eye or the "updated" text change,
   just those texts are updated, so the slider is never reset or rebuilt under the user's finger. */
let walletSig = '';
const vaSig = (cards) => JSON.stringify(cards.map(c => [c.key, c.bankName, c.color, c.fee, c.acc ? [c.acc.accountNumber, c.acc.accountName, c.acc.status, c.acc.isDefault] : null]));
const BAL_MASK = String.fromCharCode(8226).repeat(6);
let balShown = null, balRaf = 0;
const fmtBal = (n) => n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function walletBalText() {
  if (S.balHidden) return BAL_MASK;
  if (!S.balKnown) return '--.--';
  return fmtBal(num(balShown === null ? S.wallet.balance : balShown));
}
/* New balance arrives: the number counts from the old value to the new one (like OPay).
   It never drops to 0.00 first, and when the value is the same nothing moves. */
function paintBalance() {
  const el = $('#walletNum'); if (!el) return;
  cancelAnimationFrame(balRaf);
  const target = num(S.wallet.balance);
  if (S.balHidden || !S.balKnown) { if (S.balKnown) balShown = target; el.textContent = walletBalText(); return; }
  if (balShown === null || balShown === target || document.visibilityState !== 'visible') { balShown = target; el.textContent = fmtBal(target); return; }
  const from = balShown, t0 = performance.now(), dur = 800;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    balShown = p < 1 ? from + (target - from) * e : target;
    el.textContent = fmtBal(balShown);
    if (p < 1) balRaf = requestAnimationFrame(step);
  };
  balRaf = requestAnimationFrame(step);
}
function walletSubText() { return 'Available Balance' + DOT + (S.balFresh ? 'Updated just now' : (S.balNote || (S.balKnown ? 'Updating...' : 'Loading...'))); }
function renderWallet() {
  const cards = buildVaCards(), total = 1 + cards.length, sig = vaSig(cards);
  const numEl = $('#walletNum');
  if (sig === walletSig && numEl) {
    paintBalance();
    const sub = $('#walletSub'); if (sub) sub.textContent = walletSubText();
    const eye = $('#eyeBtn i'); if (eye) eye.className = 'fas fa-eye' + (S.balHidden ? '-slash' : '');
    return;
  }
  walletSig = sig;
  if (Sl.wallet >= total) Sl.wallet = 0;
  let html = '<div class="wallet-card wc-main"><div class="wc-ring1"></div><div class="wc-ring2"></div><div class="wc-blob"></div><div class="wc-in">' +
    '<div class="wc-top"><div class="wc-lbl"><i class="fas fa-wallet"></i> Wallet Balance</div>' +
    '<button class="wc-eye" id="eyeBtn" aria-label="Show or hide balance"><i class="fas fa-eye' + (S.balHidden ? '-slash' : '') + '"></i></button></div>' +
    '<div class="wc-bal"><span class="wc-bal-sym">₦</span><span id="walletNum">' + walletBalText() + '</span></div>' +
    '<div class="wc-sub" id="walletSub">' + walletSubText() + '</div>' +
    '<div class="wc-actions"><button class="wc-btn wc-btn-fund" id="wcFundBtn"><i class="fas fa-plus"></i> Fund Wallet</button>' +
    '<button class="wc-btn wc-btn-tx" id="wcTransferBtn"><i class="fas fa-paper-plane"></i> Transfer</button></div></div></div>';
  cards.forEach(c => { html += vaCardHTML(c, 'data-copy-va', 'data-gen-va'); });
  const track = $('#walletTrack');
  track.style.transition = 'none';
  track.innerHTML = html;
  paintBalance();
  $('#walletDots').innerHTML = Array.from({ length: total }).map((_, i) => '<div class="wd' + (i === 0 ? ' on' : '') + '" data-slide="' + i + '"></div>').join('');
  $$('#walletDots .wd').forEach(d => { d.onclick = () => { WAUTO.t = Date.now(); slideTo('wallet', parseInt(d.dataset.slide, 10), total); }; });
  $('#eyeBtn').onclick = () => { S.balHidden = !S.balHidden; store.setRaw('sh_bal_hidden', S.balHidden ? '1' : '0'); renderWallet(); };
  $('#wcFundBtn').onclick = openFundModal;
  $('#wcTransferBtn').onclick = openTransferChooser;
  bindVaButtons(track, 'data-copy-va', 'data-gen-va');
  attachSwipe($('#walletSlider'), track, 'wallet', () => 1 + buildVaCards().length);
  slideTo('wallet', Sl.wallet, total);
  void track.offsetWidth; track.style.transition = SLIDE_TRANS;
  if ($('#fundModal').classList.contains('show')) renderFundCards();
}

/* ----- generate a virtual account ----- */
function findCard(key) { return buildVaCards().find(c => c.key === key); }
function generateVA(key) {
  const card = findCard(key);
  if (!card || (card.acc && card.acc.accountNumber)) return;
  if (!card.provider || !card.provider.endpoint) { toast('blue', card.bankName, 'This bank is not available yet'); return; }
  if (card.bank.requiresId) openIdentityModal(card); else submitVA(card, null);
}
function openIdentityModal(card) {
  const b = card.bank, types = (b.idTypes && b.idTypes.length) ? b.idTypes : ['BVN', 'NIN'];
  const label = { BVN: 'BVN (Bank Verification Number)', NIN: 'NIN (National Identity Number)' };
  $('#identityBody').innerHTML =
    '<div class="alert-ico info" style="margin:0 auto 12px"><i class="fas fa-shield-halved"></i></div>' +
    '<div style="text-align:center;margin-bottom:16px"><div style="font-size:.94rem;font-weight:800;margin-bottom:4px">Identity Required</div>' +
    '<div style="font-size:.72rem;color:var(--muted);line-height:1.5">' + esc(card.bankName) + ' needs your ID to open your account.</div></div>' +
    '<div class="identity-benefits"><div class="identity-benefits-title"><i class="fas fa-star"></i> Why we ask</div>' +
    (b.benefits || []).map(x => '<div class="identity-benefit"><i class="fas fa-check"></i>' + esc(x) + '</div>').join('') + '</div>' +
    '<div class="fg"><label class="flbl">Select ID Type</label><select class="fi" id="idType">' +
    types.map(t => '<option value="' + t + '">' + (label[t] || t) + '</option>').join('') + '</select></div>' +
    '<div class="fg"><label class="flbl">Enter your 11-digit <span id="idLabel">' + types[0] + '</span></label>' +
    '<input type="tel" class="fi" id="idNumber" maxlength="11" placeholder="11 digits" inputmode="numeric" autocomplete="off"/>' +
    '<div class="fi-err" id="idNumberErr"></div></div>' +
    '<button class="btn-p" id="idSubmitBtn">Generate Account</button>';
  Modal.open('identityModal');
  $('#idType').onchange = () => { $('#idLabel').textContent = $('#idType').value; };
  $('#idNumber').addEventListener('input', e => { e.target.value = digitsOnly(e.target.value, 11); });
  $('#idSubmitBtn').onclick = () => {
    const v = $('#idNumber').value.trim(), t = $('#idType').value;
    clearErr('idNumberErr');
    if (!/^\d{11}$/.test(v)) { fieldErr('idNumberErr', 'Enter a valid 11-digit ' + t); return; }
    Modal.close('identityModal');
    submitVA(card, { idType: t, idNumber: v });
  };
}
async function submitVA(card, ident) {
  showProc('Generating Account', card.bankName + ' is setting up your account');
  const body = Object.assign({ bank: card.bank.id }, card.bank.body || {}, ident || {});
  const r = await api(card.provider.endpoint, { method: 'POST', body: body, timeout: 60000 });
  hideProc();
  if (r.network) { showAlert({ icon: 'warn', title: 'Connection lost', message: 'We could not confirm if your account was created. Pull to refresh in a moment to check.' }); await loadMe(true); return; }
  if (r.ok && r.data.success) {
    await loadMe(true);
    toast('green', 'Account Created', 'Your ' + card.bankName + ' account is ready');
    return;
  }
  showAlert({ icon: 'err', title: 'Could not create account', message: r.data.message || 'Please try again in a moment.' });
  await loadMe(true);
}

/* ----- fund modal ----- */
function openFundModal() { Sl.fund = 0; renderFundCards(); $('#fundMoreOptionsBtn').onclick = openDepositOptions; Modal.open('fundModal'); const ft = $('#fundVATrack'); if (ft) ft.scrollTop = 0; fixFundScroll(); }
/* The list never traps the finger: if the modal itself scrolls, the list simply flows inside it.
   Only when nothing around it scrolls, the list gets its own scroll area (and scroll passes on at its ends). */
function fixFundScroll() {
  const track = $('#fundVATrack'); if (!track) return;
  track.classList.remove('fund-inner');
  let p = track.parentElement, sc = null;
  while (p && p !== document.body && p !== document.documentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') { sc = p; break; }
    p = p.parentElement;
  }
  if (!sc) track.classList.add('fund-inner');
}
function renderFundCards() {
  const cards = buildVaCards();
  const track = $('#fundVATrack');
  track.classList.add('fund-list');                 // vertical list: no slider, no dots, no swipe
  track.style.transform = 'none'; track.style.transition = 'none';
  track.innerHTML = cards.map(c => vaCardHTML(c, 'data-fund-copy', 'data-fund-gen')).join('');
  const dots = $('#fundVADots'); if (dots) { dots.innerHTML = ''; dots.style.display = 'none'; }
  bindVaButtons(track, 'data-fund-copy', 'data-fund-gen');
}
function openDepositOptions() {
  const rows = [
    { id: 'va', ico: 'ico-sky', icon: 'fa-building-columns', name: 'Virtual Account', desc: 'Transfer to your dedicated account', soon: false },
    { id: 'ussd', ico: 'ico-pur', icon: 'fa-phone', name: 'USSD', desc: 'Dial a short code to fund', soon: true },
    { id: 'card', ico: 'ico-grn', icon: 'fa-credit-card', name: 'Debit Card', desc: 'Pay with your card', soon: true },
    { id: 'bank', ico: 'ico-amb', icon: 'fa-arrow-right-arrow-left', name: 'Pay with Bank', desc: 'Instant bank payment', soon: true },
    { id: 'qr', ico: 'ico-org', icon: 'fa-qrcode', name: 'QR Pay', desc: 'Scan to pay', soon: true }
  ];
  $('#depositOptionsBody').innerHTML = rows.map(r =>
    '<div class="deposit-option" data-dep="' + r.id + '"><div class="deposit-option-ico ' + r.ico + '"><i class="fas ' + r.icon + '"></i></div>' +
    '<div class="deposit-option-info"><div class="deposit-option-name">' + r.name + (r.soon ? ' <span class="soon-pill">Soon</span>' : '') + '</div><div class="deposit-option-desc">' + r.desc + '</div></div>' +
    '<i class="fas fa-chevron-right" style="color:var(--muted);font-size:.7rem"></i></div>').join('');
  Modal.open('depositOptionsModal');
  $$('#depositOptionsBody .deposit-option').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.dep;
      Modal.close('depositOptionsModal');
      if (id === 'va') openFundModal(); else go(ROUTES.deposit + '?method=' + encodeURIComponent(id));
    };
  });
}

/* ============================================================================
   8. SERVICES GRID, PRIORITY ROW, STATS, SLIDES
============================================================================ */
const TAGS = { hot: 'Hot', new: 'New', soon: 'Soon' };
const CATALOG = {
  data:        { label: 'Buy Data',      sub: 'All networks',        icon: 'fa-wifi',                cls: 'ico-sky' },
  airtime:     { label: 'Buy Airtime',   sub: 'Instant top-up',      icon: 'fa-phone',               cls: 'ico-grn' },
  cable:       { label: 'Cable TV',      sub: 'DStv, GOtv, Star',    icon: 'fa-tv',                  cls: 'ico-pur' },
  electricity: { label: 'Electricity',   sub: 'Prepaid, postpaid',   icon: 'fa-bolt',                cls: 'ico-amb' },
  exam:        { label: 'Exam Pins',     sub: 'WAEC, NECO, NABTEB',  icon: 'fa-graduation-cap',      cls: 'ico-tel', tag: 'hot' },
  epin:        { label: 'Epin Print',    sub: 'Recharge card PINs',  icon: 'fa-print',               cls: 'ico-pnk', tag: 'new' },
  crypto:      { label: 'Crypto',        sub: 'Buy and sell',        icon: 'fa-coins',               cls: 'ico-amb', tag: 'soon' },
  loan:        { label: 'Loan',          sub: 'Borrow instantly',    icon: 'fa-hand-holding-dollar', cls: 'ico-grn', tag: 'new' },
  sms:         { label: 'Bulk SMS',      sub: 'Send to many',        icon: 'fa-comment-dots',        cls: 'ico-red' },
  engage:      { label: 'Engage',        sub: 'Boost your reach',    icon: 'fa-rocket',              cls: 'ico-pur', tag: 'new', href: ROUTES.engage },
  analytics:   { label: 'Analytics',     sub: 'Your activity',       icon: 'fa-chart-line',          cls: 'ico-sky', tag: 'new', href: ROUTES.analytics },
  more:        { label: 'More',          sub: 'All services',        icon: 'fa-ellipsis',            cls: 'ico-org', tag: 'new' },
  fund:        { label: 'Fund Wallet',   sub: 'Add money',           icon: 'fa-wallet',              cls: 'ico-grn', tag: 'new' },
  transfer:    { label: 'Transfer',      sub: 'Send money',          icon: 'fa-paper-plane',         cls: 'ico-sky', tag: 'new' },
  notifications: { label: 'Notifications', sub: 'Alerts and news',   icon: 'fa-bell',                cls: 'ico-amb', tag: 'new' },
  settings:    { label: 'Settings',      sub: 'Profile and account', icon: 'fa-gear',                cls: 'ico-tel', tag: 'new', href: ROUTES.profile }
};
const GRID_ORDER = ['exam', 'epin', 'crypto', 'loan', 'sms', 'engage', 'analytics', 'more'];
const PRIORITY = [
  { id: 'data', label: 'Data', icon: 'fa-wifi', cls: 'ico-sky', tag: 'hot' },
  { id: 'airtime', label: 'Airtime', icon: 'fa-phone', cls: 'ico-grn', tag: 'hot' },
  { id: 'cable', label: 'Cable', icon: 'fa-tv', cls: 'ico-pur' },
  { id: 'electricity', label: 'Electricity', icon: 'fa-bolt', cls: 'ico-amb' }
];
const tagHTML = (it) => it.tag ? '<span class="svc-tag ' + it.tag + '">' + TAGS[it.tag] + '</span>' : '';

function renderServices() {
  $('#priorityRow').innerHTML = PRIORITY.map(s =>
    '<button class="prio-item" data-service="' + s.id + '">' + tagHTML(s) + '<div class="prio-ico ' + s.cls + '"><i class="fas ' + s.icon + '"></i></div><span>' + s.label + '</span></button>').join('');
  $('#svcGrid').innerHTML = GRID_ORDER.map(id => {
    const s = CATALOG[id];
    return '<button class="svc" data-service="' + id + '">' + tagHTML(s) + '<div class="svc-ico ' + s.cls + '"><i class="fas ' + s.icon + '"></i></div><div class="svc-nm">' + s.label + '</div></button>';
  }).join('');
  $$('#priorityRow .prio-item, #svcGrid .svc').forEach(b => { b.onclick = () => openService(b.dataset.service); });
}
function openService(id) {
  const it = CATALOG[id];
  if (it && it.href) { go(it.href); return; }
  switch (id) {
    case 'data': return openDataModal();
    case 'airtime': return openAirtimeModal();
    case 'cable': return openCableModal();
    case 'electricity': return openElecModal();
    case 'exam': return openExamModal();
    case 'epin': return openEpinModal();
    case 'sms': return openSmsModal();
    case 'crypto': return toast('blue', 'Crypto', 'Coming soon');
    case 'loan': return openLoan();
    case 'more': return openMoreModal();
    case 'fund': return openFundModal();
    case 'transfer': return openTransferChooser();
    case 'notifications': return openNotifications();
  }
}

/* Deep links: slides, popups, banner and notification buttons all use this.
   target = 'data'                                 open a service
          = { service:'data', network:'MTN', planId:123 }     open data and jump to that plan
          = { service:'airtime', network:'MTN', amount:500 }
          = { service:'cable', provider:'dstv', planCode:'X' }
          = { service:'electricity', disco:'KEDCO' }
          = { service:'exam', planId:1 }   { service:'epin', network:'MTN', planId:2 }
          = { href:'/app/referrals.html' }                    open a page */
function openTarget(t) {
  if (!t) return;
  if (typeof t === 'string') { if (/^(https?:|\/)/.test(t)) go(t); else openService(t); return; }
  if (t.href) { go(t.href); return; }
  const svc = t.service || t.target;
  if (!svc) return;
  switch (svc) {
    case 'data': return openDataModal({ network: t.network, planId: t.planId, phone: t.phone });
    case 'airtime': return openAirtimeModal({ network: t.network, amount: t.amount, phone: t.phone });
    case 'cable': return openCableModal({ provider: t.provider, planCode: t.planCode });
    case 'electricity': return openElecModal({ disco: t.disco });
    case 'exam': return openExamModal({ planId: t.planId });
    case 'epin': return openEpinModal({ network: t.network, planId: t.planId });
    default: return openService(svc);
  }
}

/* ----- promo slider (admin slides, with a default referral slide) ----- */
const DEFAULT_SLIDES = [{ id: 'ref', category: 'Refer & Earn', title: '🎁 Refer & Earn ' + naira0(REFERRAL_BONUS), desc: 'Share your referral code and earn when a friend buys data.', cta: 'Get my code', action: { href: ROUTES.referrals } }];
const PROMO = { idx: 0, timer: null, paused: false, list: [], key: '' };
function renderSlides() {
  const list = (S.content.slides && S.content.slides.length) ? S.content.slides : DEFAULT_SLIDES;
  const key = JSON.stringify(list);
  if (key === PROMO.key) return;
  PROMO.key = key; PROMO.list = list; PROMO.idx = 0;
  $('#promoTrack').innerHTML = list.map((s, i) =>
    '<div class="promo-slide' + (s.image ? '' : ' no-img') + '" data-i="' + i + '">' + (s.image ? imgBox('fill cover', s.image) : '') +
    '<div class="promo-overlay">' + (s.category ? '<span class="promo-cat">' + esc(s.category) + '</span>' : '') +
    '<div class="promo-title">' + esc(s.title) + '</div>' + (s.desc ? '<div class="promo-desc">' + esc(s.desc) + '</div>' : '') +
    (s.cta ? '<span class="promo-cta">' + esc(s.cta) + ' <i class="fas fa-arrow-right" style="font-size:.7rem"></i></span>' : '') + '</div></div>').join('');
  $('#promoDots').innerHTML = list.map((_, i) => '<div class="pd-item' + (i === 0 ? ' on' : '') + '" data-i="' + i + '"></div>').join('');
  $$('#promoDots .pd-item').forEach(d => { d.onclick = () => slidePromo(parseInt(d.dataset.i, 10)); });
  $$('#promoTrack .promo-slide').forEach(el => { el.onclick = () => { const s = PROMO.list[parseInt(el.dataset.i, 10)]; if (s) openTarget(s.action); }; });
  slidePromo(0);
}
function slidePromo(i) {
  const n = PROMO.list.length; if (!n) return;
  i = ((i % n) + n) % n; PROMO.idx = i;
  $('#promoTrack').style.transform = 'translateX(-' + (i * 100) + '%)';
  $$('#promoDots .pd-item').forEach((d, k) => d.classList.toggle('on', k === i));
}
function startPromoTimer() {
  const wrap = $('#promoTrackWrap');
  let x = 0;
  wrap.addEventListener('touchstart', e => { x = e.touches[0].clientX; PROMO.paused = true; }, { passive: true });
  wrap.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - x; if (Math.abs(dx) > 30) slidePromo(PROMO.idx + (dx < 0 ? 1 : -1)); setTimeout(() => { PROMO.paused = false; }, 3000); }, { passive: true });
  PROMO.timer = setInterval(() => { if (!PROMO.paused && document.visibilityState === 'visible' && PROMO.list.length > 1) slidePromo(PROMO.idx + 1); }, 5200);
}

/* ============================================================================
   9. RECENT NUMBERS + CONTACTS
============================================================================ */
const RECENT_KEY = 'sh_recent_numbers';
function loadRecents() {
  let a = store.get(RECENT_KEY, null);
  if (!Array.isArray(a)) {                                  // migrate from the old keys once
    a = [];
    const old = [].concat(store.get('sh_contacts', []) || [], store.get('sh_recents', []) || []);
    old.forEach(o => {
      if (!o || !o.phone || a.some(x => x.phone === o.phone)) return;
      const n = netOf(o.net || o.network);
      a.push({ id: 'rn' + Math.random().toString(36).slice(2, 8), name: o.name || '', phone: o.phone, network: n ? n.id : (detectNetwork(o.phone) || 'MTN'), ts: Date.now() });
    });
    store.set(RECENT_KEY, a);
  }
  return a;
}
function saveRecents() { store.set(RECENT_KEY, S.recents); }
const pickedNames = {};                       // phone -> name, remembered when the user picks a contact
function contactName(phone) {
  if (pickedNames[phone]) return pickedNames[phone];
  const c = CT.device.find(x => x.phone === phone);
  return c ? c.name : '';
}
/* numbers saved earlier without a name get the name from the phone's contacts as soon as contacts are known */
function syncRecentNames() {
  if (!CT.device.length) return;
  const by = {}; CT.device.forEach(c => { if (c.name) by[c.phone] = c.name; });
  let changed = false;
  S.recents.forEach(n => { if (!n.name && by[n.phone]) { n.name = by[n.phone]; changed = true; } });
  if (changed) { saveRecents(); renderRecents(); }
}
function rememberNumber(phone, networkId) {
  if (!validLocal11(phone)) return;
  const i = S.recents.findIndex(x => x.phone === phone);
  let item;
  if (i > -1) item = S.recents.splice(i, 1)[0];
  else item = { id: 'rn' + Math.random().toString(36).slice(2, 8), name: '', phone: phone, network: networkId || detectNetwork(phone) || 'MTN' };
  item.ts = Date.now();
  if (networkId) item.network = networkId;
  if (!item.name) { const nm = contactName(phone); if (nm) item.name = nm; }      // saved with the contact's name
  S.recents.unshift(item);
  const named = S.recents.filter(x => x.name), unnamed = S.recents.filter(x => !x.name).slice(0, 12);
  S.recents = S.recents.filter(x => named.includes(x) || unnamed.includes(x));
  saveRecents(); renderRecents();
}
function renderRecents(filter) {
  filter = String(filter == null ? ($('#rnSearch') ? $('#rnSearch').value : '') : filter).trim().toLowerCase();
  const wrap = $('#rnScroll');
  const list = S.recents.filter(n => !filter || (n.name || '').toLowerCase().includes(filter) || n.phone.includes(filter));
  if (!list.length) { wrap.innerHTML = '<div class="rn-empty"><i class="fas fa-users"></i><span>' + (filter ? 'No matches' : 'No recent numbers yet') + '</span></div>'; return; }
  wrap.innerHTML = list.map(n => {
    const net = netOf(n.network) || NETWORKS[0];
    return '<div class="chip" data-id="' + n.id + '"><div class="chip-av">' + imgBox('fill', net.logo, { text: initials(n.name || n.phone.slice(-2)), bg: net.color, fg: net.fg }) + '<span class="sdot ok"></span></div>' +
      '<div class="chip-name">' + esc(n.name || 'No name') + '</div><div class="chip-num">' + esc(n.phone) + '</div><div class="chip-net">' + esc(net.name) + '</div>' +
      '<div class="chip-actions"><button class="chip-act-btn edit" data-edit="' + n.id + '" aria-label="Edit"><i class="fas fa-pen"></i></button>' +
      '<button class="chip-act-btn del" data-del="' + n.id + '" aria-label="Delete"><i class="fas fa-trash"></i></button></div></div>';
  }).join('');
  $$('#rnScroll .chip').forEach(ch => ch.addEventListener('click', e => {
    if (e.target.closest('.chip-act-btn')) return;
    const n = S.recents.find(x => x.id === ch.dataset.id); if (n) openQuickService(n);
  }));
  $$('#rnScroll [data-edit]').forEach(b => { b.onclick = e => { e.stopPropagation(); editRecent(b.dataset.edit); }; });
  $$('#rnScroll [data-del]').forEach(b => { b.onclick = e => { e.stopPropagation(); deleteRecent(b.dataset.del); }; });
}
let editingId = null;
function openSaveBar(entry) {
  editingId = entry ? entry.id : null;
  $('#scName').value = entry ? entry.name || '' : '';
  $('#scPhone').value = entry ? entry.phone : '';
  $('#scNet').value = entry ? entry.network : 'MTN';
  $('#saveBar').classList.add('open');
}
function editRecent(id) { const n = S.recents.find(x => x.id === id); if (n) openSaveBar(n); }
function deleteRecent(id) {
  showAlert({ icon: 'warn', title: 'Delete number?', message: 'This removes the number from your recent list.', okLabel: 'Delete', cancelLabel: 'Cancel',
    onOk: () => { S.recents = S.recents.filter(x => x.id !== id); saveRecents(); renderRecents(); toast('green', 'Deleted', 'Number removed'); } });
}
function saveContactForm() {
  const name = $('#scName').value.trim(), phone = cleanPhoneInput($('#scPhone').value), network = $('#scNet').value;
  if (!name) { toast('warn', 'Invalid', 'Enter a name'); return; }
  if (!validLocal11(phone)) { toast('warn', 'Invalid', 'Enter a valid 11-digit phone number'); return; }
  if (editingId) {
    const n = S.recents.find(x => x.id === editingId);
    if (n) { n.name = name; n.phone = phone; n.network = network; }
  } else {
    const i = S.recents.findIndex(x => x.phone === phone);
    if (i > -1) { S.recents[i].name = name; S.recents[i].network = network; }
    else S.recents.unshift({ id: 'rn' + Math.random().toString(36).slice(2, 8), name: name, phone: phone, network: network, ts: Date.now() });
  }
  saveRecents(); renderRecents();
  $('#saveBar').classList.remove('open'); editingId = null;
  toast('green', 'Saved', name + ' saved');
}
function exportRecents() {
  if (!S.recents.length) { toast('warn', 'Nothing to export', 'No numbers saved yet'); return; }
  const rows = [['Name', 'Phone', 'Network']].concat(S.recents.map(n => [n.name || '', n.phone, n.network]));
  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  try {
    if (window.AndroidDownload && window.AndroidDownload.saveFile) {
      window.AndroidDownload.saveFile(btoa(unescape(encodeURIComponent(csv))), 'SubHub_Numbers.csv', 'text/csv');
      toast('green', 'Saved', 'Numbers saved to your Downloads'); return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'SubHub_Numbers.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } catch (e) { copyText(csv, 'Numbers copied'); }
}

/* ----- quick action ----- */
function openQuickService(rec) {
  const net = netOf(rec.network) || netOf(detectNetwork(rec.phone)) || NETWORKS[0];
  const badge = $('#qsNetBadge');
  badge.style.background = net.color; badge.style.color = net.fg; badge.textContent = net.name;
  $('#qsPhone').value = rec.phone;
  $$('#quickSvcModal .qs-svc').forEach(el => {
    el.onclick = () => {
      const s = el.dataset.qsvc;
      if (s === 'copy') { copyText(rec.phone, rec.phone); return; }
      Modal.close('quickSvcModal');
      if (s === 'data') openDataModal({ network: net.id, phone: rec.phone });
      else if (s === 'airtime') openAirtimeModal({ network: net.id, phone: rec.phone });
      else if (s === 'sms') openSmsModal({ phone: rec.phone });
    };
  });
  Modal.open('quickSvcModal');
}

/* ----- full contacts screen (phone contacts via AndroidContacts) ----- */
const CT = { device: [], loaded: false, shown: 0, filter: '', msg: '' };
function toLocalPhone(raw) { const d = normalizePhone(raw); return validLocal11(d) ? d : ''; }
async function openContactsPage() {
  $('#contactsPage').classList.add('show');
  Modal.stack.push('contactsPage');
  document.body.style.overflow = 'hidden';
  CT.filter = ''; CT.shown = 0;
  renderContactsShell();
  if (!CT.loaded) await loadDeviceContacts();
  renderContactsList();
}
function closeContactsPage() {
  $('#contactsPage').classList.remove('show');
  const i = Modal.stack.indexOf('contactsPage'); if (i > -1) Modal.stack.splice(i, 1);
  if (!Modal.stack.length) document.body.style.overflow = '';
}
let ctRun = null;
function loadDeviceContacts() { if (!ctRun) ctRun = loadDeviceContactsRun().finally(() => { ctRun = null; }); return ctRun; }
function contactSkeleton(n) {
  return Array.from({ length: n || 8 }).map((_, i) =>
    '<div class="contact-item ct-skel"><div class="skeleton" style="width:42px;height:42px;border-radius:50%;flex:none"></div>' +
    '<div class="contact-details"><div class="skeleton" style="height:12px;width:' + (48 + (i * 17) % 38) + '%;border-radius:6px;margin-bottom:8px"></div>' +
    '<div class="skeleton" style="height:10px;width:' + (30 + (i * 11) % 22) + '%;border-radius:6px"></div></div>' +
    '<div class="skeleton" style="width:48px;height:22px;border-radius:11px;flex:none"></div></div>').join('');
}
async function loadDeviceContactsRun() {
  const lw = $('#ctList'); if (lw) lw.innerHTML = contactSkeleton(9);
  const r = await getDeviceContacts();
  const seen = new Set(); const out = [];
  (r.contacts || []).forEach(c => {
    const p = toLocalPhone(c && (c.phone || c.number)); if (!p || seen.has(p)) return;
    seen.add(p); out.push({ name: String(c.name || '').trim(), phone: p, network: detectNetwork(p) || 'MTN' });
  });
  out.sort((a, b) => (a.name || '~').localeCompare(b.name || '~'));
  CT.device = out; CT.loaded = r.success;
  syncRecentNames();
  CT.msg = r.success ? '' : r.noBridge ? 'Open SubHub in the Android app to load your phone contacts.' : 'Contact access is off. Tap Open settings, allow Contacts for SubHub, then come back.';
}
function renderContactsShell() {
  $('#contactsPageBody').innerHTML =
    '<div class="contacts-page-search"><i class="fas fa-search"></i><input type="text" id="ctSearch" placeholder="Search by name or number" autocomplete="off"/></div><div class="ct-count" id="ctCount"></div><div class="contacts-page-list" id="ctList"></div>';
  $('#ctSearch').oninput = e => { CT.filter = e.target.value; CT.shown = 0; renderContactsList(); };
  $('#contactsPageBody').onscroll = () => { const b = $('#contactsPageBody'); if (b.scrollTop + b.clientHeight > b.scrollHeight - 200) renderContactsList(true); };
}
function renderContactsList(more) {
  const wrap = $('#ctList'); if (!wrap) return;
  const f = CT.filter.trim().toLowerCase();
  const saved = S.recents.map(n => ({ name: n.name, phone: n.phone, network: n.network }));
  const all = [];
  const seen = new Set();
  saved.concat(CT.device).forEach(c => { if (seen.has(c.phone)) return; seen.add(c.phone); all.push(c); });
  const list = all.filter(c => !f || (c.name || '').toLowerCase().includes(f) || c.phone.includes(f));
  const cc = $('#ctCount');
  if (cc) cc.textContent = !all.length ? '' : (f ? list.length + ' of ' + all.length + ' contacts' : all.length + (all.length === 1 ? ' contact' : ' contacts'));
  if (!list.length) {
    const failed = !CT.loaded && !f && isApp();
    wrap.innerHTML = emptyHTML('fa-user-slash', f ? 'No matches' : (CT.msg || 'No contacts yet'), failed ? 'ctRetry' : null);
    if (failed) wrap.querySelector('.empty').insertAdjacentHTML('beforeend', '<button class="btn-sec" id="ctSettings" style="width:auto;margin:10px auto 0;padding:9px 20px"><i class="fas fa-gear"></i><span>Open settings</span></button>');
    const rb = $('#ctRetry'); if (rb) rb.onclick = async () => { await loadDeviceContacts(); renderContactsList(); };
    const sb = $('#ctSettings'); if (sb) sb.onclick = () => openAppSettings();
    return;
  }
  if (!more) CT.shown = 0;
  const end = Math.min(list.length, CT.shown + 60);
  const html = list.slice(CT.shown, end).map(c => {
    const net = netOf(c.network) || NETWORKS[0];
    return '<div class="contact-item" data-p="' + esc(c.phone) + '" data-n="' + esc(c.name || '') + '"><div class="contact-avatar">' + imgBox('fill', net.logo, { text: initials(c.name || c.phone.slice(-2)), bg: net.color, fg: net.fg }) + '</div>' +
      '<div class="contact-details"><div class="contact-name">' + esc(c.name || c.phone) + '</div><div class="contact-phone">' + esc(c.phone) + '</div></div>' +
      '<div class="contact-badge" style="background:' + net.color + ';color:' + net.fg + '">' + esc(net.name) + '</div></div>';
  }).join('');
  if (more) wrap.insertAdjacentHTML('beforeend', html); else wrap.innerHTML = html;
  CT.shown = end;
  $$('#ctList .contact-item:not([data-b])').forEach(el => {
    el.dataset.b = '1';
    el.onclick = () => { const rec = { name: el.dataset.n, phone: el.dataset.p, network: detectNetwork(el.dataset.p) || 'MTN' }; if (rec.name) pickedNames[rec.phone] = rec.name; closeContactsPage(); setTimeout(() => openQuickService(rec), 200); };
  });
}

/* ----- paste chips (native paste needs AndroidClipboard) ----- */
const PASTE_FIELDS = [
  { id: 'dataPhone', mode: 'phone' }, { id: 'atPhone', mode: 'phone' }, { id: 'trRecipient', mode: 'phone' }, { id: 'scPhone', mode: 'phone' },
  { id: 'cableCard', mode: 'digits', max: 12 }, { id: 'elecMeter', mode: 'digits', max: 15 }, { id: 'smsNums', mode: 'phones' }
];
function extractPhones(text) {
  const flat = String(text || '').replace(/(\d)[\s\-.]+(?=\d)/g, '$1');      // 0803 123 4567 -> 08031234567
  return (flat.match(/(\+?234|0)?[789]\d{9}/g) || []).map(normalizePhone).filter(validLocal11).filter((n, i, a) => a.indexOf(n) === i);
}
function applyPaste(id, mode, max, text) {
  const el = document.getElementById(id); if (!el) return;
  let v = String(text || '');
  if (mode === 'phone') v = extractPhones(v)[0] || '';
  else if (mode === 'digits') v = digitsOnly(v, max);
  else if (mode === 'phones') {
    const found = extractPhones(v);
    if (!found.length) v = '';
    else { const cur = el.value.split(/[\s,;]+/).filter(Boolean); found.forEach(p => { if (cur.indexOf(p) === -1) cur.push(p); }); v = cur.join(', '); }
  } else if (mode === 'code') v = digitsOnly(v, 6);
  if (!v) { toast('warn', 'Paste', 'Nothing usable was found in your clipboard'); return; }
  el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus();
}
async function pasteInto(id, mode, max) {
  const t = await readClipboard();
  if (t == null) { const el = document.getElementById(id); if (el) el.focus(); toast('warn', 'Paste', 'Long-press the field and tap Paste'); return; }
  applyPaste(id, mode, max, t);
}
function initPasteChips() {
  PASTE_FIELDS.forEach(f => {
    const input = document.getElementById(f.id); if (!input || input.dataset.pc) return;
    input.dataset.pc = '1';
    const anchor = input.closest('.phone-wrap, .verify-wrap') || input;
    const row = document.createElement('div');
    row.className = 'paste-row';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'paste-chip';
    btn.innerHTML = '<i class="fas fa-clipboard"></i> Paste';
    btn.onclick = () => pasteInto(f.id, f.mode, f.max);
    row.appendChild(btn);
    anchor.parentNode.insertBefore(row, anchor);
  });
}

/* ============================================================================
   10. TRANSACTIONS + RECEIPT
============================================================================ */
const TX_META = {
  data: ['fa-wifi', 'ico-sky'], airtime: ['fa-phone', 'ico-grn'], cable: ['fa-tv', 'ico-pur'], electricity: ['fa-bolt', 'ico-amb'],
  exam: ['fa-graduation-cap', 'ico-tel'], epin: ['fa-print', 'ico-pnk'], sms: ['fa-comment-dots', 'ico-red'],
  wallet_fund: ['fa-arrow-down', 'ico-grn'], wallet_transfer: ['fa-paper-plane', 'ico-sky'], earncial_transfer: ['fa-arrow-down', 'ico-grn'],
  referral_bonus: ['fa-gift', 'ico-grn'], cashback: ['fa-coins', 'ico-amb'], refund: ['fa-rotate-right', 'ico-pur']
};
const TX_LABEL = { data: 'Data', airtime: 'Airtime', cable: 'Cable TV', electricity: 'Electricity', exam: 'Exam Pins', epin: 'Epin Print', sms: 'Bulk SMS',
  wallet_fund: 'Wallet Funding', wallet_transfer: 'Transfer', earncial_transfer: 'Transfer Received', referral_bonus: 'Referral Bonus', cashback: 'Cashback', refund: 'Refund' };
const CREDIT_TYPES = ['wallet_fund', 'refund', 'cashback', 'referral_bonus', 'earncial_transfer'];

function parsePins(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.reduce((a, x) => a.concat(parsePins(x)), []);
  if (typeof v === 'object') { const p = v.pin || v.PIN || v.code || v.token; const s = v.serial || v.serialNumber || v.sn; return p ? [{ pin: String(p), serial: s ? String(s) : '' }] : []; }
  const s = String(v).trim(); if (!s) return [];
  if (s[0] === '[' || s[0] === '{') { try { return parsePins(JSON.parse(s)); } catch (e) {} }
  return s.split(/[\n,;|]+/).map(x => x.trim()).filter(Boolean).map(x => ({ pin: x, serial: '' }));
}
function isCredit(tx) {
  if (isNum(tx.newBalance) && isNum(tx.oldBalance) && tx.newBalance !== tx.oldBalance) return tx.newBalance > tx.oldBalance;
  return CREDIT_TYPES.indexOf(tx.type) > -1;
}
function txInfo(tx) {
  const meta = TX_META[tx.type] || ['fa-receipt', 'ico-sky'];
  const net = tx.network ? (netOf(tx.network) ? netOf(tx.network).name : tx.network) : '';
  const qty = tx.examQuantity > 1 ? ' x' + tx.examQuantity : '';
  let title, sub = '', details = [], pins = [];
  switch (tx.type) {
    case 'data': title = (net + ' ' + (tx.dataPlan || 'Data')).trim(); sub = tx.phone || '';
      details = [['Network', net], ['Plan', tx.dataPlan], ['Plan type', tx.planType], ['Recipient', tx.phone]]; break;
    case 'airtime': title = (net + ' Airtime ' + naira0(tx.amount)).trim(); sub = tx.phone || '';
      details = [['Network', net], ['Recipient', tx.phone]]; break;
    case 'cable': title = ((net || 'Cable') + ' ' + (tx.dataPlan || '')).trim(); sub = tx.phone || '';
      details = [['Provider', net], ['Plan', tx.dataPlan], ['Smart card', tx.phone]]; break;
    case 'electricity': title = (net ? net + ' ' : '') + 'Electricity'; sub = tx.phone || '';
      details = [['DISCO', net], ['Meter', tx.phone], ['Meter type', tx.planType]];
      pins = parsePins(tx.token || tx.examPin).map(p => ({ pin: p.pin, serial: '', type: 'Token' })); break;
    case 'exam': title = ((tx.dataPlan || net || 'Exam') + qty).trim(); sub = 'Exam pin';
      details = [['Exam', tx.dataPlan || net], ['Quantity', tx.examQuantity || 1]];
      pins = parsePins(tx.examPin).map(p => ({ pin: p.pin, serial: p.serial, type: tx.dataPlan || net || 'Exam PIN' })); break;
    case 'epin': title = ((net + ' ' + (tx.dataPlan || 'Epin')).trim() + qty); sub = 'Epin';
      details = [['Network', net], ['Plan', tx.dataPlan], ['Quantity', tx.examQuantity || 1]];
      pins = parsePins(tx.examPin).map(p => ({ pin: p.pin, serial: p.serial, type: (net + ' ' + (tx.dataPlan || '')).trim() })); break;
    case 'sms': title = 'Bulk SMS'; sub = tx.smsRecipient || ''; details = [['Recipients', tx.smsRecipient], ['Message', tx.smsMessage]]; break;
    case 'wallet_fund': {
      const s = tx.sender || {};
      title = 'Wallet funding'; sub = s.name || '';
      details = [['Sender', s.name], ['Bank', s.bank], ['Account number', s.accountNumber], ['Channel', tx.fundingProvider ? 'Virtual account \u2022 ' + tx.fundingProvider : 'Virtual account'], ['Note', tx.description]]; break;
    }
    default: title = tx.description || TX_LABEL[tx.type] || 'Transaction'; sub = '';
      details = [['Description', tx.description]];
      if (tx.receiver && tx.receiver.name) details.unshift(['Recipient', tx.receiver.name]);
      if (tx.sender && tx.sender.name) details.unshift(['Sender', tx.sender.name]);
  }
  if (tx.refundedAt) details.push(['Refunded', fmtDate(tx.refundedAt)]);
  details = details.filter(d => d[1] != null && String(d[1]).trim() !== '');
  return { title: title || TX_LABEL[tx.type] || 'Transaction', sub: sub, icon: meta[0], cls: meta[1], credit: isCredit(tx), details: details, pins: pins };
}
async function loadTransactions(quiet) {
  const r = await api(EP.transactions + '?limit=6');
  if (!r.ok || !r.data.success) { if (!quiet && !S.txns.length) $('#txList').innerHTML = emptyHTML('fa-receipt', r.network ? 'No connection' : 'Could not load transactions', 'txRetry'); const b = $('#txRetry'); if (b) b.onclick = () => loadTransactions(); return; }
  S.txns = r.data.transactions || [];
  renderTransactions();
  saveCache();
}
/* The number in "Recent (6) Transactions" is the real count. Put <span id="txCount">6</span> around it in the HTML;
   if it is not there yet, the script wraps the number in the existing label by itself. */
function setTxCount(n) { const el = $('#txCount'); if (el) el.textContent = n; }
function ensureTxCount() {
  if ($('#txCount')) return;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = w.nextNode())) {
    const par = node.parentElement; if (!par || /^(SCRIPT|STYLE|TEXTAREA)$/.test(par.tagName)) continue;
    const m = /\(\s*(\d+)\s*\)/.exec(node.data); if (!m) continue;
    const label = par.textContent || '';
    if (label.length > 70 || !/recent/i.test(label) || !/transaction/i.test(label)) continue;
    const before = node.data.slice(0, m.index) + '(', after = ')' + node.data.slice(m.index + m[0].length);
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(before));
    const sp = document.createElement('span'); sp.id = 'txCount'; sp.textContent = m[1]; frag.appendChild(sp);
    frag.appendChild(document.createTextNode(after));
    par.replaceChild(frag, node);
    return;
  }
}
function renderTransactions() {
  const list = S.txns.slice(0, 6);
  setTxCount(list.length);
  if (!list.length) { renderTransactions._sig = ''; $('#txList').innerHTML = emptyHTML('fa-receipt', 'No transactions yet'); return; }
  const tsig = JSON.stringify(list.map(t => [t.requestId, t.status, t.amount, t.createdAt]));
  if (renderTransactions._sig === tsig && $('#txList .tx')) return;      // same data: leave the list alone, nothing flickers
  renderTransactions._sig = tsig;
  $('#txList').innerHTML = list.map(tx => {
    const i = txInfo(tx), st = String(tx.status || 'pending').toLowerCase();
    return '<div class="tx" data-ref="' + esc(tx.requestId) + '"><div class="tx-ico ' + i.cls + '"><i class="fas ' + i.icon + '"></i></div>' +
      '<div class="tx-body"><div class="tx-desc">' + esc(i.title) + '</div><div class="tx-meta"><i class="far fa-clock"></i>' + esc(fmtDate(tx.createdAt)) + (i.sub ? DOT + esc(i.sub) : '') + '</div></div>' +
      '<div class="tx-r"><div class="tx-amt ' + (i.credit ? 'crd' : 'dbt') + '">' + (i.credit ? '+' : '-') + naira0(tx.amount) + '</div><span class="bdg ' + esc(st === 'reversed' ? 'failed' : st) + '">' + esc(st) + '</span></div></div>';
  }).join('');
  $$('#txList .tx').forEach(el => { el.onclick = () => showTxDetail(el.dataset.ref); });
}
function showTxDetail(ref) {
  const tx = S.txns.find(t => t.requestId === ref); if (!tx) return;
  const i = txInfo(tx);
  showReceipt({
    status: tx.status, amount: tx.amount, type: tx.type, ref: tx.requestId,
    rows: [['Service', TX_LABEL[tx.type] || tx.type], ['Reference', tx.requestId, 'txid'], ['Date', fmtDate(tx.createdAt)], ['Direction', i.credit ? 'Credit' : 'Debit']]
      .concat(isNum(tx.oldBalance) ? [['Balance Before', naira(tx.oldBalance), 'bal']] : [], isNum(tx.newBalance) ? [['Balance After', naira(tx.newBalance), 'bal']] : []),
    details: i.details, pins: i.pins
  });
}

/* receipt: no download or share here (done on the transactions page) */
const recRowHTML = (r) => '<div class="rr"><div class="rrl">' + esc(r[0]) + '</div><div class="rrv ' + (r[2] || '') + '">' + esc(r[1]) + '</div></div>';
const sectionTitle = (t) => t === 'wallet_fund' ? 'Sender Details' : (t === 'wallet_transfer' || t === 'earncial_transfer') ? 'Transfer Details' : 'Purchase Details';
function showReceipt(o) {
  const st = String(o.status || 'success').toLowerCase();
  const kind = st === 'success' ? 'ok' : st === 'pending' ? 'pending' : 'fail';
  $('#recRing').className = 'rec-ring ' + kind;
  $('#recRingIco').className = 'fas ' + (kind === 'ok' ? 'fa-check' : kind === 'pending' ? 'fa-clock' : 'fa-xmark');
  $('#recStat').className = 'rec-stat ' + kind;
  $('#recStat').textContent = o.title || (kind === 'ok' ? 'Transaction Successful!' : kind === 'pending' ? 'Transaction Pending' : st === 'reversed' ? 'Transaction Reversed' : 'Transaction Failed');
  $('#recNote').textContent = o.note || '';
  $('#recNote').style.display = o.note ? 'block' : 'none';
  $('#recAmt').textContent = naira(o.amount);
  $('#recRows').innerHTML = (o.rows || []).map(recRowHTML).join('');
  let extra = '';
  if (o.details && o.details.length) extra += '<div class="rec-sec-t">' + sectionTitle(o.type) + '</div><div class="rec-rows">' + o.details.map(recRowHTML).join('') + '</div>';
  if (o.pins && o.pins.length) {
    extra += '<div class="rec-sec-t">' + (o.pins[0].type === 'Token' ? 'Your Token' : 'Your PINs') + '</div>' + o.pins.map(p =>
      '<div class="pin-card"><div class="pc-top"><span class="pc-type">' + esc(p.type || 'PIN') + '</span><button class="pc-copy" data-pin="' + esc(p.pin) + '" aria-label="Copy"><i class="fas fa-copy"></i></button></div>' +
      (p.serial ? '<div class="pc-serial">Serial ' + esc(p.serial) + '</div>' : '') + '<div class="pc-pin">' + esc(p.pin) + '</div></div>').join('');
  }
  $('#recExtra').innerHTML = extra;
  $$('#recExtra [data-pin]').forEach(b => {
    b.onclick = () => { copyText(b.dataset.pin, 'Copied'); b.classList.add('copied'); b.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => { b.classList.remove('copied'); b.innerHTML = '<i class="fas fa-copy"></i>'; }, 1600); };
  });
  $('#recViewBtn').onclick = () => go(ROUTES.transactions + (o.ref ? '?ref=' + encodeURIComponent(o.ref) : ''));
  Modal.open('receiptModal');
}
/* after the receipt closes, offer fingerprint for purchases (once the PIN was typed and accepted) */
Modal.hooks.receiptModal = function () {
  const pin = S.offerPin, auto = !!S.autoBio;
  S.offerPin = null; S.autoBio = false;
  if (!pin || bioStatus() !== 'ok' || bioHas('transaction')) return;
  const enable = async () => {
    const r = await bioEnable('transaction', pin, 'Enable fingerprint', 'Confirm to pay faster next time');
    if (r.success) toast('green', 'Fingerprint enabled', 'Confirm payments with your fingerprint');
    else if (r.reason !== 'cancelled') toast('warn', 'Fingerprint', 'Could not turn on fingerprint. Please try again later.');
  };
  if (auto) { setTimeout(enable, 350); return; }          // the user asked for it on the PIN pad
  if (Date.now() < num(store.raw('sh_txbio_snooze'))) return;
  setTimeout(() => showAlert({
    icon: 'info', title: 'Pay with fingerprint?', message: 'Skip typing your PIN. Confirm your payments with your fingerprint next time.',
    okLabel: 'Enable', cancelLabel: 'Not now', onOk: enable,
    onCancel: () => store.setRaw('sh_txbio_snooze', String(Date.now() + 7 * 86400000))
  }), 350);
};

/* ============================================================================
   11. PURCHASE ENGINE  (confirm -> fingerprint or PIN -> API -> receipt)
============================================================================ */
let confirmCfg = null;
function showConfirm(cfg) {
  confirmCfg = cfg;
  const before = S.wallet.balance, after = before - cfg.amount;
  $('#confAmt').textContent = naira(cfg.amount);
  $('#confService').textContent = cfg.service;
  $('#confDetails').innerHTML = cfg.details.map(d => '<div class="cd-row"><span class="cd-lbl">' + esc(d[0]) + '</span><span class="cd-val">' + esc(d[1]) + '</span></div>').join('') +
    '<div class="cd-row"><span class="cd-lbl">Balance Before</span><span class="cd-val">' + naira(before) + '</span></div>' +
    '<div class="cd-row"><span class="cd-lbl">Amount</span><span class="cd-val" style="color:var(--danger)">-' + naira(cfg.amount) + '</span></div>' +
    '<div class="cd-row total"><span class="cd-lbl" style="color:var(--pr)">Balance After</span><span class="cd-val" style="color:var(--pr)">' + naira(after) + '</span></div>';
  Modal.open('confirmModal');
}

/* PIN pad (returns { pin, bio } or null when cancelled) */
const PIN = { buf: '', resolve: null, bio: false, wantBio: false };
function updatePinDots() { for (let i = 0; i < 4; i++) { const d = $('#pd' + i); if (d) d.classList.toggle('on', i < PIN.buf.length); } }
function askPin(label) {
  return new Promise(resolve => {
    PIN.resolve = resolve; PIN.buf = ''; PIN.bio = false; PIN.wantBio = false;
    $('#pinSum').textContent = label || ''; $('#pinErr').textContent = '';
    updatePinDots();
    const fp = $('#pinKp [data-pk="fp"]'); if (fp) fp.style.visibility = 'visible';      // always shown; tapping it explains if the phone can't do it
    Modal.open('pinModal');
  });
}
function finishPin(pin, bio) { const res = PIN.resolve; PIN.resolve = null; Modal.close('pinModal'); if (res) res(pin ? { pin: pin, bio: !!bio, wantBio: !!PIN.wantBio } : null); }
Modal.hooks.pinModal = function () { const res = PIN.resolve; PIN.resolve = null; if (res) res(null); };
async function pinKey(k) {
  feedback('tap');
  if (k === 'del') PIN.buf = PIN.buf.slice(0, -1);
  else if (k === 'fp') { pinFingerprint(); return; }
  else if (PIN.buf.length < 4) PIN.buf += k;
  updatePinDots();
  if (PIN.buf.length === 4) setTimeout(() => finishPin(PIN.buf, false), 120);
}
const BIO_DEAD = ['key-invalidated', 'not-enrolled', 'decrypt-error'];
/* Handles a fingerprint prompt that did not give a PIN. Returns true when the saved fingerprint is no longer usable. */
function bioFailed(r) {
  const why = r && r.reason;
  if (BIO_DEAD.indexOf(why) > -1) {
    try { window.AndroidAuth.disableBiometricCredential('transaction'); } catch (e) {}
    toast('warn', 'Fingerprint', 'The fingerprints on your phone changed. Enter your PIN, and fingerprint will be turned on again after this payment.');
    return true;
  }
  if (why === 'lockout') toast('warn', 'Fingerprint', 'Too many attempts. Use your PIN.');
  return false;
}
/* The fingerprint key on the PIN pad */
async function pinFingerprint() {
  const st = bioStatus();
  if (st !== 'ok') { showAlert({ icon: 'info', title: 'Fingerprint not available', message: BIO_MSG[st] || BIO_MSG.unsupported }); return; }
  if (!bioHas('transaction')) {
    PIN.wantBio = true;
    toast('blue', 'Fingerprint', 'Enter your PIN this once. When the payment goes through, fingerprint will be turned on.');
    return;
  }
  const r = await bioGet('transaction', 'Confirm payment', $('#pinSum').textContent);
  if (r.success && /^\d{4}$/.test(String(r.credential || ''))) { finishPin(String(r.credential), true); return; }
  if (bioFailed(r)) PIN.wantBio = true;
}
async function authorize(label) {
  let rewant = false;
  if (bioHas('transaction')) {
    const r = await bioGet('transaction', 'Confirm payment', label);
    if (r.success && /^\d{4}$/.test(String(r.credential || ''))) return { pin: String(r.credential), bio: true };
    if (r.success) { try { window.AndroidAuth.disableBiometricCredential('transaction'); } catch (e) {} rewant = true; }
    else rewant = bioFailed(r);
  }
  const res = await askPin(label);
  if (res && rewant) res.wantBio = true;
  return res;
}
function ensurePinSet() {
  if (S.user && S.user.transactionPinSet) return true;
  showAlert({ icon: 'warn', title: 'Set your PIN first', message: 'Create a transaction PIN to start paying.', okLabel: 'Set PIN', cancelLabel: 'Later', onOk: () => go(ROUTES.security) });
  return false;
}
function needFunds(amount) {
  if (amount <= S.wallet.balance) return false;
  showAlert({ icon: 'err', title: 'Insufficient Balance', message: '(' + naira0(S.wallet.balance) + ') You need ' + naira0(amount) + ' to complete this transaction.', okLabel: 'Fund Wallet', cancelLabel: 'Close', onOk: openFundModal });
  return true;
}
/* cfg: { type, service, amount, details[], endpoint, body{}, label, recent{phone,network}, receipt(tx)->details[], pins(tx)->[], extraRows(tx) } */
/* cfg also takes: modal (the form that opened it, stays open until the payment is accepted),
   procTitle and procSub (the texts of the "Purchasing..." screen). */
async function startPurchase(cfg) {
  if (S.busy || S.checking) return;
  if (!ensurePinSet()) return;
  if (!S.balFresh) {                       // the balance on screen may be from the last visit: get the real one first
    S.checking = true; showProc('Checking balance', '');
    try { await loadMe(true); } finally { hideProc(); S.checking = false; }
  }
  if (needFunds(cfg.amount)) return;
  showConfirm({ service: cfg.service, amount: cfg.amount, details: cfg.details, onProceed: () => executePurchase(cfg) });
}
async function executePurchase(cfg) {
  if (S.busy) return;
  const auth = await authorize(cfg.label || cfg.service);
  if (!auth) return;
  S.busy = true;
  showProc(cfg.procTitle || 'Purchasing...', cfg.procSub || (cfg.service + DOT + naira0(cfg.amount)));
  let r;
  try {
    r = await api(cfg.endpoint, { method: 'POST', body: Object.assign({}, cfg.body, { pin: auth.pin, source: sourceTag() }), timeout: 75000 });
  } finally { hideProc(); S.busy = false; }
  await handleResult(cfg, auth, r);
}
const syncAfter = () => Promise.all([loadMe(true), loadTransactions(true)]);
async function handleResult(cfg, auth, r) {
  const d = r.data || {}, tx = d.transaction || {};
  if (r.network) {
    if (cfg.modal) Modal.close(cfg.modal);          // the result is unknown, so do not let the user pay twice from the same form
    showAlert({ icon: 'warn', title: 'Connection lost', message: 'We could not confirm your payment. It may still have gone through, so check your transactions before trying again.',
      okLabel: 'View transactions', cancelLabel: 'Close', onOk: () => go(ROUTES.transactions) });
    setTimeout(syncAfter, 1500); return;
  }
  if (r.status === 401 && /pin/i.test(String(d.message || ''))) {
    if (auth.bio) {
      try { window.AndroidAuth.disableBiometricCredential('transaction'); } catch (e) {}
      showAlert({ icon: 'warn', title: 'Enter your PIN', message: 'Your saved fingerprint payment is out of date, maybe because you changed your PIN. Pay again with your PIN to turn it back on.' });
    } else if (/set a transaction pin/i.test(String(d.message))) ensurePinSet();
    else showAlert({ icon: 'err', title: 'PIN problem', message: d.message });
    return;
  }
  if (r.ok && d.success) {
    const pending = r.status === 202 || String(tx.status || '').toLowerCase() === 'pending';
    if (isNum(tx.newBalance)) setBalance(tx.newBalance);
    if (cfg.recent) rememberNumber(cfg.recent.phone, cfg.recent.network);
    if (!auth.bio) { S.offerPin = auth.pin; S.autoBio = !!auth.wantBio; }
    if (cfg.modal) Modal.close(cfg.modal);          // the form closes only now that the payment was accepted
    const rec = cfg.receipt ? cfg.receipt(tx) : [];
    const amount = isNum(tx.amount) ? tx.amount : cfg.amount;
    showReceipt({
      status: pending ? 'pending' : 'success', amount: amount, type: cfg.type, ref: tx.requestId,
      title: pending ? 'Transaction Pending' : 'Purchase Successful', note: pending ? d.message : '',
      rows: [['Reference', tx.requestId || '-', 'txid'], ['Date', fmtDate(Date.now())]]
        .concat(isNum(tx.oldBalance) ? [['Balance Before', naira(tx.oldBalance), 'bal']] : [], isNum(tx.newBalance) ? [['Balance After', naira(tx.newBalance), 'bal']] : []),
      details: rec, pins: cfg.pins ? cfg.pins(tx) : []
    });
    if (!isNum(tx.newBalance)) loadMe(true); else setTimeout(() => loadMe(true), 1500);
    loadTransactions(true);
    return;
  }
  showAlert({ icon: 'err', title: d.refunded ? 'Purchase failed, money returned' : 'Transaction failed',
    message: d.message || (r.status === 429 ? 'Too many requests. Please wait a moment.' : 'Something went wrong. Please try again.') });
  syncAfter();
}

/* ============================================================================
   12. DATA
============================================================================ */
let dataCtx = { network: null, tab: null, plans: [], planId: null };
function renderNetChips(sel, ctx, onChange) {
  const wrap = $(sel);
  wrap.innerHTML = NETWORKS.map(n => '<div class="nc' + (ctx.network === n.id ? ' sel' : '') + '" data-net="' + n.id + '">' + netLogo(n, 'nc-logo') + '<div class="nc-name">' + n.name + '</div></div>').join('');
  $$('[data-net]', wrap).forEach(el => { el.onclick = () => { ctx.network = el.dataset.net; $$('.nc', wrap).forEach(x => x.classList.remove('sel')); el.classList.add('sel'); onChange(); }; });
}
const NET_WAIT = { '0702': 1 };      // 0702 is Smile but 07025 and 07026 are MTN: wait for the fifth digit
function updatePhoneState(inputId, stateId, netId) {
  const inp = document.getElementById(inputId); if (!inp) return;
  const v = inp.value.trim();
  const errEl = document.getElementById(inputId + 'Err');
  if (isExamplePhone(v)) { if (errEl) { errEl.textContent = EXAMPLE_PHONE_MSG; errEl.classList.add('on'); } }
  else if (errEl && errEl.textContent === EXAMPLE_PHONE_MSG) errEl.classList.remove('on');
  const st = document.getElementById(stateId); if (!st) return;
  st.className = 'phone-state'; st.innerHTML = '';
  if (isExamplePhone(v)) { st.className = 'phone-state bad'; st.innerHTML = '<i class="fas fa-xmark"></i>'; return; }
  if (v.length < 4 || !netId) return;                      // the icon shows from the 4th digit, no need to finish the number
  if (v.length === 4 && NET_WAIT[v]) return;
  const det = detectNetwork(v); if (!det) return;
  const ok = det === netId;
  st.className = 'phone-state ' + (ok ? 'ok' : 'bad'); st.innerHTML = ok ? '<i class="fas fa-check"></i>' : '<i class="fas fa-xmark"></i>';
}
function mismatchCheck(phone, netId, proceed) {
  const det = detectNetwork(phone);
  if (det && det !== netId) {
    showAlert({ icon: 'warn', title: 'Network Mismatch!', message: 'This number looks like ' + det + ' but you selected ' + netId + '.\nThe transaction may fail, please double check the number or continue anyway.', okLabel: 'Continue', cancelLabel: 'Change Network', onOk: proceed });
    return true;
  }
  return false;
}
function openDataModal(o) {
  o = o || {};
  const net = netOf(o.network);
  dataCtx = { network: net ? net.id : null, tab: null, plans: [], planId: null };
  renderNetChips('#dnChips', dataCtx, () => { dataCtx.tab = null; dataCtx.planId = null; $('#planSection').style.display = 'block'; updatePhoneState('dataPhone', 'dataPhoneState', dataCtx.network); loadDataPlans(dataCtx.network, {}); });
  $('#dataPhone').value = o.phone || ''; clearErr('dataPhoneErr');
  $('#planSection').style.display = net ? 'block' : 'none';
  $('#planTabs').innerHTML = ''; $('#plansWrap').innerHTML = '';
  updatePhoneState('dataPhone', 'dataPhoneState', dataCtx.network);
  Modal.open('dataModal');
  if (net) loadDataPlans(net.id, o);
}
async function loadDataPlans(netId, o) {
  o = o || {};
  const net = netOf(netId); if (!net) return;
  const wrap = $('#plansWrap'); skeleton(wrap, 4); $('#planTabs').innerHTML = '';
  let plans = fresh('data:' + net.api);
  if (!plans) {
    const r = await api(EP.dataPlans(net.api));
    if (dataCtx.network !== netId) return;
    if (!r.ok || !r.data.success) { wrap.innerHTML = emptyHTML('fa-box-open', r.network ? 'No connection' : (r.data.message || 'Could not load plans'), 'plansRetry'); $('#plansRetry').onclick = () => loadDataPlans(netId, o); return; }
    plans = r.data.plans || []; planCache['data:' + net.api] = { t: Date.now(), v: plans };
  }
  if (dataCtx.network !== netId) return;
  dataCtx.plans = plans;
  const tabs = planTabsOf(plans);
  const target = o.planId != null ? plans.find(p => String(p.planId) === String(o.planId)) : null;
  dataCtx.tab = target ? target.planType : tabs[0] || null;
  dataCtx.planId = target ? target.planId : null;
  renderDataPlans(true);
  if (o.planId != null && !target) toast('blue', 'Offer', 'That offer is no longer available');
}
/* plan types in order: SME first (left), the others follow to the right in their own order */
function planTabsOf(plans) {
  const rank = (t) => /^\s*sme/i.test(String(t)) ? 0 : 1;
  return plans.map(p => p.planType).filter((t, i, a) => t && a.indexOf(t) === i)
    .map((t, i) => ({ t: t, i: i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map(x => x.t);
}
function renderDataPlans(focus) {
  const tabs = planTabsOf(dataCtx.plans);
  $('#planTabs').innerHTML = tabs.map(t => '<button class="pt' + (t === dataCtx.tab ? ' active' : '') + '" data-tab="' + esc(t) + '">' + esc(t) + '</button>').join('');
  $$('#planTabs [data-tab]').forEach(b => { b.onclick = () => { dataCtx.tab = b.dataset.tab; dataCtx.planId = null; renderDataPlans(); }; });
  const list = dataCtx.plans.filter(p => p.planType === dataCtx.tab);
  const wrap = $('#plansWrap');
  if (!list.length) { wrap.innerHTML = emptyHTML('fa-box-open', 'No plans available for this network right now'); return; }
  wrap.innerHTML = list.map(p =>
    '<div class="dc' + (String(dataCtx.planId) === String(p.planId) ? ' sel' : '') + '" data-pid="' + esc(p.planId) + '"><div class="dc-ico"><i class="fas fa-wifi"></i></div>' +
    '<div class="dc-info"><div class="dc-name">' + esc(p.planName) + ' <span class="dc-stock ' + (p.inStock === false ? 'out' : 'in') + '" data-note="' + esc(p.message || '') + '"></span></div>' +
    '<div class="dc-validity"><i class="far fa-clock"></i> ' + esc(p.validity || '') + '</div></div>' +
    '<div class="dc-price">' + naira0(p.sellingPrice) + '</div><button class="dc-buy" data-buy="' + esc(p.planId) + '"' + (p.inStock === false ? ' disabled' : '') + '>Buy</button></div>').join('');
  const act = $('#planTabs .pt.active'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (focus && dataCtx.planId != null) {
    const el = $('#plansWrap [data-pid="' + String(dataCtx.planId).replace(/"/g, '') + '"]');
    if (el) { setTimeout(() => { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); }, 250); }
  }
}
function buyDataPlan(plan) {
  const phone = $('#dataPhone').value.trim(); clearErr('dataPhoneErr');
  if (!dataCtx.network) { toast('warn', 'Select network', 'Choose a network'); return; }
  if (plan.inStock === false) { toast('warn', 'Out of stock', plan.message || 'This plan is unavailable'); return; }
  if (isExamplePhone(phone)) { fieldErr('dataPhoneErr', EXAMPLE_PHONE_MSG); return; }
  if (!validPhone(phone)) { fieldErr('dataPhoneErr', 'Enter a valid 11-digit phone number'); return; }
  const net = netOf(dataCtx.network);
  const proceed = () => {
    startPurchase({
      modal: 'dataModal', procSub: plan.planName + ' Data' + ARROW + phone,
      type: 'data', service: 'Data Purchase', amount: num(plan.sellingPrice),
      details: [['Network', net.name], ['Plan', plan.planName + ' (' + plan.validity + ')'], ['Phone', phone]],
      endpoint: EP.dataBuy, body: { planId: plan.planId, phone: phone }, label: net.name + ' ' + plan.planName + ' to ' + phone,
      recent: { phone: phone, network: net.id },
      receipt: (tx) => [['Service', 'Data Bundle'], ['Network', tx.network || net.api], ['Plan', tx.plan || plan.planName], ['Validity', tx.validity || plan.validity], ['Recipient', tx.phone || phone]]
    });
  };
  if (!mismatchCheck(phone, net.id, proceed)) proceed();
}

/* ============================================================================
   13. AIRTIME
============================================================================ */
let airCtx = { network: null };
function openAirtimeModal(o) {
  o = o || {};
  const net = netOf(o.network);
  airCtx = { network: net ? net.id : null };
  renderNetChips('#atChips', airCtx, () => updatePhoneState('atPhone', 'atPhoneState', airCtx.network));
  $('#atPhone').value = o.phone || ''; $('#atAmt').value = o.amount || '';
  $$('[data-atamt]').forEach(x => x.classList.toggle('sel', String(x.dataset.atamt) === String(o.amount)));
  clearErr('atPhoneErr'); clearErr('atAmtErr');
  updatePhoneState('atPhone', 'atPhoneState', airCtx.network);
  Modal.open('airtimeModal');
}
function submitAirtime() {
  const phone = $('#atPhone').value.trim(), amt = parseFloat($('#atAmt').value);
  clearErr('atPhoneErr'); clearErr('atAmtErr');
  if (!airCtx.network) { toast('warn', 'Select network', 'Choose a network'); return; }
  if (isExamplePhone(phone)) { fieldErr('atPhoneErr', EXAMPLE_PHONE_MSG); return; }
  if (!validPhone(phone)) { fieldErr('atPhoneErr', 'Enter a valid 11-digit phone number'); return; }
  if (!amt || amt < AIRTIME_MIN || amt > AIRTIME_MAX) { fieldErr('atAmtErr', 'Enter an amount between ' + naira0(AIRTIME_MIN) + ' and ' + naira0(AIRTIME_MAX)); return; }
  const net = netOf(airCtx.network);
  const proceed = () => {
    startPurchase({
      modal: 'airtimeModal', procSub: naira0(amt) + ' Airtime' + ARROW + phone,
      type: 'airtime', service: 'Airtime', amount: amt,
      details: [['Network', net.name], ['Phone', phone], ['Amount', naira(amt)]],
      endpoint: EP.airtimeBuy, body: { network: net.api, phone: phone, amount: amt }, label: net.name + ' ' + naira0(amt) + ' to ' + phone,
      recent: { phone: phone, network: net.id },
      receipt: (tx) => [['Service', 'Airtime'], ['Network', tx.network || net.api], ['Recipient', tx.phone || phone]]
    });
  };
  if (!mismatchCheck(phone, net.id, proceed)) proceed();
}

/* ============================================================================
   14. VERIFY HELPERS (meter, smart card)
============================================================================ */
function setVerifyRes(id, state, data) {
  const el = document.getElementById(id); if (!el) return;
  if (!state) { el.innerHTML = ''; return; }
  if (state === 'loading') el.innerHTML = '<div class="verify-res load"><i class="fas fa-spinner fa-spin"></i><span>Checking details...</span></div>';
  else if (state === 'ok') el.innerHTML = '<div class="verify-res ok"><div class="vr-ico"><i class="fas fa-check"></i></div><div class="vr-txt"><div class="vr-lbl">Customer name</div><div class="vr-name">' + esc(data.name) + '</div></div></div>';
  else el.innerHTML = '<div class="verify-res bad"><div class="vr-ico"><i class="fas fa-xmark"></i></div><div class="vr-txt"><div class="vr-name">Could not verify</div><div class="vr-addr">' + esc(data || 'Check the number and try again') + '</div></div></div>';
}

/* ============================================================================
   15. CABLE
============================================================================ */
let cableCtx = { provider: null, plans: [], planCode: null, verified: null };
function cablePlan() { return cableCtx.plans.find(p => String(p.planCode) === String(cableCtx.planCode)); }
function cableInvalidate() { cableCtx.verified = null; setVerifyRes('cableVerifyRes'); }
function openCableModal(o) {
  o = o || {};
  cableCtx = { provider: null, plans: [], planCode: null, verified: null };
  $('#cableProvChips').innerHTML = CABLES.map(c => '<div class="nc" data-prov="' + c.id + '">' + imgBox('nc-logo', c.logo, { text: c.short, bg: c.color, fg: c.fg }) + '<div class="nc-name">' + c.name + '</div></div>').join('');
  $$('#cableProvChips .nc').forEach(el => { el.onclick = () => selectCable(el.dataset.prov); });
  $('#cablePlansWrap').innerHTML = '<p style="font-size:.78rem;color:var(--muted);text-align:center;padding:16px 0">Select a provider to see plans</p>';
  $('#cablePriceBox').style.display = 'none'; $('#cableCard').value = ''; clearErr('cableCardErr'); setVerifyRes('cableVerifyRes');
  Modal.open('cableModal');
  if (o.provider) selectCable(String(o.provider).toLowerCase(), o);
}
async function selectCable(id, o) {
  const c = CABLES.find(x => x.id === id); if (!c) return;
  cableCtx.provider = id; cableCtx.planCode = null; cableCtx.plans = []; cableInvalidate();
  $$('#cableProvChips .nc').forEach(x => x.classList.toggle('sel', x.dataset.prov === id));
  $('#cablePriceBox').style.display = 'none';
  const wrap = $('#cablePlansWrap'); skeleton(wrap, 3);
  let plans = fresh('cable:' + c.api);
  if (!plans) {
    const r = await api(EP.cablePlans(c.api));
    if (cableCtx.provider !== id) return;
    if (!r.ok || !r.data.success) { wrap.innerHTML = emptyHTML('fa-tv', r.network ? 'No connection' : (r.data.message || 'Could not load plans'), 'cableRetry'); $('#cableRetry').onclick = () => selectCable(id, o); return; }
    plans = r.data.plans || []; planCache['cable:' + c.api] = { t: Date.now(), v: plans };
  }
  cableCtx.plans = plans;
  wrap.innerHTML = plans.length ? plans.map(p =>
    '<div class="dc" data-code="' + esc(p.planCode) + '"><div class="dc-ico"><i class="fas fa-tv"></i></div><div class="dc-info"><div class="dc-name">' + esc(p.planName) + ' <span class="dc-stock ' + (p.inStock === false ? 'out' : 'in') + '"></span></div></div><div class="dc-price">' + naira0(p.sellingPrice) + '</div></div>').join('')
    : emptyHTML('fa-tv', 'No plans available right now');
  $$('#cablePlansWrap .dc').forEach(el => { el.onclick = () => pickCablePlan(el.dataset.code); });
  if (o && o.planCode) pickCablePlan(o.planCode, true);
}
function pickCablePlan(code, scroll) {
  const p = cableCtx.plans.find(x => String(x.planCode) === String(code)); if (!p) return;
  if (p.inStock === false) { toast('warn', 'Unavailable', p.message || 'This plan is unavailable'); return; }
  cableCtx.planCode = p.planCode;
  $$('#cablePlansWrap .dc').forEach(x => x.classList.toggle('sel', x.dataset.code === String(code)));
  $('#cablePriceBox').style.display = 'flex'; $('#cablePriceVal').textContent = naira0(p.sellingPrice);
  if (scroll) { const el = $('#cablePlansWrap .dc.sel'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
async function verifyCard() {
  const card = $('#cableCard').value.trim();
  if (!cableCtx.provider) { toast('warn', 'Select provider', 'Choose a provider first'); return; }
  if (!/^\d{8,12}$/.test(card)) { fieldErr('cableCardErr', 'Enter a valid smart card number (8 to 12 digits)'); return; }
  clearErr('cableCardErr');
  const c = CABLES.find(x => x.id === cableCtx.provider), p = cablePlan();
  const key = c.id + '|' + card, btn = $('#cableVerifyBtn');
  setBtnLoading(btn, 'Checking'); setVerifyRes('cableVerifyRes', 'loading');
  let q = '?iuc=' + encodeURIComponent(card) + '&cable=' + encodeURIComponent(c.api);
  if (p && p.engineGroupId != null) q += '&engineGroupId=' + encodeURIComponent(p.engineGroupId);
  if (p && p.planType) q += '&planType=' + encodeURIComponent(p.planType);
  const r = await api(EP.cableVerify + q);
  resetBtn(btn);
  if (cableCtx.provider !== c.id) return;
  if (r.ok && r.data.success) {
    const name = r.data.customerName || '';
    cableCtx.verified = { key: key, name: name || 'Customer' };
    setVerifyRes('cableVerifyRes', 'ok', { name: name || 'Smart card verified' });
    toast('green', 'Smart card verified', name);
  } else {
    cableCtx.verified = null; setVerifyRes('cableVerifyRes', 'bad', r.data.message);
    toast('red', 'Verification failed', r.data.message || 'Check the smart card number and provider');
  }
}
function submitCable() {
  const card = $('#cableCard').value.trim(); clearErr('cableCardErr');
  if (!cableCtx.provider) { toast('warn', 'Select provider', 'Choose a provider'); return; }
  const p = cablePlan(); if (!p) { toast('warn', 'Select plan', 'Choose a plan'); return; }
  if (!/^\d{8,12}$/.test(card)) { fieldErr('cableCardErr', 'Enter a valid smart card number (8 to 12 digits)'); return; }
  const c = CABLES.find(x => x.id === cableCtx.provider);
  if (!cableCtx.verified || cableCtx.verified.key !== c.id + '|' + card) { fieldErr('cableCardErr', 'Verify the smart card number before you continue'); return; }
  const cust = cableCtx.verified.name;
  startPurchase({
    modal: 'cableModal', procSub: c.name + ' ' + p.planName + ARROW + card,
    type: 'cable', service: 'Cable TV', amount: num(p.sellingPrice),
    details: [['Provider', c.name], ['Plan', p.planName], ['Smart Card', card], ['Customer', cust]],
    endpoint: EP.cableBuy, body: { cable: c.api, planCode: p.planCode, smartCard: card }, label: c.name + ' ' + p.planName,
    receipt: (tx) => [['Service', 'Cable TV'], ['Provider', tx.network || c.api], ['Plan', tx.plan || p.planName], ['Smart Card', tx.smartCard || card], ['Customer', cust]]
  });
}

/* ============================================================================
   16. ELECTRICITY
============================================================================ */
let elecCtx = { discos: [], disco: null, type: 'PREPAID', verified: null };
function discoView(d) {
  const code = String(d.discoCode || d.network || d.discoName || '').trim();
  const name = d.discoName || code;
  const first = String(name).toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/)[0] || '';
  const label = String(name).replace(/\b(electric(ity)?|distribution|company|plc|disco)\b/ig, '').replace(/\s+/g, ' ').trim() || name;
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const color = DISCO_COLORS[first] || DISCO_COLORS[slug(code)] || '#00aaff';
  return { raw: d, id: code, name: name, label: label, color: color, logos: ['/' + slug(code) + '.png', '/' + first + '.png'], min: d.minimumAmount != null ? num(d.minimumAmount) : 1000, max: d.maximumAmount != null ? num(d.maximumAmount) : 100000 };
}
const curDisco = () => elecCtx.discos.find(d => d.id === elecCtx.disco);
function elecInvalidate() { elecCtx.verified = null; setVerifyRes('elecVerifyRes'); }
function openElecModal(o) {
  o = o || {};
  elecCtx = { discos: elecCtx.discos || [], disco: null, type: 'PREPAID', verified: null };
  $('#elecMeter').value = ''; $('#elecAmt').value = ''; $$('[data-eamt]').forEach(x => x.classList.remove('sel'));
  clearErr('elecMeterErr'); clearErr('elecAmtErr'); setVerifyRes('elecVerifyRes'); $('#elecFee').textContent = '';
  renderMeterTypes();
  Modal.open('elecModal');
  loadDiscos(o);
}
async function loadDiscos(o) {
  const grid = $('#discoGrid'); grid.innerHTML = '<div style="grid-column:1/-1">' + '</div>'; skeleton(grid, 2);
  let list = fresh('discos');
  if (!list) {
    const r = await api(EP.elecPlans);
    if (!r.ok || !r.data.success) { grid.innerHTML = '<div style="grid-column:1/-1">' + emptyHTML('fa-bolt', r.network ? 'No connection' : (r.data.message || 'Could not load DISCOs'), 'discoRetry') + '</div>'; $('#discoRetry').onclick = () => loadDiscos(o); return; }
    list = (r.data.discos || r.data.plans || []).filter(d => d && d.isActive !== false);
    planCache.discos = { t: Date.now(), v: list };
  }
  elecCtx.discos = list.map(discoView);
  const want = o && o.disco ? elecCtx.discos.find(d => d.id.toLowerCase() === String(o.disco).toLowerCase()) : null;
  elecCtx.disco = (want || elecCtx.discos.find(d => d.raw.inStock !== false) || {}).id || null;
  renderDiscoCards();
}
function renderDiscoCards() {
  const grid = $('#discoGrid');
  if (!elecCtx.discos.length) { grid.innerHTML = '<div style="grid-column:1/-1">' + emptyHTML('fa-bolt', 'No DISCOs available right now') + '</div>'; return; }
  grid.innerHTML = elecCtx.discos.map(d =>
    '<div class="nc' + (elecCtx.disco === d.id ? ' sel' : '') + (d.raw.inStock === false ? ' off' : '') + '" data-disco="' + esc(d.id) + '">' + imgBox('nc-logo', d.logos, { text: d.label.slice(0, 4).toUpperCase(), bg: d.color, fg: '#ffffff' }) + '<div class="nc-name">' + esc(d.label) + '</div></div>').join('');
  $$('#discoGrid .nc').forEach(el => { el.onclick = () => {
    const d = elecCtx.discos.find(x => x.id === el.dataset.disco);
    if (d && d.raw.inStock === false) { toast('warn', d.label, d.raw.message || 'Unavailable right now'); return; }
    elecCtx.disco = el.dataset.disco; elecInvalidate(); renderDiscoCards(); updateElecHint();
  }; });
  updateElecHint();
}
function renderMeterTypes() {
  $('#meterTypes').innerHTML = ['PREPAID', 'POSTPAID'].map(t => '<button class="pt' + (elecCtx.type === t ? ' active' : '') + '" data-mt="' + t + '">' + (t === 'PREPAID' ? 'Prepaid' : 'Postpaid') + '</button>').join('');
  $$('#meterTypes [data-mt]').forEach(b => { b.onclick = () => { elecCtx.type = b.dataset.mt; elecInvalidate(); renderMeterTypes(); }; });
}
function elecCharge(amount) {
  const d = curDisco(); if (!d) return { markup: null, total: amount };
  const flat = num(d.raw.markupFlat), pct = num(d.raw.profitPercentage);
  if (d.raw.markupFlat == null && d.raw.profitPercentage == null) return { markup: null, total: amount };
  const markup = flat > 0 ? flat : Math.round(amount * pct) / 100;
  return { markup: markup, total: Math.round((amount + markup) * 100) / 100 };
}
function updateElecHint() {
  const d = curDisco(), a = parseFloat($('#elecAmt').value);
  if (!d) { $('#elecFee').textContent = ''; return; }
  let t = 'Min ' + naira0(d.min) + DOT + 'Max ' + naira0(d.max);
  if (a > 0) { const c = elecCharge(a); if (c.markup != null && c.markup > 0) t += DOT + 'Service charge ' + naira(c.markup) + DOT + 'Total ' + naira(c.total); }
  $('#elecFee').textContent = t;
}
async function verifyMeter() {
  const d = curDisco(), meter = $('#elecMeter').value.trim();
  if (!d) { toast('warn', 'Select DISCO', 'Choose your electricity company'); return; }
  if (!/^\d{8,15}$/.test(meter)) { fieldErr('elecMeterErr', 'Enter a valid meter number (8 to 15 digits)'); return; }
  clearErr('elecMeterErr');
  const key = d.id + '|' + elecCtx.type + '|' + meter, btn = $('#elecVerifyBtn');
  setBtnLoading(btn, 'Checking'); setVerifyRes('elecVerifyRes', 'loading');
  let q = '?meter=' + encodeURIComponent(meter) + '&disco=' + encodeURIComponent(d.id) + '&meterType=' + encodeURIComponent(elecCtx.type);
  if (d.raw.engineGroupId != null) q += '&engineGroupId=' + encodeURIComponent(d.raw.engineGroupId);
  const r = await api(EP.elecVerify + q);
  resetBtn(btn);
  if (elecCtx.disco !== d.id) return;
  if (r.ok && r.data.success) {
    const name = r.data.customerName || '';
    elecCtx.verified = { key: key, name: name || 'Customer' };
    setVerifyRes('elecVerifyRes', 'ok', { name: name || 'Meter verified' });
    toast('green', 'Meter verified', name);
  } else {
    elecCtx.verified = null; setVerifyRes('elecVerifyRes', 'bad', r.data.message);
    toast('red', 'Verification failed', r.data.message || 'Check the meter number, DISCO and meter type');
  }
}
function submitElec() {
  const d = curDisco(), meter = $('#elecMeter').value.trim(), amt = parseFloat($('#elecAmt').value);
  clearErr('elecMeterErr'); clearErr('elecAmtErr');
  if (!d) { toast('warn', 'Select DISCO', 'Choose your electricity company'); return; }
  if (!/^\d{8,15}$/.test(meter)) { fieldErr('elecMeterErr', 'Enter a valid meter number (8 to 15 digits)'); return; }
  if (!elecCtx.verified || elecCtx.verified.key !== d.id + '|' + elecCtx.type + '|' + meter) { fieldErr('elecMeterErr', 'Verify the meter number before you continue'); return; }
  if (!amt || amt < d.min || amt > d.max) { fieldErr('elecAmtErr', 'Enter an amount between ' + naira0(d.min) + ' and ' + naira0(d.max)); return; }
  const c = elecCharge(amt), cust = elecCtx.verified.name, mt = elecCtx.type === 'PREPAID' ? 'Prepaid' : 'Postpaid';
  const det = [['DISCO', d.name], ['Meter', meter], ['Customer', cust], ['Type', mt], ['Meter credit', naira(amt)]];
  if (c.markup != null && c.markup > 0) det.push(['Service charge', naira(c.markup)]);
  startPurchase({
    modal: 'elecModal', procSub: naira0(amt) + ' Electricity' + ARROW + meter,
    type: 'electricity', service: 'Electricity', amount: c.total, details: det,
    endpoint: EP.elecBuy, body: { disco: d.id, meter: meter, meterType: elecCtx.type, amount: amt }, label: d.label + ' ' + naira0(amt),
    receipt: (tx) => [['Service', 'Electricity'], ['DISCO', d.name], ['Meter', tx.meter || meter], ['Customer', cust], ['Meter type', mt], ['Meter credit', naira(isNum(tx.meterCredit) ? tx.meterCredit : amt)]]
      .concat(tx.reference ? [['Provider reference', tx.reference]] : []),
    pins: (tx) => tx.token ? [{ pin: String(tx.token), serial: '', type: 'Token' }] : []
  });
}

/* ============================================================================
   17. EXAM PINS
============================================================================ */
let examCtx = { plans: [], planId: null };
function examQty() { return Math.max(1, Math.min(20, parseInt($('#examQty').value, 10) || 1)); }
async function openExamModal(o) {
  o = o || {};
  examCtx = { plans: [], planId: null };
  $('#examQty').value = '1'; $('#examTotal').textContent = naira0(0);
  Modal.open('examModal');
  const wrap = $('#examCards'); skeleton(wrap, 3);
  let plans = fresh('exam');
  if (!plans) {
    const r = await api(EP.examPlans);
    if (!r.ok || !r.data.success) { wrap.innerHTML = emptyHTML('fa-graduation-cap', r.network ? 'No connection' : (r.data.message || 'Could not load exam pins'), 'examRetry'); $('#examRetry').onclick = () => openExamModal(o); return; }
    plans = r.data.plans || r.data.exams || []; planCache.exam = { t: Date.now(), v: plans };
  }
  examCtx.plans = plans;
  const want = o.planId != null ? plans.find(p => String(p.planId) === String(o.planId)) : null;
  examCtx.planId = want ? want.planId : null;
  renderExamCards(); updateExamTotal();
}
function renderExamCards() {
  const wrap = $('#examCards');
  wrap.innerHTML = examCtx.plans.length ? examCtx.plans.map(p =>
    '<div class="dc' + (String(examCtx.planId) === String(p.planId) ? ' sel' : '') + '" data-pid="' + esc(p.planId) + '"><div class="dc-ico"><i class="fas fa-graduation-cap"></i></div>' +
    '<div class="dc-info"><div class="dc-name">' + esc(p.planName || p.network) + ' <span class="dc-stock ' + (p.inStock === false ? 'out' : 'in') + '"></span></div>' + (p.network && p.planName ? '<div class="dc-validity">' + esc(p.network) + '</div>' : '') + '</div>' +
    '<div class="dc-price">' + naira0(p.sellingPrice) + '</div></div>').join('') : emptyHTML('fa-graduation-cap', 'No exam pins available right now');
  $$('#examCards .dc').forEach(el => { el.onclick = () => {
    const p = examCtx.plans.find(x => String(x.planId) === el.dataset.pid);
    if (p && p.inStock === false) { toast('warn', 'Out of stock', p.message || 'This pin is unavailable'); return; }
    examCtx.planId = el.dataset.pid; renderExamCards(); updateExamTotal();
  }; });
}
function updateExamTotal() { const p = examCtx.plans.find(x => String(x.planId) === String(examCtx.planId)); $('#examTotal').textContent = naira0(p ? num(p.sellingPrice) * examQty() : 0); }
function submitExam() {
  const p = examCtx.plans.find(x => String(x.planId) === String(examCtx.planId));
  if (!p) { toast('warn', 'Select exam', 'Choose an exam type'); return; }
  const qty = examQty(), total = num(p.sellingPrice) * qty, name = p.planName || p.network;
  startPurchase({
    modal: 'examModal', procSub: name + ' Pin' + (qty > 1 ? ' x' + qty : ''),
    type: 'exam', service: 'Exam Pins', amount: total, details: [['Exam', name], ['Quantity', qty], ['Unit price', naira0(p.sellingPrice)]],
    endpoint: EP.examBuy, body: { planId: p.planId, quantity: qty }, label: name + ' x' + qty,
    receipt: (tx) => [['Service', 'Exam Pins'], ['Exam', name], ['Quantity', tx.quantity || qty]],
    pins: (tx) => parsePins(tx.pin).map(x => ({ pin: x.pin, serial: x.serial, type: name }))
  });
}

/* ============================================================================
   18. EPIN PRINT
============================================================================ */
let epinCtx = { network: null, plans: [], planId: null };
function epinQty() { return Math.max(1, Math.min(20, parseInt($('#rcQty').value, 10) || 1)); }
function openEpinModal(o) {
  o = o || {};
  const net = netOf(o.network);
  epinCtx = { network: net ? net.id : null, plans: [], planId: null };
  renderNetChips('#rcChips', epinCtx, () => { epinCtx.planId = null; loadEpinPlans(epinCtx.network, {}); });
  $('#rcQty').value = '1'; $('#rcDenomGrid').innerHTML = ''; $('#rcTotal').textContent = naira0(0);
  Modal.open('rcModal');
  if (net) loadEpinPlans(net.id, o);
}
async function loadEpinPlans(netId, o) {
  const net = netOf(netId); if (!net) return;
  const wrap = $('#rcDenomGrid'); skeleton(wrap, 2);
  let plans = fresh('epin:' + net.api);
  if (!plans) {
    const r = await api(EP.epinPlans + '?network=' + encodeURIComponent(net.api));
    if (epinCtx.network !== netId) return;
    if (!r.ok || !r.data.success) { wrap.innerHTML = emptyHTML('fa-print', r.network ? 'No connection' : (r.data.message || 'Could not load amounts'), 'epinRetry'); $('#epinRetry').onclick = () => loadEpinPlans(netId, o); return; }
    plans = r.data.plans || []; planCache['epin:' + net.api] = { t: Date.now(), v: plans };
  }
  if (epinCtx.network !== netId) return;
  epinCtx.plans = plans;
  const want = o && o.planId != null ? plans.find(p => String(p.planId) === String(o.planId)) : null;
  epinCtx.planId = want ? want.planId : null;
  renderEpinCards(); updateEpinTotal();
}
function renderEpinCards() {
  const wrap = $('#rcDenomGrid');
  wrap.innerHTML = epinCtx.plans.length ? epinCtx.plans.map(p =>
    '<div class="denom' + (String(epinCtx.planId) === String(p.planId) ? ' sel' : '') + (p.inStock === false ? ' off' : '') + '" data-pid="' + esc(p.planId) + '">' + naira0(isNum(p.amount) ? p.amount : p.sellingPrice) +
    (isNum(p.amount) && p.amount !== p.sellingPrice ? '<small>Pay ' + naira0(p.sellingPrice) + '</small>' : '') + '</div>').join('') : emptyHTML('fa-print', 'No amounts available right now');
  $$('#rcDenomGrid .denom').forEach(el => { el.onclick = () => {
    const p = epinCtx.plans.find(x => String(x.planId) === el.dataset.pid);
    if (p && p.inStock === false) { toast('warn', 'Out of stock', p.message || 'This amount is unavailable'); return; }
    epinCtx.planId = el.dataset.pid; renderEpinCards(); updateEpinTotal();
  }; });
}
function updateEpinTotal() { const p = epinCtx.plans.find(x => String(x.planId) === String(epinCtx.planId)); $('#rcTotal').textContent = naira0(p ? num(p.sellingPrice) * epinQty() : 0); }
function submitEpin() {
  if (!epinCtx.network) { toast('warn', 'Select network', 'Choose a network'); return; }
  const p = epinCtx.plans.find(x => String(x.planId) === String(epinCtx.planId));
  if (!p) { toast('warn', 'Select amount', 'Choose an amount'); return; }
  const net = netOf(epinCtx.network), qty = epinQty(), total = num(p.sellingPrice) * qty;
  startPurchase({
    modal: 'rcModal', procSub: net.name + ' ' + p.planName + ' Epin' + (qty > 1 ? ' x' + qty : ''),
    type: 'epin', service: 'Epin Print', amount: total, details: [['Network', net.name], ['Plan', p.planName], ['Quantity', qty], ['Unit price', naira0(p.sellingPrice)]],
    endpoint: EP.epinBuy, body: { planId: p.planId, quantity: qty }, label: net.name + ' ' + p.planName + ' x' + qty,
    receipt: (tx) => [['Service', 'Epin Print'], ['Network', tx.network || net.api], ['Plan', tx.plan || p.planName], ['Quantity', tx.quantity || qty]],
    pins: (tx) => parsePins(tx.pins).map(x => ({ pin: x.pin, serial: x.serial, type: net.name + ' ' + p.planName }))
  });
}

/* ============================================================================
   19. BULK SMS
============================================================================ */
function smsNumbers() { return $('#smsNums').value.split(/[\s,;]+/).map(normalizePhone).filter(validLocal11).filter(n => !isExamplePhone(n)).filter((n, i, a) => a.indexOf(n) === i); }
function openSmsModal(o) {
  o = o || {};
  $('#smsSender').value = ''; $('#smsNums').value = o.phone || ''; $('#smsMsg').value = '';
  updateSmsCounts(); Modal.open('smsModal');
}
function updateSmsCounts() { const n = smsNumbers(); $('#smsCount').textContent = n.length; $('#smsCost').textContent = naira0(n.length * SMS_RATE); $('#smsLen').textContent = $('#smsMsg').value.length; }
function submitSms() {
  const sender = $('#smsSender').value.trim(), nums = smsNumbers(), msg = $('#smsMsg').value.trim();
  if (!sender) { toast('warn', 'Sender ID', 'Enter a sender ID'); return; }
  if (!nums.length) { toast('warn', 'Recipients', 'Enter at least one valid number'); return; }
  if (!msg) { toast('warn', 'Message', 'Type your message'); return; }
  if (msg.length > 160) { toast('warn', 'Too long', 'Max 160 characters'); return; }
  const cost = nums.length * SMS_RATE;
  startPurchase({
    modal: 'smsModal', procSub: nums.length + ' SMS',
    type: 'sms', service: 'Bulk SMS', amount: cost, details: [['Sender', sender], ['Recipients', nums.length], ['Rate', naira0(SMS_RATE) + ' per SMS']],
    endpoint: EP.smsSend, body: { sender: sender, numbers: nums, message: msg }, label: nums.length + ' SMS',
    receipt: () => [['Service', 'Bulk SMS'], ['Sender ID', sender], ['Recipients', nums.length], ['Message', msg.length > 40 ? msg.slice(0, 40) + '...' : msg]]
  });
}

/* ============================================================================
   20. TRANSFER  (SubHub user by phone number, other banks coming soon)
============================================================================ */
let trCtx = { recipient: null, phone: '' };
function openTransferChooser() { Modal.open('transferTypeModal'); }
function bankComingSoon() {
  Modal.close('transferTypeModal');
  showAlert({ icon: 'info', title: 'Coming soon', message: 'Transfers to other banks are coming soon. Use Send to SubHub User instead for now.', okLabel: 'Send to SubHub User', cancelLabel: 'Close', onOk: openTransferModal });
}
function openTransferModal() {
  Modal.close('transferTypeModal');
  trCtx = { recipient: null, phone: '' };
  $('#trRecipient').value = ''; $('#trAmt').value = ''; clearErr('trErr'); clearErr('trAmtErr');
  $('#trRecipientCard').style.display = 'none'; $('#trAmtGroup').style.display = 'none'; $('#trContinueBtn').style.display = 'none';
  $('#trAvail').textContent = naira(S.wallet.balance);
  Modal.open('transferModal');
}
async function lookupRecipient() {
  const phone = cleanPhoneInput($('#trRecipient').value); clearErr('trErr');
  if (isExamplePhone(phone)) { fieldErr('trErr', EXAMPLE_PHONE_MSG); return; }
  if (!validLocal11(phone)) { fieldErr('trErr', 'Enter a valid 11-digit phone number starting with 0'); return; }
  if (S.user && phone === S.user.phone) { fieldErr('trErr', 'You cannot send money to yourself'); return; }
  const btn = $('#trLookupBtn'); setBtnLoading(btn, '');
  const r = await api(EP.transferLookup + '?phone=' + encodeURIComponent(phone));
  resetBtn(btn);
  if (!r.ok || !r.data.success) {
    trCtx.recipient = null; $('#trRecipientCard').style.display = 'none'; $('#trAmtGroup').style.display = 'none'; $('#trContinueBtn').style.display = 'none';
    fieldErr('trErr', r.network ? 'No connection. Please try again.' : (r.data.message || 'No SubHub user found with this number')); return;
  }
  const u = r.data.user || r.data.recipient || r.data.data || r.data;
  const name = u.fullName || u.name || u.username || 'SubHub user';
  trCtx = { phone: phone, recipient: { name: name, username: u.username || '', pic: u.profilePicture || '' } };
  $('#trRecipientCard').style.display = 'block';
  $('#trRecipientCard').innerHTML = '<div style="display:flex;align-items:center;gap:11px;background:rgba(0,170,255,.06);border:1.5px solid rgba(0,170,255,.25);border-radius:16px;padding:12px;margin-bottom:13px">' +
    avatarBox(trCtx.recipient.pic, name, 'tr-av') + '<div style="flex:1;min-width:0"><div style="font-size:.9rem;font-weight:800">' + esc(name) + '</div><div style="font-size:.72rem;color:var(--muted);margin-top:2px">' + esc(phone) + '</div></div>' +
    '<i class="fas fa-circle-check" style="color:var(--success);font-size:1.1rem"></i></div>';
  $('#trAmtGroup').style.display = 'block'; $('#trContinueBtn').style.display = 'flex'; $('#trAvail').textContent = naira(S.wallet.balance);
}
function continueTransfer() {
  clearErr('trAmtErr');
  const amt = parseFloat($('#trAmt').value);
  if (!trCtx.recipient) { toast('warn', 'No recipient', 'Look up the phone number first'); return; }
  if (!amt || amt < 50) { fieldErr('trAmtErr', 'Minimum transfer is ' + naira0(50)); return; }
  if (S.balFresh && amt > S.wallet.balance) { fieldErr('trAmtErr', 'Insufficient. Balance: ' + naira(S.wallet.balance)); return; }
  const r = trCtx.recipient, phone = trCtx.phone;
  startPurchase({
    modal: 'transferModal', procTitle: 'Sending...', procSub: naira0(amt) + ARROW + r.name,
    type: 'wallet_transfer', service: 'Wallet Transfer', amount: amt, details: [['Recipient', r.name], ['Phone', phone]],
    endpoint: EP.transfer, body: { phone: phone, amount: amt }, label: naira0(amt) + ' to ' + r.name,
    receipt: () => [['Service', 'Wallet Transfer'], ['Recipient', r.name], ['Phone', phone]]
  });
}

/* ============================================================================
   21. LOAN, MORE
============================================================================ */
function openLoan() { renderLoanStart(); Modal.open('loanModal'); }
function renderLoanStart() {
  $('#loanBody').innerHTML = '<div class="alert-ico info" style="margin:6px auto 14px"><i class="fas fa-hand-holding-dollar"></i></div><div class="alert-ttl">Check your loan eligibility</div>' +
    '<div class="alert-msg">See if you qualify for a SubHub loan. It only takes a moment.</div><button class="btn-p" id="loanCheckBtn" style="margin-top:20px"><span>Check eligibility</span></button>';
  $('#loanCheckBtn').onclick = checkLoan;
}
async function checkLoan() {
  const btn = $('#loanCheckBtn'); setBtnLoading(btn, 'Checking');
  const [r] = await Promise.all([api(EP.loan), sleep(1200)]);
  if (!r.ok || !r.data.success) {
    resetBtn(btn);
    toast('red', 'Loan', r.network ? 'No connection. Please try again.' : (r.data.message || 'Loan check is not available right now'));
    return;
  }
  const d = r.data;
  if (d.eligible) {
    $('#loanBody').innerHTML = '<div class="alert-ico ok" style="margin:6px auto 14px"><i class="fas fa-check"></i></div><div class="alert-ttl">You are eligible</div>' +
      '<div class="alert-msg">' + esc(d.message || (isNum(d.limit) ? 'Your loan limit is ' + naira0(d.limit) + '.' : 'Your loan limit is ready.')) + '</div>' +
      '<button class="btn-p" id="loanOkBtn" style="margin-top:20px"><span>Got it</span></button>';
    $('#loanOkBtn').onclick = () => Modal.close('loanModal');
    return;
  }
  $('#loanBody').innerHTML = '<div class="alert-ico info" style="margin:6px auto 14px"><i class="fas fa-info"></i></div><div class="alert-ttl">Not eligible yet</div>' +
    '<div class="alert-msg">' + esc(d.message || 'Continue using SubHub to unlock your loan limit. The more you transact, the higher your limit grows.') + '</div>' +
    '<button class="btn-p" id="loanOkBtn" style="margin-top:20px"><span>Got it</span></button>' +
    '<button class="btn-sec" id="loanMoreBtn"><i class="fas fa-arrow-up-right-from-square"></i><span>Learn more about loans</span></button>';
  $('#loanOkBtn').onclick = () => Modal.close('loanModal');
  $('#loanMoreBtn').onclick = () => go(ROUTES.loanInfo);
}
function openMoreModal() {
  const item = (id) => { const s = CATALOG[id]; return '<button class="more-item" data-more="' + id + '">' + tagHTML(s) + '<div class="svc-ico ' + s.cls + '"><i class="fas ' + s.icon + '"></i></div><div class="more-item-info"><div class="more-item-name">' + s.label + '</div><div class="more-item-sub">' + s.sub + '</div></div></button>'; };
  $('#moreEverydayGrid').innerHTML = ['data', 'airtime', 'cable', 'electricity'].map(item).join('');
  $('#moreServicesGrid').innerHTML = ['exam', 'epin', 'crypto', 'loan', 'sms', 'engage', 'analytics'].map(item).join('');
  $('#moreAccountGrid').innerHTML = ['fund', 'transfer', 'notifications', 'settings'].map(item).join('');
  $$('#moreModal [data-more]').forEach(b => { b.onclick = () => { const id = b.dataset.more; Modal.close('moreModal'); setTimeout(() => openService(id), 200); }; });
  Modal.open('moreModal');
}

/* ============================================================================
   22. NOTIFICATIONS
============================================================================ */
const KNOWN_ICONS = new Set(["address-book", "arrow-down", "arrow-left", "arrow-right", "arrow-right-arrow-left", "arrow-up", "arrow-up-right-from-square", "bell", "bell-slash", "bolt", "box-open", "building-columns", "bullhorn", "chart-line", "check", "check-circle", "chevron-down", "chevron-right", "circle-check", "circle-info", "circle-xmark", "clipboard", "clock", "clock-rotate-left", "cog", "coins", "comment-dots", "copy", "credit-card", "crown", "database", "delete-left", "download", "ellipsis", "envelope", "envelope-circle-check", "eye", "eye-slash", "file-export", "fingerprint", "gear", "gift", "graduation-cap", "hand-holding-dollar", "home", "home-s", "id-card", "info", "link", "list", "list-ul", "lock", "medal", "moon", "paper-plane", "pen", "phone", "plus", "plus-circle", "print", "qrcode", "receipt", "receipt-s", "rocket", "rotate-right", "search", "send", "share-nodes", "shield-check", "shield-halved", "sign-out-alt", "spinner", "star", "sun", "tag", "th-large", "times", "trash", "trash-can", "triangle-exclamation", "tv", "user", "user-plus", "user-plus-s", "user-s", "user-shield", "user-slash", "users", "wallet", "wifi", "x", "xmark"]);
const CAT_ICON = { account: 'fa-user-shield', transaction: 'fa-circle-check', promo: 'fa-gift', service: 'fa-bullhorn', security: 'fa-shield-halved' };
const nid = (n) => n._id || n.id;
function notifIcon(n) { const k = String(n.icon || '').replace(/^fas\s+/, '').replace(/^fa-/, ''); return KNOWN_ICONS.has(k) ? 'fa-' + k : (CAT_ICON[n.category] || 'fa-bell'); }
const notifCat = (n) => CAT_ICON[n.category] ? n.category : 'account';
function renderBadge() { const el = $('#annDot'); el.textContent = S.unread > 9 ? '9+' : String(S.unread); el.classList.toggle('on', S.unread > 0); }
async function loadUnread() {
  const r = await api(EP.notifUnread);
  if (r.ok && r.data.success) { S.unread = num(r.data.count != null ? r.data.count : r.data.unreadCount); renderBadge(); }
}
async function openNotifications() {
  Modal.open('notifModal');
  const wrap = $('#notifList');
  if (!S.notifs.length) skeleton(wrap, 3);
  const r = await api(EP.notifications + '?limit=30');
  if (!r.ok || !r.data.success) { if (!S.notifs.length) wrap.innerHTML = emptyHTML('fa-bell-slash', r.network ? 'No connection' : 'Notifications are not available right now', 'notifRetry'); const b = $('#notifRetry'); if (b) b.onclick = openNotifications; return; }
  S.notifs = r.data.notifications || [];
  if (r.data.unreadCount != null) { S.unread = num(r.data.unreadCount); renderBadge(); }
  renderNotifList();
}
function renderNotifList() {
  const wrap = $('#notifList');
  if (!S.notifs.length) { wrap.innerHTML = emptyHTML('fa-bell-slash', 'No notifications'); return; }
  wrap.innerHTML = S.notifs.map(n =>
    '<div class="notif-item' + (n.read ? '' : ' unread') + '" data-id="' + esc(nid(n)) + '"><div class="notif-ico ' + notifCat(n) + '"><i class="fas ' + notifIcon(n) + '"></i></div>' +
    '<div class="notif-body"><div class="notif-ttl">' + esc(n.title) + '</div><div class="notif-msg">' + esc(n.message) + '</div><div class="notif-time">' + esc(fmtRel(n.createdAt)) + '</div></div></div>').join('');
  $$('#notifList .notif-item').forEach(el => { el.onclick = () => { const n = S.notifs.find(x => String(nid(x)) === el.dataset.id); if (n) readNotif(n); }; });
}
async function readNotif(n) {
  if (!n.read) {
    n.read = true; S.unread = Math.max(0, S.unread - 1); renderBadge(); renderNotifList();
    api(EP.notifications + '/' + encodeURIComponent(nid(n)) + '/read', { method: 'PATCH' });
  }
  openNotifDetail(n);
}
function openNotifDetail(n) {
  const btns = (n.buttons && n.buttons.length) ? n.buttons : [{ label: 'Got it', kind: 'primary' }];
  $('#ndBody').innerHTML = '<div class="nd-top"><div class="notif-ico ' + notifCat(n) + '"><i class="fas ' + notifIcon(n) + '"></i></div><div class="nd-ttl">' + esc(n.title) + '</div><div class="nd-time">' + esc(fmtDate(n.createdAt)) + '</div></div>' +
    '<div class="nd-msg">' + esc(n.message) + '</div><div class="nd-btns">' + btns.map((b, i) => '<button class="' + ((b.kind === 'secondary' || (i > 0 && !b.kind)) ? 'btn-sec' : 'btn-p') + '" data-nb="' + i + '" style="margin-top:0">' + esc(b.label) + '</button>').join('') + '</div>';
  $$('#ndBody [data-nb]').forEach(el => { el.onclick = () => {
    const b = btns[parseInt(el.dataset.nb, 10)], t = b.action || b.href;
    if (t) { Modal.close('notifDetailModal'); Modal.close('notifModal'); setTimeout(() => openTarget(b.action ? b.action : { href: b.href }), 200); } else Modal.close('notifDetailModal');
  }; });
  Modal.open('notifDetailModal');
}
function clearNotifs() {
  showAlert({ icon: 'warn', title: 'Clear all?', message: 'This removes all your notifications.', okLabel: 'Clear all', cancelLabel: 'Cancel', onOk: async () => {
    const r = await api(EP.notifications, { method: 'DELETE' });
    if (r.ok && r.data.success) { S.notifs = []; S.unread = 0; renderBadge(); renderNotifList(); toast('blue', 'Cleared', 'All notifications removed'); }
    else toast('red', 'Notifications', r.data.message || 'Could not clear right now');
  } });
}

/* ============================================================================
   23. ADMIN CONTENT: banner, service notices, popups, slides
============================================================================ */
/* [label](https://...) and plain https://... links in admin messages. Only http(s) and in-app / paths are allowed. */
function linkify(html) {
  return html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)|(^|[\s(>])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (m, label, url, pre, bare) => {
    const u = url || bare, text = label || bare;
    return (pre || '') + '<a href="#" class="fmt-link" data-href="' + u + '">' + text + '</a>';
  });
}
function formatMessage(text) {
  const bold = (t) => linkify(esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'));
  let html = '', list = [];
  const flush = () => { if (list.length) { html += '<ul>' + list.map(li => '<li><i class="fas fa-check-circle"></i><span>' + bold(li) + '</span></li>').join('') + '</ul>'; list = []; } };
  String(text || '').split('\n').forEach(l => { if (/^\s*-\s+/.test(l)) list.push(l.replace(/^\s*-\s+/, '')); else if (l.trim()) { flush(); html += '<p>' + bold(l) + '</p>'; } });
  flush(); return html;
}
const KIND_ICON = { info: 'fa-info', warn: 'fa-triangle-exclamation', success: 'fa-circle-check', danger: 'fa-circle-xmark' };
async function loadContent(noPopups) {
  const r = await api(EP.content);
  if (!r.ok || !r.data.success) return;
  const d = r.data;
  S.content = { banner: d.banner || null, notices: d.notices || {}, popups: d.popups || [], slides: d.slides || [] };
  renderAdminBanner(); renderNotices(); renderSlides();
  if (!noPopups) showPopups();
}
function renderAdminBanner() {
  const el = $('#adminBanner'), b = S.content.banner;
  const bsig = JSON.stringify(b || null); if (renderAdminBanner._sig === bsig) return; renderAdminBanner._sig = bsig;
  if (!b || b.active === false || !b.message) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const kind = KIND_ICON[b.kind] ? b.kind : 'info';
  el.className = 'admin-banner ' + kind; el.style.display = 'block';
  el.innerHTML = '<div class="ab-row"><div class="ab-ico"><i class="fas ' + KIND_ICON[kind] + '"></i></div><div class="ab-body">' + (b.title ? '<div class="ab-title">' + esc(b.title) + '</div>' : '') +
    '<div class="ab-msg">' + formatMessage(b.message) + '</div>' + (b.button && b.button.label ? '<button class="ab-btn" id="abBtn">' + esc(b.button.label) + '</button>' : '') + '</div></div>';
  if ($('#abBtn')) $('#abBtn').onclick = () => openTarget(b.button.action || (b.button.href ? { href: b.button.href } : null));
}
function renderNotices() {
  const nsig = JSON.stringify(S.content.notices || {}); if (renderNotices._sig === nsig) return; renderNotices._sig = nsig;
  $$('[data-notice]').forEach(el => {
    const n = S.content.notices[el.dataset.notice];
    if (!n || n.active === false || !n.message) { el.style.display = 'none'; el.innerHTML = ''; return; }
    const kind = KIND_ICON[n.kind] ? n.kind : 'info';
    el.className = 'svc-notice ' + kind; el.style.display = 'flex';
    el.innerHTML = '<div class="sn-ico"><i class="fas ' + KIND_ICON[kind] + '"></i></div><div class="sn-body">' + (n.title ? '<div class="sn-ttl">' + esc(n.title) + '</div>' : '') + '<div class="sn-msg">' + formatMessage(n.message) + '</div></div>';
  });
}
let popQueue = [], popShowing = false;
const popKey = (p) => String(p.id) + ':' + String(p.updatedAt || '');
function showPopups() {
  if (popShowing) return;
  const seen = store.get('sh_popups_seen', []);
  popQueue = (S.content.popups || []).filter(p => p && p.active !== false && !(p.showOnce && seen.indexOf(popKey(p)) > -1))
    .sort((a, b) => (num(a.priority) || 99) - (num(b.priority) || 99));
  nextPopup();
}
function nextPopup() { const p = popQueue.shift(); if (p) renderPopup(p); else popShowing = false; }
function renderPopup(a) {
  popShowing = true;
  const type = a.type || ((a.image && (a.title || a.message)) ? 'both' : a.image ? 'image' : 'text');
  let finished = false;
  const done = () => {
    if (finished) return; finished = true;
    if (a.showOnce) { const seen = store.get('sh_popups_seen', []); if (seen.indexOf(popKey(a)) === -1) { seen.push(popKey(a)); store.set('sh_popups_seen', seen.slice(-100)); } }
    Modal.hooks.annModal = null; Modal.close('annModal'); setTimeout(nextPopup, 300);
  };
  const hasLbl = (b) => !!(b && String(b.label || '').trim());          // a button with an empty label is not shown
  const buttons = (hasLbl(a.primary) || hasLbl(a.secondary)) ? '<div class="ann-btns">' + (hasLbl(a.primary) ? '<button class="ann-btn" id="annCta">' + esc(a.primary.label) + '</button>' : '') + (hasLbl(a.secondary) ? '<button class="ann-btn2" id="annDismiss">' + esc(a.secondary.label) + '</button>' : '') + '</div>' : '';
  const tgt = (b) => b ? (b.action || (b.href ? { href: b.href } : null)) : null;
  let html;
  if (type === 'image') {          // the whole flyer is shown (never cropped). Title, text and buttons are optional.
    const below = !!(a.title || a.message || buttons);
    html = '<div class="ann-hero full' + (below ? '' : ' solo') + '">' + imgBox('cover', a.image) + '<button class="ann-x" id="annX" aria-label="Close"><i class="fas fa-times"></i></button></div>' +
      (below ? '<div class="ann-wrap" style="padding-top:14px">' + (a.title ? '<div class="ann-title">' + esc(a.title) + '</div>' : '') + (a.message ? '<div class="ann-msg">' + formatMessage(a.message) + '</div>' : '') + buttons + '</div>' : '');
  }
  else if (type === 'text') html = '<button class="ann-x light" id="annX" aria-label="Close"><i class="fas fa-times"></i></button><div class="ann-wrap solo"><div class="alert-ico info"><i class="fas fa-bullhorn"></i></div>' + (a.title ? '<div class="ann-title">' + esc(a.title) + '</div>' : '') + '<div class="ann-msg">' + formatMessage(a.message) + '</div>' + buttons + '</div>';
  else html = '<div class="ann-hero">' + (a.image ? imgBox('cover', a.image) : '<i class="fas fa-rocket"></i>') + '<button class="ann-x" id="annX" aria-label="Close"><i class="fas fa-times"></i></button></div><div class="ann-wrap">' + (a.title ? '<div class="ann-title">' + esc(a.title) + '</div>' : '') + '<div class="ann-msg">' + formatMessage(a.message) + '</div>' + buttons + '</div>';
  $('#annContent').innerHTML = html; $('#annContent').style.position = 'relative';
  $('#annX').onclick = (e) => { e.stopPropagation(); done(); };
  if ($('#annDismiss')) $('#annDismiss').onclick = () => { const t = tgt(a.secondary); done(); if (t) setTimeout(() => openTarget(t), 250); };
  if ($('#annCta')) $('#annCta').onclick = () => { const t = tgt(a.primary); done(); if (t) setTimeout(() => openTarget(t), 250); };
  const heroEl = $('#annContent .ann-hero');
  if (heroEl && (a.action || a.href)) { heroEl.style.cursor = 'pointer'; heroEl.onclick = () => { const t = a.action || { href: a.href }; done(); setTimeout(() => openTarget(t), 250); }; }
  Modal.hooks.annModal = done;
  Modal.open('annModal', true);
}

/* ============================================================================
   24. EMAIL VERIFICATION BANNER (6-digit code)
============================================================================ */
const EV = { open: false, endAt: 0, timer: null, busy: false };
function evTick() {
  const btn = $('#ebResend'); if (!btn) return;
  const left = Math.max(0, Math.ceil((EV.endAt - Date.now()) / 1000));
  if (left > 0) { btn.disabled = true; btn.textContent = 'Resend in ' + left + 's'; }
  else { btn.disabled = false; btn.textContent = 'Resend code'; clearInterval(EV.timer); EV.timer = null; }
}
function evStartTimer() { if (EV.timer) clearInterval(EV.timer); EV.timer = setInterval(evTick, 1000); evTick(); }
const evCode = () => $$('.eb-box').map(b => b.value).join('');
function renderEmailBanner() {
  const el = $('#emailBanner'), u = S.user;
  if (!u || u.isVerified !== false) { el.style.display = 'none'; el.innerHTML = ''; if (EV.timer) { clearInterval(EV.timer); EV.timer = null; } return; }
  if (el.dataset.mode === (EV.open ? 'open' : 'closed') && el.innerHTML) { el.style.display = 'block'; return; }
  el.dataset.mode = EV.open ? 'open' : 'closed'; el.style.display = 'block';
  if (!EV.open) {
    el.innerHTML = '<div class="eb-row"><div class="eb-ico"><i class="fas fa-envelope"></i></div><div class="eb-txt"><div class="eb-title">Email isn\'t verified yet</div>' +
      '<div class="eb-msg">Verify ' + esc(u.email) + ' to secure your account and get receipts...</div></div><button class="eb-open" id="ebOpen">Open</button></div>';
    $('#ebOpen').onclick = () => { EV.open = true; renderEmailBanner(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    return;
  }
  el.innerHTML = '<div class="eb-full"><div class="eb-head"><div class="eb-ico"><i class="fas fa-envelope"></i></div><div class="eb-txt"><div class="eb-title">Verify your email</div></div>' +
    '<button class="eb-collapse" id="ebCollapse" aria-label="Close"><i class="fas fa-times"></i></button></div>' +
    '<div class="eb-lead">Enter the 6-digit code sent to <b>' + esc(u.email) + '</b>. Tap Resend if you did not get it.</div>' +
    '<div class="eb-benefits"><div class="eb-benefit"><i class="fas fa-check"></i>Recover your account if you forget your password</div><div class="eb-benefit"><i class="fas fa-check"></i>Get notified about every transaction</div><div class="eb-benefit"><i class="fas fa-check"></i>Receive security alerts about your wallet</div></div>' +
    '<div class="paste-row"><button type="button" class="paste-chip" id="ebPaste"><i class="fas fa-clipboard"></i> Paste code</button></div>' +
    '<div class="eb-boxes" id="ebBoxes">' + Array.from({ length: 6 }).map((_, i) => '<input class="eb-box" inputmode="numeric" autocomplete="' + (i === 0 ? 'one-time-code' : 'off') + '" aria-label="Digit ' + (i + 1) + '"/>').join('') + '</div>' +
    '<div class="eb-err" id="ebErr"></div><button class="btn-p" id="ebVerify" style="margin-top:0"><span>Verify email</span></button>' +
    '<div class="eb-resend"><span>Didn\'t get the code?</span><button id="ebResend"></button></div></div>';
  bindEvBoxes();
  $('#ebCollapse').onclick = () => { EV.open = false; renderEmailBanner(); };
  $('#ebVerify').onclick = submitEvCode;
  $('#ebResend').onclick = resendEv;
  $('#ebPaste').onclick = async () => { const t = await readClipboard(); if (t == null) { toast('warn', 'Paste', 'Long-press a box and tap Paste'); return; } const d = digitsOnly(t, 6); if (d) fillEv(0, d); else toast('warn', 'Paste', 'No 6-digit code found'); };
  if (EV.endAt > Date.now()) evStartTimer(); else { const b = $('#ebResend'); b.disabled = false; b.textContent = 'Resend code'; }
  const f = $('.eb-box'); if (f) f.focus();
}
function fillEv(start, digits) {
  const boxes = $$('.eb-box');
  digits.split('').forEach((c, k) => { const b = boxes[start + k]; if (b) { b.value = c; b.classList.add('filled'); } });
  const next = boxes[Math.min(start + digits.length, 5)]; if (next) next.focus();
  if (evCode().length === 6) submitEvCode();
}
function bindEvBoxes() {
  const boxes = $$('.eb-box');
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      $('#ebBoxes').classList.remove('err'); $('#ebErr').textContent = '';
      const d = b.value.replace(/\D/g, '');
      if (d.length > 1) { b.value = ''; fillEv(i, d.slice(0, 6 - i)); return; }
      b.value = d; b.classList.toggle('filled', !!d);
      if (d && i < 5) boxes[i + 1].focus();
      if (evCode().length === 6) submitEvCode();
    });
    b.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].classList.remove('filled'); boxes[i - 1].focus(); }
      else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus(); else if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
    });
    b.addEventListener('paste', e => { e.preventDefault(); const t = digitsOnly((e.clipboardData || window.clipboardData).getData('text'), 6); if (t) fillEv(0, t); });
  });
}
async function submitEvCode() {
  if (EV.busy) return;
  const code = evCode();
  if (code.length !== 6) { $('#ebErr').textContent = 'Enter all 6 digits'; toast('warn', 'Check your details', 'Enter all 6 digits of the code'); return; }
  EV.busy = true;
  const btn = $('#ebVerify'); setBtnLoading(btn, 'Verifying');
  const r = await api(EP.verifyEmail, { method: 'POST', auth: false, body: { email: S.user.email, code: code } });
  EV.busy = false;
  if (r.ok && r.data.success) {
    S.user.isVerified = true; EV.open = false; renderEmailBanner();
    toast('green', 'Email verified', r.data.message || 'Your email address is now verified'); loadMe(true); return;
  }
  resetBtn(btn);
  const msg = r.network ? 'No connection. Please try again.' : (r.data.message || 'That code is not correct. Try again.');
  $('#ebBoxes').classList.add('err'); $('#ebErr').textContent = msg; toast('red', 'Could not verify', msg);
  $$('.eb-box').forEach(b => { b.value = ''; b.classList.remove('filled'); });
  const f = $('.eb-box'); if (f) f.focus();
}
async function resendEv() {
  const btn = $('#ebResend'); if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = 'Sending...';
  const r = await api(EP.resendEmail, { method: 'POST', auth: false, body: { email: S.user.email } });
  if (r.ok && r.data.success) { EV.endAt = Date.now() + 30000; evStartTimer(); toast('green', 'Code sent', 'Check your inbox for a new code'); return; }
  if (r.status === 429) { EV.endAt = Date.now() + num(r.data.retryAfter || 30) * 1000; evStartTimer(); toast('warn', 'Please wait', r.data.message || 'Wait a moment before requesting another code'); return; }
  btn.disabled = false; btn.textContent = 'Resend code';
  toast('red', 'Could not send', r.network ? 'No connection. Please try again.' : (r.data.message || 'Please try again'));
}

/* ============================================================================
   25. THEME, BACK BUTTON, LOGOUT
============================================================================ */
function applyTheme(dark) { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); const i = $('#dmIco'); if (i) i.className = dark ? 'fas fa-sun' : 'fas fa-moon'; }
function toggleTheme() { const dark = document.documentElement.getAttribute('data-theme') !== 'dark'; applyTheme(dark); store.setRaw('sh_dark', dark ? '1' : '0'); }

/* The Android back button calls this first (see BACKEND_NEEDS.md, "Native app").
   true  = the page closed something, the app must not go back
   false = nothing open, the app goes back as usual */
function handleBack() {
  if (procOpen()) return true;
  if ($('#avDrop').classList.contains('show')) { $('#avDrop').classList.remove('show'); return true; }
  if ($('#saveBar').classList.contains('open')) { $('#saveBar').classList.remove('open'); editingId = null; return true; }
  const id = Modal.stack[Modal.stack.length - 1];
  if (!id) return false;
  if (id === 'contactsPage') closeContactsPage(); else Modal.close(id);
  return true;
}
window.__subhubHandleBack = handleBack;
window.subhubClearCache = clearCache;            // logout.js can call this too

function logout() {
  $('#avDrop').classList.remove('show');
  showAlert({ icon: 'warn', title: 'Log out?', message: 'Are you sure you want to log out of your account?', okLabel: 'Log out', cancelLabel: 'Cancel', onOk: () => {
    clearCache();
    if (typeof window.subhubLogout === 'function') window.subhubLogout();
    else { api('/auth/logout', { method: 'POST', body: { refreshToken: localStorage.getItem(REFRESH_KEY) || '' } }).finally(() => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); goLogin(); }); }
  } });
}

/* ============================================================================
   26. EVENTS + INIT
============================================================================ */
function bindEvents() {
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]'); if (c) { Modal.close(c.dataset.close); return; }
    if (e.target.classList && e.target.classList.contains('ov') && e.target.classList.contains('show')) Modal.close(e.target.id);
  });
  document.addEventListener('click', e => { if (e.target.closest('button,.svc,.prio-item,.nc,.dc,.denom,.qs-svc,.more-item,.bnav-i,.tx,.chip,.notif-item,.deposit-option,.contact-item,.promo-slide')) feedback('tap'); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') handleBack(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (Date.now() - S.lastMe > 30000) loadMe(true); loadUnread(); } });

  $('#dmBtn').onclick = toggleTheme;
  $('#annBtn').onclick = openNotifications;
  $('#clearNotifBtn').onclick = clearNotifs;
  const avBtn = $('#avBtn'), avDrop = $('#avDrop');
  avBtn.onclick = e => { e.stopPropagation(); avDrop.classList.toggle('show'); };
  document.addEventListener('click', e => { if (!avDrop.contains(e.target) && !avBtn.contains(e.target)) avDrop.classList.remove('show'); });
  $('#dd-profile').onclick = () => go(ROUTES.profile);
  $('#dd-fund').onclick = () => { avDrop.classList.remove('show'); openFundModal(); };
  $('#dd-ref').onclick = () => { avDrop.classList.remove('show'); const b = $('.ref-banner'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  $('#dd-logout').onclick = logout;

  $('#viewAllBtn').onclick = () => go(ROUTES.transactions);
  $('#viewAllBtn2').onclick = () => go(ROUTES.transactions);
  $$('.bnav-i').forEach(b => { b.onclick = () => {
    $$('.bnav-i').forEach(x => x.classList.remove('active')); b.classList.add('active');
    const n = b.dataset.nav;
    if (n === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (n === 'history') go(ROUTES.transactions); else if (n === 'fund') openFundModal();
    else if (n === 'referral') go(ROUTES.referrals); else if (n === 'profile') go(ROUTES.profile);
  }; });

  /* recents + contacts */
  $('#saveContactBtn').onclick = () => { if ($('#saveBar').classList.contains('open')) $('#saveBar').classList.remove('open'); else openSaveBar(null); };
  $('#scCancelBtn').onclick = () => { $('#saveBar').classList.remove('open'); editingId = null; };
  $('#scSaveBtn').onclick = saveContactForm;
  bindPhoneInput('scPhone');
  $('#rnSearch').oninput = e => renderRecents(e.target.value);
  $('#exportContactsBtn').onclick = exportRecents;
  $('#viewAllContactsBtn').onclick = openContactsPage;
  $('#contactsBackBtn').onclick = closeContactsPage;

  /* data */
  $('#plansWrap').addEventListener('click', e => {
    const stock = e.target.closest('.dc-stock'); if (stock) { e.stopPropagation(); const n = stock.dataset.note; toast(n ? 'warn' : 'blue', n ? 'Note' : 'Status', n || (stock.classList.contains('in') ? 'In stock' : 'Out of stock')); return; }
    const buy = e.target.closest('[data-buy]');
    if (buy) { e.stopPropagation(); const p = dataCtx.plans.find(x => String(x.planId) === buy.dataset.buy); if (p) { dataCtx.planId = p.planId; buyDataPlan(p); } return; }
    const row = e.target.closest('.dc[data-pid]');
    if (row) { dataCtx.planId = row.dataset.pid; $$('#plansWrap .dc').forEach(x => x.classList.remove('sel', 'flash')); row.classList.add('sel'); }
  });
  bindPhoneInput('dataPhone', () => updatePhoneState('dataPhone', 'dataPhoneState', dataCtx.network));

  /* airtime */
  bindPhoneInput('atPhone', () => updatePhoneState('atPhone', 'atPhoneState', airCtx.network));
  $$('[data-atamt]').forEach(b => { b.onclick = () => { $('#atAmt').value = b.dataset.atamt; $$('[data-atamt]').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); }; });
  $('#atSubmit').onclick = submitAirtime;

  /* cable + electricity */
  $('#cableVerifyBtn').onclick = verifyCard;
  $('#cableCard').addEventListener('input', e => { e.target.value = digitsOnly(e.target.value, 12); cableInvalidate(); });
  $('#cableSubmit').onclick = submitCable;
  $('#elecVerifyBtn').onclick = verifyMeter;
  $('#elecMeter').addEventListener('input', e => { e.target.value = digitsOnly(e.target.value, 15); elecInvalidate(); });
  $('#elecAmt').addEventListener('input', updateElecHint);
  $$('[data-eamt]').forEach(b => { b.onclick = () => { $('#elecAmt').value = b.dataset.eamt; $$('[data-eamt]').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); updateElecHint(); }; });
  $('#elecSubmit').onclick = submitElec;

  /* exam, epin, sms */
  $('#examQty').addEventListener('input', updateExamTotal); $('#examSubmit').onclick = submitExam;
  $('#rcQty').addEventListener('input', updateEpinTotal); $('#rcSubmit').onclick = submitEpin;
  $('#smsNums').addEventListener('input', updateSmsCounts); $('#smsMsg').addEventListener('input', updateSmsCounts); $('#smsSubmit').onclick = submitSms;

  /* transfer */
  $('#trTypeSubhub').onclick = openTransferModal;
  $('#trTypeBank').onclick = bankComingSoon;
  bindPhoneInput('trRecipient', e => { if (e.target.value.length === 11) lookupRecipient(); else { trCtx.recipient = null; $('#trRecipientCard').style.display = 'none'; $('#trAmtGroup').style.display = 'none'; $('#trContinueBtn').style.display = 'none'; } });
  $('#trLookupBtn').onclick = lookupRecipient;
  $('#trContinueBtn').onclick = continueTransfer;

  /* confirm + pin */
  $('#confProceedBtn').onclick = () => { Modal.close('confirmModal'); if (confirmCfg && confirmCfg.onProceed) confirmCfg.onProceed(); };
  $('#pinKp').addEventListener('click', e => { const b = e.target.closest('[data-pk]'); if (b) pinKey(b.dataset.pk); });
}

//SCROLL FROM EVERYDAY SERVICES TO OTHER SERVICES
document.getElementById('viewAllServicesBtn')?.addEventListener('click', () => {
  const target = document.getElementById('otherServices');
  
  if (!target) return;
  
  const headerOffset = 80; // Daidaita da tsayin sticky header
  const targetPosition =
    target.getBoundingClientRect().top +
    window.scrollY -
    headerOffset;
  
  window.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  });
});


/* ----- phone settings (Android) ----- */
function openAppSettings() {
  try { if (window.AndroidApp && window.AndroidApp.openAppSettings) { window.AndroidApp.openAppSettings(); return; } } catch (e) {}
  toast('blue', 'Settings', 'Open your phone Settings, then Apps, SubHub, Permissions.');
}
function openNotifSettings() {
  try { if (window.AndroidApp && window.AndroidApp.openNotificationSettings) { window.AndroidApp.openNotificationSettings(); return; } } catch (e) {}
  openAppSettings();
}
function notifEnabled() {
  try { return !(window.AndroidApp && window.AndroidApp.notificationsEnabled) || window.AndroidApp.notificationsEnabled() !== false; } catch (e) { return true; }
}
/* Android stops asking for notification permission after two refusals, so the user has to go to Settings. */
function maybePromptNotifications() {
  if (!isApp() || notifEnabled() || document.visibilityState !== 'visible') return;
  if (Date.now() < num(store.raw('sh_notif_snooze'))) return;
  if (Modal.stack.length || popShowing || procOpen()) return;
  showAlert({
    icon: 'info', title: 'Turn on notifications', message: 'Notifications are off for SubHub. Turn them on to get instant alerts for your payments and wallet funding.',
    okLabel: 'Open settings', cancelLabel: 'Not now', onOk: openNotifSettings,
    onCancel: () => store.setRaw('sh_notif_snooze', String(Date.now() + 3 * 86400000))
  });
}

/* ----- pull to refresh (the Android app calls this): data is replaced in place, the page never reloads or jumps ----- */
async function refreshData() {
  await Promise.all([loadMe(true), loadTransactions(true), loadContent(true), loadUnread()]);
}
window.__subhubRefresh = function () {
  refreshData().catch(() => {}).then(() => { try { if (window.AndroidApp && window.AndroidApp.refreshDone) window.AndroidApp.refreshDone(); } catch (e) {} });
  return true;
};
/* the user came back to the app (for example from the phone's settings after allowing contacts) */
window.__subhubAppResumed = function () {
  try {
    if ($('#contactsPage').classList.contains('show') && !CT.loaded && CT.msg && isApp()) loadDeviceContacts().then(() => renderContactsList());
    if (S.user && Date.now() - S.lastMe > 30000) loadMe(true);
  } catch (e) {}
};

function startWalletAuto() {
  if (WAUTO.timer) return;
  WAUTO.timer = setInterval(() => {
    if (document.visibilityState !== 'visible' || Modal.stack.length || procOpen()) return;
    if (Date.now() - WAUTO.t < 8000) return;                     // the user just used the slider
    const total = 1 + buildVaCards().length; if (total < 2) return;
    const sl = $('#walletSlider'); if (!sl) return;
    const r = sl.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return;
    slideTo('wallet', Sl.wallet + 1, total);
  }, 4500);
}

/* styles that belong to the scripts above (kept here so the CSS files do not have to change) */
function injectCss() {
  if (document.getElementById('sh-js-css')) return;
  const st = document.createElement('style'); st.id = 'sh-js-css';
  st.textContent = [
    '#fundVATrack.fund-list{display:flex!important;flex-direction:column;gap:12px;transform:none!important;width:100%;padding:2px 0 6px;touch-action:pan-y}',
    '#fundVATrack.fund-list *{touch-action:pan-y}',
    '#fundVATrack.fund-list.fund-inner{max-height:min(54vh,430px);overflow-y:auto;-webkit-overflow-scrolling:touch}',
    '#fundVATrack.fund-list>.wallet-card{flex:0 0 auto!important;width:100%!important;min-width:0;margin:0}',
    '#fundSlider{overflow:visible!important;height:auto!important;touch-action:auto!important}',
    '.proc-wait{margin-top:14px;font-size:.74rem;font-weight:600;color:var(--muted);animation:procPulse 1.4s ease-in-out infinite}',
    '@keyframes procPulse{0%,100%{opacity:.4}50%{opacity:1}}',
    '.fmt-link{color:#00aaff;font-weight:700;text-decoration:underline;word-break:break-word}',
    '.ct-skel{pointer-events:none}',
    '.ct-count{font-size:.74rem;font-weight:700;color:var(--muted);padding:2px 4px 8px}',
    '#annContent{max-height:92vh;overflow-y:auto}',
    '.ann-hero.full{height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;display:block!important}',
    '.ann-hero.full .imgbox{position:relative!important;display:block!important;width:100%!important;height:auto!important;aspect-ratio:auto!important;min-height:170px}',
    '.ann-hero.full .imgbox.loaded{min-height:0!important}',
    '.ann-hero.full .imgbox img{position:static!important;display:block!important;width:100%!important;height:auto!important;max-height:72vh;object-fit:contain!important}'
  ].join('\n');
  document.head.appendChild(st);
}

async function init() {
  if (!localStorage.getItem(TOKEN_KEY)) { goLogin(); return; }
  injectCss(); ensureTxCount();
  applyTheme(store.raw('sh_dark') === '1');
  S.recents = loadRecents();
  const cached = loadCache();
  updateGreeting(); setInterval(updateGreeting, 30000);
  renderServices(); renderSlides(); startPromoTimer(); renderRecents();
  renderBadge();
  if (cached) { renderAccount(); renderTransactions(); }          // last known data at once, the API updates it a moment later
  else { renderWallet(); renderStats(); setTxCount('...'); $('#txList').innerHTML = ''; skeleton($('#txList'), 3); }
  bindEvents(); initPasteChips(); watchImages();
  document.addEventListener('click', e => {                     // links inside admin messages
    const a = e.target.closest && e.target.closest('a.fmt-link'); if (!a) return;
    e.preventDefault(); const h = a.dataset.href; if (h) openTarget({ href: h });
  });
  startWalletAuto();
  await loadMe();
  loadTransactions(); loadContent(); loadUnread();
  setTimeout(maybePromptNotifications, 8000);
  setTimeout(() => {                                             // names for saved numbers + the contacts count, without asking for anything
    try { if (window.AndroidContacts && window.AndroidContacts.hasContactsPermission && window.AndroidContacts.hasContactsPermission() && !CT.loaded) loadDeviceContacts(); } catch (e) {}
  }, 3000);
  setInterval(() => { if (document.visibilityState === 'visible') loadUnread(); }, 60000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
