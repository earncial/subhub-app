/* ============================================================================
   SubHub  |  transactions.js   (real API, no demo code)

   Runs inside the SubHub Android WebView and in a normal browser.
   Native bridges are feature detected: AndroidShare, AndroidDownload,
   AndroidClipboard, AndroidFeedback.

   ONE request loads the transactions. Period, type, status, direction, search,
   sort, summary, chart and statement are all done here in the page.
   BACKEND CONTRACT: see TRANSACTIONS_API.md. Short version:
     GET /transactions                      (all of the user's transactions)
     GET /transactions/:reference?refresh=1 (only for Check status)
   Change any endpoint name in the EP block, nothing else needs touching.
============================================================================ */
(function () {
'use strict';

/* ============================================================================
   1. CONFIG
============================================================================ */
const API_BASE = 'https://subhub-sandbox.onrender.com/api';            // same value as app.js
const TOKEN_KEY = 'sh_access_token';
const REFRESH_KEY = 'sh_refresh_token';
const LOGIN_URL = '/';
const DASH_URL = '/app/index.html';
const REPORT_URL = '/app/report.html';                    // opened with ?ref=<reference>
const LOGO_URL = '/logo.png';                             // if it cannot load, the vector S is used
const EP = {
  refresh: '/auth/refresh-token',
  list: '/transactions',
  one: ref => '/transactions/' + encodeURIComponent(ref)
};
const PAGE = 15;

/* where "Buy again" sends the user. The dashboard can read these query values. */
const buyAgainUrl = x => DASH_URL + '?buy=' + encodeURIComponent(x.type) + (x.net ? '&network=' + encodeURIComponent(x.net) : '') + (x.to ? '&to=' + encodeURIComponent(x.to) : '') + (x.plan ? '&plan=' + encodeURIComponent(x.plan) : '');

/* ============================================================================
   2. HELPERS + OFFLINE ICONS
============================================================================ */
const $ = id => document.getElementById(id);
const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const isNum = v => typeof v === 'number' && isFinite(v);
const naira = (n, d) => '\u20A6' + num(n).toLocaleString('en-NG', { minimumFractionDigits: d === 0 ? 0 : 2, maximumFractionDigits: d === 0 ? 0 : 2 });
const DAY = 86400000;
const store = { raw(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, setRaw(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };
const goLogin = () => { window.location.replace(LOGIN_URL); };
const go = url => { window.location.href = url; };

const P = {
  back:'<path d="M19 12H5M11 6l-6 6 6 6"/>', x:'<path d="M6 6l12 12M18 6 6 18"/>', chev:'<path d="m9 6 6 6-6 6"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', filter:'<path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/>',
  download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4"/><path d="m8.7 13.3 6.6 4.4"/>',
  repeat:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2-2.5 3.5"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>',
  check:'<path d="M5 12.5 10 17 19 7"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/>',
  warn:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  inbox:'<path d="M3 13l3-8h12l3 8"/><path d="M3 13v6h18v-6h-5l-1 2h-6l-1-2H3z"/>',
  all:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  wifi:'<path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
  call:'<path d="M4.5 3h3.8l1.7 4.4-2.3 2.3a12.5 12.5 0 0 0 6.1 6.1l2.3-2.3 4.4 1.7v3.8a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 2.7 5a1.8 1.8 0 0 1 1.8-2z"/>',
  tv:'<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M17 2l-5 5-5-5"/>',
  bulb:'<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  cap:'<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
  ticket:'<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  message:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  wallet:'<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2h-3.2a2.2 2.2 0 0 0 0 4.4H19V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><circle cx="16.4" cy="13.2" r="1" fill="currentColor" stroke="none"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  img:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/>',
  code:'<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  sheet:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'
};
const ico = n => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>';
const fillIcons = r => (r || document).querySelectorAll('[data-ico]').forEach(e => { e.innerHTML = ico(e.dataset.ico); });

/* ============================================================================
   3. NATIVE FEEDBACK, TOAST, SHEET, COPY
============================================================================ */
const lastFb = {};
function feedback(type) {
  const now = Date.now();
  if (lastFb[type] && now - lastFb[type] < 80) return;
  lastFb[type] = now;
  try {
    if (window.AndroidFeedback && window.AndroidFeedback.play) { window.AndroidFeedback.play(type); return; }
    if (navigator.vibrate) navigator.vibrate(type === 'error' ? [90, 50, 90, 50, 200] : type === 'success' ? [35, 60, 35] : 15);
  } catch (e) {}
}
function toast(title, msg, type, ms) {
  type = type || 'info'; ms = ms || 3500;
  if (type === 'success') feedback('success'); else if (type === 'error' || type === 'warn') feedback('error');
  const ic = { success:'check', error:'x', info:'info', warn:'warn' };
  const t = el('div', 'toast ' + type);
  t.innerHTML = '<span class="t-i">' + ico(ic[type] || 'info') + '</span><div style="flex:1;min-width:0"><b>' + esc(title) + '</b>' + (msg ? '<span class="m">' + esc(msg) + '</span>' : '') + '</div><i class="bar2" style="animation-duration:' + ms + 'ms"></i>';
  const out = () => { if (t.classList.contains('out')) return; t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  t.addEventListener('click', out); $('toasts').appendChild(t); setTimeout(out, ms);
}
let openCtl = null, rcOpen = null;
function sheet(html, onClose) {
  if (openCtl) openCtl.close();
  const ov = el('div', 'ov'), sh = el('div', 'sheet');
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
  sh.innerHTML = '<span class="grab"></span><button class="sheet-x" type="button" aria-label="Close">' + ico('x') + '</button>' + html;
  ov.appendChild(sh); document.body.appendChild(ov); document.body.classList.add('lock'); fillIcons(sh);
  const ctl = { ov, sh, close() { ov.remove(); if (!rcOpen) document.body.classList.remove('lock'); if (openCtl === ctl) openCtl = null; if (onClose) onClose(); } };
  sh.querySelector('.sheet-x').addEventListener('click', ctl.close);
  ov.addEventListener('click', e => { if (e.target === ov) ctl.close(); });
  openCtl = ctl; return ctl;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (openCtl) openCtl.close(); else if (rcOpen) closeReceipt(); } });

function copy(text, msg) {
  text = String(text == null ? '' : text);
  let ok = false;
  try { if (window.AndroidClipboard && window.AndroidClipboard.setText) { window.AndroidClipboard.setText(text); ok = true; } } catch (e) {}
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px';
      document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
      ok = document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) { ok = false; }
  }
  if (!ok && navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => toast(msg || 'Copied', '', 'success', 2000), () => toast('Copy it by hand', text, 'info', 4500)); return; }
  if (ok) toast(msg || 'Copied', '', 'success', 2000); else toast('Copy it by hand', text, 'info', 4500);
}

/* ============================================================================
   4. API  (tokens, refresh, session expiry). Same behaviour as app.js
============================================================================ */
function timedFetch(url, init, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, Object.assign({}, init, { signal: ctl.signal })).finally(() => clearTimeout(t));
}
let sessionEnded = false;
function endSession(title, message) {
  if (sessionEnded) return;
  sessionEnded = true;
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); } catch (e) {}
  toast(title || 'Session expired', message || 'Please login again', 'error');
  setTimeout(goLogin, 2500);
}
let refreshing = null;
function refreshAccess() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return { ok: false, expired: true };
    try {
      const res = await timedFetch(API_BASE + EP.refresh, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) }, 20000);
      let data = {}; try { data = await res.json(); } catch (e) {}
      if (res.ok && data.success && data.accessToken) {
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
        return { ok: true };
      }
      if (res.status === 401 || data.code === 'REFRESH_TOKEN_EXPIRED' || data.code === 'INVALID_TOKEN') return { ok: false, expired: true };
      return { ok: false, expired: false };
    } catch (e) { return { ok: false, expired: false }; }
  })();
  const clear = () => { refreshing = null; };
  refreshing.then(clear, clear);
  return refreshing;
}
const netFail = e => ({ ok: false, status: 0, network: true, timeout: !!(e && e.name === 'AbortError'), data: { success: false, message: 'Connection problem. Please check your internet and try again.' } });
async function api(path, opts) {
  opts = opts || {};
  const send = async () => {
    const headers = { 'Accept': 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const res = await timedFetch(API_BASE + path, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }, opts.timeout || 30000);
    let data = {}; try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data: data || {} };
  };
  let r;
  try { r = await send(); } catch (e) { return netFail(e); }
  if (r.status === 401) {
    const code = r.data && r.data.code;
    if (code === 'ACCOUNT_SUSPENDED') { endSession('Account suspended', r.data.message || 'Your account has been suspended, contact support'); return r; }
    if (code === 'ACCESS_TOKEN_EXPIRED' || code === 'INVALID_TOKEN') {
      const rf = await refreshAccess();
      if (rf.ok) {
        try { r = await send(); } catch (e) { return netFail(e); }
        const c2 = r.data && r.data.code;
        if (r.status === 401 && (c2 === 'ACCESS_TOKEN_EXPIRED' || c2 === 'INVALID_TOKEN')) endSession();
      } else if (rf.expired) endSession();
      else return netFail();
    }
  }
  return r;
}
const failMsg = (r, fallback) => r.network ? 'No connection. Check your internet and try again.' : ((r.data && r.data.message) || fallback);

/* ============================================================================
   5. TRANSACTION MODEL  (backend fields in, page fields out)
============================================================================ */
const TYPES = {
  data:{ label:'Data', icon:'wifi', tint:'t-blue', c:'#00aaff' },
  airtime:{ label:'Airtime', icon:'call', tint:'t-green', c:'#00c07a' },
  cable:{ label:'Cable TV', icon:'tv', tint:'t-purple', c:'#8b5cf6' },
  electricity:{ label:'Electricity', icon:'bulb', tint:'t-amber', c:'#f59e0b' },
  exam:{ label:'Exam PIN', icon:'cap', tint:'t-pink', c:'#ff4d8d' },
  epin:{ label:'Recharge card', icon:'ticket', tint:'t-blue', c:'#4fc4ff' },
  sms:{ label:'Bulk SMS', icon:'message', tint:'t-green', c:'#35d49b' },
  funding:{ label:'Wallet funding', icon:'wallet', tint:'t-green', c:'#00c07a' }
};
const OTHER = { label:'Other', icon:'file', tint:'t-gray', c:'#8096b8' };
const typeOf = x => TYPES[x.type] || OTHER;
const CHIPS = [['all', 'All', 'all'], ['data', 'Data', 'wifi'], ['airtime', 'Airtime', 'call'], ['cable', 'Cable', 'tv'], ['electricity', 'Electricity', 'bulb'], ['exam', 'Exam', 'cap'], ['epin', 'Recharge cards', 'ticket'], ['sms', 'SMS', 'message'], ['funding', 'Funding', 'wallet']];
const NET = { mtn:'MTN', airtel:'Airtel', glo:'Glo', '9mobile':'9mobile' };
const STX = { success:['Successful', 'st-ok'], pending:['Pending', 'st-pending'], failed:['Failed', 'st-failed'] };

function statusOf(s) {
  s = String(s || '').toLowerCase();
  if (['success', 'successful', 'completed', 'delivered'].indexOf(s) > -1) return 'success';
  if (['failed', 'failure', 'error', 'refunded', 'reversed'].indexOf(s) > -1) return 'failed';
  return 'pending';
}
const netKey = n => { const k = String(n || '').toLowerCase().replace(/\s/g, ''); return NET[k] ? k : ''; };
const toTs = v => { const t = typeof v === 'number' ? v : Date.parse(v); return isNaN(t) ? 0 : t; };
function attemptOf(a) { return { provider: a.provider || 'Provider', status: statusOf(a.status), ts: toTs(a.createdAt || a.ts) }; }

function normalize(r) {
  const nk = netKey(r.network), nn = NET[nk] || '', q = num(r.quantity) || 1, before = r.balanceBefore, after = r.balanceAfter;
  const x = {
    id: r.reference, ref: r.reference, type: r.type, ts: toTs(r.createdAt), status: statusOf(r.status), amount: num(r.amount),
    credit: r.credit === true || r.direction === 'credit' || r.type === 'funding',
    before: before == null ? null : num(before), after: after == null ? null : num(after),
    net: nk, netName: nn, to: r.to || '', plan: r.plan || '', attempts: Array.isArray(r.attempts) ? r.attempts.map(attemptOf) : [], rows: []
  };
  if (r.type === 'data') { x.title = (nn + ' ' + (r.plan || '')).trim() || 'Data'; x.who = r.to; x.rows = [['Network', nn], ['Plan', r.plan]]; if (r.validity) x.rows.push(['Validity', r.validity]); x.rows.push(['Phone number', r.to]); }
  else if (r.type === 'airtime') { x.title = nn + ' airtime \u00B7 ' + naira(r.value, 0); x.who = r.to; x.rows = [['Network', nn], ['Airtime value', naira(r.value, 0)], ['Phone number', r.to]]; if (r.value != null && num(r.value) > x.amount) x.rows.push(['Discount', naira(num(r.value) - x.amount)]); }
  else if (r.type === 'cable') { x.title = r.package || 'Cable TV'; x.who = 'Smartcard ' + (r.to || ''); x.rows = [['Cable', r.biller], ['Package', r.package], ['Smartcard number', r.to]]; }
  else if (r.type === 'electricity') { x.title = (r.biller || 'Electricity') + ' prepaid \u00B7 ' + naira(r.amount, 0); x.who = 'Meter ' + (r.to || ''); x.rows = [['Disco', (r.biller || '') + ' (Prepaid)'], ['Meter number', r.to]]; if (r.units != null) x.rows.push(['Units', r.units + ' kWh']); }
  else if (r.type === 'exam') { x.title = (r.biller || 'Exam') + ' result checker'; x.who = 'Quantity ' + q; x.rows = [['Exam body', r.biller], ['Quantity', String(q)]]; }
  else if (r.type === 'epin') { x.title = nn + ' recharge \u00B7 ' + q + ' \u00D7 ' + naira(r.value, 0); x.who = q + ' card' + (q > 1 ? 's' : ''); x.rows = [['Network', nn], ['Denomination', naira(r.value, 0)], ['Quantity', String(q)]]; }
  else if (r.type === 'sms') { x.title = 'Bulk SMS \u00B7 ' + r.units + ' units'; x.who = 'Sender ' + (r.senderId || ''); x.rows = [['Service', 'Bulk SMS'], ['Units', String(r.units)], ['Sender ID', r.senderId]]; }
  else if (r.type === 'funding') { x.title = 'Wallet funding'; x.who = [r.method, r.bank].filter(Boolean).join(' \u00B7 '); x.rows = [['Method', r.method], ['Bank', r.bank], ['Account', r.account]]; }
  else { x.title = r.title || r.description || 'Transaction'; x.who = r.to || ''; }
  x.rows = x.rows.filter(p => p[1] != null && p[1] !== '' && p[1] !== 'undefined');
  if (r.token) x.token = { label: r.type === 'exam' ? 'Result checker PIN' : 'Meter token', v: String(r.token), serial: r.serial };
  if (Array.isArray(r.pins) && r.pins.length) x.pins = r.pins.map(String);
  if (x.status === 'failed') x.failNote = 'We could not complete this purchase. Your money was returned to your wallet.';
  if (x.status === 'pending') x.pendNote = 'This is taking a little longer. It usually completes within a few minutes.';
  const phone = String(r.to || ''), intl = /^0\d{10}$/.test(phone) ? ' 234' + phone.slice(1) : '';
  x.hay = [x.title, x.who, x.ref, x.to + intl, x.netName, x.plan, typeOf(x).label, STX[x.status][0], r.token, r.serial, (r.pins || []).join(' '), x.rows.map(p => p[1]).join(' '), x.amount].join(' ').toLowerCase();
  return x;
}

/* ============================================================================
   6. LOADING (one request, then filter and search in the page)
============================================================================ */
const F = { period:'month', type:'all', status:'all', dir:'all', sort:'new', q:'' };
let all = [], shown = PAGE, loading = true, failed = null;
const cache = new Map();
const activeFilters = () => (F.status !== 'all') + (F.dir !== 'all') + (F.sort !== 'new');

async function fetchAll() {
  const r = await api(EP.list);
  if (!r.ok || !r.data.success) throw new Error(failMsg(r, 'Could not load your transactions.'));
  const list = (r.data.transactions || []).map(normalize).sort((a, b) => b.ts - a.ts);
  list.forEach(x => cache.set(x.id, x));
  return list;
}
async function fetchOne(ref, refresh) {
  const r = await api(EP.one(ref) + (refresh ? '?refresh=1' : ''));
  if (!r.ok || !r.data.success || !r.data.transaction) throw new Error(failMsg(r, 'Could not load this transaction.'));
  const x = normalize(r.data.transaction); cache.set(x.id, x); return x;
}

function periodRange(p) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  if (p === 'month') return [new Date(y, m, 1).getTime(), Infinity];
  if (p === 'last') return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()];
  if (p === 'd90') return [Date.now() - 90 * DAY, Infinity];
  return [0, Infinity];
}
const inPeriod = () => { const r = periodRange(F.period); return all.filter(x => x.ts >= r[0] && x.ts < r[1]); };
function filtered() {
  const words = F.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const l = inPeriod().filter(x =>
    (F.type === 'all' || x.type === F.type) && (F.status === 'all' || x.status === F.status) &&
    (F.dir === 'all' || (F.dir === 'in') === x.credit) &&
    words.every(w => x.hay.indexOf(w) > -1));
  if (F.sort === 'old') l.sort((a, b) => a.ts - b.ts); else if (F.sort === 'high') l.sort((a, b) => b.amount - a.amount);
  return l;
}
async function load() {
  loading = true; failed = null; renderList();
  try { all = await fetchAll(); } catch (e) { failed = e.message; all = []; }
  loading = false; shown = PAGE; renderSummary(); renderList(); renderTools(); checkMore();
}
function refilter(withSummary) { shown = PAGE; if (withSummary) renderSummary(); renderList(); renderTools(); checkMore(); }
function loadMore() {
  if (loading || failed || filtered().length <= shown) return;
  const prev = shown; shown += PAGE; renderList(prev); checkMore();
}
function checkMore() { if ($('sentinel').getBoundingClientRect().top < window.innerHeight + 400) loadMore(); }
new IntersectionObserver(es => { if (es[0].isIntersecting) loadMore(); }, { rootMargin: '400px' }).observe($('sentinel'));

/* ============================================================================
   7. RENDER: PERIOD, CHIPS, SUMMARY, LIST
============================================================================ */
function dayLabel(ts) {
  const d = new Date(ts), t = new Date(), y = new Date(Date.now() - DAY);
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, t)) return 'Today'; if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
const timeOf = ts => new Date(ts).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
const dateTime = ts => new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) + ', ' + timeOf(ts);

function renderPeriod() {
  const P2 = [['month', 'This month'], ['last', 'Last month'], ['d90', '90 days'], ['all', 'All time']];
  $('period').innerHTML = P2.map(p => '<button role="tab" data-p="' + p[0] + '" class="' + (F.period === p[0] ? 'on' : '') + '" aria-selected="' + (F.period === p[0]) + '">' + p[1] + '</button>').join('');
}
function renderChips() {
  $('chips').innerHTML = CHIPS.map(c => '<button class="ch ' + (F.type === c[0] ? 'on' : '') + '" data-t="' + c[0] + '">' + ico(c[2]) + c[1] + '</button>').join('');
}
function renderTools() {
  const n = activeFilters(); $('fCount').hidden = !n; $('fCount').textContent = n;
  $('qClear').hidden = !$('q').value;
}
function countUp(node, to, fmt) { const t0 = performance.now(); (function step(t) { const p = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - p, 3); node.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); })(t0); }
function renderSummary() {
  const l = inPeriod(), ok = l.filter(x => !x.credit && x.status !== 'failed' && x.status !== 'pending');
  const spent = ok.reduce((s, x) => s + x.amount, 0), funded = l.filter(x => x.credit && x.status === 'success').reduce((s, x) => s + x.amount, 0);
  /* spending bars */
  const r = periodRange(F.period), end = Math.min(r[1], Date.now() + 1), start = r[0] === 0 ? (l.length ? Math.min.apply(null, l.map(x => x.ts)) : end - DAY) : r[0];
  const n = F.period === 'month' || F.period === 'last' ? Math.max(1, Math.round((end - start) / DAY)) : F.period === 'd90' ? 13 : Math.max(3, Math.ceil((end - start) / (30 * DAY)));
  const step = (end - start) / n, b = new Array(n).fill(0);
  ok.forEach(x => { b[Math.min(n - 1, Math.max(0, Math.floor((x.ts - start) / step)))] += x.amount; });
  const mx = Math.max.apply(null, b.concat([1]));
  /* spending by service */
  const by = {}; ok.forEach(x => { by[x.type] = (by[x.type] || 0) + x.amount; });
  const cats = Object.keys(by).sort((a, c) => by[c] - by[a]);
  const col = k => (TYPES[k] || OTHER).c, lab = k => (TYPES[k] || OTHER).label;
  $('sum').innerHTML = '<small>Total spent</small><div class="big" id="sSpent">' + naira(0) + '</div>' +
    '<div class="two"><div class="pill2"><small>Wallet funded</small><b id="sFund">' + naira(0) + '</b></div><div class="pill2"><small>Transactions</small><b id="sCnt">0</b></div></div>' +
    '<div class="chart" id="chart">' + b.map((v, i) => '<i class="bar" data-i="' + i + '" data-v="' + v + '" style="height:3px"></i>').join('') + '</div><div class="chart-tip" id="tip">Tap a bar to see that day</div>' +
    '<div class="cat">' + cats.map(k => '<i style="background:' + col(k) + ';width:0" data-w="' + (by[k] / (spent || 1) * 100).toFixed(1) + '"></i>').join('') + '</div>' +
    '<div class="legend">' + cats.slice(0, 4).map(k => '<span style="--c:' + col(k) + '">' + esc(lab(k)) + ' ' + Math.round(by[k] / (spent || 1) * 100) + '%</span>').join('') + '</div>';
  countUp($('sSpent'), spent, v => naira(v)); countUp($('sFund'), funded, v => naira(v)); countUp($('sCnt'), l.length, v => String(Math.round(v)));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $('chart').querySelectorAll('.bar').forEach(e => { e.style.height = Math.max(3, (+e.dataset.v / mx) * 64) + 'px'; });
    $('sum').querySelectorAll('.cat i').forEach(e => { e.style.width = e.dataset.w + '%'; });
  }));
  $('chart').addEventListener('click', ev => {
    const bar = ev.target.closest('.bar'); if (!bar) return;
    $('chart').querySelectorAll('.bar').forEach(x => x.classList.remove('on')); bar.classList.add('on');
    const i = +bar.dataset.i, a = new Date(start + i * step), c2 = new Date(start + (i + 1) * step - 1), fd = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    $('tip').textContent = ((F.period === 'month' || F.period === 'last') ? fd(a) : fd(a) + ' to ' + fd(c2)) + ': ' + naira(+bar.dataset.v);
  });
}

function txHtml(x, delay, flat) {
  const T = typeOf(x), s = STX[x.status];
  return '<button class="tx rise" style="--d:' + delay + 'ms" data-id="' + esc(x.id) + '"><span class="ico ' + T.tint + '">' + ico(T.icon) + (x.net ? '<i class="net n-' + x.net + '">' + (x.net === '9mobile' ? '9' : x.netName[0]) + '</i>' : '') + '</span>' +
    '<span class="tx-main"><b>' + esc(x.title) + '</b><small>' + esc(x.who || T.label) + ' \u00B7 ' + (flat ? dateTime(x.ts) : timeOf(x.ts)) + '</small></span>' +
    '<span class="tx-end"><span class="amt ' + (x.credit ? 'in' : '') + '">' + (x.credit ? '+' : '-') + naira(x.amount) + '</span><span class="st ' + s[1] + '">' + s[0] + '</span></span></button>';
}
function renderList(prev) {
  const L = $('list');
  if (loading) { L.innerHTML = [0, 1, 2, 3, 4, 5].map(i => '<div class="sk" style="height:68px;margin-top:10px;animation-delay:' + i * 80 + 'ms"></div>').join(''); return; }
  if (failed) { L.innerHTML = '<div class="card empty"><div class="ill" style="background:rgba(232,51,74,.1);color:var(--error)">' + ico('warn') + '</div><h3>Could not load</h3><p>' + esc(failed) + '</p><button class="btn btn-primary sm" id="retry">Try again</button></div>'; feedback('error'); return; }
  const l = filtered();
  if (!l.length) {
    const act = F.q || F.type !== 'all' || activeFilters();
    L.innerHTML = '<div class="card empty rise"><div class="ill">' + ico('inbox') + '</div><h3>' + (act ? 'No matching transactions' : 'No transactions yet') + '</h3><p>' + (act ? 'Try a different search or clear your filters.' : 'When you buy data, airtime or fund your wallet, it will show up here.') + '</p>' + (act ? '<button class="btn btn-primary sm" id="clearF">Clear filters</button>' : '') + '</div>';
    return;
  }
  const part = l.slice(0, shown), delay = i => (prev !== undefined && i < prev) ? 0 : Math.min(i - (prev || 0), 12) * 35;
  let html;
  if (F.sort === 'high') {
    html = '<section class="grp flat"><div class="card">' + part.map((x, i) => txHtml(x, delay(i), true)).join('') + '</div></section>';
  } else {
    const groups = [];
    part.forEach((x, i) => { const k = dayLabel(x.ts), g = groups[groups.length - 1]; if (g && g.k === k) g.items.push([x, i]); else groups.push({ k, items:[[x, i]] }); });
    html = groups.map(g => {
      const tot = g.items.reduce((s, p) => s + (p[0].credit || p[0].status === 'failed' ? 0 : p[0].amount), 0);
      return '<section class="grp"><h3 class="dh">' + esc(g.k) + (tot ? '<em>' + naira(tot, 0) + ' spent</em>' : '') + '</h3><div class="card">' + g.items.map(p => txHtml(p[0], delay(p[1]), false)).join('') + '</div></section>';
    }).join('');
  }
  L.innerHTML = html + (l.length > shown ? '<div class="more"><i class="mini-spin"></i>Loading more...</div>' : '<div class="more">You are all caught up</div>');
  L.querySelectorAll('.tx.rise').forEach(e => { if (e.style.getPropertyValue('--d') === '0ms') { e.style.opacity = 1; e.style.animation = 'none'; } });
}

/* ============================================================================
   8. RECEIPT (full screen + picture to share or download)
============================================================================ */
function rowsOf(x) {
  const T = typeOf(x), r = [['Reference', x.ref, 'copy'], ['Date', new Date(x.ts).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) + ', ' + timeOf(x.ts)], ['Service', T.label]].concat(x.rows);
  r.push(['Payment method', x.credit ? 'Bank transfer' : 'Wallet']);
  if (x.status === 'failed') r.push(['Refund', 'Returned to wallet']);
  else { if (isNum(x.before)) r.push(['Balance before', naira(x.before)]); if (isNum(x.after)) r.push(['Balance after', naira(x.after)]); }
  return r;
}
const LOGO = '<svg viewBox="0 0 48 48"><defs><linearGradient id="lgS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00aaff"/><stop offset="1" stop-color="#0059b8"/></linearGradient></defs><rect width="48" height="48" rx="14" fill="url(#lgS)"/><path d="M30 17.5c-1.4-1.6-3.6-2.5-6-2.5-3.4 0-6 1.8-6 4.6 0 6.6 12.5 3.4 12.5 9.6 0 2.7-2.7 4.3-6.4 4.3-2.6 0-5-.9-6.6-2.7" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>';
let logoImg = null;
(function () { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { logoImg = im; }; im.src = LOGO_URL; })();
const SPATH = 'M30 17.5c-1.4-1.6-3.6-2.5-6-2.5-3.4 0-6 1.8-6 4.6 0 6.6 12.5 3.4 12.5 9.6 0 2.7-2.7 4.3-6.4 4.3-2.6 0-5-.9-6.6-2.7';
const spaced = v => /^\d+$/.test(v) ? v.replace(/(\d{4})(?=\d)/g, '$1 ') : v;
const stamp = n => { if (!n) return ''; const d = new Date(n), p = v => String(v).padStart(2, '0'); return p(d.getDate()) + '-' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); };

function stepsOf(x) {
  const a = x.credit ? ['Transfer received', 'Verifying', 'Wallet credited'] : ['Order placed', 'Processing', 'Delivered'], t = x.ts;
  const lastT = x.attempts.length && x.attempts[x.attempts.length - 1].ts ? x.attempts[x.attempts.length - 1].ts : t + 30000;
  const s = [{ l:a[0], t:stamp(t), s:'done' }, { l:a[1], t:stamp(t + 1000), s:'done' }];
  if (x.status === 'pending') s.push({ l:'Delivering', t:'Please wait', s:'pending' });
  else if (x.status === 'failed') s.push({ l:'Failed', t:stamp(lastT), s:'failed' });
  else s.push({ l:a[2], t:stamp(lastT), s:'done' });
  return s;
}
function vaultItems(x) {
  if (x.status !== 'success') return [];
  if (x.pins) return x.pins.map((p, i) => ({ k:'PIN ' + (i + 1), v:p }));
  if (x.token) { const a = [{ k:x.token.label, v:x.token.v }]; if (x.token.serial) a.push({ k:'Serial', v:String(x.token.serial) }); return a; }
  return [];
}

/* ---- download as ---- */
const csvOf = rows => '\uFEFF' + rows.map(r => r.map(v => { v = String(v); if (/^\d{9,}$/.test(v)) v = '\t' + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(',')).join('\n');
function saveText(name, text, mime) { const b64 = btoa(unescape(encodeURIComponent(text))); downloadFile('data:' + mime + ';base64,' + b64, name, b64, mime); }
function dlSheet(title, lead, opts) {
  const c = sheet('<h3>' + title + '</h3><p class="lead">' + lead + '</p>' + opts.map((o, i) => '<button type="button" class="dl-o" data-i="' + i + '"><span class="ico ' + o.tint + '">' + ico(o.icon) + '</span><span class="tx-main"><b>' + o.name + '</b><small>' + o.desc + '</small></span>' + ico('chev') + '</button>').join(''));
  c.sh.addEventListener('click', e => { const b = e.target.closest('.dl-o'); if (!b) return; const o = opts[+b.dataset.i]; c.close(); o.run(); });
}
function itemsOpts(x) {
  const it = vaultItems(x), n = 'subhub-' + (x.pins ? 'pins-' : 'token-') + x.ref, iso = new Date(x.ts).toISOString();
  return [
    { icon:'sheet', tint:'t-green', name:'CSV', desc:'For Excel or Google Sheets', run:() => saveText(n + '.csv', csvOf([['Label', 'Value', 'Reference', 'Service', 'Date']].concat(it.map(i => [i.k, i.v, x.ref, x.title, iso]))), 'text/csv') },
    { icon:'sheet', tint:'t-blue', name:'Excel (.xls)', desc:'Opens directly in Excel', run:() => saveText(n + '.xls', '<html><meta charset="utf-8"><table border="1"><tr><th>Label</th><th>Value</th><th>Reference</th></tr>' + it.map(i => '<tr><td>' + esc(i.k) + '</td><td style="mso-number-format:\'\\@\'">' + esc(i.v) + '</td><td>' + esc(x.ref) + '</td></tr>').join('') + '</table></html>', 'application/vnd.ms-excel') },
    { icon:'code', tint:'t-amber', name:'JSON', desc:'For developers and apps', run:() => saveText(n + '.json', JSON.stringify({ reference:x.ref, service:typeOf(x).label, title:x.title, date:iso, items:it.map(i => ({ label:i.k, value:i.v })) }, null, 2), 'application/json') },
    { icon:'file', tint:'t-gray', name:'Text (.txt)', desc:'Plain text, opens anywhere', run:() => saveText(n + '.txt', 'SubHub \u00B7 ' + x.title + '\nReference: ' + x.ref + '\n\n' + it.map(i => i.k + ': ' + i.v).join('\n') + '\n', 'text/plain') }
  ];
}
function receiptOpts(x) {
  const n = 'subhub-receipt-' + x.ref, rows = rowsOf(x), iso = new Date(x.ts).toISOString();
  return [
    { icon:'img', tint:'t-blue', name:'Image (PNG)', desc:'Best for sharing on WhatsApp', run:() => downloadReceipt(x) },
    { icon:'file', tint:'t-red', name:'PDF', desc:'Good for printing or email', run:async () => { await canvasReady(); const c = receiptCanvas(x), b64 = pdfFromJpg(c.toDataURL('image/jpeg', .95).split(',')[1], c.width, c.height); downloadFile('data:application/pdf;base64,' + b64, n + '.pdf', b64, 'application/pdf'); } },
    { icon:'sheet', tint:'t-green', name:'CSV', desc:'For Excel or Google Sheets', run:() => saveText(n + '.csv', csvOf([rows.map(r => r[0]), rows.map(r => r[1])]), 'text/csv') },
    { icon:'code', tint:'t-amber', name:'JSON', desc:'For developers and apps', run:() => saveText(n + '.json', JSON.stringify({ reference:x.ref, date:iso, service:typeOf(x).label, description:x.title, amount:x.amount, currency:'NGN', direction:x.credit ? 'credit' : 'debit', status:x.status, details:Object.fromEntries(rows.map(r => [r[0], r[1]])), items:vaultItems(x).map(i => ({ label:i.k, value:i.v })) }, null, 2), 'application/json') },
    { icon:'file', tint:'t-gray', name:'Text (.txt)', desc:'Plain text, opens anywhere', run:() => saveText(n + '.txt', 'SubHub receipt\n' + x.title + ' \u00B7 ' + naira(x.amount) + ' \u00B7 ' + STX[x.status][0] + '\n\n' + rows.map(r => r[0] + ': ' + r[1]).join('\n') + '\n', 'text/plain') }
  ];
}

/* ---- full screen receipt ---- */
function closeReceipt() { if (!rcOpen) return; rcOpen.root.remove(); rcOpen = null; if (!openCtl) document.body.classList.remove('lock'); }
function openReceipt(id) {
  const x = cache.get(id); if (!x) return;
  const s = STX[x.status], items = vaultItems(x), keep = rcOpen && rcOpen.id === id ? rcOpen.body.scrollTop : 0;
  if (rcOpen) { rcOpen.root.remove(); rcOpen = null; }
  const note = x.failNote ? ['bad', 'warn', x.failNote] : x.pendNote ? ['warn', 'warn', x.pendNote] : ['ok', 'check', x.credit ? 'Your wallet was credited successfully.' : 'Delivered successfully. Keep the reference for any enquiry.'];
  const trk = '<div class="trk">' + stepsOf(x).map((p, i) => '<div class="stp ' + p.s + '" style="--d:' + (i * 220) + 'ms"><span class="dot">' + (p.s === 'done' ? ico('check') : p.s === 'failed' ? ico('x') : '<i class="mini-spin"></i>') + '</span><b>' + p.l + '</b><small>' + p.t + '</small></div>').join('') + '</div>';
  const vault = items.length ? '<section class="card vault rise" style="--d:100ms"><div class="vh"><div><b>' + esc(x.pins ? 'Recharge PINs' : x.token.label) + '</b><small>' + items.length + (items.length > 1 ? ' items' : ' item') + (items.length > 3 ? ' \u00B7 scroll to see all' : '') + '</small></div><button class="vb" data-a="pcopy" aria-label="Copy all">' + ico('copy') + '</button><button class="vb" data-a="pdl" aria-label="Download">' + ico('download') + '</button></div><div class="vlist">' +
    items.map(i => '<div class="vi"><div><small>' + esc(i.k) + '</small><code>' + esc(spaced(i.v)) + '</code></div><button class="cp" data-cp="' + esc(i.v) + '">Copy</button></div>').join('') + '</div></section>' : '';
  const att = x.attempts.length ? '<section class="card att rise" style="--d:190ms"><h4>Delivery attempts</h4>' + (x.attempts.length > 1 ? '<p class="att-sub">SubHub Engine switched provider automatically.</p>' : '') + x.attempts.map((a, i) => { const st = STX[a.status]; return '<div class="att-row"><span class="att-n ' + st[1] + '">' + (i + 1) + '</span><div><b>' + esc(a.provider) + '</b><small>' + stamp(a.ts) + '</small></div><span class="st ' + st[1] + '">' + st[0] + '</span></div>'; }).join('') + '</section>' : '';
  const root = el('div', 'rcs'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.innerHTML = '<header class="rcs-top"><button class="icon-btn" data-a="back" aria-label="Back">' + ico('back') + '</button><h2>Transaction details</h2><button class="icon-btn" data-a="help" aria-label="Report a problem">' + ico('help') + '</button></header>' +
    '<div class="rcs-body"><div class="rcs-in">' +
    '<section class="card hero rise"><span class="logo"><img src="' + LOGO_URL + '" alt="SubHub"></span><div class="hsvc">' + esc(x.title) + '</div><div class="rc-amt">' + (x.credit ? '+' : '') + naira(x.amount) + '</div><div class="hs ' + s[1] + '">' + s[0] + '</div>' + trk +
    '<div class="note ' + note[0] + '">' + ico(note[1]) + '<span>' + esc(note[2]) + '</span></div></section>' + vault +
    '<section class="card det rise" style="--d:160ms"><h4>Transaction details</h4>' + rowsOf(x).map(r => '<div class="rc-row"><span>' + r[0] + '</span>' + (r[2] ? '<b><button data-cp="' + esc(r[1]) + '">' + esc(r[1]) + ico('copy') + '</button></b>' : '<b>' + esc(r[1]) + '</b>') + '</div>').join('') + '</section>' +
    att + '<section class="card more-a rise" style="--d:220ms"><h4>More actions</h4>' + (x.credit ? '' : '<button class="mrow" data-a="again">' + ico('repeat') + '<span>Buy again</span>' + ico('chev') + '</button>') + '<button class="mrow" data-a="help">' + ico('help') + '<span>Report a problem</span>' + ico('chev') + '</button></section>' +
    '</div></div><footer class="rcs-foot"><div class="rcs-in">' +
    (x.status === 'pending' ? '<button class="btn btn-primary" data-a="chk"><span class="spinner"></span><span class="lbl">Check status</span></button>' : '<div class="grid2"><button class="btn btn-ghost" data-a="dl">' + ico('download') + ' Download</button><button class="btn btn-primary" data-a="share">' + ico('share') + ' Share receipt</button></div>') + '</div></footer>';
  root.querySelectorAll('.logo img').forEach(im => im.addEventListener('error', () => { im.parentNode.innerHTML = LOGO; }));
  root.addEventListener('click', async e => {
    const cp = e.target.closest('[data-cp]'); if (cp) { copy(cp.dataset.cp, 'Copied'); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'back') closeReceipt();
    else if (a === 'share') shareReceipt(x);
    else if (a === 'dl') dlSheet('Download receipt', 'Download as:', receiptOpts(x));
    else if (a === 'pdl') dlSheet('Download ' + (x.pins ? 'PINs' : 'token'), 'Download as:', itemsOpts(x));
    else if (a === 'pcopy') copy(items.map(i => i.k + ': ' + i.v).join('\n'), 'Copied all');
    else if (a === 'again') go(buyAgainUrl(x));
    else if (a === 'help') go(REPORT_URL + '?ref=' + encodeURIComponent(x.ref));
    else if (a === 'chk') {
      b.disabled = true; b.classList.add('loading');
      try {
        const u = await fetchOne(x.id, true);
        all = all.map(t => t.id === u.id ? u : t);
        if (u.status === 'success') toast('Transaction completed', u.title, 'success');
        else if (u.status === 'failed') toast('Transaction failed', 'Your money was returned to your wallet.', 'error');
        else toast('Still pending', 'Please check again in a few minutes.', 'info');
        renderSummary(); renderList(shown); openReceipt(u.id);
      } catch (err) { b.disabled = false; b.classList.remove('loading'); toast('Could not check', err.message, 'error'); }
    }
  });
  document.body.appendChild(root); document.body.classList.add('lock');
  rcOpen = { id, root, body:root.querySelector('.rcs-body') }; rcOpen.body.scrollTop = keep;
}

/* the picture: drawn on a canvas, light theme always (looks right when shared on WhatsApp) */
async function canvasReady() { try { await Promise.all(['800 28px Sora', '700 15px Sora', '600 15px Sora', '500 12px Sora'].map(f => document.fonts.load(f))); } catch (e) {} }
function receiptCanvas(x) {
  const W = 640, pad = 40, k = 2, rows = rowsOf(x), items = vaultItems(x);
  const col = x.status === 'success' ? '#00c07a' : x.status === 'pending' ? '#f59e0b' : '#e8334a';
  const SANS = 'Sora, system-ui, -apple-system, Segoe UI, Roboto, sans-serif', MONO = 'ui-monospace, Menlo, Consolas, monospace';
  const f = (w, s) => w + ' ' + s + 'px ' + SANS, m = document.createElement('canvas').getContext('2d');
  const wrap = (t, w, font) => {
    m.font = font; const out = []; let cur = '';
    String(t).split(' ').forEach(word => {
      const tt = cur ? cur + ' ' + word : word;
      if (m.measureText(tt).width <= w) { cur = tt; return; }
      if (cur) { out.push(cur); cur = ''; }
      if (m.measureText(word).width <= w) { cur = word; return; }
      for (const ch of word) { if (m.measureText(cur + ch).width > w) { out.push(cur); cur = ch; } else cur += ch; }
    });
    if (cur) out.push(cur); return out.length ? out : [''];
  };
  const R = rows.map(r => { const L = wrap(r[1], W - pad * 2 - 190, f('700', 15)); return { l:r[0], L, h:Math.max(48, 24 + L.length * 22) }; });
  const rowsH = R.reduce((s, r) => s + r.h, 0), itemsH = items.length ? items.length * 54 + 12 : 0, top = 356;
  const H = top + rowsH + (itemsH ? itemsH + 14 : 0) + 150;
  const c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
  const g = c.getContext('2d'); g.scale(k, k);
  const rr = (X, Y, w, h, r) => { g.beginPath(); g.moveTo(X + r, Y); g.arcTo(X + w, Y, X + w, Y + h, r); g.arcTo(X + w, Y + h, X, Y + h, r); g.arcTo(X, Y + h, X, Y, r); g.arcTo(X, Y, X + w, Y, r); g.closePath(); };
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  /* header */
  const gr = g.createLinearGradient(0, 0, W, 160); gr.addColorStop(0, '#00aaff'); gr.addColorStop(1, '#0059b8'); g.fillStyle = gr; g.fillRect(0, 0, W, 160);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(W - 40, 10, 110, 0, 7); g.fill();
  g.save(); g.translate(pad, 34); g.scale(52 / 48, 52 / 48); g.fillStyle = '#fff'; rr(0, 0, 48, 48, 14); g.fill();
  if (logoImg) { const sc = Math.min(36 / logoImg.naturalWidth, 36 / logoImg.naturalHeight), iw = logoImg.naturalWidth * sc, ih = logoImg.naturalHeight * sc; g.drawImage(logoImg, 24 - iw / 2, 24 - ih / 2, iw, ih); }
  else { g.strokeStyle = '#0a8de0'; g.lineWidth = 3.6; g.lineCap = 'round'; g.stroke(new Path2D(SPATH)); }
  g.restore();
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = f('800', 28); g.fillText('Sub', pad + 68, 66); const sw = g.measureText('Sub').width; g.fillStyle = '#c8ecff'; g.fillText('Hub', pad + 68 + sw, 66);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = f('600', 14); g.fillText('Transaction receipt', pad + 68, 88);
  g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = f('700', 14); g.fillText(new Date(x.ts).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }), W - pad, 60);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = f('600', 13); g.fillText(timeOf(x.ts), W - pad, 82);
  /* status badge */
  const cx = W / 2; g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, 160, 44, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(cx, 160, 34, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
  if (x.status === 'success') { g.moveTo(cx - 14, 160); g.lineTo(cx - 4, 170); g.lineTo(cx + 15, 149); }
  else if (x.status === 'pending') { g.moveTo(cx, 146); g.lineTo(cx, 161); g.lineTo(cx + 10, 168); }
  else { g.moveTo(cx - 12, 148); g.lineTo(cx + 12, 172); g.moveTo(cx + 12, 148); g.lineTo(cx - 12, 172); }
  g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#0d1a2e'; g.font = f('800', 40); g.fillText((x.credit ? '+' : '') + naira(x.amount), cx, 256);
  g.fillStyle = '#4d6480'; g.font = f('600', 17); let tt = x.title; while (g.measureText(tt).width > W - pad * 2 && tt.length > 8) tt = tt.slice(0, -2); if (tt !== x.title) tt += '...'; g.fillText(tt, cx, 286);
  const lab = STX[x.status][0]; g.font = f('800', 14); const lw = g.measureText(lab).width + 36;
  g.fillStyle = col + '22'; rr(cx - lw / 2, 300, lw, 30, 15); g.fill(); g.fillStyle = col; g.fillText(lab, cx, 320);
  /* watermark */
  g.save(); g.translate(cx, top + rowsH / 2 + 20); g.rotate(-0.38); g.font = f('800', 84); g.fillStyle = col + '12'; g.fillText(lab.toUpperCase(), 0, 0); g.restore();
  /* rows */
  let y = top; g.strokeStyle = '#d5e3f3'; g.lineWidth = 1.5; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(pad, y - 6); g.lineTo(W - pad, y - 6); g.stroke();
  R.forEach(r => {
    g.setLineDash([]); g.textAlign = 'left'; g.fillStyle = '#8096b8'; g.font = f('600', 15); g.fillText(r.l, pad, y + 29);
    g.textAlign = 'right'; g.fillStyle = '#0d1a2e'; g.font = f('700', 15); r.L.forEach((ln, i) => g.fillText(ln, W - pad, y + 29 + i * 22));
    g.strokeStyle = '#e6eef8'; g.lineWidth = 1; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(pad, y + r.h); g.lineTo(W - pad, y + r.h); g.stroke(); y += r.h;
  });
  g.setLineDash([]);
  /* PINs / token */
  if (itemsH) {
    y += 14; g.fillStyle = '#eef7ff'; rr(pad, y, W - pad * 2, itemsH, 16); g.fill(); g.textAlign = 'left';
    items.forEach((it, i) => { const yy = y + 6 + i * 54; g.fillStyle = '#8096b8'; g.font = f('800', 11); g.fillText(it.k.toUpperCase(), pad + 18, yy + 20); g.fillStyle = '#0d1a2e'; g.font = '700 20px ' + MONO; g.fillText(spaced(it.v), pad + 18, yy + 44); });
    y += itemsH;
  }
  /* footer */
  g.textAlign = 'center'; g.fillStyle = '#4d6480'; g.font = f('700', 14); g.fillText('Thank you for choosing SubHub', cx, H - 86);
  g.fillStyle = '#8096b8'; g.font = f('500', 12); g.fillText('This is a system generated receipt. Keep the reference for any enquiry.', cx, H - 62); g.fillText('Powered by Earncial Global  \u00B7  subhub.com.ng', cx, H - 40);
  const bs = g.createLinearGradient(0, 0, W, 0); bs.addColorStop(0, '#00aaff'); bs.addColorStop(1, '#0059b8'); g.fillStyle = bs; g.fillRect(0, H - 10, W, 10);
  return c;
}
function pdfFromJpg(b64, w, h) {
  const jpg = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), pw = 595, ph = Math.round(595 * h / w), enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const add = d => { const u = typeof d === 'string' ? enc.encode(d) : d; parts.push(u); len += u.length; };
  const obj = (n, fn) => { offs[n] = len; add(n + ' 0 obj\n'); fn(); add('\nendobj\n'); };
  add('%PDF-1.4\n');
  obj(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'));
  obj(4, () => { add('<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); add(jpg); add('\nendstream'); });
  const cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
  obj(5, () => add('<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream'));
  const xr = len; add('xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
  const out = new Uint8Array(len); let p = 0; parts.forEach(u => { out.set(u, p); p += u.length; });
  let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.subarray(i, i + 8192));
  return btoa(s);
}
function downloadFile(url, name, b64, mime) {
  if (window.AndroidDownload) { window.AndroidDownload.saveFile(b64, name, mime); toast('Saved', 'Look in your Downloads folder.', 'success'); return; }
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Downloaded', name, 'success');
}
async function receiptPng(x) { await canvasReady(); return receiptCanvas(x).toDataURL('image/png'); }
async function downloadReceipt(x) { const url = await receiptPng(x); downloadFile(url, 'subhub-receipt-' + x.ref + '.png', url.split(',')[1], 'image/png'); }
async function shareReceipt(x) {
  const url = await receiptPng(x), b64 = url.split(',')[1], name = 'subhub-receipt-' + x.ref + '.png';
  if (window.AndroidShare) { window.AndroidShare.shareImage(b64, name); return; }
  try {
    const blob = await (await fetch(url)).blob(), f = new File([blob], name, { type:'image/png' });
    if (navigator.canShare && navigator.canShare({ files:[f] })) { await navigator.share({ files:[f], title:'SubHub receipt' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  downloadFile(url, name, b64, 'image/png');
}

/* ============================================================================
   9. STATEMENT (CSV of what matches the current filters)
============================================================================ */
function exportStatement() {
  const l = filtered(), when = ({ month:'this month', last:'last month', d90:'the last 90 days', all:'all time' })[F.period];
  const c = sheet('<h3>Download statement</h3><p class="lead">Your statement includes <b>' + l.length + ' transaction' + (l.length === 1 ? '' : 's') + '</b> for <b>' + when + '</b>' + (activeFilters() || F.type !== 'all' || F.q ? ' (with your filters)' : '') + '.</p><button class="btn btn-primary" id="stGo"' + (l.length ? '' : ' disabled') + '>' + ico('download') + ' Download CSV</button><p class="lead" style="margin:12px 0 0;font-size:.78rem">Opens in Excel or Google Sheets.</p>');
  c.sh.querySelector('#stGo').addEventListener('click', () => {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = ['Date,Reference,Service,Description,Details,Amount (NGN),Direction,Status,Balance after (NGN)'].concat(l.map(x => [new Date(x.ts).toISOString(), x.ref, typeOf(x).label, x.title, x.who, x.amount.toFixed(2), x.credit ? 'Credit' : 'Debit', STX[x.status][0], isNum(x.after) ? x.after.toFixed(2) : ''].map(q).join(','))).join('\n');
    const b64 = btoa(unescape(encodeURIComponent('\uFEFF' + csv)));
    c.close(); downloadFile('data:text/csv;base64,' + b64, 'subhub-statement.csv', b64, 'text/csv');
  });
}

/* ============================================================================
   10. FILTER SHEET + EVENTS
============================================================================ */
function filterSheet() {
  const draft = { status:F.status, dir:F.dir, sort:F.sort };
  const grp = (k, label, list) => '<div class="lbl-s">' + label + '</div><div class="opts" data-k="' + k + '">' + list.map(i => '<button type="button" class="opt ' + (draft[k] === i[0] ? 'on' : '') + '" data-v="' + i[0] + '">' + i[1] + '</button>').join('') + '</div>';
  const c = sheet('<h3>Filters</h3>' + grp('status', 'Status', [['all', 'All'], ['success', 'Successful'], ['pending', 'Pending'], ['failed', 'Failed']]) + grp('dir', 'Money', [['all', 'All'], ['out', 'Money out'], ['in', 'Money in']]) + grp('sort', 'Sort by', [['new', 'Newest'], ['old', 'Oldest'], ['high', 'Highest amount']]) +
    '<div class="grid2" style="margin-top:22px"><button class="btn btn-ghost" id="fReset">Reset</button><button class="btn btn-primary" id="fApply">Show results</button></div>');
  c.sh.addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; const k = b.parentElement.dataset.k; draft[k] = b.dataset.v; b.parentElement.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === b)); });
  c.sh.querySelector('#fReset').addEventListener('click', () => { Object.assign(F, { status:'all', dir:'all', sort:'new' }); c.close(); refilter(); });
  c.sh.querySelector('#fApply').addEventListener('click', () => { Object.assign(F, draft); c.close(); refilter(); });
}

$('period').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b || F.period === b.dataset.p) return; F.period = b.dataset.p; renderPeriod(); refilter(true); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('chips').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b || F.type === b.dataset.t) return; F.type = b.dataset.t; renderChips(); refilter(); });
let qT; $('q').addEventListener('input', () => { renderTools(); clearTimeout(qT); qT = setTimeout(() => { if (F.q === $('q').value) return; F.q = $('q').value; refilter(); }, 200); });
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(qT); if (F.q !== $('q').value) { F.q = $('q').value; refilter(); } $('q').blur(); } });
$('qClear').addEventListener('click', () => { clearTimeout(qT); $('q').value = ''; if (F.q) { F.q = ''; refilter(); } renderTools(); $('q').focus(); });
$('fBtn').addEventListener('click', filterSheet);
$('exportBtn').addEventListener('click', exportStatement);
$('backBtn').addEventListener('click', () => { if (rcOpen) { closeReceipt(); return; } if (history.length > 1) history.back(); else go(DASH_URL); });
$('list').addEventListener('click', e => {
  const t = e.target.closest('.tx'); if (t) { openReceipt(t.dataset.id); return; }
  if (e.target.closest('#retry')) load();
  if (e.target.closest('#clearF')) { Object.assign(F, { type:'all', status:'all', dir:'all', sort:'new', q:'' }); $('q').value = ''; renderChips(); refilter(); }
});
function applyTheme(d) { document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'); store.setRaw('sh_dark', d ? '1' : '0'); $('themeBtn').innerHTML = ico(d ? 'sun' : 'moon'); }
$('themeBtn').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark'));

/* ============================================================================
   11. START
============================================================================ */
if (!store.raw(TOKEN_KEY)) { goLogin(); return; }
fillIcons();
$('themeBtn').innerHTML = ico(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon');
renderPeriod(); renderChips(); renderTools();
$('sum').innerHTML = '<div class="sk" style="height:200px;background-color:rgba(255,255,255,.08)"></div>';
load().then(async () => {
  /* deep link: transactions.html?ref=<reference> opens that receipt (push notifications can use it) */
  const ref = new URLSearchParams(location.search).get('ref'); if (!ref) return;
  try { const x = cache.get(ref) || await fetchOne(ref); openReceipt(x.id); } catch (e) { toast('Could not open transaction', e.message, 'error'); }
});
})();
