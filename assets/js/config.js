/* ============================================================
   SubHub — config.js        (load this file FIRST)
   Shared settings + helpers used by login.js, sign-up.js and pin.js.
   Change the server address here only.
============================================================ */
(function () {
'use strict';

const API_BASE         = 'https://subhub-sandbox.onrender.com/api';
const REFRESH_ENDPOINT = '/auth/refresh-token';   // POST { refreshToken } -> { success, accessToken, refreshToken? }
const HOME_URL         = '/app/index.html';

const K = {
  access:'sh_access_token', refresh:'sh_refresh_token', remember:'subhub_login_creds',
  bioOwner:'sh_bio_owner',       // username the saved fingerprint belongs to
  bioDeclined:'sh_bio_declined', // username that cancelled the fingerprint set-up
  dark:'sh_dark'
};

const $ = id => document.getElementById(id);
const ico = n => '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
function setIcon(svg, name){ svg.querySelector('use').setAttribute('href', '#i-' + name); }

/* storage (falls back to memory if localStorage is blocked) */
const mem = {};
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return k in mem ? mem[k] : null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){ mem[k] = String(v); } },
  del(k){ try { localStorage.removeItem(k); } catch(e){ delete mem[k]; } }
};

/* state shared by login + signup */
const app   = { busy:false };
const state = { mode:'first', saved:null, editing:false };   // modes: first | bio | pw | signup

function setLoading(btn, on){ btn.disabled = on; btn.classList.toggle('loading', on); }

/* ---- vibration: every error calls this (needs VIBRATE permission in the Android app) ---- */
const ERR_VIB = [90, 50, 90, 50, 200];
let lastVib = 0;
function vibrate(p){
  const now = Date.now();
  if (now - lastVib < 450) return;       // a toast + a shake = one buzz, not two
  lastVib = now;
  try { if (navigator.vibrate) navigator.vibrate(p || ERR_VIB); } catch(e){}
}
function errorFeedback(target){
  target = target || $('card');
  target.classList.remove('enter','shake'); void target.offsetWidth; target.classList.add('shake');
  vibrate();
}

/* ---- toast (login style) ---- */
function showToast(title, msg, type, duration){
  type = type || 'info'; duration = duration || 3500;
  if (type === 'error' || type === 'warn') vibrate();
  const icons = { success:'check', error:'x', info:'info', warn:'warn' };
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const i = document.createElement('div'); i.className = 'toast-ico'; i.innerHTML = ico(icons[type] || 'info');
  const body = document.createElement('div'); body.className = 'toast-body';
  const t = document.createElement('div'); t.className = 'toast-title'; t.textContent = title; body.appendChild(t);
  if (msg) { const m = document.createElement('div'); m.className = 'toast-msg'; m.textContent = msg; body.appendChild(m); }
  const close = document.createElement('button'); close.type = 'button'; close.className = 'toast-close';
  close.setAttribute('aria-label','Dismiss'); close.innerHTML = ico('x');
  const bar = document.createElement('div'); bar.className = 'toast-bar'; bar.style.animationDuration = duration + 'ms';

  el.append(i, body, close, bar);
  const dismiss = () => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  close.addEventListener('click', e => { e.stopPropagation(); dismiss(); });
  el.addEventListener('click', dismiss);
  $('toastContainer').appendChild(el);
  setTimeout(dismiss, duration);
}

/* ---- API ---- */
async function apiCall(endpoint, options){
  options = options || {};
  try {
    const res = await fetch(API_BASE + endpoint, Object.assign({}, options, { headers: Object.assign({ 'Content-Type':'application/json' }, options.headers || {}) }));
    let data = {}; try { data = await res.json(); } catch(e){}
    return Object.assign({}, data, { status: res.status, ok: res.ok });
  } catch(e){
    return { success:false, network:true, message:'Network error, please check your connection' };
  }
}

/* ---- loader (logo) + error sheet ---- */
const proc = { ov:$('procOverlay'), loader:$('procLoader'), box:$('procBox'), lt:$('procLoadTitle'), ls:$('procLoadSub'), title:$('procTitle'), sub:$('procSub'), btn:$('procBtn') };
function loaderShow(t, s){ proc.box.hidden = true; proc.lt.textContent = t; proc.ls.textContent = s; proc.loader.hidden = false; proc.ov.hidden = false; }
function procHide(){ proc.ov.hidden = true; proc.loader.hidden = true; proc.box.hidden = true; }
function errorSheet(title, msg){
  proc.loader.hidden = true; proc.box.classList.remove('shake');
  proc.title.textContent = title; proc.sub.textContent = msg;
  proc.box.hidden = false; proc.ov.hidden = false;
  errorFeedback(proc.box); proc.btn.focus();
}

function getDeviceId(){
  let id = store.get('sh_device_id');
  if (!id) {
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
       : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    store.set('sh_device_id', id);
  }
  return id;
}

window.SubHub = {
  API_BASE, REFRESH_ENDPOINT, HOME_URL, K, $, ico, setIcon, store, app, state,
  setLoading, vibrate, errorFeedback, showToast, apiCall, proc, loaderShow, procHide, errorSheet
};
})();
