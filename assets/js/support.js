/**
 * SubHub Support Widget
 * Usage: <script src="/assets/js/support-widget.js" data-position="right"></script>
 * Position: "right" (default) or "left" — used only as the initial FAB position.
 * After the user drags the FAB, its position is remembered in localStorage.
 */
(function () {
  'use strict';

  // Prevent duplicate initialization if the script is included twice
  if (window.__shSupportWidgetLoaded) return;
  window.__shSupportWidgetLoaded = true;

  const POSITION = (document.currentScript?.getAttribute('data-position') || 'right').toLowerCase();
  const SIDE = POSITION === 'left' ? 'left' : 'right';
  const STORAGE_KEY = 'sh_support_fab_pos_v1';
  const FAB_SIZE = 56;
  const EDGE_MARGIN = 14;
  const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag

  // ── CONFIG ──────────────────────────────────────────────────
  const CONFIG = {
    whatsapp: {
      number: '2347040495661', // ← Replace with SubHub support number
      message: 'Hi SubHub Support, I need help with my account.',
    },
    saveNumber: {
      number: '+2347040495661', // ← Same number, with country code
      message: "Hey SubHub, I have saved your number, please save mine so I can view your WhatsApp status updates.",
    },
    social: {
      whatsappChannel: 'https://whatsapp.com/channel/0029Vb841DxBfxoFoPsjBA0s', // ← Replace
      telegram: 'https://t.me/subhubng',                    // ← Replace
      tiktok: 'https://tiktok.com/@subhubng',               // ← Replace
    },
    // bot: {
    //   whatsapp: 'https://wa.me/2348100000000?text=Hi+SubHub+Bot',
    //   label: 'Connect our WhatsApp Bot',
    //   desc: 'Buy data, airtime and more without opening the app or website',
    // },
  };

  // ── ICONS (inline SVG, no emojis anywhere) ─────────────────
  const ICONS = {
    headset: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M21 15.5a2.5 2.5 0 0 1-2.5 2.5H17a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.5a2.5 2.5 0 0 1 2.5 2.5z"/><path d="M3 15.5A2.5 2.5 0 0 0 5.5 18H7a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 0 3 14.5z"/><path d="M17 18v1a2 2 0 0 1-2 2h-2"/></svg>`,
    chat: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    bookmark: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    broadcast: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1a10 10 0 0 1 0-14.2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/></svg>`,
    paperplane: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>`,
    arrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>`,
    whatsappBrand: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
    telegramBrand: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
    tiktokBrand: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.67a8.27 8.27 0 004.83 1.55V6.77a4.85 4.85 0 01-1.06-.08z"/></svg>`,
    close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    fabOpen: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  };

  // ── STYLES ──────────────────────────────────────────────────
  const CSS = `
    #sh-support-widget, #sh-support-widget * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    #sh-support-widget { margin: 0; padding: 0; }

    /* ── Floating action button ── */
    #sh-support-fab {
      position: fixed;
      bottom: 24px;
      ${SIDE}: 20px;
      z-index: 99999;
      width: ${FAB_SIZE}px;
      height: ${FAB_SIZE}px;
      border-radius: 50%;
      background: #00aaff;
      border: none;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 20px rgba(0,120,200,0.38), 0 2px 6px rgba(0,120,200,0.22);
      transition: box-shadow 0.2s ease, transform 0.15s ease;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
      outline: none;
    }
    #sh-support-fab:hover { box-shadow: 0 8px 26px rgba(0,120,200,0.46), 0 3px 8px rgba(0,120,200,0.26); }
    #sh-support-fab:focus-visible { box-shadow: 0 0 0 3px #fff, 0 0 0 6px #00aaff; }
    #sh-support-fab.dragging { cursor: grabbing; transition: none; }
    #sh-support-fab.pressed { transform: scale(0.94); }

    #sh-support-fab .sh-fab-icon { position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
    #sh-support-fab .sh-fab-icon svg { position: absolute; transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1); }
    #sh-support-fab .sh-fab-icon .sh-icon-open { opacity: 1; transform: rotate(0deg) scale(1); }
    #sh-support-fab .sh-fab-icon .sh-icon-close { opacity: 0; transform: rotate(-60deg) scale(0.5); }
    #sh-support-fab.open .sh-fab-icon .sh-icon-open { opacity: 0; transform: rotate(60deg) scale(0.5); }
    #sh-support-fab.open .sh-fab-icon .sh-icon-close { opacity: 1; transform: rotate(0deg) scale(1); }

    #sh-support-fab::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(0,170,255,0.55);
      animation: sh-pulse 2.6s ease-out infinite;
      pointer-events: none;
    }
    #sh-support-fab.open::before, #sh-support-fab.dragging::before { animation: none; box-shadow: none; }
    @keyframes sh-pulse {
      0% { box-shadow: 0 0 0 0 rgba(0,170,255,0.45); }
      70% { box-shadow: 0 0 0 14px rgba(0,170,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(0,170,255,0); }
    }

    /* ── Overlay ── */
    #sh-support-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,0.4);
      backdrop-filter: blur(1.5px);
      z-index: 99997;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
    }
    #sh-support-overlay.show { opacity: 1; pointer-events: all; }

    /* ── Modal ── */
    #sh-support-modal {
      position: fixed;
      z-index: 99998;
      width: 336px;
      max-width: calc(100vw - 24px);
      max-height: calc(100vh - 24px);
      overflow-y: auto;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(15,23,42,0.22), 0 4px 16px rgba(15,23,42,0.1);
      transform: translateY(14px) scale(0.97);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.26s cubic-bezier(0.34,1.4,0.64,1), opacity 0.2s ease;
    }
    #sh-support-modal.show {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }
    #sh-support-modal:focus { outline: none; }

    /* Header */
    .sh-modal-header {
      background: linear-gradient(135deg, #00aaff 0%, #0086d1 100%);
      padding: 22px 20px 18px;
      color: #fff;
      position: relative;
    }
    .sh-modal-header-top { display: flex; align-items: center; gap: 12px; }
    .sh-modal-avatar {
      width: 42px; height: 42px;
      border-radius: 50%;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      color: #fff;
    }
    .sh-modal-brand { flex: 1; min-width: 0; }
    .sh-modal-brand-name { font-weight: 700; font-size: 15px; letter-spacing: -0.1px; }
    .sh-modal-brand-sub { font-size: 11.5px; opacity: 0.88; margin-top: 2px; display: flex; align-items: center; gap: 5px; }
    .sh-online-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 0 2.5px rgba(74,222,128,0.28);
      flex-shrink: 0;
      display: inline-block;
    }
    .sh-modal-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 30px; height: 30px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.16);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .sh-modal-close:hover { background: rgba(255,255,255,0.28); }
    .sh-modal-close:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .sh-modal-close svg { width: 15px; height: 15px; }
    .sh-modal-tagline {
      font-size: 12.5px;
      opacity: 0.92;
      margin-top: 12px;
      line-height: 1.5;
    }

    /* Body */
    .sh-modal-body { padding: 16px 16px 8px; }

    .sh-btn-primary {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 14px 15px;
      border-radius: 14px;
      background: #00aaff;
      color: #fff;
      border: none;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 10px;
      box-shadow: 0 4px 14px rgba(0,170,255,0.3);
      transition: background 0.16s ease, transform 0.15s ease, box-shadow 0.16s ease;
    }
    .sh-btn-primary:hover { background: #0092e0; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,170,255,0.38); }
    .sh-btn-primary:focus-visible { outline: 2px solid #0086d1; outline-offset: 2px; }
    .sh-btn-primary-ico {
      width: 38px; height: 38px; border-radius: 10px;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      color: #fff;
    }
    .sh-btn-primary-text { flex: 1; text-align: left; min-width: 0; }
    .sh-btn-primary-label { font-weight: 600; font-size: 13.5px; display: block; }
    .sh-btn-primary-sub { font-size: 11px; opacity: 0.88; display: block; margin-top: 2px; }
    .sh-btn-primary-arrow { flex-shrink: 0; opacity: 0.9; }

    .sh-section-label {
      font-size: 10.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 6px 2px 8px;
    }

    .sh-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
    .sh-grid-btn {
      display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
      padding: 12px 12px 11px;
      border-radius: 13px;
      background: #f8fafc;
      border: 1.5px solid #eef2f7;
      cursor: pointer;
      text-decoration: none;
      color: #1e293b;
      transition: background 0.15s, border-color 0.15s, transform 0.15s;
    }
    .sh-grid-btn:hover { background: #eef8ff; border-color: #b6e6ff; transform: translateY(-1px); }
    .sh-grid-btn:focus-visible { outline: 2px solid #00aaff; outline-offset: 2px; }
    .sh-grid-ico {
      width: 30px; height: 30px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,170,255,0.1);
      color: #00aaff;
    }
    .sh-grid-label { font-size: 12px; font-weight: 700; color: #1e293b; }
    .sh-grid-sub { font-size: 10.5px; color: #64748b; line-height: 1.3; }

    .sh-btn-save {
      display: flex;
      align-items: center;
      gap: 11px;
      width: 100%;
      padding: 12px 14px;
      border-radius: 13px;
      background: #f8fafc;
      border: 1.5px solid #eef2f7;
      cursor: pointer;
      text-decoration: none;
      color: #1e293b;
      margin-bottom: 10px;
      transition: background 0.15s, border-color 0.15s, transform 0.15s;
    }
    .sh-btn-save:hover { background: #eef8ff; border-color: #b6e6ff; transform: translateY(-1px); }
    .sh-btn-save:focus-visible { outline: 2px solid #00aaff; outline-offset: 2px; }
    .sh-btn-save-ico {
      width: 34px; height: 34px; border-radius: 9px;
      background: rgba(0,170,255,0.1);
      color: #00aaff;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sh-btn-save-text { flex: 1; min-width: 0; }
    .sh-btn-save-label { font-weight: 700; font-size: 12.5px; display: block; color: #1e293b; }
    .sh-btn-save-sub { font-size: 10.5px; color: #64748b; display: block; margin-top: 2px; }

    /* Footer */
    .sh-modal-footer {
      padding: 10px 16px 16px;
      border-top: 1px solid #f1f5f9;
      margin-top: 4px;
    }
    .sh-footer-label { font-size: 10.5px; color: #94a3b8; text-align: center; margin-bottom: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .sh-socials { display: flex; justify-content: center; gap: 10px; }
    .sh-social-btn {
      width: 38px; height: 38px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      text-decoration: none;
      color: #fff;
      transition: transform 0.15s, opacity 0.15s;
    }
    .sh-social-btn:hover { transform: scale(1.1); opacity: 0.92; }
    .sh-social-btn:focus-visible { outline: 2px solid #00aaff; outline-offset: 2px; }
    .sh-social-wa { background: #25D366; }
    .sh-social-tg { background: #2AABEE; }
    .sh-social-tt { background: #010101; }

    .sh-powered {
      text-align: center;
      font-size: 10px;
      color: #cbd5e1;
      padding: 8px 0 0;
    }
    .sh-powered span { color: #00aaff; font-weight: 700; }

    @media (max-width: 380px) {
      #sh-support-modal { width: calc(100vw - 20px); }
    }
  `;

  // ── HTML ────────────────────────────────────────────────────
  function buildHTML() {
    return `
      <div id="sh-support-overlay"></div>

      <div id="sh-support-modal" role="dialog" aria-modal="true" aria-label="SubHub Support" tabindex="-1">
        <div class="sh-modal-header">
          <button type="button" class="sh-modal-close" id="sh-modal-close-btn" aria-label="Close support widget">${ICONS.close.replace('width="20" height="20"', 'width="15" height="15"')}</button>
          <div class="sh-modal-header-top">
            <div class="sh-modal-avatar">${ICONS.headset}</div>
            <div class="sh-modal-brand">
              <div class="sh-modal-brand-name">SubHub Support</div>
              <div class="sh-modal-brand-sub"><span class="sh-online-dot"></span> We reply within minutes</div>
            </div>
          </div>
          <div class="sh-modal-tagline">Need help? We're here for you. Choose how you'd like to reach us.</div>
        </div>

        <div class="sh-modal-body">

          <a id="sh-wa-support" href="#" target="_blank" rel="noopener" class="sh-btn-primary">
            <div class="sh-btn-primary-ico">${ICONS.chat}</div>
            <div class="sh-btn-primary-text">
              <span class="sh-btn-primary-label">Chat with Support</span>
              <span class="sh-btn-primary-sub">Opens WhatsApp, fast response</span>
            </div>
            <span class="sh-btn-primary-arrow">${ICONS.arrow}</span>
          </a>

          <a id="sh-wa-save" href="#" target="_blank" rel="noopener" class="sh-btn-save">
            <span class="sh-btn-save-ico">${ICONS.bookmark}</span>
            <div class="sh-btn-save-text">
              <span class="sh-btn-save-label">Save our number</span>
              <span class="sh-btn-save-sub">Get WhatsApp status updates from us</span>
            </div>
          </a>

          <div class="sh-section-label">Join our community</div>
          <div class="sh-grid">
            <a id="sh-wa-channel" href="${CONFIG.social.whatsappChannel}" target="_blank" rel="noopener" class="sh-grid-btn">
              <span class="sh-grid-ico">${ICONS.broadcast}</span>
              <span class="sh-grid-label">WhatsApp Channel</span>
              <span class="sh-grid-sub">News &amp; updates</span>
            </a>
            <a id="sh-tg-channel" href="${CONFIG.social.telegram}" target="_blank" rel="noopener" class="sh-grid-btn">
              <span class="sh-grid-ico">${ICONS.paperplane}</span>
              <span class="sh-grid-label">Telegram</span>
              <span class="sh-grid-sub">Community chat</span>
            </a>
          </div>

          <!-- Bot (commented out — uncomment to enable) -->
          <!--
          <div class="sh-section-label">Shortcuts</div>
          <a href="${CONFIG.bot?.whatsapp || '#'}" target="_blank" rel="noopener" class="sh-btn-primary">
            <div class="sh-btn-primary-ico">${ICONS.chat}</div>
            <div class="sh-btn-primary-text">
              <span class="sh-btn-primary-label">${CONFIG.bot?.label || 'WhatsApp Bot'}</span>
              <span class="sh-btn-primary-sub">${CONFIG.bot?.desc || ''}</span>
            </div>
            <span class="sh-btn-primary-arrow">${ICONS.arrow}</span>
          </a>
          -->

        </div>

        <div class="sh-modal-footer">
          <div class="sh-footer-label">Follow us</div>
          <div class="sh-socials">
            <a href="${CONFIG.social.whatsappChannel}" target="_blank" rel="noopener" class="sh-social-btn sh-social-wa" aria-label="WhatsApp Channel">${ICONS.whatsappBrand}</a>
            <a href="${CONFIG.social.telegram}" target="_blank" rel="noopener" class="sh-social-btn sh-social-tg" aria-label="Telegram">${ICONS.telegramBrand}</a>
            <a href="${CONFIG.social.tiktok}" target="_blank" rel="noopener" class="sh-social-btn sh-social-tt" aria-label="TikTok">${ICONS.tiktokBrand}</a>
          </div>
          <div class="sh-powered">Powered by <span>SubHub</span></div>
        </div>
      </div>

      <button id="sh-support-fab" aria-label="Open support" aria-expanded="false" aria-haspopup="dialog">
        <span class="sh-fab-icon">
          <span class="sh-icon-open">${ICONS.fabOpen}</span>
          <span class="sh-icon-close">${ICONS.close}</span>
        </span>
      </button>
    `;
  }

  // ── INIT ─────────────────────────────────────────────────────
  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.id = 'sh-support-widget';
    wrapper.innerHTML = buildHTML();
    document.body.appendChild(wrapper);

    const waSupport = document.getElementById('sh-wa-support');
    const waSave    = document.getElementById('sh-wa-save');
    waSupport.href = `https://wa.me/${CONFIG.whatsapp.number}?text=${encodeURIComponent(CONFIG.whatsapp.message)}`;
    waSave.href    = `https://wa.me/${CONFIG.saveNumber.number}?text=${encodeURIComponent(CONFIG.saveNumber.message)}`;

    const fab       = document.getElementById('sh-support-fab');
    const modal     = document.getElementById('sh-support-modal');
    const overlay   = document.getElementById('sh-support-overlay');
    const closeBtn  = document.getElementById('sh-modal-close-btn');

    // ── Open / close ──
    function positionModalNearFab() {
      const fabRect = fab.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Reset to measure natural size
      modal.style.left = '0px';
      modal.style.top = '0px';
      modal.style.right = 'auto';
      modal.style.bottom = 'auto';
      const modalRect = modal.getBoundingClientRect();
      const mw = modalRect.width;
      const mh = modalRect.height;

      const fabCenterX = fabRect.left + fabRect.width / 2;
      const opensUp = fabRect.top > mh + 20; // enough room above FAB
      const opensLeft = fabCenterX > vw / 2;

      let left = opensLeft ? fabRect.right - mw : fabRect.left;
      let top = opensUp ? fabRect.top - mh - 12 : fabRect.bottom + 12;

      // Clamp inside viewport
      left = Math.min(Math.max(left, EDGE_MARGIN), vw - mw - EDGE_MARGIN);
      top = Math.min(Math.max(top, EDGE_MARGIN), vh - mh - EDGE_MARGIN);

      modal.style.left = `${left}px`;
      modal.style.top = `${top}px`;
    }

    function openWidget() {
      positionModalNearFab();
      modal.classList.add('show');
      overlay.classList.add('show');
      fab.classList.add('open');
      fab.setAttribute('aria-expanded', 'true');
      window.addEventListener('resize', positionModalNearFab);
      setTimeout(() => modal.focus(), 50);
    }

    function closeWidget() {
      modal.classList.remove('show');
      overlay.classList.remove('show');
      fab.classList.remove('open');
      fab.setAttribute('aria-expanded', 'false');
      window.removeEventListener('resize', positionModalNearFab);
    }

    function toggleWidget() {
      modal.classList.contains('show') ? closeWidget() : openWidget();
    }

    overlay.addEventListener('click', closeWidget);
    closeBtn.addEventListener('click', closeWidget);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeWidget();
    });

    // ── Draggable FAB (Pointer Events: works on mouse, touch, pen) ──
    let dragState = null;

    function applySavedPosition() {
      let saved = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (e) { saved = null; }

      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        const clamped = clampToViewport(saved.left, saved.top);
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
        fab.style.left = `${clamped.left}px`;
        fab.style.top = `${clamped.top}px`;
      }
      // else: leave default CSS bottom/side positioning in place
    }

    function clampToViewport(left, top) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxLeft = vw - FAB_SIZE - EDGE_MARGIN;
      const maxTop = vh - FAB_SIZE - EDGE_MARGIN;
      return {
        left: Math.min(Math.max(left, EDGE_MARGIN), Math.max(EDGE_MARGIN, maxLeft)),
        top: Math.min(Math.max(top, EDGE_MARGIN), Math.max(EDGE_MARGIN, maxTop)),
      };
    }

    function savePosition(left, top) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top }));
      } catch (e) { /* localStorage unavailable, ignore */ }
    }

    fab.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return; // left click / primary touch only
      const rect = fab.getBoundingClientRect();
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        moved: false,
        pointerId: e.pointerId,
      };
      fab.classList.add('pressed');
      try { fab.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    fab.addEventListener('pointermove', function (e) {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      if (!dragState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragState.moved = true;
        fab.classList.add('dragging');
        fab.classList.remove('pressed');
        if (modal.classList.contains('show')) closeWidget();
      }

      if (dragState.moved) {
        e.preventDefault();
        const clamped = clampToViewport(dragState.originLeft + dx, dragState.originTop + dy);
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
        fab.style.left = `${clamped.left}px`;
        fab.style.top = `${clamped.top}px`;
      }
    });

    function endDrag(e) {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const wasDrag = dragState.moved;
      fab.classList.remove('dragging');
      fab.classList.remove('pressed');
      try { fab.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }

      if (wasDrag) {
        const rect = fab.getBoundingClientRect();
        const clamped = clampToViewport(rect.left, rect.top);
        fab.style.left = `${clamped.left}px`;
        fab.style.top = `${clamped.top}px`;
        savePosition(clamped.left, clamped.top);
      } else {
        toggleWidget();
      }
      dragState = null;
    }

    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', endDrag);

    // Keep FAB (and open modal) inside viewport on resize/orientation change
    window.addEventListener('resize', function () {
      const rect = fab.getBoundingClientRect();
      const isPositioned = fab.style.left && fab.style.left !== 'auto';
      if (isPositioned) {
        const clamped = clampToViewport(rect.left, rect.top);
        fab.style.left = `${clamped.left}px`;
        fab.style.top = `${clamped.top}px`;
      }
    });

    applySavedPosition();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
