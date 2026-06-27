/**
 * SubHub Support Widget
 * Usage: <script src="/assets/js/support-widget.js" data-position="right"></script>
 * Position: "right" (default) or "left"
 */
(function () {
  'use strict';

  const POSITION = (document.currentScript?.getAttribute('data-position') || 'right').toLowerCase();
  const SIDE = POSITION === 'left' ? 'left' : 'right';

  // ── CONFIG ──────────────────────────────────────────────────
  const CONFIG = {
    whatsapp: {
      number: '2348100000000', // ← Replace with SubHub support number
      message: 'Hi SubHub Support, I need help with my account.',
    },
    saveNumber: {
      number: '+2348100000000', // ← Same number, with country code
      message: "Hey SubHub 👋 I have saved your number, please save mine so I can view your WhatsApp status updates 🙏",
    },
    social: {
      whatsappChannel: 'https://whatsapp.com/channel/subhub', // ← Replace
      telegram: 'https://t.me/subhub_ng',                    // ← Replace
      tiktok: 'https://tiktok.com/@subhub_ng',               // ← Replace
    },
    // bot: {
    //   whatsapp: 'https://wa.me/2348100000000?text=Hi+SubHub+Bot',
    //   label: 'Connect our WhatsApp Bot',
    //   desc: 'Buy data, airtime and more without opening the app or website',
    // },
  };

  // ── STYLES ──────────────────────────────────────────────────
  const CSS = `
    #sh-support-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; }

    #sh-support-fab {
      position: fixed;
      bottom: 28px;
      ${SIDE}: 22px;
      z-index: 99999;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #00aaff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 18px rgba(0,170,255,0.45);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      outline: none;
    }
    #sh-support-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(0,170,255,0.55);
    }
    #sh-support-fab svg { transition: transform 0.3s ease, opacity 0.2s ease; }
    #sh-support-fab.open .sh-fab-open { transform: rotate(90deg) scale(0.8); opacity: 0; position: absolute; }
    #sh-support-fab.open .sh-fab-close { opacity: 1 !important; transform: scale(1) !important; }
    .sh-fab-close { opacity: 0 !important; transform: scale(0.5) !important; position: absolute; transition: all 0.3s ease; }

    /* Pulse ring */
    #sh-support-fab::before {
      content: '';
      position: absolute;
      width: 100%; height: 100%;
      border-radius: 50%;
      background: rgba(0,170,255,0.3);
      animation: sh-pulse 2.5s ease-out infinite;
    }
    @keyframes sh-pulse {
      0% { transform: scale(1); opacity: 0.7; }
      70% { transform: scale(1.55); opacity: 0; }
      100% { transform: scale(1.55); opacity: 0; }
    }
    #sh-support-fab.open::before { animation: none; }

    /* Modal overlay */
    #sh-support-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 99997;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
    }
    #sh-support-overlay.show { opacity: 1; pointer-events: all; }

    /* Modal */
    #sh-support-modal {
      position: fixed;
      bottom: 94px;
      ${SIDE}: 18px;
      z-index: 99998;
      width: 320px;
      max-width: calc(100vw - 28px);
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      overflow: hidden;
      transform: translateY(18px) scale(0.96);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease;
    }
    #sh-support-modal.show {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }

    /* Header */
    .sh-modal-header {
      background: linear-gradient(135deg, #00aaff 0%, #0088cc 100%);
      padding: 20px 18px 16px;
      color: #fff;
      position: relative;
    }
    .sh-modal-header-top { display: flex; align-items: center; gap: 11px; }
    .sh-modal-avatar {
      width: 42px; height: 42px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-size: 18px;
    }
    .sh-modal-brand { flex: 1; }
    .sh-modal-brand-name { font-weight: 700; font-size: 15px; letter-spacing: -0.2px; }
    .sh-modal-brand-sub { font-size: 11.5px; opacity: 0.85; margin-top: 1px; }
    .sh-online-dot {
      width: 9px; height: 9px; border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 0 2px rgba(74,222,128,0.3);
      flex-shrink: 0;
    }
    .sh-modal-tagline {
      font-size: 12.5px;
      opacity: 0.9;
      margin-top: 10px;
      line-height: 1.45;
    }

    /* Body */
    .sh-modal-body { padding: 14px 14px 10px; }

    /* Primary CTA */
    .sh-btn-primary {
      display: flex;
      align-items: center;
      gap: 11px;
      width: 100%;
      padding: 13px 14px;
      border-radius: 12px;
      background: #00aaff;
      color: #fff;
      border: none;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 10px;
      transition: background 0.18s ease, transform 0.15s ease;
    }
    .sh-btn-primary:hover { background: #0099ee; transform: translateY(-1px); }
    .sh-btn-primary-ico {
      width: 36px; height: 36px; border-radius: 9px;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-size: 17px;
    }
    .sh-btn-primary-text { flex: 1; text-align: left; }
    .sh-btn-primary-label { font-weight: 600; font-size: 13.5px; display: block; }
    .sh-btn-primary-sub { font-size: 11px; opacity: 0.85; display: block; margin-top: 1px; }

    /* Section label */
    .sh-section-label {
      font-size: 10.5px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 4px 2px 7px;
    }

    /* Grid buttons */
    .sh-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
    .sh-grid-btn {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 11px 8px 10px;
      border-radius: 11px;
      background: #f8fafc;
      border: 1.5px solid #e8f4fd;
      cursor: pointer;
      text-decoration: none;
      color: #1e293b;
      transition: background 0.15s, border-color 0.15s, transform 0.15s;
    }
    .sh-grid-btn:hover { background: #e8f4fd; border-color: #00aaff; transform: translateY(-1px); }
    .sh-grid-ico { font-size: 20px; line-height: 1; }
    .sh-grid-label { font-size: 11px; font-weight: 600; text-align: center; color: #334155; }
    .sh-grid-sub { font-size: 10px; color: #64748b; text-align: center; line-height: 1.3; }

    /* Save number button */
    .sh-btn-save {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 11px 13px;
      border-radius: 11px;
      background: #f0fdf4;
      border: 1.5px solid #bbf7d0;
      cursor: pointer;
      text-decoration: none;
      color: #166534;
      margin-bottom: 10px;
      transition: background 0.15s, transform 0.15s;
    }
    .sh-btn-save:hover { background: #dcfce7; transform: translateY(-1px); }
    .sh-btn-save-ico { font-size: 20px; flex-shrink: 0; }
    .sh-btn-save-text { flex: 1; }
    .sh-btn-save-label { font-weight: 600; font-size: 12.5px; display: block; }
    .sh-btn-save-sub { font-size: 10.5px; opacity: 0.75; display: block; margin-top: 1px; }

    /* Footer */
    .sh-modal-footer {
      padding: 8px 14px 14px;
      border-top: 1px solid #f1f5f9;
    }
    .sh-footer-label { font-size: 10.5px; color: #94a3b8; text-align: center; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .sh-socials { display: flex; justify-content: center; gap: 10px; }
    .sh-social-btn {
      width: 38px; height: 38px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      text-decoration: none;
      color: #fff;
      transition: transform 0.15s, opacity 0.15s;
    }
    .sh-social-btn:hover { transform: scale(1.12); opacity: 0.9; }
    .sh-social-wa { background: #25D366; }
    .sh-social-tg { background: #2AABEE; }
    .sh-social-tt { background: #010101; }

    /* Powered by */
    .sh-powered {
      text-align: center;
      font-size: 10px;
      color: #cbd5e1;
      padding: 6px 0 2px;
    }
    .sh-powered span { color: #00aaff; font-weight: 600; }

    @media (max-width: 360px) {
      #sh-support-modal { width: calc(100vw - 20px); ${SIDE}: 10px; }
    }
  `;

  // ── HTML ────────────────────────────────────────────────────
  function buildHTML() {
    return `
      <div id="sh-support-overlay"></div>

      <div id="sh-support-modal" role="dialog" aria-modal="true" aria-label="SubHub Support">
        <!-- Header -->
        <div class="sh-modal-header">
          <div class="sh-modal-header-top">
            <div class="sh-modal-avatar">💙</div>
            <div class="sh-modal-brand">
              <div class="sh-modal-brand-name">SubHub Support</div>
              <div class="sh-modal-brand-sub">We reply within minutes</div>
            </div>
            <div class="sh-online-dot"></div>
          </div>
          <div class="sh-modal-tagline">Hey there 👋 Need help? We're here for you. Choose how you'd like to reach us.</div>
        </div>

        <!-- Body -->
        <div class="sh-modal-body">

          <!-- Get Support CTA -->
          <a id="sh-wa-support" href="#" target="_blank" rel="noopener" class="sh-btn-primary">
            <div class="sh-btn-primary-ico">💬</div>
            <div class="sh-btn-primary-text">
              <span class="sh-btn-primary-label">Chat with Support</span>
              <span class="sh-btn-primary-sub">Opens WhatsApp — fast response</span>
            </div>
            <span>→</span>
          </a>

          <!-- Save Number -->
          <a id="sh-wa-save" href="#" target="_blank" rel="noopener" class="sh-btn-save">
            <span class="sh-btn-save-ico">💾</span>
            <div class="sh-btn-save-text">
              <span class="sh-btn-save-label">Save our number</span>
              <span class="sh-btn-save-sub">Get WhatsApp status updates from us</span>
            </div>
          </a>

          <!-- Community / Channels -->
          <div class="sh-section-label">Join our community</div>
          <div class="sh-grid">
            <a id="sh-wa-channel" href="${CONFIG.social.whatsappChannel}" target="_blank" rel="noopener" class="sh-grid-btn">
              <span class="sh-grid-ico">📢</span>
              <span class="sh-grid-label">WhatsApp Channel</span>
              <span class="sh-grid-sub">News & updates</span>
            </a>
            <a id="sh-tg-channel" href="${CONFIG.social.telegram}" target="_blank" rel="noopener" class="sh-grid-btn">
              <span class="sh-grid-ico">✈️</span>
              <span class="sh-grid-label">Telegram</span>
              <span class="sh-grid-sub">Community chat</span>
            </a>
          </div>

          <!-- Bot (commented out — uncomment to enable) -->
          <!--
          <div class="sh-section-label">Shortcuts</div>
          <a href="${CONFIG.bot?.whatsapp || '#'}" target="_blank" rel="noopener" class="sh-btn-primary" style="background:#128C7E;margin-bottom:10px">
            <div class="sh-btn-primary-ico">🤖</div>
            <div class="sh-btn-primary-text">
              <span class="sh-btn-primary-label">${CONFIG.bot?.label || 'WhatsApp Bot'}</span>
              <span class="sh-btn-primary-sub">${CONFIG.bot?.desc || ''}</span>
            </div>
            <span>→</span>
          </a>
          -->

        </div>

        <!-- Footer socials -->
        <div class="sh-modal-footer">
          <div class="sh-footer-label">Follow us</div>
          <div class="sh-socials">
            <a href="${CONFIG.social.whatsappChannel}" target="_blank" rel="noopener" class="sh-social-btn sh-social-wa" title="WhatsApp Channel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <a href="${CONFIG.social.telegram}" target="_blank" rel="noopener" class="sh-social-btn sh-social-tg" title="Telegram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
            <a href="${CONFIG.social.tiktok}" target="_blank" rel="noopener" class="sh-social-btn sh-social-tt" title="TikTok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.67a8.27 8.27 0 004.83 1.55V6.77a4.85 4.85 0 01-1.06-.08z"/></svg>
            </a>
          </div>
          <div class="sh-powered">Powered by <span>SubHub</span></div>
        </div>
      </div>

      <!-- FAB -->
      <button id="sh-support-fab" aria-label="Open support" aria-expanded="false">
        <!-- Open icon -->
        <svg class="sh-fab-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <!-- Close icon -->
        <svg class="sh-fab-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
  }

  // ── INIT ─────────────────────────────────────────────────────
  function init() {
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Inject HTML
    const wrapper = document.createElement('div');
    wrapper.id = 'sh-support-widget';
    wrapper.innerHTML = buildHTML();
    document.body.appendChild(wrapper);

    // Build WhatsApp links
    const waSupport = document.getElementById('sh-wa-support');
    const waSave    = document.getElementById('sh-wa-save');

    waSupport.href = `https://wa.me/${CONFIG.whatsapp.number}?text=${encodeURIComponent(CONFIG.whatsapp.message)}`;
    waSave.href    = `https://wa.me/${CONFIG.saveNumber.number}?text=${encodeURIComponent(CONFIG.saveNumber.message)}`;

    // Toggle
    const fab     = document.getElementById('sh-support-fab');
    const modal   = document.getElementById('sh-support-modal');
    const overlay = document.getElementById('sh-support-overlay');

    function openWidget() {
      modal.classList.add('show');
      overlay.classList.add('show');
      fab.classList.add('open');
      fab.setAttribute('aria-expanded', 'true');
    }

    function closeWidget() {
      modal.classList.remove('show');
      overlay.classList.remove('show');
      fab.classList.remove('open');
      fab.setAttribute('aria-expanded', 'false');
    }

    fab.addEventListener('click', function () {
      modal.classList.contains('show') ? closeWidget() : openWidget();
    });

    overlay.addEventListener('click', closeWidget);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeWidget();
    });
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();


