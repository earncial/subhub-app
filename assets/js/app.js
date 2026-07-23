/* ============================================================
   CONFIG
============================================================ */
const API_BASE = 'https://api.subhub.com.ng/api';
const TOKEN_KEY = 'sh_access_token';
const REFRESH_KEY = 'sh_refresh_token';

/* ============================================================
   STATE
============================================================ */
let state = {
  user: null,
  balance: 0,
  totalFunded: 0,
  totalSpent: 0,
  balHidden: false,
  dark: localStorage.getItem('sh_dark') === '1',
  contacts: JSON.parse(localStorage.getItem('sh_contacts') || '[]'),
  recents: JSON.parse(localStorage.getItem('sh_recents') || '[]'),
  txns: [],
  virtualAccount: null,
  walletSlide: 0,
  selNet: null, selNetName: '', selTab: '', selPlan: null, shownN: 10, filteredPlans: [],
  atNet: '', atNetId: null, atMinAmount: 50,
  rcNet: '', rcNetId: null,
  pdNet: null, pdNetName: '', pdTab: '', pdPlan: null, pdShown: 10, pdFiltered: [],
  cableProv: '', cableSelPlan: null,
  pinBuf: '', pinTries: 0, pinAction: null, pinLabel: '',
  cpPhase: 1, cpBuf: '', cpNewPIN: '',
  receipt: null,
  qsPhone: '', qsNet: '',
  annRead: localStorage.getItem('sh_ann_read') || '',
  rcCards: [],
  cablePlans: {},
  examPlans: [],
  electricityPlans: [],
  editingContactPhone: null,
};

const NETS = [
  { id: 1, name: 'MTN',     short: 'MTN', bg: '#ffcc00', fg: '#1a1a00' },
  { id: 2, name: 'Airtel',  short: 'AIR', bg: '#ef0000', fg: '#ffffff' },
  { id: 3, name: 'Glo',     short: 'GLO', bg: '#009a44', fg: '#ffffff' },
  { id: 4, name: '9Mobile', short: '9MB', bg: '#006b3c', fg: '#ffffff' },
];

const SERVICES = [
  { id: 'data',      label: 'Data',          icon: 'wifi',           bg: 'ico-sky', modal: 'dataModal'      },
  { id: 'airtime',   label: 'Airtime',       icon: 'phone',          bg: 'ico-grn', modal: 'airtimeModal'   },
  { id: 'cable',     label: 'Cable TV',      icon: 'tv',             bg: 'ico-pur', modal: 'cableModal'     },
  { id: 'elec',      label: 'Electricity',   icon: 'bolt',           bg: 'ico-amb', modal: 'elecModal'      },
  { id: 'exam',      label: 'Exam Pins',     icon: 'graduation-cap', bg: 'ico-org', modal: 'examModal'      },
  { id: 'rc',        label: 'Recharge Card', icon: 'id-card',        bg: 'ico-tel', modal: 'rcModal'        },
  { id: 'sms',       label: 'Bulk SMS',      icon: 'comment-dots',   bg: 'ico-pnk', modal: 'smsModal'       },
  { id: 'printdata', label: 'Print Data',    icon: 'print',          bg: 'ico-red', modal: 'printDataModal' },
];

const TX_META = {
  data:          { icon: 'wifi',           bg: 'ico-sky' },
  airtime:       { icon: 'phone',          bg: 'ico-grn' },
  cable:         { icon: 'tv',             bg: 'ico-pur' },
  electricity:   { icon: 'bolt',           bg: 'ico-amb' },
  exam:          { icon: 'graduation-cap', bg: 'ico-org' },
  rc:            { icon: 'id-card',        bg: 'ico-tel' },
  sms:           { icon: 'comment-dots',   bg: 'ico-pnk' },
  wallet_fund:   { icon: 'plus-circle',    bg: 'ico-grn' },
  wallet_transfer:{ icon: 'paper-plane',   bg: 'ico-sky' },
  earncial_transfer:{ icon: 'plus-circle',   bg: 'ico-grn' },
  referral_bonus:   { icon: 'plus-circle',    bg: 'ico-grn' },
  refund:        { icon: 'rotate-left',    bg: 'ico-pur' },
};

/* ============================================================
   UTILS
============================================================ */
const $ = id => document.getElementById(id);
const fmt = n => parseFloat(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const uid = () => 'SH' + Date.now().toString().slice(-8).toUpperCase() + Math.floor(Math.random() * 100);
const delay = ms => new Promise(r => setTimeout(r, ms));

/* ============================================================
   TOAST
============================================================ */
const TOAST_ICONS = {
  green: { icon: 'fa-circle-check',         cls: 'green', title: 'Success' },
  red:   { icon: 'fa-circle-xmark',         cls: 'red',   title: 'Error'   },
  blue:  { icon: 'fa-circle-info',          cls: 'blue',  title: 'Info'    },
  warn:  { icon: 'fa-triangle-exclamation', cls: 'warn',  title: 'Warning' },
  '':    { icon: 'fa-circle-info',          cls: 'blue',  title: 'Notice'  },
};

function toast(msg, type = '', title = '') {
  const container = $('toastContainer'); if (!container) return;
  const cfg = TOAST_ICONS[type] || TOAST_ICONS[''];
  const id = 'toast_' + Date.now();
  const el = document.createElement('div');
  el.className = 'toast-item'; el.id = id;
  el.style.cssText = 'position:relative;overflow:hidden';
  el.innerHTML = `
    <div class="toast-ico ${cfg.cls}"><i class="fas ${cfg.icon}"></i></div>
    <div class="toast-body">
      <div class="toast-title">${title || cfg.title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="dismissToast('${id}')"><i class="fas fa-times"></i></button>
    <div class="toast-progress ${cfg.cls}" id="prog_${id}" style="width:100%"></div>
  `;
  container.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add('show');
    const p = $('prog_' + id);
    if (p) { p.style.transition = 'width 4000ms linear'; requestAnimationFrame(() => requestAnimationFrame(() => p.style.width = '0%')); }
  }));
  el._timer = setTimeout(() => dismissToast(id), 4000);
}

function dismissToast(id) {
  const el = $(id); if (!el) return;
  clearTimeout(el._timer);
  el.classList.remove('show'); el.classList.add('hide');
  setTimeout(() => el.remove(), 350);
}

/* ============================================================
   MODALS
============================================================ */
function openModal(id) {
  const el = $(id); if (!el) return;
  el.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = $(id); if (!el) return;
  el.classList.remove('show');
  if (!document.querySelectorAll('.ov.show').length) document.body.style.overflow = '';
}

function showProc(title = 'Processing…', sub = 'Please wait') {
  $('procTitle').textContent = title;
  $('procSub').textContent = sub;
  $('procOv').classList.add('show');
}
function hideProc() { $('procOv').classList.remove('show'); }

function showAlert(type, title, msg) {
  const icons = { ok: 'circle-check', err: 'circle-xmark', info: 'circle-info' };
  $('alertBody').innerHTML = `
    <div class="alert-ico ${type}"><i class="fas fa-${icons[type] || 'circle-info'}"></i></div>
    <div class="alert-ttl">${title}</div>
    <div class="alert-msg">${msg || ''}</div>
  `;
  openModal('alertModal');
}

function showSkeleton(wrap, count = 4) {
  wrap.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skel-card">
      <div class="skeleton skel-ico"></div>
      <div class="skel-info">
        <div class="skeleton skel-line"></div>
        <div class="skeleton skel-line sm"></div>
      </div>
      <div class="skeleton skel-price"></div>
    </div>
  `).join('');
}

/* ============================================================
   API — no random logout, only logout on confirmed 401 + refresh fail
============================================================ */
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    if (res.status === 401) {
  const body = await res.json().catch(() => null);
  if (!body || body.code === 'ACCESS_TOKEN_EXPIRED' || body.code === 'INVALID_TOKEN') {
  const refreshed = await refreshToken();
  if (refreshed) return apiCall(endpoint, options);
  return null;
}
  return body;
}
    return await res.json();
  } catch {
    toast('Network error, please check connection', 'red', 'Error');
    return null;
  }
}

async function refreshToken() {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    const data = await res.json();
    if (data?.success) { localStorage.setItem(TOKEN_KEY, data.accessToken); return true; }
    if (data?.code === 'REFRESH_TOKEN_EXPIRED' || data?.code === 'INVALID_TOKEN') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      toast('Session expired, please login again', 'red', 'Session Expired');
      setTimeout(() => window.location.replace('/login.html'), 3000);
    }
    return false;
  } catch { return false; }
}

/* ============================================================
   LOAD USER DATA — no logout on network/server error
============================================================ */
async function loadUserData() {
  const data = await apiCall('/auth/me');
  if (!data) return;         // network error — stay on page
  if (!data.success) return; // server error — stay on page

  state.user        = data.user;
  state.balance     = data.wallet.balance;
  state.totalFunded = data.wallet.totalFunded;
  state.totalSpent  = data.wallet.totalSpent;

 
  const va = data.user.virtualAccount;
  state.virtualAccount = (va && va.accountNumber) ? va : null;

  if ($('userName'))  $('userName').textContent  = state.user.fullName.split(' ')[0];
  if ($('avLetter'))  $('avLetter').textContent  = state.user.fullName[0].toUpperCase();
  if ($('ddName'))    $('ddName').textContent    = state.user.fullName;
  if ($('ddPhone'))   $('ddPhone').textContent   = state.user.phone || state.user.email;

  setupReferralLink();
  updateWalletUI();
  updateStats();
  renderVirtualCard();
  updateFundModal();
  checkEmailVerified();
}

async function loadTransactions() {
  const data = await apiCall('/transactions?limit=6');
  if (!data || !data.success) return;
  state.txns = data.transactions;
  renderTxns();
  updateStats();
}

/* ============================================================
   AUTH
============================================================ */
function doLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.location.href = '/login.html';
}

function logout() {
  closeAvDrop();
  const body = $('alertBody');
  if (body) body.innerHTML = `
    <div class="alert-ico err"><i class="fas fa-arrow-right-from-bracket"></i></div>
    <div class="alert-ttl">Logout</div>
    <div class="alert-msg">Are you sure you want to log out of your account?</div>
    <button class="btn-p" style="margin-top:16px;background:var(--danger);border-color:var(--danger)" id="confirmLogoutBtn">
      <i class="fas fa-arrow-right-from-bracket"></i>Yes, Logout
    </button>
    <button style="width:100%;padding:9px;background:transparent;border:none;color:var(--muted);font-size:.78rem;font-weight:600;cursor:pointer;font-family:'Sora',sans-serif;margin-top:6px" data-close="alertModal">Cancel</button>
  `;
  openModal('alertModal');
  setTimeout(() => {
    $('confirmLogoutBtn')?.addEventListener('click', () => {
      closeModal('alertModal');
      apiCall('/auth/logout', { method: 'POST' }).finally(doLogout);
    });
  }, 50);
}

function closeAvDrop() { $('avDrop')?.classList.remove('show'); }
function setActiveNav(id) {
  document.querySelectorAll('.bnav-i').forEach(b => b.classList.remove('active'));
  $(id)?.classList.add('active');
}

/* ============================================================
   DARK MODE
============================================================ */
function applyDark(on) {
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  const ico = $('dmIco'); if (ico) ico.className = on ? 'fas fa-sun' : 'fas fa-moon';
}

let _dmLock = false;
function toggleDark() {
  if (_dmLock) return; _dmLock = true;
  state.dark = !state.dark;
  applyDark(state.dark);
  localStorage.setItem('sh_dark', state.dark ? '1' : '0');
  setTimeout(() => _dmLock = false, 300);
}

/* ============================================================
   DATE/TIME
============================================================ */
function updateDateTime() {
  const now = new Date(), hr = now.getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : hr < 20 ? 'Good evening' : 'Good night';
  if ($('greetMsg')) $('greetMsg').textContent = greet + '! Ready to transact?';
  if ($('wDate'))    $('wDate').textContent    = now.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if ($('wTime'))    $('wTime').textContent    = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

/* ============================================================
   WALLET
============================================================ */
function slideWallet(dir) {
  const ns = Math.max(0, Math.min(1, state.walletSlide + dir));
  if (ns === state.walletSlide) return;
  state.walletSlide = ns;
  $('walletTrack').style.transform = `translateX(-${ns * 100}%)`;
  document.querySelectorAll('.wd').forEach((d, i) => d.classList.toggle('on', i === ns));
}

function updateWalletUI() {
  const el = $('walletNum'); if (!el) return;
  el.textContent = state.balHidden ? '••••••' : fmt(state.balance);
  const ico = $('eyeIco'); if (ico) ico.className = state.balHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function toggleBal() {
  state.balHidden = !state.balHidden;
  updateWalletUI();
}

function setBalance(nb) { state.balance = parseFloat(nb); updateWalletUI(); }

/* ============================================================
   VIRTUAL ACCOUNT — 
============================================================ */
function renderVirtualCard() {
  const va  = state.virtualAccount;
  const el  = $('vcContent'); if (!el) return;
  if (!va) {
    el.innerHTML = `
      <div class="wc-top"><div class="wc-lbl"><i class="fas fa-university"></i> VIRTUAL ACCOUNT</div></div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 0 12px;gap:10px">
        <div style="display:flex;gap:16px;opacity:.28">
          <i class="fas fa-university" style="font-size:1.8rem"></i>
          <i class="fas fa-credit-card" style="font-size:1.8rem"></i>
          <i class="fas fa-piggy-bank" style="font-size:1.8rem"></i>
        </div>
        <div style="font-size:.74rem;opacity:.72;text-align:center;line-height:1.6">No virtual account yet</div>
      </div>
      <button class="wc-act" id="vcGenBtn"><i class="fas fa-plus"></i>Generate Account</button>
    `;
    const btn = $('vcGenBtn');
    if (btn) btn.addEventListener('click', generateVirtualAccount);
    return;
  }
  el.innerHTML = `
    <div class="wc-top">
      <div class="wc-lbl"><i class="fas fa-university"></i> VIRTUAL ACCOUNT</div>
      <span style="font-size:.6rem;font-weight:700;opacity:.7;background:rgba(255,255,255,.15);padding:3px 8px;border-radius:8px">1.5% FEE</span>
    </div>
    <div style="margin:10px 0 4px">
      <div style="font-size:.58rem;opacity:.6;font-weight:600;letter-spacing:.6px;text-transform:uppercase;margin-bottom:3px">Account Number</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:1.3rem;font-weight:800;letter-spacing:2px;font-family:'JetBrains Mono',monospace">${va.accountNumber || '—'}</div>
        <button onclick="copyField('${va.accountNumber}','Account number')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:7px;cursor:pointer;font-size:.72rem;display:flex;align-items:center;justify-content:center"><i class="fas fa-copy"></i></button>
      </div>
    </div>
    <div style="font-size:.58rem;opacity:.55;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px">Account Name</div>
    <div style="font-size:.8rem;font-weight:700;opacity:.9;margin-bottom:6px">${va.accountName || '—'}</div>
    <div style="font-size:.58rem;opacity:.55;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px">Bank</div>
    <div style="font-size:.76rem;font-weight:700;opacity:.85;margin-bottom:10px">${va.bankName || '—'}</div>
  `;
}

async function generateVirtualAccount() {
  const btn = $('vcGenBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating…'; }
  const data = await apiCall('/wallet/virtual-account/xixa', { method: 'POST' });
  if (data?.success) {
    state.virtualAccount = data.virtualAccount;
    renderVirtualCard();
    updateFundModal();
    toast('Virtual account generated!', 'green', 'Done!');
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i>Generate Account'; }
    toast(data?.message, 'red', 'Error');
  }
}

function copyField(val, label) {
  navigator.clipboard?.writeText(val).then(() => toast(`${label} copied!`, 'green', 'Copied!'));
}

function copyAllVA() {
  const va = state.virtualAccount; if (!va) return;
  const text = `Bank: ${va.bankName}\nAccount Number: ${va.accountNumber}\nAccount Name: ${va.accountName}`;
  navigator.clipboard?.writeText(text).then(() => toast('Account details copied!', 'green', 'Copied!'));
}

function copyVA() {
  const va = state.virtualAccount; if (!va) return;
  navigator.clipboard?.writeText(va.accountNumber).then(() => toast('Account number copied!', 'green', 'Copied!'));
}

function updateFundModal() {
  const va = state.virtualAccount;
  const content = $('fundVAContent'), noVA = $('fundNoVA');
  if (!content || !noVA) return;
  if (va) {
    content.style.display = 'block'; noVA.style.display = 'none';
    if ($('fundVABank'))   $('fundVABank').textContent   = va.bankName     || '—';
    if ($('fundVANumber')) $('fundVANumber').textContent = va.accountNumber || '—';
    if ($('fundVAName'))   $('fundVAName').textContent   = va.accountName  || '—';
  } else {
    content.style.display = 'none'; noVA.style.display = 'block';
  }
}

/* ============================================================
   SERVICES GRID
============================================================ */
function renderServices() {
  const g = $('svcGrid'); if (!g) return;
  g.innerHTML = SERVICES.map(s => `
    <div class="svc" data-modal="${s.modal}">
      <div class="svc-ico ${s.bg}"><i class="fas fa-${s.icon}"></i></div>
      <div class="svc-nm">${s.label}</div>
    </div>
  `).join('');
}

/* ============================================================
   NETWORK CHIPS
============================================================ */
function buildNetChips(containerId, onSelect) {
  const c = $(containerId); if (!c) return;
  c.innerHTML = NETS.map(n => `
    <div class="nc" data-netid="${n.id}" data-netname="${n.name}">
      <div class="nc-logo" style="background:${n.bg};color:${n.fg}">${n.short}</div>
      <div class="nc-name">${n.name}</div>
    </div>
  `).join('');
  c.addEventListener('click', e => {
    const nc = e.target.closest('.nc[data-netid]'); if (!nc) return;
    c.querySelectorAll('.nc').forEach(x => x.classList.remove('sel'));
    nc.classList.add('sel');
    const net = NETS.find(n => n.id === parseInt(nc.dataset.netid));
    if (net) onSelect(net);
  });
}

/* ============================================================
   CONFIRM + PIN FLOW
============================================================ */
function openConfirm(amt, service, detailObj, pinLabel, pinAction) {
  // Check if user has set a PIN — if not, open set PIN flow first
  if (!state.user?.transactionPinSet) {
    openSetPIN();
    return;
  }
  if ($('confAmt'))     $('confAmt').textContent     = `₦${fmt(amt)}`;
  if ($('confService')) $('confService').textContent = service;
  if ($('confDetails')) $('confDetails').innerHTML   = Object.entries(detailObj).map(([k, v]) => `
    <div class="cd-row"><span class="cd-lbl">${k}</span><span class="cd-val">${v}</span></div>
  `).join('') + `
    <div class="cd-row"><span class="cd-lbl">Wallet Balance</span><span class="cd-val">₦${fmt(state.balance)}</span></div>
    <div class="cd-row"><span class="cd-lbl">Balance After</span><span class="cd-val" style="color:var(--pr);font-weight:800">₦${fmt(state.balance - amt)}</span></div>
  `;
  state.pinLabel  = pinLabel;
  state.pinAction = pinAction;
  openModal('confirmModal');
}

function openPIN() {
  state.pinBuf   = '';
  state.pinTries = 0;
  if ($('pinSum')) $('pinSum').textContent = state.pinLabel;
  if ($('pinErr')) $('pinErr').textContent = '';
  updatePinDots('pd');
  openModal('pinModal');
}

/* ============================================================
   SET PIN — first time PIN setup
============================================================ */
let _spPhase = 1, _spBuf = '', _spNew = '';

function openSetPIN() {
  _spPhase = 1; _spBuf = ''; _spNew = '';
  updateSetPinUI();
  openModal('setPinModal');
}

function updateSetPinUI() {
  const phases = ['Create a PIN', 'Confirm your PIN'];
  const subs   = ['Choose a 4-digit transaction PIN', 'Re-enter your PIN to confirm'];
  if ($('spTitle')) $('spTitle').textContent = phases[_spPhase - 1];
  if ($('spSub'))   $('spSub').textContent   = subs[_spPhase - 1];
  if ($('spErr'))   $('spErr').textContent   = '';
  for (let i = 0; i < 4; i++) {
    const d = $('spd' + i); if (d) d.classList.remove('on');
  }
  // Update step bar
  if ($('sps1')) $('sps1').classList.toggle('on', _spPhase >= 1);
  if ($('sps2')) $('sps2').classList.toggle('on', _spPhase >= 2);
}

function spKey(k) {
  if (k === 'del') { _spBuf = _spBuf.slice(0, -1); }
  else if (_spBuf.length < 4) { _spBuf += k; }
  for (let i = 0; i < 4; i++) {
    const d = $('spd' + i); if (d) d.classList.toggle('on', i < _spBuf.length);
  }
  if (_spBuf.length === 4) setTimeout(procSetPIN, 150);
}

async function procSetPIN() {
  if (_spPhase === 1) {
    _spNew = _spBuf; _spBuf = ''; _spPhase = 2;
    updateSetPinUI();
  } else {
    if (_spBuf !== _spNew) {
      if ($('spErr')) $('spErr').textContent = 'PINs do not match, try again';
      _spBuf = ''; _spPhase = 1; _spNew = '';
      for (let i = 0; i < 4; i++) { const d = $('spd' + i); if (d) d.classList.remove('on'); }
      setTimeout(updateSetPinUI, 600);
      return;
    }
    // Save PIN
    showProc('Setting PIN…', 'Please wait');
    const d = await apiCall('/auth/set-pin', { method: 'POST', body: JSON.stringify({ pin: _spNew }) });
    hideProc();
    if (d?.success) {
      state.user.transactionPinSet = true;
      closeModal('setPinModal');
      toast('PIN set successfully! You can now transact.', 'green', 'PIN Created!');
    } else {
      if ($('spErr')) $('spErr').textContent = d?.message;
      _spBuf = ''; _spPhase = 1; _spNew = '';
      updateSetPinUI();
    }
  }
}

function updatePinDots(prefix) {
  const buf = prefix === 'pd' ? state.pinBuf : state.cpBuf;
  for (let i = 0; i < 4; i++) {
    const el = $(prefix + i);
    if (el) el.classList.toggle('on', i < buf.length);
  }
}

async function verifyPIN() {
  const pin = state.pinBuf;
  closeModal('pinModal');
  const action = state.pinAction;
  state.pinBuf   = '';
  state.pinAction = null;
  if (action) await action(pin);
}

/* ============================================================
   DATA
============================================================ */
function onSelDataNet(n) {
  state.selNet     = n.id;
  state.selNetName = n.name;
  state.selPlan    = null;
  state.shownN     = 20;
  fetchDataPlans(n.id, n.name);
}

async function fetchDataPlans(netId) {
  $('planSection').style.display = 'block';
  showSkeleton($('plansWrap'));
  const netMap = { 1: 'MTN', 2: 'AIRTEL', 3: 'GLO', 4: '9MOBILE' };
  const data = await apiCall(`/data/plans/${netMap[netId]}`);
  if (!data || !data.success) {
    $('plansWrap').innerHTML = '<div class="empty" style="padding:12px"><i class="fas fa-box-open"></i><p>Could not load plans</p></div>';
    return;
  }
  const plans = data.plans;
  const tabs  = [...new Set(plans.map(p => p.planType))];
  state.selTab        = tabs[0] || '';
  state.filteredPlans = plans;

  $('planTabs').innerHTML = tabs.map((t, i) => `
    <button class="pt ${i === 0 ? 'active' : ''}" data-tab="${t}">${t}</button>
  `).join('');

  $('planTabs').onclick = e => {
    const btn = e.target.closest('[data-tab]'); if (!btn) return;
    state.selTab  = btn.dataset.tab;
    state.selPlan = null;
    state.shownN  = 10;
    $('planTabs').querySelectorAll('.pt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showSkeleton($('plansWrap'), 3);
    setTimeout(() => renderPlans(), 300);
  };

  renderPlans();
}

function renderPlans() {
  const all  = state.filteredPlans.filter(p => p.planType === state.selTab);
  const shown = all.slice(0, state.shownN);
  const wrap = $('plansWrap');

  if (!shown.length) {
    wrap.innerHTML = '<div class="empty" style="padding:12px"><i class="fas fa-box-open"></i><p>No plans for this type 🙂</p></div>';
    $('loadMoreBtn').style.display = 'none';
    return;
  }

  wrap.innerHTML = shown.map(p => `
    <div class="dc ${state.selPlan && state.selPlan.planId === p.planId ? 'sel' : ''}" data-planid="${p.planId}">
      <div class="dc-ico"><i class="fas fa-wifi"></i></div>
      <div class="dc-info">
        <div class="dc-name">${p.planName}</div>
        <div class="dc-validity"><i class="fas fa-clock" style="font-size:.56rem"></i>${p.validity}</div>
      </div>
      <div class="dc-price">₦${p.sellingPrice.toLocaleString()}</div>
      <button class="dc-buy" data-buyid="${p.planId}">Buy</button>
    </div>
  `).join('');

  $('loadMoreBtn').style.display = all.length > state.shownN ? 'block' : 'none';

  wrap.onclick = e => {
    const pc = e.target.closest('.dc[data-planid]');
    if (pc) {
      wrap.querySelectorAll('.dc').forEach(c => c.classList.remove('sel'));
      pc.classList.add('sel');
      state.selPlan = state.filteredPlans.find(p => p.planId === parseInt(pc.dataset.planid));
    }
    const buy = e.target.closest('[data-buyid]');
    if (buy) {
      e.stopPropagation();
      const plan = state.filteredPlans.find(p => p.planId === parseInt(buy.dataset.buyid));
      if (plan) { state.selPlan = plan; triggerBuyData(); }
    }
  };
}

function triggerBuyData() {
  const phone = $('dataPhone').value.trim();
  if (!phone || phone.length < 11) { toast('Enter a valid 11-digit phone number', 'red', 'Invalid'); $('dataPhone').focus(); return; }
  if (!state.selPlan) return;
  if (state.selPlan.sellingPrice > state.balance) return toast('Insufficient balance', 'red', 'Balance Error');
  openConfirm(
    state.selPlan.sellingPrice,
    'Data Bundle',
    { Network: state.selNetName, Plan: `${state.selPlan.planName} — ${state.selPlan.validity}`, Type: state.selTab, Phone: phone },
    `${state.selNetName} ${state.selPlan.planName} · ₦${state.selPlan.sellingPrice.toLocaleString()}`,
    (pin) => execData(state.selPlan, phone, pin)
  );
}

async function execData(plan, phone, pin) {
  closeModal('dataModal');
  showProc('Purchasing Data…', `${state.selNetName} ${plan.planName} → ${phone}`);
  const data = await apiCall('/data/buy', {
    method: 'POST',
    body: JSON.stringify({ planId: plan.planId, phone, pin }),
  });
  hideProc();
  if (!data || !data.success) {
    console.error('execData error:', data);
    showAlert('err', 'Transaction Failed', data && data.message ? data.message : '');
    await loadUserData();
    return;
  }
  setBalance(data.transaction.newBalance);
  addRecent(phone, state.selNetName, true);
  await loadTransactions();
  showReceipt({
    txId: data.transaction.requestId,
    service: 'Data Bundle',
    amt: plan.sellingPrice,
    status: 'success',
    details: { Network: state.selNetName, Plan: `${plan.planName} — ${plan.validity}`, Phone: phone },
    balBefore: data.transaction.oldBalance,
    balAfter: data.transaction.newBalance,
  });
}

/* ============================================================
   AIRTIME
============================================================ */
function initAirtime() {
  const phone = $('atPhone').value.trim();
  const amt   = parseFloat($('atAmt').value);
  if (!state.atNet) return toast('Select a network', 'red', 'Required');
  if (!phone || phone.length < 11) return toast('Enter valid 11-digit number', 'red', 'Invalid');
  if (!amt || amt < state.atMinAmount) return toast(`Minimum airtime is ₦${state.atMinAmount}`, 'red', 'Invalid');
  if (amt > state.balance) return toast('Insufficient balance', 'red', 'Balance Error');
  openConfirm(
    amt, 'Airtime',
    { Network: state.atNet, Phone: phone, Amount: `₦${amt.toLocaleString()}` },
    `${state.atNet} Airtime · ₦${amt.toLocaleString()}`,
    (pin) => execAirtime(phone, amt, pin)
  );
}

async function execAirtime(phone, amt, pin) {
  closeModal('airtimeModal');
  showProc('Sending Airtime…', `${state.atNet} → ${phone}`);
  const data = await apiCall('/airtime/buy', {
    method: 'POST',
    body: JSON.stringify({ network: state.atNet, phone, amount: amt, pin }),
  });
  hideProc();
  if (!data || !data.success) {
    showAlert('err', 'Transaction Failed', data && data.message ? data.message : '');
    await loadUserData();
    return;
  }
  setBalance(data.transaction.newBalance);
  addRecent(phone, state.atNet, true);
  await loadTransactions();
  showReceipt({
    txId: data.transaction.requestId,
    service: 'Airtime',
    amt,
    status: 'success',
    details: { Network: state.atNet, Phone: phone },
    balBefore: data.transaction.oldBalance,
    balAfter: data.transaction.newBalance,
  });
}

/* ============================================================
   CABLE TV
============================================================ */
async function loadCablePlans(prov) {
  if (state.cablePlans[prov]) return state.cablePlans[prov];
  const provMap = { dstv: 'DSTV', gotv: 'GOTV', startimes: 'STARTIMES' };
  const data = await apiCall(`/cable/plans/${provMap[prov]}`);
  if (data && data.success) {
    state.cablePlans[prov] = data.plans;
    return data.plans;
  }
  return [];
}

function selectCableProv(prov) {
  state.cableProv    = prov;
  state.cableSelPlan = null;
  $('cableProvChips').querySelectorAll('.nc').forEach(c => c.classList.remove('sel'));
  $('cableProvChips').querySelector(`[data-prov="${prov}"]`)?.classList.add('sel');
  $('cablePriceBox').style.display = 'none';
  const wrap = $('cablePlansWrap');
  showSkeleton(wrap, 3);
  loadCablePlans(prov).then(plans => {
    if (!plans.length) {
      wrap.innerHTML = '<p style="font-size:.78rem;color:var(--muted);text-align:center;padding:16px 0">No plans available</p>';
      return;
    }
    wrap.innerHTML = plans.map(p => `
      <div class="dc" data-cplanid="${p.planCode || p.id}" data-amt="${p.sellingPrice || p.amount}">
        <div class="dc-ico" style="background:rgba(16,185,129,.12);color:var(--success)"><i class="fas fa-tv"></i></div>
        <div class="dc-info">
          <div class="dc-name">${p.planName || p.name}</div>
          <div class="dc-validity"><i class="fas fa-calendar" style="font-size:.56rem"></i>Monthly</div>
        </div>
        <div class="dc-price">₦${(p.sellingPrice || p.amount).toLocaleString()}</div>
      </div>
    `).join('');
    wrap.onclick = e => {
      const dc = e.target.closest('.dc[data-cplanid]'); if (!dc) return;
      wrap.querySelectorAll('.dc').forEach(c => c.classList.remove('sel'));
      dc.classList.add('sel');
      state.cableSelPlan = plans.find(p => (p.planCode || p.id) === dc.dataset.cplanid);
      $('cablePriceVal').textContent = `₦${parseInt(dc.dataset.amt).toLocaleString()}`;
      $('cablePriceBox').style.display = 'flex';
    };
  });
}

function initCable() {
  if (!state.cableProv) return toast('Select a provider', 'red', 'Required');
  if (!state.cableSelPlan) return toast('Select a plan', 'red', 'Required');
  const card = $('cableCard').value.trim();
  if (!card) return toast('Enter smart card number', 'red', 'Required');
  const amt      = state.cableSelPlan.sellingPrice || state.cableSelPlan.amount;
  if (amt > state.balance) return toast('Insufficient balance', 'red', 'Balance Error');
  const planName = state.cableSelPlan.planName || state.cableSelPlan.name;
  const planCode = state.cableSelPlan.planCode || state.cableSelPlan.id;
  openConfirm(
    amt, 'Cable TV',
    { Provider: state.cableProv.toUpperCase(), Plan: planName, 'Smart Card': card },
    `${planName} · ₦${amt.toLocaleString()}`,
    (pin) => execCable(state.cableProv, planCode, card, amt, planName, pin)
  );
}

async function execCable(prov, planCode, card, amt, planName, pin) {
  closeModal('cableModal');
  showProc('Subscribing…', planName);
  const data = await apiCall('/cable/buy', {
    method: 'POST',
    body: JSON.stringify({ cable: prov, planCode, smartCardNumber: card, amount: amt, pin }),
  });
  hideProc();
  if (!data || !data.success) {
    showAlert('err', 'Transaction Failed', data && data.message ? data.message : '');
    await loadUserData();
    return;
  }
  setBalance(data.transaction.newBalance);
  await loadTransactions();
  showReceipt({
    txId: data.transaction.requestId,
    service: 'Cable TV',
    amt,
    status: 'success',
    details: { Provider: prov.toUpperCase(), Plan: planName, 'Smart Card': card },
    balBefore: data.transaction.oldBalance,
    balAfter: data.transaction.newBalance,
  });
}

/* ============================================================
   ELECTRICITY
============================================================ */
async function loadElectricityPlans() {
  if (state.electricityPlans.length) return;
  const data = await apiCall('/electricity/plans');
  if (data && data.success) {
    state.electricityPlans = data.plans;
    const select = $('disco');
    if (select && data.plans.length) {
      select.innerHTML = data.plans.map(p =>
        `<option value="${p.discoName.toLowerCase()}">${p.discoName} Electric</option>`
      ).join('');
    }
  }
}

function initElec() {
  const disco     = $('disco');
  const discoName = disco.selectedOptions[0].text;
  const meter     = $('elecMeter').value.trim();
  const mtype     = $('elecMtype').value;
  const amt       = parseFloat($('elecAmt').value);
  if (!meter) return toast('Enter meter number', 'red', 'Required');
  if (!amt || amt < 100) return toast('Minimum amount is ₦100', 'red', 'Invalid');
  if (amt > state.balance) return toast('Insufficient balance', 'red', 'Balance Error');
  openConfirm(
    amt, 'Electricity',
    { DISCO: discoName, 'Meter No.': meter, 'Meter Type': mtype },
    `${discoName} · ₦${amt.toLocaleString()}`,
    (pin) => execElec(disco.value, meter, mtype, amt, discoName, pin)
  );
}

async function execElec(disco, meter, mtype, amt, discoName, pin) {
  closeModal('elecModal');
  showProc('Vending Token…', `${discoName} — ${meter}`);
  const data = await apiCall('/electricity/buy', {
    method: 'POST',
    body: JSON.stringify({ disco, meterType: mtype, meterNumber: meter, amount: amt, pin }),
  });
  hideProc();
  if (!data || !data.success) {
    showAlert('err', 'Transaction Failed', data && data.message ? data.message : '');
    await loadUserData();
    return;
  }
  setBalance(data.transaction.newBalance);
  await loadTransactions();
  showReceipt({
    txId: data.transaction.requestId,
    service: 'Electricity',
    amt,
    status: 'success',
    details: { DISCO: discoName, 'Meter No.': meter, 'Meter Type': mtype, 'Token 🔑': data.transaction.token || '—' },
    balBefore: data.transaction.oldBalance,
    balAfter: data.transaction.newBalance,
  });
}

/* ============================================================
   EXAM
============================================================ */
async function loadExamPlans() {
  if (state.examPlans.length) return;
  const data = await apiCall('/exam/types');
  if (data && data.success && data.exams.length) {
    state.examPlans = data.exams;
    const select = $('examType');
    if (select) {
      select.innerHTML = data.exams.map(e =>
        `<option value="${e.examName.toLowerCase()}" data-p="${e.sellingPrice}">${e.examName} Result Checker — ₦${e.sellingPrice.toLocaleString()}</option>`
      ).join('');
      calcExam();
    }
  }
}

function calcExam() {
  const opt = $('examType')?.selectedOptions[0]; if (!opt) return;
  const qty = Math.min(Math.max(parseInt($('examQty').value) || 1, 1), 10);
  if ($('examTotal')) $('examTotal').textContent = `₦${(parseInt(opt.dataset.p) * qty).toLocaleString()}`;
}

function initExam() {
  const opt = $('examType').selectedOptions[0];
  const qty = Math.min(Math.max(parseInt($('examQty').value) || 1, 1), 10);
  const amt = parseInt(opt.dataset.p) * qty;
  const name = opt.textContent.split('—')[0].trim();
  if (amt > state.balance) return toast('Insufficient balance', 'red', 'Balance Error');
  openConfirm(
    amt, 'Exam PIN',
    { Exam: name, Quantity: qty, 'Price Each': `₦${parseInt(opt.dataset.p).toLocaleString()}` },
    `${name} ×${qty} · ₦${amt.toLocaleString()}`,
    (pin) => execExam($('examType').value, qty, amt, name, pin)
  );
}

async function execExam(examType, qty, amt, examName, pin) {
  closeModal('examModal');
  showProc('Generating PIN(s)…', `${examName} ×${qty}`);
  const data = await apiCall('/exam/buy', {
    method: 'POST',
    body: JSON.stringify({ examType, quantity: qty, pin }),
  });
  hideProc();
  if (!data || !data.success) {
    showAlert('err', 'Transaction Failed', data && data.message ? data.message : '');
    await loadUserData();
    return;
  }
  setBalance(data.transaction.newBalance);
  await loadTransactions();
  showReceipt({
    txId: data.transaction.requestId,
    service: 'Exam PIN',
    amt,
    status: 'success',
    details: { Exam: examName, Quantity: qty, 'Generated PIN': data.transaction.pin || '—' },
    balBefore: data.transaction.oldBalance,
    balAfter: data.transaction.newBalance,
  });
}

/* ============================================================
   RECHARGE CARD — real API, no fake pins
============================================================ */
function calcRC() {
  const d = parseFloat($('rcDenom').value) || 100;
  const q = Math.min(Math.max(parseInt($('rcQty').value) || 1, 1), 50);
  if ($('rcTotal')) $('rcTotal').textContent = `₦${(d * q).toLocaleString()}`;
}

function initRC() {
  if (!state.rcNet) return toast('Select a network', 'red');
  const d   = parseFloat($('rcDenom').value);
  const q   = Math.min(Math.max(parseInt($('rcQty').value) || 1, 1), 50);
  const amt = d * q;
  if (amt > state.balance) return toast('Insufficient balance', 'red');
  openConfirm(
    amt, 'Recharge Card',
    { Network: state.rcNet, Denomination: `₦${d}`, Quantity: q },
    `${state.rcNet} Recharge ×${q} · ₦${amt.toLocaleString()}`,
    (pin) => execRC(d, q, amt, pin)
  );
}

async function execRC(denom, qty, amt, pin) {
  closeModal('rcModal');
  showProc('Generating Card(s)…', `${state.rcNet} ₦${denom} ×${qty}`);
  const data = await apiCall('/rc/buy', {
    method: 'POST',
    body: JSON.stringify({ network: state.rcNet, denomination: denom, quantity: qty, pin }),
  });
  hideProc();
  if (!data || !data.success) {
    showAlert('err', 'Transaction Failed', data && data.message ? data.message : '');
    await loadUserData();
    return;
  }
  setBalance(data.transaction.newBalance);
  state.rcCards = data.cards || [];
  await loadTransactions();
  showPrintCards(state.rcCards);
}

function showPrintCards(cards) {
  if (!cards || !cards.length) {
    toast('No cards received from server', 'red', 'Error');
    return;
  }
  $('printCardsWrap').innerHTML = cards.map((c, i) => `
    <div class="print-card">
      <div class="pc-header">
        <span class="pc-net">${c.network || c.net}</span>
        <span class="pc-type">₦${(c.denomination || c.denom || 0).toLocaleString()} Airtime</span>
      </div>
      <div class="pc-pin-label">PIN</div>
      <div class="pc-pin">${c.pin}</div>
      <div class="pc-footer">
        <div style="font-size:.58rem;opacity:.55;font-family:'JetBrains Mono',monospace">${c.serial || c.serialNumber || ''}</div>
        <button class="pc-copy" data-pin="${c.pin}" data-idx="${i}">
          <i class="fas fa-copy"></i> Copy PIN
        </button>
      </div>
    </div>
  `).join('');

  $('printCardsWrap').addEventListener('click', e => {
    const btn = e.target.closest('.pc-copy[data-pin]'); if (!btn) return;
    navigator.clipboard?.writeText(btn.dataset.pin).catch(() => {});
    btn.classList.add('copied');
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<i class="fas fa-copy"></i> Copy PIN'; }, 2000);
  });

  openModal('printModal');
}

/* ============================================================
   PRINT DATA
============================================================ */
function onSelPdNet(n) {
  state.pdNet     = n.id;
  state.pdNetName = n.name;
  state.pdPlan    = null;
  state.pdShown   = 10;
  $('pdSection').style.display = 'block';
  showSkeleton($('pdPlansWrap'), 3);
  const netMap = { 1: 'MTN', 2: 'AIRTEL', 3: 'GLO', 4: '9MOBILE' };
  apiCall(`/data/plans/${netMap[n.id]}`).then(data => {
    if (!data || !data.success) return;
    const plans = data.plans;
    const tabs  = [...new Set(plans.map(p => p.planType))];
    state.pdTab      = tabs[0] || '';
    state.pdFiltered = plans;
    $('pdTabs').innerHTML = tabs.map((t, i) => `
      <button class="pt ${i === 0 ? 'active' : ''}" data-pdtab="${t}">${t}</button>
    `).join('');
    $('pdTabs').onclick = e => {
      const btn = e.target.closest('[data-pdtab]'); if (!btn) return;
      state.pdTab  = btn.dataset.pdtab;
      state.pdPlan = null;
      $('pdTabs').querySelectorAll('.pt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPdPlans();
    };
    renderPdPlans();
  });
}

function renderPdPlans() {
  const all  = state.pdFiltered.filter(p => p.planType === state.pdTab);
  const shown = all.slice(0, state.pdShown);
  const wrap = $('pdPlansWrap');
  if (!shown.length) {
    wrap.innerHTML = '<div class="empty" style="padding:12px"><i class="fas fa-box-open"></i><p>No plans</p></div>';
    if ($('pdSubmit')) $('pdSubmit').style.display = 'none';
    return;
  }
  wrap.innerHTML = shown.map(p => `
    <div class="dc ${state.pdPlan && state.pdPlan.planId === p.planId ? 'sel' : ''}" data-pdplanid="${p.planId}">
      <div class="dc-ico"><i class="fas fa-wifi"></i></div>
      <div class="dc-info">
        <div class="dc-name">${p.planName}</div>
        <div class="dc-validity"><i class="fas fa-clock" style="font-size:.56rem"></i>${p.validity}</div>
      </div>
      <div class="dc-price">₦${p.sellingPrice.toLocaleString()}</div>
    </div>
  `).join('');
  if ($('pdSubmit')) $('pdSubmit').style.display = 'flex';
  wrap.onclick = e => {
    const pc = e.target.closest('.dc[data-pdplanid]'); if (!pc) return;
    wrap.querySelectorAll('.dc').forEach(c => c.classList.remove('sel'));
    pc.classList.add('sel');
    state.pdPlan = state.pdFiltered.find(p => p.planId === parseInt(pc.dataset.pdplanid));
    updatePdPrice();
  };
}

function updatePdPrice() {
  if (!state.pdPlan) return;
  const qty   = Math.min(Math.max(parseInt($('pdQty').value) || 1, 1), 10);
  const total = state.pdPlan.sellingPrice * qty;
  if ($('pdTotal'))    $('pdTotal').textContent       = `₦${total.toLocaleString()}`;
  if ($('pdPriceBox')) $('pdPriceBox').style.display  = 'flex';
}

function initPrintData() {
  if (!state.pdNet)  return toast('Select a network', 'red');
  if (!state.pdPlan) return toast('Select a plan', 'red');
  const qty = Math.min(Math.max(parseInt($('pdQty').value) || 1, 1), 10);
  const amt = state.pdPlan.sellingPrice * qty;
  if (amt > state.balance) return toast('Insufficient balance', 'red');
  openConfirm(
    amt, 'Print Data',
    { Network: state.pdNetName, Plan: state.pdPlan.planName, Quantity: qty },
    `${state.pdNetName} ${state.pdPlan.planName} ×${qty}`,
    (pin) => execData(state.pdPlan, '', pin)
  );
}

/* ============================================================
   FUND MODAL
============================================================ */
function initFund() { /* fund via VA only */ }

function copyVAFund() {
  const va = state.virtualAccount; if (!va) return;
  navigator.clipboard?.writeText(va.accountNumber).then(() => toast('Account number copied!', 'green', 'Copied!'));
}

/* ============================================================
   BULK SMS
============================================================ */
function calcSMS() {
  const nums = $('smsNums').value.split(',').filter(n => n.trim().length > 5);
  if ($('smsCount')) $('smsCount').textContent = nums.length;
  if ($('smsCost'))  $('smsCost').textContent  = `₦${(nums.length * 4).toLocaleString()}`;
}

function initSMS() {
  const sender = $('smsSender').value.trim();
  const msg    = $('smsMsg').value.trim();
  const nums   = $('smsNums').value.split(',').map(n => n.trim()).filter(n => n.length > 5);
  if (!sender)       return toast('Enter sender ID', 'red');
  if (!nums.length)  return toast('Enter at least one recipient', 'red');
  if (!msg)          return toast('Enter a message', 'red');
  if (msg.length > 160) return toast('Message exceeds 160 characters', 'red');
  const amt = nums.length * 4;
  if (amt > state.balance) return toast('Insufficient balance', 'red');
  openConfirm(
    amt, 'Bulk SMS',
    { Sender: sender, Recipients: nums.length, Message: msg.slice(0, 30) + '…' },
    `Bulk SMS ×${nums.length} · ₦${amt.toLocaleString()}`,
    (pin) => execSMS(sender, nums, msg, amt, pin)
  );
}

async function execSMS(sender, numbers, message, amt, pin) {
  closeModal('smsModal');
  showProc('Sending SMS…', `${numbers.length} recipient(s)`);
  const data = await apiCall('/sms/send', {
    method: 'POST',
    body: JSON.stringify({ sender, numbers, message, pin }),
  });
  hideProc();
  if (!data || !data.success) {
    showAlert('err', 'SMS Failed', data?.message || 'Service unavailable');
    await loadUserData();
    return;
  }
  setBalance(data.transaction.newBalance);
  await loadTransactions();
  showReceipt({
    txId: data.transaction.requestId,
    service: 'Bulk SMS',
    amt,
    status: 'success',
    details: { Sender: sender, Recipients: numbers.length },
    balBefore: data.transaction.oldBalance,
    balAfter: data.transaction.newBalance,
  });
}

/* ============================================================
   RECENTS + CONTACTS
============================================================ */
function addRecent(phone, net, ok) {
  state.recents = state.recents.filter(n => n.phone !== phone);
  const contact = state.contacts.find(c => c.phone === phone);
  state.recents.unshift({ phone, net, ok, name: contact?.name || '', date: new Date().toISOString() });
  if (state.recents.length > 15) state.recents = state.recents.slice(0, 15);
  localStorage.setItem('sh_recents', JSON.stringify(state.recents));
  renderRecents();
}

function renderRecents(filter = '') {
  const scroll = $('rnScroll'); if (!scroll) return;
  const NETCOLORS = { MTN: '#ffcc00', Airtel: '#ef0000', Glo: '#009a44', '9Mobile': '#006b3c' };
  const NETFG = { MTN: '#1a1a00', Airtel: '#fff', Glo: '#fff', '9Mobile': '#fff' };
  const combined = [...state.recents, ...state.contacts.filter(c => !state.recents.find(r => r.phone === c.phone))];
  const filtered = filter
    ? combined.filter(n => (n.name || '').toLowerCase().includes(filter.toLowerCase()) || (n.phone || '').includes(filter))
    : combined;

  if (!filtered.length) {
    scroll.innerHTML = `<div class="rn-empty"><i class="fas fa-users"></i><span>${filter ? 'No results found' : 'No recent numbers yet'}</span></div>`;
    return;
  }

  scroll.innerHTML = filtered.map(n => {
    const bg = NETCOLORS[n.net] || '#00aaff', fg = NETFG[n.net] || '#fff';
    const initials = n.name ? n.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : n.phone.slice(-2);
    const isRecent = state.recents.find(r => r.phone === n.phone);
    const isContact = state.contacts.find(c => c.phone === n.phone);
    return `
    <div class="chip" data-phone="${n.phone}" data-net="${n.net}" data-netbg="${bg}" data-netfg="${fg}" title="${n.name || n.phone}">
      <div class="chip-av" style="background:${bg};color:${fg}">${initials}<span class="sdot ${isRecent ? (n.ok ? 'ok' : 'bad') : 'neutral'}"></span></div>
      <div class="chip-name">${n.name || '—'}</div>
      <div class="chip-num">${n.phone}</div>
      <div class="chip-net">${n.net}</div>
      <div class="chip-actions">
        <button class="chip-act-btn edit" data-action="edit" data-phone="${n.phone}" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="chip-act-btn del" data-action="del" data-phone="${n.phone}" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');

  scroll.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', e => {
      // Ignore if clicking action buttons
      if (e.target.closest('.chip-act-btn')) return;
      state.qsPhone = chip.dataset.phone;
      state.qsNet   = chip.dataset.net;
      if ($('qsPhone'))    $('qsPhone').value = chip.dataset.phone;
      // Auto-detect and pre-select network in data & airtime modals
      const chipNet = NETS.find(n => n.name === chip.dataset.net);
      if (chipNet) {
        // Pre-select in data modal
        onSelDataNet(chipNet);
        document.querySelectorAll('#dnChips .nc').forEach(nc => nc.classList.toggle('sel', nc.dataset.netname === chipNet.name));
        // Pre-select in airtime modal
        state.atNet = chipNet.name; state.atNetId = chipNet.id;
        document.querySelectorAll('#atChips .nc').forEach(nc => nc.classList.toggle('sel', nc.dataset.netname === chipNet.name));
        // Pre-fill airtime phone
        if ($('atPhone')) $('atPhone').value = chip.dataset.phone;
        if ($('dataPhone')) $('dataPhone').value = chip.dataset.phone;
      }
      if ($('qsNetBadge')) {
        $('qsNetBadge').textContent = chip.dataset.net;
        $('qsNetBadge').style.cssText = `background:${chip.dataset.netbg};color:${chip.dataset.netfg};display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:.76rem;font-weight:800;margin-bottom:14px`;
      }
      openModal('quickSvcModal');
    });

    chip.querySelectorAll('.chip-act-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const phone = btn.dataset.phone;
        if (btn.dataset.action === 'edit') editContact(phone);
        else confirmDeleteContact(phone);
      });
    });
  });
}

function saveContact() {
  const name  = $('scName').value.trim();
  const phone = $('scPhone').value.trim();
  const net   = $('scNet').value;
  if (!name)                       return toast('Enter a name', 'red');
  if (!phone || phone.length < 11) return toast('Enter valid 11-digit number', 'red');

  const oldPhone = state.editingContactPhone;

  // Remove old entry (by old phone if editing, or by new phone if duplicate)
  if (oldPhone && oldPhone !== phone) {
    state.contacts = state.contacts.filter(c => c.phone !== oldPhone);
    state.recents  = state.recents.filter(r => r.phone !== oldPhone);
  }
  state.contacts = state.contacts.filter(c => c.phone !== phone);
  state.contacts.unshift({ name, phone, net, date: new Date().toISOString() });

  // Also update name in recents if phone matches
  state.recents = state.recents.map(r =>
    r.phone === phone || r.phone === oldPhone
      ? { ...r, phone, name, net }
      : r
  );

  localStorage.setItem('sh_contacts', JSON.stringify(state.contacts));
  localStorage.setItem('sh_recents',  JSON.stringify(state.recents));
  $('scName').value = ''; $('scPhone').value = '';
  $('saveBar')?.classList.remove('open');
  state.editingContactPhone = null;
  renderRecents();
  toast(`${name} saved!`, 'green');
}

function editContact(phone) {
  const contact = state.contacts.find(c => c.phone === phone);
  const recent  = state.recents.find(r => r.phone === phone);
  const entry   = contact || recent;
  if (!entry) return;
  state.editingContactPhone = phone;
  // Open save bar with pre-filled data
  const bar = $('saveBar');
  if (bar) bar.classList.add('open');
  const t = document.querySelector('#saveBar .save-bar-title');
  if (t) t.innerHTML = '<i class="fas fa-pen"></i>Edit Contact';
  if ($('scName'))  $('scName').value  = entry.name  || '';
  if ($('scPhone')) $('scPhone').value = entry.phone || '';
  if ($('scNet'))   $('scNet').value   = entry.net   || 'MTN';
}

function confirmDeleteContact(phone) {
  const entry = [...state.contacts, ...state.recents].find(n => n.phone === phone);
  const label = entry?.name || phone;
  const body = $('alertBody');
  if (body) body.innerHTML = `
    <div class="alert-ico err"><i class="fas fa-trash"></i></div>
    <div class="alert-ttl">Delete Contact</div>
    <div class="alert-msg">Remove <strong>${label}</strong> (${phone}) from your contacts and recents?</div>
    <button class="btn-p" style="margin-top:16px;background:var(--danger);border-color:var(--danger)" id="confirmDelBtn">
      <i class="fas fa-trash"></i>Yes, Delete
    </button>
    <button style="width:100%;padding:9px;background:transparent;border:none;color:var(--muted);font-size:.78rem;font-weight:600;cursor:pointer;font-family:'Sora',sans-serif;margin-top:6px" data-close="alertModal">Cancel</button>
  `;
  openModal('alertModal');
  setTimeout(() => {
    $('confirmDelBtn')?.addEventListener('click', () => {
      state.contacts = state.contacts.filter(c => c.phone !== phone);
      state.recents  = state.recents.filter(r => r.phone !== phone);
      localStorage.setItem('sh_contacts', JSON.stringify(state.contacts));
      localStorage.setItem('sh_recents',  JSON.stringify(state.recents));
      renderRecents();
      closeModal('alertModal');
      toast(`${label} deleted`, 'green');
    });
  }, 50);
}

function exportContacts() {
  const combined = [...state.contacts, ...state.recents.filter(r => !state.contacts.find(c => c.phone === r.phone))];
  if (!combined.length) { toast('No contacts to export yet', 'warn', 'Empty'); return; }
  const rows = [['Name', 'Phone Number', 'Network', 'Date Added']];
  combined.forEach(c => {
    rows.push([c.name || '—', c.phone || '—', c.net || '—', c.date ? new Date(c.date).toLocaleDateString('en-NG') : '—']);
  });
  const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `SubHub_Contacts_${new Date().toLocaleDateString('en-NG').replace(/\//g, '-')}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`${combined.length} contacts exported as CSV`, 'green', 'Exported!');
}

/* ============================================================
   REFERRAL
============================================================ */
function setupReferralLink() {
  const username = state.user?.username || '';
  const link     = `${window.location.origin}/sign-up?ref=${username}`;
  const input    = $('refLinkInput');
  if (input) input.value = link;
}

function copyRefLink() {
  const input = $('refLinkInput'); if (!input) return;
  const link  = input.value;
  navigator.clipboard?.writeText(link).then(() => {
    if ($('refCopyIco'))  $('refCopyIco').className  = 'fas fa-check';
    if ($('refCopyTxt'))  $('refCopyTxt').textContent = 'Copied!';
    if ($('refLinkBtn'))  $('refLinkBtn').classList.add('copied');
    toast('Referral link copied to clipboard!', 'green', 'Copied!');
    setTimeout(() => {
      if ($('refCopyIco'))  $('refCopyIco').className  = 'fas fa-copy';
      if ($('refCopyTxt'))  $('refCopyTxt').textContent = 'Copy';
      if ($('refLinkBtn'))  $('refLinkBtn').classList.remove('copied');
    }, 2500);
  }).catch(() => {
    if (navigator.share) navigator.share({ title: 'Join SubHub', url: link });
    else toast(link, 'blue', 'Share this link');
  });
}

/* ============================================================
   ANNOUNCEMENT
============================================================ */
async function showAnnouncement(force = false) {
  const data = await apiCall('/admin/announcements/latest');
  const ann  = data?.announcement;
  if (!ann) { if ($('annDot')) $('annDot').style.display = 'none'; return; }
  // Always show — no read check

  if ($('annContent')) $('annContent').innerHTML = `
    <div class="modal-hd">
      <div class="modal-ttl" style="gap:6px">
        <span style="font-size:1.2rem">${ann.icon || '📢'}</span>
        <span>${ann.title}</span>
      </div>
      <button class="m-close" data-close="annModal"><i class="fas fa-times"></i></button>
    </div>
    <div style="background:linear-gradient(135deg,var(--pr),var(--pr-d));border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.1)"></div>
      <div style="font-size:2.4rem;margin-bottom:8px">${ann.icon || '📢'}</div>
      ${ann.badge ? `<div style="color:#fff;font-size:.76rem;font-weight:600;opacity:.85;background:rgba(255,255,255,.15);display:inline-block;padding:3px 10px;border-radius:12px;margin-bottom:10px">${ann.badge}</div>` : ''}
    </div>
    <div style="font-size:.84rem;color:var(--muted);line-height:1.7;margin-bottom:18px">${ann.body}</div>
    ${ann.cta ? `<button class="btn-p" id="annCtaBtn" style="margin-bottom:8px">${ann.cta}</button>` : ''}
    <button style="width:100%;padding:9px;background:transparent;border:none;color:var(--muted);font-size:.78rem;font-weight:600;cursor:pointer;font-family:'Sora',sans-serif" data-close="annModal">Maybe later</button>
  `;

  openModal('annModal');

  const ctaBtn = $('annCtaBtn');
  if (ctaBtn) ctaBtn.addEventListener('click', () => {
    closeModal('annModal');
    if (ann.ctaAction === 'generateVC') { slideWallet(1); setTimeout(generateVirtualAccount, 400); }
    else if (ann.ctaLink) window.open(ann.ctaLink, '_blank');
  });

  if ($('annDot')) $('annDot').style.display = 'none';
}

/* ============================================================
   CHANGE PIN
============================================================ */
function openChangePIN() {
  state.cpPhase  = 1;
  state.cpBuf    = '';
  state.cpNewPIN = '';
  if ($('cpInstr')) $('cpInstr').textContent = 'Enter your current PIN';
  if ($('cpErr'))   $('cpErr').textContent   = '';
  updatePinDots('cpd');
  for (let i = 1; i <= 3; i++) { const s = $('cps' + i); if (s) s.classList.toggle('on', i <= 1); }
  openModal('cpModal');
}

async function procCP() {
  if (state.cpPhase === 1) {
    const data = await apiCall('/auth/verify-pin', { method: 'POST', body: JSON.stringify({ pin: state.cpBuf }) });
    if (!data || !data.success) {
      if ($('cpErr')) $('cpErr').textContent = 'Incorrect PIN';
      state.cpBuf = ''; updatePinDots('cpd'); return;
    }
    state.cpPhase = 2; state.cpBuf = '';
    if ($('cpInstr')) $('cpInstr').textContent = 'Enter your new PIN';
    if ($('cpErr'))   $('cpErr').textContent   = '';
    updateCPSteps(); updatePinDots('cpd');
  } else if (state.cpPhase === 2) {
    state.cpNewPIN = state.cpBuf; state.cpBuf = ''; state.cpPhase = 3;
    if ($('cpInstr')) $('cpInstr').textContent = 'Confirm your new PIN';
    updateCPSteps(); updatePinDots('cpd');
  } else {
    if (state.cpBuf !== state.cpNewPIN) {
      if ($('cpErr')) $('cpErr').textContent = 'PINs do not match';
      state.cpBuf = ''; state.cpPhase = 2; state.cpNewPIN = '';
      if ($('cpInstr')) $('cpInstr').textContent = 'Enter your new PIN';
      updateCPSteps(); updatePinDots('cpd'); return;
    }
    const data = await apiCall('/auth/change-pin', { method: 'PUT', body: JSON.stringify({ currentPin: state.cpBuf, newPin: state.cpNewPIN }) });
    if (!data || !data.success) { if ($('cpErr')) $('cpErr').textContent = data?.message || 'Failed to change PIN'; return; }
    closeModal('cpModal');
    toast('PIN changed successfully!', 'green');
  }
}

function updateCPSteps() {
  for (let i = 1; i <= 3; i++) { const s = $('cps' + i); if (s) s.classList.toggle('on', i <= state.cpPhase); }
}

/* ============================================================
   RECEIPT
============================================================ */
function showReceipt({ txId, service, amt, status, details, balBefore, balAfter }) {
  state.receipt = { txId, service, amt, status, details, balBefore, balAfter };
  if ($('recAmt')) $('recAmt').textContent = `₦${fmt(amt)}`;
  const ok = status === 'success';
  if ($('recRing'))    $('recRing').className    = `rec-ring ${ok ? 'ok' : 'fail'}`;
  if ($('recRingIco')) $('recRingIco').className = `fas fa-${ok ? 'check' : 'times'}`;
  if ($('recStat'))  { $('recStat').className = `rec-stat ${ok ? 'ok' : 'fail'}`; $('recStat').textContent = ok ? 'Transaction Successful!' : 'Transaction Failed'; }

  const rows = [
    { l: 'Reference', v: `<span class="rrv txid">${txId}</span>` },
    { l: 'Service',   v: service },
    ...Object.entries(details).map(([k, v]) => ({ l: k, v })),
    ...(balBefore !== undefined ? [{ l: 'Balance Before', v: `₦${fmt(balBefore)}` }] : []),
    ...(balAfter  !== undefined ? [{ l: 'Balance After',  v: `<span style="color:var(--pr);font-weight:800">₦${fmt(balAfter)}</span>` }] : []),
    { l: 'Status', v: `<span class="bdg ${status}">${status}</span>` },
  ];

  if ($('recRows')) $('recRows').innerHTML = rows.map(r => `
    <div class="rr"><span class="rrl">${r.l}</span><span class="rrv">${r.v}</span></div>
  `).join('');

  openModal('receiptModal');
}

function downloadReceipt() {
  if (!state.receipt) return;
  const r = state.receipt;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SubHub Receipt</title><style>*{margin:0;padding:0;box-sizing:border-box;font-family:sans-serif}body{background:#f0f7ff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#fff;border-radius:20px;padding:28px;max-width:380px;width:100%;border:1px solid #e0eaf5}.logo{text-align:center;margin-bottom:18px}.logo h1{color:#00aaff;font-size:1.3rem;font-weight:800}.ring{width:58px;height:58px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:#fff;background:${r.status === 'success' ? '#10b981' : '#ef4444'}}.amt{text-align:center;font-size:1.9rem;font-weight:800}.stat{text-align:center;font-size:.78rem;font-weight:700;color:${r.status === 'success' ? '#10b981' : '#ef4444'};margin:3px 0 14px}table{width:100%;border-collapse:collapse}td{padding:8px 5px;border-bottom:1px solid #e0eaf5;font-size:.78rem}td:first-child{color:#64748b;font-weight:600}td:last-child{text-align:right;font-weight:700}.footer{text-align:center;margin-top:16px;font-size:.66rem;color:#94a3b8}</style></head><body><div class="card"><div class="logo"><h1>SubHub</h1><p style="color:#64748b;font-size:.72rem">Official Receipt</p></div><div class="ring">${r.status === 'success' ? '✓' : '✗'}</div><div class="amt">₦${fmt(r.amt)}</div><div class="stat">${r.status === 'success' ? 'Transaction Successful' : 'Transaction Failed'}</div><table>${Object.entries(r.details).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}${r.balBefore !== undefined ? `<tr><td>Balance Before</td><td>₦${fmt(r.balBefore)}</td></tr><tr><td>Balance After</td><td>₦${fmt(r.balAfter)}</td></tr>` : ''}<tr><td>Reference</td><td style="font-family:monospace;font-size:.68rem">${r.txId}</td></tr><tr><td>Date</td><td>${new Date().toLocaleString('en-NG')}</td></tr></table><div class="footer">SubHub VTU Platform · Thank you!</div></div></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `SubHub-${r.txId}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('Receipt downloaded!', 'green');
}

function shareReceipt() {
  if (!state.receipt) return;
  const r    = state.receipt;
  const text = `SubHub Receipt\n\nService: ${r.service}\nAmount: ₦${fmt(r.amt)}\nRef: ${r.txId}\nStatus: ${r.status}\nBalance After: ₦${fmt(r.balAfter || state.balance)}\nDate: ${fmtDate(new Date())}`;
  if (navigator.share) navigator.share({ title: 'SubHub Receipt', text });
  else { navigator.clipboard?.writeText(text); toast('Receipt copied!', 'green'); }
}

/* ============================================================
   TRANSACTIONS
============================================================ */
function renderTxns() {
  const list = $('txList'); if (!list) return;
  if (!state.txns.length) {
    list.innerHTML = '<div class="empty"><i class="fas fa-receipt"></i><p>No transactions yet</p></div>';
    return;
  }
  list.innerHTML = state.txns.slice(0, 6).map(tx => {
    const m    = TX_META[tx.type] || { icon: 'circle', bg: 'ico-sky' };
    const desc = tx.dataPlan || tx.cablePlan || tx.discoName || tx.examType || tx.type;
    const isCr = tx.type === 'wallet_fund' || tx.type === 'refund' || tx.type === 'earncial_transfer';
    return `
    <div class="tx" data-txid="${tx.requestId}">
      <div class="tx-ico ${m.bg}"><i class="fas fa-${m.icon}"></i></div>
      <div class="tx-body">
        <div class="tx-desc" style="text-transform:capitalize">${desc}</div>
        <div class="tx-meta"><i class="fas fa-clock"></i>${fmtDate(tx.createdAt)}${tx.phone ? `<span>·</span><i class="fas fa-phone"></i>${tx.phone}` : ''}</div>
      </div>
      <div class="tx-r">
        <div class="tx-amt ${isCr ? 'crd' : 'dbt'}">${isCr ? '+' : '-'}₦${tx.amount.toLocaleString()}</div>
        <span class="bdg ${tx.status}">${tx.status}</span>
      </div>
    </div>`;
  }).join('');
}

function showTxDetail(requestId) {
  const tx = state.txns.find(t => t.requestId === requestId); if (!tx) return;
  showReceipt({
    txId: tx.requestId,
    service: tx.type,
    amt: tx.amount,
    status: tx.status,
    details: {
      ...(tx.phone   ? { Phone:   tx.phone   } : {}),
      ...(tx.network ? { Network: tx.network } : {}),
      ...(tx.dataPlan? { Plan:    tx.dataPlan} : {}),
      ...(tx.token   ? { 'Token 🔑': tx.token } : {}),
      Date: fmtDate(tx.createdAt),
    },
    balBefore: tx.oldBalance,
    balAfter:  tx.newBalance,
  });
}

function updateStats() {
  if ($('statSpent')) $('statSpent').textContent = (state.totalSpent  || 0).toLocaleString();
  if ($('statFunds')) $('statFunds').textContent = (state.totalFunded || 0).toLocaleString();
  if ($('statTx'))    $('statTx').textContent    = state.txns.length;
  if ($('statSuc'))   $('statSuc').textContent   = state.txns.filter(t => t.status === 'success').length;
}

/* ============================================================
   EMAIL VERIFY BANNER
============================================================ */
let _resendCooldown = 0, _resendTimer = null;

function checkEmailVerified() {
  if (!state.user) return;
  // Treat undefined as verified (safe default)
  const isVerified = state.user.isVerified !== undefined ? state.user.isVerified : true;
  if (isVerified) { const b = $('verifyBanner'); if (b) b.style.display = 'none'; return; }

  // Build banner HTML dynamically — same as profile.html approach
  const banner = `
  <div class="ev-banner" id="verifyBanner">
    <div class="ev-banner-top">
      <div class="ev-banner-icon"><i class="fas fa-envelope-open-text"></i></div>
      <div>
        <div class="ev-banner-title">Verify your email address</div>
        <div class="ev-banner-desc">A verification link was sent to <strong style="color:var(--text)">${state.user.email}</strong>. Verify to unlock all features.</div>
      </div>
    </div>
    <div class="ev-perks">
      <div class="ev-perk"><i class="fas fa-bell"></i>Get notified on every successful or failed transaction</div>
      <div class="ev-perk"><i class="fas fa-rocket"></i>Early access to new features and updates</div>
      <div class="ev-perk"><i class="fas fa-shield-halved"></i>Receive security alerts and login notifications</div>
    </div>
    <div class="ev-banner-foot">
      <span class="ev-no-email">Didn't get the email? <span id="vbCountdown"></span></span>
      <button class="ev-resend-btn" id="vbResendBtn" onclick="resendVerification()"><i class="fas fa-paper-plane"></i>Resend Email</button>
    </div>
  </div>`;

  // Insert before .wallet-wrap or at top of container
  const container = document.querySelector('.page-content, .container, #mainContent, main');
  if (container && !$('verifyBanner')) {
    container.insertAdjacentHTML('afterbegin', banner);
  } else if ($('verifyBanner')) {
    $('verifyBanner').style.display = 'block';
  }
}

async function resendVerification() {
  const btn = $('vbResendBtn') || $('evResendBtn'); if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>Sending…';
  const d = await apiCall('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: state.user?.email || '' }) });
  if (d?.success) {
    toast(d.message, 'green', 'Sent!');
    startResendCooldown(60);
  } else {
    toast(d?.message, 'red', 'Error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i>Resend Email';
  }
}

function startResendCooldown(secs) {
  _resendCooldown = secs;
  const btn = $('vbResendBtn'), cd = $('vbCountdown');
  if (btn) btn.innerHTML = '<i class="fas fa-clock"></i>Wait ' + secs + 's';
  if (_resendTimer) clearInterval(_resendTimer);
  _resendTimer = setInterval(() => {
    _resendCooldown--;
    if (btn) btn.innerHTML = '<i class="fas fa-clock"></i>Wait ' + _resendCooldown + 's';
    if (cd)  cd.textContent = '(' + _resendCooldown + 's)';
    if (_resendCooldown <= 0) {
      clearInterval(_resendTimer);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i>Resend Email'; }
      if (cd)  cd.textContent = '';
    }
  }, 1000);
}

/* ============================================================
   BIND EVENTS
============================================================ */
function bindEvents() {
  $('dmBtn')?.addEventListener('click', toggleDark);
  $('eyeBtn')?.addEventListener('click', toggleBal);
  $('wc-fund')?.addEventListener('click', () => openModal('fundModal'));
  $('promoBanner')?.addEventListener('click', copyRefLink);

  document.querySelectorAll('.wd').forEach(d => {
    d.addEventListener('click', () => slideWallet(parseInt(d.dataset.slide) - state.walletSlide));
  });
  let tsX = 0;
  $('walletSlider')?.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; }, { passive: true });
  $('walletSlider')?.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - tsX;
    if (Math.abs(dx) > 40) slideWallet(dx < 0 ? 1 : -1);
  }, { passive: true });

  $('svcGrid')?.addEventListener('click', e => {
    const svc = e.target.closest('.svc');
    if (svc) openModal(svc.dataset.modal);
  });

  $('saveContactBtn')?.addEventListener('click', () => {
    $('saveBar')?.classList.toggle('open');
    state.editingContactPhone = null;
    const t = document.querySelector('#saveBar .save-bar-title');
    if (t) t.innerHTML = '<i class="fas fa-address-book"></i>Save a contact';
  });
  $('scSaveBtn')?.addEventListener('click', saveContact);
  $('scCancelBtn')?.addEventListener('click', () => { $('saveBar')?.classList.remove('open'); state.editingContactPhone = null; });
  $('rnSearch')?.addEventListener('input', e => renderRecents(e.target.value));
  $('refLinkBtn')?.addEventListener('click', copyRefLink);
  $('exportContactsBtn')?.addEventListener('click', exportContacts);

  document.addEventListener('click', e => {
    const qa = e.target.closest('[data-sv]');
    if (qa) { const [id, val] = qa.dataset.sv.split(':'); const el = $(id); if (el) { el.value = parseFloat(val); el.dispatchEvent(new Event('input')); } }
    const cl = e.target.closest('[data-close]');
    if (cl) closeModal(cl.dataset.close);
    const tx = e.target.closest('#txList .tx[data-txid]');
    if (tx) showTxDetail(tx.dataset.txid);
  });

  document.querySelectorAll('.ov').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
  });

  $('avBtn')?.addEventListener('click', e => { e.stopPropagation(); $('avDrop')?.classList.toggle('show'); });
  document.addEventListener('click', e => { if (!$('avBtn')?.contains(e.target)) $('avDrop')?.classList.remove('show'); });
  $('dd-profile')?.addEventListener('click', () => { closeAvDrop(); location.href = '/app/profile.html'; });
  $('dd-pin')?.addEventListener('click',     () => { closeAvDrop(); location.href = '/app/profile.html#security'; });
  $('dd-fund')?.addEventListener('click',    () => { closeAvDrop(); openModal('fundModal'); });
  $('dd-ref')?.addEventListener('click',     () => { closeAvDrop(); copyRefLink(); });
  $('dd-logout')?.addEventListener('click',  () => { closeAvDrop(); logout(); });

  $('bn-home')?.addEventListener('click',    () => setActiveNav('bn-home'));
  $('bn-history')?.addEventListener('click', () => { location.href = '/app/transactions.html'; });
  $('bn-fund')?.addEventListener('click',    () => openModal('fundModal'));
  $('bn-profile')?.addEventListener('click', () => { location.href = '/app/profile.html'; });

  $('viewAllBtn')?.addEventListener('click',  () => { location.href = '/app/transactions.html'; });
  $('viewAllBtn2')?.addEventListener('click', () => { location.href = '/app/transactions.html'; });

  $('atSubmit')?.addEventListener('click', initAirtime);
  $('cableProvChips')?.addEventListener('click', e => {
    const nc = e.target.closest('.nc[data-prov]');
    if (nc) selectCableProv(nc.dataset.prov);
  });
  $('cableSubmit')?.addEventListener('click', initCable);
  $('elecSubmit')?.addEventListener('click',  initElec);
  $('examType')?.addEventListener('change',   calcExam);
  $('examQty')?.addEventListener('input',     calcExam);
  $('examSubmit')?.addEventListener('click',  initExam);
  $('rcDenom')?.addEventListener('change',    calcRC);
  $('rcQty')?.addEventListener('input',       calcRC);
  $('rcSubmit')?.addEventListener('click',    initRC);
  $('smsNums')?.addEventListener('input',     calcSMS);
  $('smsMsg')?.addEventListener('input', e => { const sl = $('smsLen'); if (sl) sl.textContent = e.target.value.length; calcSMS(); });
  $('smsSubmit')?.addEventListener('click',   initSMS);
  $('loadMoreBtn')?.addEventListener('click', () => { state.shownN += 10; renderPlans(); });
  $('pdSubmit')?.addEventListener('click',    initPrintData);
  $('pdQty')?.addEventListener('input',       updatePdPrice);
  $('fundGenVA')?.addEventListener('click',   generateVirtualAccount);

  $('confProceedBtn')?.addEventListener('click', () => { closeModal('confirmModal'); openPIN(); });
  $('dlBtn')?.addEventListener('click',     downloadReceipt);
  $('shareBtn')?.addEventListener('click',  shareReceipt);
  $('annBtn')?.addEventListener('click',    () => showAnnouncement(true));
  $('printAllBtn')?.addEventListener('click', () => window.print());

  $('quickSvcModal')?.addEventListener('click', e => {
    const qs = e.target.closest('[data-qsvc]'); if (!qs) return;
    closeModal('quickSvcModal');
    const svc = qs.dataset.qsvc;
    if (svc === 'data')    { const dp = $('dataPhone'); if (dp) dp.value = state.qsPhone; openModal('dataModal'); }
    else if (svc === 'airtime') { const ap = $('atPhone'); if (ap) ap.value = state.qsPhone; openModal('airtimeModal'); }
    else if (svc === 'gift') openModal('printDataModal');
    else if (svc === 'rc')   openModal('rcModal');
  });

  $('pinKp')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-pk]'); if (!btn) return;
    const k = btn.dataset.pk;
    if (k === 'del') { state.pinBuf = state.pinBuf.slice(0, -1); updatePinDots('pd'); }
    else if (k !== 'fp' && state.pinBuf.length < 4) { state.pinBuf += k; updatePinDots('pd'); if (state.pinBuf.length === 4) setTimeout(verifyPIN, 150); }
  });

  $('cpKp')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-cpk]'); if (!btn) return;
    const k = btn.dataset.cpk;
    if (k === 'del') { state.cpBuf = state.cpBuf.slice(0, -1); updatePinDots('cpd'); }
    else if (k !== 'fp' && state.cpBuf.length < 4) { state.cpBuf += k; updatePinDots('cpd'); if (state.cpBuf.length === 4) setTimeout(procCP, 150); }
  });
}

/* ============================================================
   INIT
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem(TOKEN_KEY)) { window.location.href = '/login.html'; return; }

  applyDark(state.dark);
  renderServices();
  buildNetChips('dnChips', n => onSelDataNet(n));
  buildNetChips('atChips', n => { state.atNet = n.name; state.atNetId = n.id; });
  buildNetChips('rcChips', n => { state.rcNet = n.name; state.rcNetId = n.id; });
  buildNetChips('pdChips', n => onSelPdNet(n));
  renderVirtualCard();
  renderRecents();
  calcExam();
  calcRC();
  calcSMS();
  updateDateTime();
  setInterval(updateDateTime, 30000);
  bindEvents();

  await loadUserData();
  await loadTransactions();
  await loadExamPlans();
  await loadElectricityPlans();

  showAnnouncement();
});
