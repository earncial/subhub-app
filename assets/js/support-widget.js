/**
 * SubHub Support Widget  (v2)
 * Usage:  <script src="/assets/js/support-widget.js" data-position="right"></script>
 *   data-position = "right" (default) or "left"  -> first position of the floating button only.
 *   After the user drags the button, its position is remembered.
 *
 * Extra:
 *   - any element with  data-support-open  opens the sheet when tapped
 *   - window.SubHubSupport.open() / .close() / .toggle()
 *   - window.SubHubSupportContext = { username:'abdul', page:'Buy Data' }  (optional) is added to the WhatsApp message
 *
 * Works on old Android WebView (Chrome 55+): no inset, no flex-gap, no ?. / ??
 */
(function () {
  'use strict';

  if (window.__shSupportWidgetLoaded) return;
  window.__shSupportWidgetLoaded = true;

  var cs = document.currentScript;
  var POSITION = ((cs && cs.getAttribute('data-position')) || 'right').toLowerCase();
  var SIDE = POSITION === 'left' ? 'left' : 'right';
  var STORAGE_KEY = 'sh_support_fab_pos_v1';
  var FAB_SIZE = 56;
  var EDGE_MARGIN = 14;
  var DRAG_THRESHOLD = 6;

  // ── CONFIG ────────────────────────────────────────────────────
  var CONFIG = {
    whatsapp: {
      number: '2347040495661',
      message: 'Hi SubHub Supoorts Team, I need help with ....'
    },
    saveNumber: {
      number: '+2347040495661',
      message: 'Hey SubHub, I have saved your number, please save mine so I can view your WhatsApp status updates.'
    },
    // support hours, Nigeria time (WAT = UTC+1). Outside these hours the widget says "We'll reply in the morning".
    hours: { start: 8, end: 22 },
    displayNumber: '0704 049 5661',
    faqUrl: '/faq',
    social: {
      whatsappChannel: 'https://whatsapp.com/channel/0029Vb841DxBfxoFoPsjBA0s',
      facebook: 'https://www.facebook.com/subhubng',
      tiktok: 'https://www.tiktok.com/@subhubng',
      instagram: 'https://www.instagram.com/subhubng',
      x: 'https://x.com/subhubng',
      youtube: 'https://www.youtube.com/@subhubng',
      telegram: 'https://t.me/subhubng'
    },
    // quick topics: tapping one pre-writes the WhatsApp message so support gets the problem straight away
    topics: [
      { id: 'pay',  label: 'Payment issue',     text: 'Hi SubHub, I made a payment / funded my wallet but it has not reflected.' },
      { id: 'data', label: 'Data / Airtime',    text: 'Hi SubHub, I bought data/airtime but I did not receive it.' },
      { id: 'tx',   label: 'Failed transaction', text: 'Hi SubHub, my transaction failed or is still pending.' },
      { id: 'acct', label: 'Account / PIN',     text: 'Hi SubHub, I need help with my account / PIN / password.' },
      { id: 'other', label: 'Something else',   text: 'Hi SubHub Team, I need help with ....' }
    ]
  };

  // ── ICONS (inline SVG) ───────────────────────────────────────
  function svg(path, size, extra) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' + (extra || '') + '>' + path + '</svg>';
  }
  function brand(path, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor">' + path + '</svg>';
  }
  var ICONS = {
    headset: svg('<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M21 15.5a2.5 2.5 0 0 1-2.5 2.5H17a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.5a2.5 2.5 0 0 1 2.5 2.5z"/><path d="M3 15.5A2.5 2.5 0 0 0 5.5 18H7a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 0 3 14.5z"/><path d="M17 18v1a2 2 0 0 1-2 2h-2"/>', 22),
    chat: svg('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>', 24),
    bookmark: svg('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', 20),
    broadcast: svg('<path d="M4.9 19.1a10 10 0 0 1 0-14.2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/>', 20),
    arrow: svg('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>', 18),
    copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', 18),
    help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 20),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 14),
    close: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 18),
    fabClose: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 24, 'stroke-width="2.4"'),
    whatsapp: brand('<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>', 22),
    telegram: brand('<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>', 22),
    tiktok: brand('<path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.67a8.27 8.27 0 004.83 1.55V6.77a4.85 4.85 0 01-1.06-.08z"/>', 22),
    facebook: brand('<path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z"/>', 22),
    instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>', 22, 'stroke-width="2"'),
    x: brand('<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>', 20),
    youtube: brand('<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>', 22)
  };

  // ── STYLES ────────────────────────────────────────────────────
  var CSS = '' +
  '#sh-sw,#sh-sw *{box-sizing:border-box;font-family:"Sora",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
  '#sh-sw{--b:#00aaff;--b2:#0070cc;--bd:rgba(0,170,255,.12);--sf:#ffffff;--sf2:#f3f8ff;--bg:#f3f8ff;--tx:#0d1a2e;--sub:#4d6480;--mu:#8096b8;--bo:rgba(0,100,200,.14);--ov:rgba(8,20,40,.5);--ok:#00c07a;--off:#f59e0b}' +
  ':root[data-theme="dark"] #sh-sw{--sf:#111820;--sf2:#161e2a;--bg:#080c12;--tx:#eef2ff;--sub:#8fa0bf;--mu:#7080a0;--bo:rgba(255,255,255,.09);--ov:rgba(0,0,0,.65)}' +
  '#sh-sw button,#sh-sw a{font:inherit;color:inherit}' +

  /* floating button */
  '#sh-fab{position:fixed;bottom:24px;' + SIDE + ':18px;z-index:99990;width:' + FAB_SIZE + 'px;height:' + FAB_SIZE + 'px;border-radius:50%;border:0;padding:0;cursor:grab;display:-webkit-flex;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#00aaff,#0070cc);box-shadow:0 8px 22px rgba(0,120,200,.4);touch-action:none;outline:none;transition:transform .15s}' +
  '#sh-fab.pressed{transform:scale(.93)}#sh-fab.dragging{cursor:grabbing}' +
  '#sh-fab:before{content:"";position:absolute;top:0;right:0;bottom:0;left:0;border-radius:50%;animation:shPulse 2.8s ease-out infinite;pointer-events:none}' +
  '#sh-fab.open:before,#sh-fab.dragging:before{animation:none}' +
  '@keyframes shPulse{0%{box-shadow:0 0 0 0 rgba(0,170,255,.5)}70%{box-shadow:0 0 0 15px rgba(0,170,255,0)}100%{box-shadow:0 0 0 0 rgba(0,170,255,0)}}' +
  '#sh-fab .shf{position:absolute;display:-webkit-flex;display:flex;align-items:center;justify-content:center;transition:opacity .2s,transform .25s}' +
  '#sh-fab .shf-c{opacity:0;transform:rotate(-70deg) scale(.5)}' +
  '#sh-fab.open .shf-o{opacity:0;transform:rotate(70deg) scale(.5)}#sh-fab.open .shf-c{opacity:1;transform:none}' +
  '#sh-fab .shf-dot{position:absolute;top:3px;right:3px;width:13px;height:13px;border-radius:50%;background:var(--ok);border:2.5px solid #fff}' +
  '#sh-fab.off .shf-dot{background:var(--off)}#sh-fab.open .shf-dot{display:none}' +

  /* overlay + sheet (almost full screen) */
  '#sh-ov{position:fixed;top:0;right:0;bottom:0;left:0;z-index:99991;background:var(--ov);opacity:0;visibility:hidden;transition:opacity .22s,visibility .22s}' +
  '#sh-ov.show{opacity:1;visibility:visible}' +
  '#sh-sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;width:100%;max-width:520px;height:94%;z-index:99992;background:var(--bg);color:var(--tx);border-radius:28px 28px 0 0;display:-webkit-flex;display:flex;flex-direction:column;overflow:hidden;transform:translateY(100%);visibility:hidden;transition:transform .3s cubic-bezier(.2,.9,.3,1),visibility .3s;box-shadow:0 -10px 40px rgba(0,0,0,.18)}' +
  '#sh-sheet.show{transform:none;visibility:visible}' +
  '#sh-sheet:focus{outline:none}' +

  /* header */
  '.sh-head{position:relative;flex:none;padding:10px 20px 20px;color:#fff;background:linear-gradient(135deg,#00aaff 0%,#0070cc 100%);border-radius:28px 28px 0 0;overflow:hidden}' +
  '.sh-head:after{content:"";position:absolute;right:-40px;top:-40px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.10);pointer-events:none}' +
  '.sh-grab{display:block;width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.55);margin:0 auto 14px}' +
  '.sh-x{position:absolute;top:14px;right:14px;z-index:2;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.2);color:#fff;display:-webkit-flex;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
  '.sh-x:active{background:rgba(255,255,255,.35)}' +
  '.sh-hrow{display:-webkit-flex;display:flex;align-items:center;position:relative;z-index:1}' +
  '.sh-av{flex:none;width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.2);border:1.5px solid rgba(255,255,255,.35);display:-webkit-flex;display:flex;align-items:center;justify-content:center;margin-right:14px}' +
  '.sh-ht{font-weight:800;font-size:1.2rem;letter-spacing:-.3px;line-height:1.2}' +
  '.sh-hs{margin-top:5px;font-size:.78rem;opacity:.95;display:-webkit-flex;display:flex;align-items:center}' +
  '.sh-dot{width:9px;height:9px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 3px rgba(74,222,128,.3);margin-right:7px;flex:none}' +
  '.sh-off .sh-dot{background:#fbbf24;box-shadow:0 0 0 3px rgba(251,191,36,.3)}' +
  '.sh-tag{position:relative;z-index:1;margin-top:14px;font-size:.84rem;line-height:1.5;opacity:.95}' +

  /* scroll body */
  '.sh-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 16px 8px}' +
  '.sh-lab{font-size:.68rem;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--mu);margin:2px 4px 10px}' +
  '.sh-sec{margin-bottom:20px}' +

  /* topics */
  '.sh-chips{display:-webkit-flex;display:flex;flex-wrap:wrap;margin:-4px}' +
  '.sh-chip{margin:4px;padding:10px 14px;border-radius:999px;border:1.5px solid var(--bo);background:var(--sf);color:var(--sub);font-size:.8rem;font-weight:600;cursor:pointer;transition:background .12s,border-color .12s,color .12s}' +
  '.sh-chip.on{background:var(--bd);border-color:var(--b);color:var(--b)}' +

  /* main chat button */
  '.sh-chat{display:-webkit-flex;display:flex;align-items:center;width:100%;padding:16px;border-radius:20px;text-decoration:none;color:#fff!important;background:linear-gradient(135deg,#25d366,#128c4a);box-shadow:0 10px 26px rgba(18,140,74,.32);margin-bottom:12px}' +
  '.sh-chat:active{transform:scale(.985)}' +
  '.sh-chat-i{flex:none;width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.22);display:-webkit-flex;display:flex;align-items:center;justify-content:center;margin-right:14px}' +
  '.sh-chat-t{flex:1;min-width:0;text-align:left}' +
  '.sh-chat-t b{display:block;font-size:1rem;font-weight:800}' +
  '.sh-chat-t span{display:block;margin-top:3px;font-size:.76rem;opacity:.92}' +

  /* row cards */
  '.sh-row{display:-webkit-flex;display:flex;align-items:center;width:100%;padding:13px 14px;border-radius:18px;border:1.5px solid var(--bo);background:var(--sf);text-decoration:none;color:var(--tx)!important;cursor:pointer;margin-bottom:10px;text-align:left}' +
  '.sh-row:active{background:var(--bd);border-color:var(--b)}' +
  '.sh-row-i{flex:none;width:40px;height:40px;border-radius:12px;background:var(--bd);color:var(--b);display:-webkit-flex;display:flex;align-items:center;justify-content:center;margin-right:13px}' +
  '.sh-row-t{flex:1;min-width:0}.sh-row-t b{display:block;font-size:.88rem;font-weight:700}.sh-row-t span{display:block;margin-top:2px;font-size:.74rem;color:var(--mu)}' +
  '.sh-row-a{flex:none;color:var(--mu);margin-left:8px}' +

  /* social tiles */
  '.sh-soc{display:-webkit-flex;display:flex;flex-wrap:wrap;margin:-4px}' +
  '.sh-tile{width:calc(33.333% - 8px);margin:4px;padding:14px 6px 12px;border-radius:18px;border:1.5px solid var(--bo);background:var(--sf);text-decoration:none;color:var(--tx)!important;text-align:center}' +
  '.sh-tile:active{background:var(--bd);border-color:var(--b)}' +
  '.sh-tile-i{width:46px;height:46px;border-radius:50%;margin:0 auto 8px;display:-webkit-flex;display:flex;align-items:center;justify-content:center;color:#fff}' +
  '.sh-tile b{display:block;font-size:.78rem;font-weight:700}.sh-tile span{display:block;margin-top:1px;font-size:.66rem;color:var(--mu)}' +
  '.c-wa{background:#25d366}.c-tg{background:#2aabee}.c-tt{background:#010101}.c-fb{background:#1877f2}.c-ig{background:linear-gradient(45deg,#f9a03f,#e1306c 55%,#833ab4)}.c-x{background:#000}.c-yt{background:#f00}' +

  /* footer */
  '.sh-foot{flex:none;padding:10px 16px 16px;text-align:center;font-size:.7rem;color:var(--mu);border-top:1.5px solid var(--bo);background:var(--sf)}' +
  '.sh-foot b{color:var(--b)}' +
  '.sh-toast{position:absolute;left:50%;bottom:76px;z-index:5;margin-left:-90px;width:180px;padding:10px 12px;border-radius:999px;background:#0d1a2e;color:#fff;font-size:.78rem;font-weight:600;text-align:center;opacity:0;pointer-events:none;transition:opacity .2s}' +
  '.sh-toast.show{opacity:1}';

  // ── helpers ───────────────────────────────────────────────────
  function isOnline() {
    var h = (new Date().getUTCHours() + 1) % 24;          // Nigeria time
    return h >= CONFIG.hours.start && h < CONFIG.hours.end;
  }
  function pad12(h) { var s = h >= 12 ? 'pm' : 'am'; h = h % 12; if (h === 0) h = 12; return h + s; }
  function ctxText() {
    var c = window.SubHubSupportContext, out = '';
    if (c && c.username) out += '\n\nUsername: ' + c.username;
    if (c && c.page) out += (out ? '\n' : '\n\n') + 'Page: ' + c.page;
    return out;
  }

  // ── HTML ──────────────────────────────────────────────────────
  function tile(cls, icon, name, handle, url) {
    return '<a class="sh-tile" href="' + url + '" target="_blank" rel="noopener"><div class="sh-tile-i ' + cls + '">' + icon + '</div><b>' + name + '</b><span>' + handle + '</span></a>';
  }
  function buildHTML() {
    var online = isOnline();
    var chips = '';
    for (var i = 0; i < CONFIG.topics.length; i++) {
      chips += '<button type="button" class="sh-chip" data-topic="' + CONFIG.topics[i].id + '">' + CONFIG.topics[i].label + '</button>';
    }
    var S = CONFIG.social;
    return '' +
    '<div id="sh-ov"></div>' +
    '<div id="sh-sheet" role="dialog" aria-modal="true" aria-label="SubHub Support" tabindex="-1">' +
      '<div class="sh-head' + (online ? '' : ' sh-off') + '">' +
        '<span class="sh-grab"></span>' +
        '<button type="button" class="sh-x" id="sh-x" aria-label="Close">' + ICONS.close + '</button>' +
        '<div class="sh-hrow"><div class="sh-av">' + ICONS.headset + '</div><div>' +
          '<div class="sh-ht">SubHub Support</div>' +
          '<div class="sh-hs"><span class="sh-dot"></span><span id="sh-status">' + (online ? 'Online now, we reply within minutes' : 'Offline, we reply from ' + pad12(CONFIG.hours.start)) + '</span></div>' +
        '</div></div>' +
        '<div class="sh-tag">Need help with a transaction, wallet or account? Pick a topic below and we will get on it.</div>' +
      '</div>' +
      '<div class="sh-body">' +
        '<div class="sh-sec"><div class="sh-lab">What do you need help with?</div><div class="sh-chips">' + chips + '</div></div>' +
        '<a id="sh-chat" class="sh-chat" href="#" target="_blank" rel="noopener"><div class="sh-chat-i">' + ICONS.whatsapp + '</div><div class="sh-chat-t"><b>Chat on WhatsApp</b><span>' + (online ? 'Fastest way to get help' : 'Leave a message, we will reply in the morning') + '</span></div>' + ICONS.arrow + '</a>' +
        '<button type="button" class="sh-row" id="sh-copy"><span class="sh-row-i">' + ICONS.copy + '</span><span class="sh-row-t"><b>Copy support number</b><span>' + CONFIG.displayNumber + '</span></span></button>' +
        '<a class="sh-row" href="' + CONFIG.faqUrl + '"><span class="sh-row-i">' + ICONS.help + '</span><span class="sh-row-t"><b>Read the FAQ</b><span>Quick answers to common questions</span></span><span class="sh-row-a">' + ICONS.arrow + '</span></a>' +
        '<a class="sh-row" id="sh-save" href="#" target="_blank" rel="noopener"><span class="sh-row-i">' + ICONS.bookmark + '</span><span class="sh-row-t"><b>Save our number</b><span>See our WhatsApp status updates and promos</span></span></a>' +
        '<a class="sh-row" href="' + S.whatsappChannel + '" target="_blank" rel="noopener"><span class="sh-row-i">' + ICONS.broadcast + '</span><span class="sh-row-t"><b>WhatsApp Channel</b><span>News, promos and price updates</span></span><span class="sh-row-a">' + ICONS.arrow + '</span></a>' +
        '<div class="sh-sec" style="margin-top:20px"><div class="sh-lab">Join our community</div><div class="sh-soc">' +
          tile('c-tg', ICONS.telegram, 'Telegram', '@subhubng', S.telegram) +
          tile('c-ig', ICONS.instagram, 'Instagram', '@subhubng', S.instagram) +
          tile('c-fb', ICONS.facebook, 'Facebook', 'subhubng', S.facebook) +
          tile('c-tt', ICONS.tiktok, 'TikTok', '@subhubng', S.tiktok) +
          tile('c-x', ICONS.x, 'X', '@subhubng', S.x) +
          tile('c-yt', ICONS.youtube, 'YouTube', '@subhubng', S.youtube) +
        '</div></div>' +
      '</div>' +
      '<div class="sh-foot">Support hours: ' + pad12(CONFIG.hours.start) + ' to ' + pad12(CONFIG.hours.end) + ' daily &middot; Powered by <b>SubHub</b></div>' +
      '<div class="sh-toast" id="sh-toast"></div>' +
    '</div>' +
    '<button type="button" id="sh-fab" class="' + (online ? '' : 'off') + '" aria-label="Open support" aria-expanded="false" aria-haspopup="dialog">' +
      '<span class="shf shf-o">' + ICONS.chat + '</span><span class="shf shf-c">' + ICONS.fabClose + '</span><span class="shf-dot"></span>' +
    '</button>';
  }

  // ── INIT ──────────────────────────────────────────────────────
  function init() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var wrap = document.createElement('div');
    wrap.id = 'sh-sw';
    wrap.innerHTML = buildHTML();
    document.body.appendChild(wrap);

    function $(id) { return document.getElementById(id); }
    var fab = $('sh-fab'), sheet = $('sh-sheet'), ov = $('sh-ov'), chat = $('sh-chat'), toastEl = $('sh-toast');
    var topic = CONFIG.topics[CONFIG.topics.length - 1];

    function setTopic(id) {
      for (var i = 0; i < CONFIG.topics.length; i++) if (CONFIG.topics[i].id === id) topic = CONFIG.topics[i];
      var chips = wrap.querySelectorAll('.sh-chip');
      for (var j = 0; j < chips.length; j++) {
        if (chips[j].getAttribute('data-topic') === topic.id && id) chips[j].classList.add('on'); else chips[j].classList.remove('on');
      }
      refreshLinks();
    }
    function refreshLinks() {
      chat.href = 'https://wa.me/' + CONFIG.whatsapp.number + '?text=' + encodeURIComponent(topic.text + ctxText());
      $('sh-save').href = 'https://wa.me/' + CONFIG.saveNumber.number + '?text=' + encodeURIComponent(CONFIG.saveNumber.message);
    }
    refreshLinks();

    wrap.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== wrap) {
        if (t.getAttribute && t.getAttribute('data-topic')) { setTopic(t.getAttribute('data-topic')); return; }
        t = t.parentNode;
      }
    });

    function toast(msg) {
      toastEl.textContent = msg; toastEl.classList.add('show');
      setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
    }
    $('sh-copy').addEventListener('click', function () {
      var num = CONFIG.saveNumber.number;
      function ok() { toast('Number copied'); }
      function legacy() {
        try {
          var ta = document.createElement('textarea'); ta.value = num; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.focus(); ta.select();
          var r = document.execCommand('copy'); document.body.removeChild(ta);
          if (r) ok(); else toast(num);
        } catch (e) { toast(num); }
      }
      if (window.AndroidClipboard && typeof window.AndroidClipboard.setText === 'function') {
        try { window.AndroidClipboard.setText(num); ok(); return; } catch (e) { /* fall through */ }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(num).then(ok, legacy); else legacy();
    });

    // keep the status right if the page stays open for hours
    setInterval(function () {
      var on = isOnline();
      var head = sheet.querySelector('.sh-head');
      if (on) { head.classList.remove('sh-off'); fab.classList.remove('off'); } else { head.classList.add('sh-off'); fab.classList.add('off'); }
      $('sh-status').textContent = on ? 'Online now, we reply within minutes' : 'Offline, we reply from ' + pad12(CONFIG.hours.start);
    }, 60000);

    // open / close
    function isOpen() { return sheet.classList.contains('show'); }
    function openW() {
      setTopic(topic && topic.id === 'other' ? null : topic.id);
      sheet.classList.add('show'); ov.classList.add('show'); fab.classList.add('open'); fab.setAttribute('aria-expanded', 'true');
      var b = sheet.querySelector('.sh-body'); if (b) b.scrollTop = 0;
      setTimeout(function () { try { sheet.focus(); } catch (e) {} }, 60);
    }
    function closeW() {
      sheet.classList.remove('show'); ov.classList.remove('show'); fab.classList.remove('open'); fab.setAttribute('aria-expanded', 'false');
    }
    function toggleW() { if (isOpen()) closeW(); else openW(); }
    ov.addEventListener('click', closeW);
    $('sh-x').addEventListener('click', closeW);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) closeW(); });
    document.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== document) {
        if (t.getAttribute && t.hasAttribute('data-support-open')) { e.preventDefault(); openW(); return; }
        t = t.parentNode;
      }
    });
    window.SubHubSupport = { open: openW, close: closeW, toggle: toggleW, isOpen: isOpen };

    // draggable button
    var drag = null;
    function clamp(l, t) {
      var vw = window.innerWidth, vh = window.innerHeight;
      return {
        left: Math.min(Math.max(l, EDGE_MARGIN), Math.max(EDGE_MARGIN, vw - FAB_SIZE - EDGE_MARGIN)),
        top: Math.min(Math.max(t, EDGE_MARGIN), Math.max(EDGE_MARGIN, vh - FAB_SIZE - EDGE_MARGIN))
      };
    }
    function place(l, t) { fab.style.right = 'auto'; fab.style.bottom = 'auto'; fab.style.left = l + 'px'; fab.style.top = t + 'px'; }
    (function restore() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var s = JSON.parse(raw);
        if (s && typeof s.left === 'number' && typeof s.top === 'number') { var c = clamp(s.left, s.top); place(c.left, c.top); }
      } catch (e) { /* ignore */ }
    })();

    fab.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      var r = fab.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, moved: false, id: e.pointerId };
      fab.classList.add('pressed');
      try { fab.setPointerCapture(e.pointerId); } catch (err) {}
    });
    fab.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        drag.moved = true; fab.classList.add('dragging'); fab.classList.remove('pressed');
        if (isOpen()) closeW();
      }
      if (drag.moved) { e.preventDefault(); var c = clamp(drag.l + dx, drag.t + dy); place(c.left, c.top); }
    });
    function endDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      var was = drag.moved;
      fab.classList.remove('dragging'); fab.classList.remove('pressed');
      try { fab.releasePointerCapture(e.pointerId); } catch (err) {}
      if (was) {
        var r = fab.getBoundingClientRect(), c = clamp(r.left, r.top);
        place(c.left, c.top);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: c.left, top: c.top })); } catch (err) {}
      } else if (e.type !== 'pointercancel') {
        toggleW();
      }
      drag = null;
    }
    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', function () {
      if (fab.style.left && fab.style.left !== 'auto') { var r = fab.getBoundingClientRect(), c = clamp(r.left, r.top); place(c.left, c.top); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
