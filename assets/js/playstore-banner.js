(function SubHubPlayStoreBanner() {
  // ─── CONFIG ────────────────────────────────────────────────
  const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=ng.subhub';
  const SHOW_DELAY_MS    = 4000;
  const SNOOZE_DAYS      = 2;
  const STORAGE_KEY      = 'sh_playstore_banner_dismissed_at';
  const PERMANENT_HIDE   = 'sh_playstore_banner_installed';
  // Official "Get it on Google Play" badge, hosted by Google for developer use
  const PLAY_BADGE_IMG   = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';

  // ─── GUARDS ────────────────────────────────────────────────
  if (localStorage.getItem(PERMANENT_HIDE) === 'true') return;

  const dismissedAt = localStorage.getItem(STORAGE_KEY);
  if (dismissedAt) {
    const daysPassed = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
    if (daysPassed < SNOOZE_DAYS) return;
  }

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(showBanner, SHOW_DELAY_MS);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(showBanner, SHOW_DELAY_MS));
  }

  // ═══════════════════════════════════════════════════════════════
  //  BANNER UI
  // ═══════════════════════════════════════════════════════════════
  function showBanner() {
    if (document.getElementById('sh-ps-banner')) return;

    const BRAND      = '#00aaff';
    const BRAND_DARK = '#0077b3';
    const BRAND_DEEP = '#004d73';

    const styles = `
      #sh-ps-banner {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: sh-ps-slide-up 0.4s cubic-bezier(0.16,1,0.3,1);
      }
      @keyframes sh-ps-slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      #sh-ps-banner .sh-ps-card {
        position: relative;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px 18px;
        background: linear-gradient(120deg, ${BRAND_DEEP} 0%, ${BRAND_DARK} 45%, ${BRAND} 100%);
        box-shadow: 0 -6px 28px rgba(0,77,115,0.4);
        overflow: hidden;
      }
      #sh-ps-banner .sh-ps-card::before {
        content: '';
        position: absolute;
        top: -60%; right: -10%;
        width: 220px; height: 220px;
        background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
        pointer-events: none;
      }
      #sh-ps-banner .sh-ps-btn-close {
        position: absolute;
        top: 8px; right: 10px;
        background: rgba(255,255,255,0.12);
        border: none;
        color: rgba(255,255,255,0.9);
        font-size: 15px;
        line-height: 1;
        width: 24px; height: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
        z-index: 2;
      }
      #sh-ps-banner .sh-ps-btn-close:hover { background: rgba(255,255,255,0.25); }

      #sh-ps-banner .sh-ps-icon {
        position: relative;
        width: 52px; height: 52px; flex-shrink: 0;
        background: #ffffff;
        border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      }
      #sh-ps-banner .sh-ps-icon svg { width: 28px; height: 28px; }

      #sh-ps-banner .sh-ps-body {
        flex: 1;
        min-width: 0;
        position: relative;
      }
      #sh-ps-banner .sh-ps-tag {
        display: inline-block;
        background: rgba(255,255,255,0.18);
        color: #ffffff;
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        padding: 2px 7px;
        border-radius: 5px;
        margin-bottom: 4px;
      }
      #sh-ps-banner .sh-ps-title {
        font-size: 14.5px;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 2px 0;
        letter-spacing: 0.1px;
      }
      #sh-ps-banner .sh-ps-sub {
        font-size: 11.5px;
        color: rgba(255,255,255,0.88);
        margin: 0;
        line-height: 1.4;
      }

      #sh-ps-banner .sh-ps-cta {
        flex-shrink: 0;
        position: relative;
      }
      #sh-ps-banner .sh-ps-badge-img {
        display: block;
        height: 44px;
        width: auto;
        cursor: pointer;
        transition: transform 0.15s;
        filter: drop-shadow(0 3px 10px rgba(0,0,0,0.3));
      }
      #sh-ps-banner .sh-ps-badge-img:hover  { transform: scale(1.04); }
      #sh-ps-banner .sh-ps-badge-img:active { transform: scale(0.97); }

      /* fallback button, shown only if the badge image fails to load */
      #sh-ps-banner .sh-ps-btn-fallback {
        display: none;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        color: ${BRAND_DARK};
        border: none;
        border-radius: 9px;
        padding: 10px 16px;
        font-size: 12.5px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
      }

      @media (max-width: 480px) {
        #sh-ps-banner .sh-ps-card { flex-wrap: wrap; padding: 16px 16px 14px; }
        #sh-ps-banner .sh-ps-sub { display: none; }
        #sh-ps-banner .sh-ps-cta { width: 100%; display: flex; justify-content: center; margin-top: 4px; }
        #sh-ps-banner .sh-ps-badge-img { height: 46px; }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    const banner = document.createElement('div');
    banner.id = 'sh-ps-banner';
    banner.innerHTML = `
      <div class="sh-ps-card">
        <button class="sh-ps-btn-close" id="sh-ps-btn-close" aria-label="Close">&times;</button>

        <div class="sh-ps-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3.5v17c0 .4.2.7.5.9l9.5-9.4-9.5-9.4c-.3.2-.5.5-.5.9z" fill="#00d2ff"/>
            <path d="M13 12l3.4-3.4 4.1 2.4c.9.5.9 1.9 0 2.4l-4.1 2.4L13 12z" fill="#ffcd00"/>
            <path d="M3.5 20.4L13 12l-9.5-8.4c-.2.3-.3.6-.3 1v14.8c0 .4.1.7.3 1z" fill="#00e676"/>
            <path d="M13 12L3.5 20.4c.3.3.8.4 1.2.2l11.7-6.7L13 12z" fill="#ff3b30"/>
          </svg>
        </div>

        <div class="sh-ps-body">
          <span class="sh-ps-tag">Now Available</span>
          <p class="sh-ps-title">SubHub • Official App</p>
          <p class="sh-ps-sub">Pay bills faster, track transactions &amp; enjoy exclusive app-only offers.</p>
        </div>

        <div class="sh-ps-cta">
          <img class="sh-ps-badge-img" id="sh-ps-badge-img" src="${PLAY_BADGE_IMG}" alt="Get it on Google Play" />
          <button class="sh-ps-btn-fallback" id="sh-ps-btn-fallback">Get the App</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    const badgeImg = document.getElementById('sh-ps-badge-img');
    const fallbackBtn = document.getElementById('sh-ps-btn-fallback');

    // If the Google-hosted badge image fails to load, show a text button instead
    badgeImg.addEventListener('error', () => {
      badgeImg.style.display = 'none';
      fallbackBtn.style.display = 'flex';
    });

    function goToStore() {
      localStorage.setItem(PERMANENT_HIDE, 'true');
      window.open(PLAY_STORE_LINK, '_blank', 'noopener');
      removeBanner();
    }

    badgeImg.addEventListener('click', goToStore);
    fallbackBtn.addEventListener('click', goToStore);

    document.getElementById('sh-ps-btn-close').addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      removeBanner();
    });
  }

  function removeBanner() {
    const b = document.getElementById('sh-ps-banner');
    if (b) {
      b.style.transform  = 'translateY(100%)';
      b.style.opacity    = '0';
      b.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      setTimeout(() => b.remove(), 260);
    }
  }
})();
