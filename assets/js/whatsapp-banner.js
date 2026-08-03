(function SubHubWhatsAppBanner() {
  // ─── CONFIG ────────────────────────────────────────────────
  const WHATSAPP_LINK = 'https://whatsapp.com/channel/0029Vb841DxBfxoFoPsjBA0s'; // real channel link
  const SHOW_DELAY_MS  = 4000;   // 3-5s delay before showing
  const SNOOZE_DAYS    = 2;      // days before showing again after dismiss
  const STORAGE_KEY     = 'sh_wa_banner_dismissed_at';
  const PERMANENT_HIDE  = 'sh_wa_banner_joined'; // set true once they actually click Join

  // ─── GUARDS ────────────────────────────────────────────────
  if (localStorage.getItem(PERMANENT_HIDE) === 'true') return;

  const dismissedAt = localStorage.getItem(STORAGE_KEY);
  if (dismissedAt) {
    const daysPassed = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
    if (daysPassed < SNOOZE_DAYS) return; // still snoozed
  }

  setTimeout(showBanner, SHOW_DELAY_MS);

  // ═══════════════════════════════════════════════════════════════
  //  BANNER UI
  // ═══════════════════════════════════════════════════════════════
  function showBanner() {
    if (document.getElementById('sh-wa-banner')) return;

    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // ── Brand colors ──
    const BRAND        = '#00aaff';
    const BRAND_HOVER   = '#0090dd';

    const styles = `
      #sh-wa-banner {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 18px;
        background: ${BRAND};
        box-shadow: 0 -4px 24px rgba(0,170,255,0.35);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: sh-wa-slide-up 0.35s cubic-bezier(0.16,1,0.3,1);
      }
      @keyframes sh-wa-slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      #sh-wa-banner .sh-wa-icon {
        width: 38px; height: 38px; flex-shrink: 0;
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
      }
      #sh-wa-banner .sh-wa-icon svg {
        width: 20px; height: 20px; fill: #ffffff;
      }
      #sh-wa-banner .sh-wa-text {
        flex: 1;
      }
      #sh-wa-banner .sh-wa-title {
        font-size: 13px;
        font-weight: 700;
        color: #ffffff;
        margin: 0 0 2px 0;
        letter-spacing: 0.1px;
      }
      #sh-wa-banner .sh-wa-sub {
        font-size: 11.5px;
        color: rgba(255,255,255,0.85);
        margin: 0;
        line-height: 1.4;
      }
      #sh-wa-banner .sh-wa-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      #sh-wa-banner .sh-wa-btn-join {
        background: #ffffff;
        color: ${BRAND};
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
        white-space: nowrap;
      }
      #sh-wa-banner .sh-wa-btn-join:hover  { background: #f0f8ff; }
      #sh-wa-banner .sh-wa-btn-join:active { transform: scale(0.97); }
      #sh-wa-banner .sh-wa-btn-later {
        background: transparent;
        color: #ffffff;
        border: 1px solid rgba(255,255,255,0.5);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        white-space: nowrap;
      }
      #sh-wa-banner .sh-wa-btn-later:hover { background: rgba(255,255,255,0.1); }

      @media (max-width: 420px) {
        #sh-wa-banner { flex-wrap: wrap; }
        #sh-wa-banner .sh-wa-actions { width: 100%; justify-content: flex-end; margin-top: 4px; }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    const banner = document.createElement('div');
    banner.id = 'sh-wa-banner';
    banner.innerHTML = `
      <div class="sh-wa-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 004.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.79 14.02c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.13.11-1.83-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.79-4.17-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2.01.89 2.16.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.71 1.18 1.53 1.91 1.05.94 1.94 1.24 2.22 1.38.28.14.44.12.61-.07.16-.19.68-.79.87-1.06.18-.28.36-.23.61-.14.24.09 1.55.73 1.82.87.27.14.44.2.51.31.07.12.07.68-.17 1.35z"/>
        </svg>
      </div>
      <div class="sh-wa-text">
        <p class="sh-wa-title">Join our WhatsApp channel</p>
        <p class="sh-wa-sub">Get news, offers &amp; updates straight from SubHub.</p>
      </div>
      <div class="sh-wa-actions">
        <button class="sh-wa-btn-later" id="sh-wa-btn-later">Not now</button>
        <button class="sh-wa-btn-join" id="sh-wa-btn-join">Join Now</button>
      </div>
    `;

    document.body.appendChild(banner);

    // ── Button handlers ──────────────────────────────────────
    document.getElementById('sh-wa-btn-join').addEventListener('click', () => {
      localStorage.setItem(PERMANENT_HIDE, 'true');
      window.open(WHATSAPP_LINK, '_blank', 'noopener');
      removeBanner();
    });

    document.getElementById('sh-wa-btn-later').addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      removeBanner();
    });
  }

  function removeBanner() {
    const b = document.getElementById('sh-wa-banner');
    if (b) {
      b.style.transform  = 'translateY(100%)';
      b.style.opacity    = '0';
      b.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      setTimeout(() => b.remove(), 260);
    }
  }
})();
