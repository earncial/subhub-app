/* ============================================================
   CONFIG
============================================================ */
const API_BASE    = 'https://api.subhub.com.ng/api';
const TOKEN_KEY   = 'sh_access_token';
const REFRESH_KEY = 'sh_refresh_token';
const REMEMBER_KEY = 'subhub_login_creds';

/* ============================================================
   UTILS
============================================================ */
async function apiCall(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        return await res.json();
    } catch {
        return { success: false, message: 'Network error. Please check your connection.' };
    }
}

/* ============================================================
   MAIN IIFE
============================================================ */
(function () {
    'use strict';

    // ── DOM refs ──
    const form             = document.getElementById('loginForm');
    const identifier       = document.getElementById('identifier');
    const password         = document.getElementById('password');
    const rememberMe       = document.getElementById('rememberMe');
    const submitBtn        = document.getElementById('submitBtn');
    const identifierGroup  = document.getElementById('identifierGroup');
    const identifierError  = document.getElementById('identifierError');
    const passwordGroup    = document.getElementById('passwordGroup');
    const passwordError    = document.getElementById('passwordError');

    // Forgot password modal
    const forgotModal      = document.getElementById('forgotModal');
    const forgotModalClose = document.getElementById('forgotModalClose');
    const forgotPasswordBtn= document.getElementById('forgotPasswordBtn');
    const fpEmail          = document.getElementById('fpEmail');
    const fpEmailGroup     = document.getElementById('fpEmailGroup');
    const fpEmailError     = document.getElementById('fpEmailError');
    const fpSubmitBtn      = document.getElementById('fpSubmitBtn');
    const fpDefault        = document.getElementById('fpDefault');
    const fpSuccess        = document.getElementById('fpSuccess');
    const fpSentEmail      = document.getElementById('fpSentEmail');
    const fpSuccessClose   = document.getElementById('fpSuccessClose');

    // Overlay
    const overlay          = document.getElementById('procOverlay');
    const procLogoWrap     = document.getElementById('procLogoWrap');
    const procStatusIcon   = document.getElementById('procStatusIcon');
    const procTitle        = document.getElementById('procTitle');
    const procSub          = document.getElementById('procSub');
    const procDots         = document.getElementById('procDots');
    const procBtnDone      = document.getElementById('procBtnDone');

    // Sidebar
    const hamburger        = document.getElementById('hamburgerBtn');
    const sidebar          = document.getElementById('sidebar');
    const sidebarOverlay   = document.getElementById('sidebarOverlay');
    const sidebarClose     = document.getElementById('sidebarClose');

    // Toggle password
    const togglePw         = document.getElementById('togglePassword');

    // Toast
    const toastContainer   = document.getElementById('toastContainer');

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // REDIRECT IF ALREADY LOGGED IN
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    if (localStorage.getItem(TOKEN_KEY)) {
        window.location.href = '/app/index.html';
        return;
    }

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // REMEMBER ME
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    function loadRememberedCredentials() {
        try {
            const raw = localStorage.getItem(REMEMBER_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.identifier) {
                identifier.value = data.identifier;
                rememberMe.checked = true;
                validateIdentifier();
            }
        } catch (e) { /* ignore */ }
    }

    function saveRememberedCredentials() {
        if (rememberMe.checked) {
            try {
                localStorage.setItem(REMEMBER_KEY, JSON.stringify({ identifier: identifier.value.trim() }));
            } catch (e) { /* ignore */ }
        } else {
            try { localStorage.removeItem(REMEMBER_KEY); } catch (e) { /* ignore */ }
        }
    }

    loadRememberedCredentials();

    identifier.addEventListener('input', function () {
        validateIdentifier();
        if (rememberMe.checked) saveRememberedCredentials();
    });

    rememberMe.addEventListener('change', function () {
        if (this.checked) saveRememberedCredentials();
        else { try { localStorage.removeItem(REMEMBER_KEY); } catch (e) { /* ignore */ } }
    });

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // SIDEBAR
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', openSidebar);
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // TOAST
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    function showToast(title, message, type = 'blue', duration = 4000) {
        const iconMap = {
            green: 'fa-circle-check',
            red:   'fa-circle-xmark',
            blue:  'fa-circle-info',
            warn:  'fa-triangle-exclamation'
        };
        const icon = iconMap[type] || 'fa-circle-info';

        const el = document.createElement('div');
        el.className = 'toast-item';
        el.innerHTML = `
            <div class="toast-ico ${type}"><i class="fas ${icon}"></i></div>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
            <button class="toast-close"><i class="fas fa-xmark"></i></button>
            <div class="toast-progress ${type}" style="width:100%;"></div>
        `;
        toastContainer.appendChild(el);

        const closeBtn = el.querySelector('.toast-close');
        const progress = el.querySelector('.toast-progress');

        requestAnimationFrame(() => el.classList.add('show'));

        const startTime = Date.now();
        const timer = setInterval(() => {
            const pct = Math.max(0, (duration - (Date.now() - startTime)) / duration * 100);
            progress.style.width = pct + '%';
            if (pct <= 0) clearInterval(timer);
        }, 30);

        function dismiss() {
            if (el.classList.contains('hide')) return;
            el.classList.remove('show');
            el.classList.add('hide');
            clearInterval(timer);
            setTimeout(() => { if (el.parentNode) el.remove(); }, 350);
        }

        closeBtn.addEventListener('click', dismiss);
        setTimeout(dismiss, duration);
    }

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // TOGGLE PASSWORD VISIBILITY
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    togglePw.addEventListener('click', function () {
        const type = password.type === 'password' ? 'text' : 'password';
        password.type = type;
        this.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // VALIDATIONS
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    function validateIdentifier() {
        const val = identifier.value.trim();
        if (val.length === 0) {
            identifierGroup.classList.remove('success', 'error');
            return false;
        }
        identifierGroup.classList.remove('error');
        identifierGroup.classList.add('success');
        return true;
    }

    function validatePassword() {
        const val = password.value;
        if (val.length === 0) {
            passwordGroup.classList.remove('success', 'error');
            return false;
        }
        passwordGroup.classList.remove('error');
        passwordGroup.classList.add('success');
        return true;
    }

    password.addEventListener('input', validatePassword);

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // FORM SUBMISSION
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        handleSignIn();
    });

    submitBtn.addEventListener('click', function (e) {
        e.preventDefault();
        handleSignIn();
    });

    password.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') handleSignIn();
    });

    identifier.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') password.focus();
    });

    async function handleSignIn() {
        // Clear previous errors
        identifierGroup.classList.remove('error');
        passwordGroup.classList.remove('error');
        identifierError.textContent = 'Please enter your username, email, or phone number.';
        passwordError.textContent = 'Please enter your password.';

        const credVal = identifier.value.trim();
        const pwVal   = password.value;

        if (!credVal) {
            identifierGroup.classList.add('error');
            identifierGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (!pwVal) {
            passwordGroup.classList.add('error');
            passwordGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (rememberMe.checked) saveRememberedCredentials();

        showProcessing();

        const data = await apiCall('/auth/signin', {
            method: 'POST',
            body: JSON.stringify({ credential: credVal, password: pwVal }),
        });

        if (!data || !data.success) {
            showError(data?.message || 'Invalid credentials. Please try again.');
            identifierGroup.classList.add('error');
            identifierError.textContent = data?.message || 'Invalid credentials.';
            return;
        }

        // Save tokens
        localStorage.setItem(TOKEN_KEY,   data.accessToken);
        localStorage.setItem(REFRESH_KEY, data.refreshToken);

        showSuccess();
    }

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // PROCESSING OVERLAY
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    function showProcessing() {
        overlay.classList.add('active');
        procLogoWrap.style.display = 'flex';
        procStatusIcon.className = 'proc-status-icon';
        procStatusIcon.style.display = 'none';
        procTitle.textContent = 'Logging you in...';
        procSub.textContent = 'Please wait while we verify your credentials.';
        procDots.style.display = 'flex';
        procBtnDone.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
    }

    function showSuccess() {
        procLogoWrap.style.display = 'none';
        procStatusIcon.className = 'proc-status-icon success';
        procStatusIcon.style.display = 'block';
        procStatusIcon.innerHTML = '<i class="fas fa-circle-check"></i>';
        procTitle.textContent = 'Welcome back! 🎉';
        procSub.textContent = 'Redirecting you to your dashboard...';
        procDots.style.display = 'none';
        procBtnDone.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');

        setTimeout(() => { window.location.href = '/app/index.html'; }, 1500);
    }

    function showError(msg) {
        procLogoWrap.style.display = 'none';
        procStatusIcon.className = 'proc-status-icon error';
        procStatusIcon.style.display = 'block';
        procStatusIcon.innerHTML = '<i class="fas fa-circle-xmark"></i>';
        procTitle.textContent = 'Login failed';
        procSub.textContent = msg || 'Invalid credentials. Please try again.';
        procDots.style.display = 'none';
        procBtnDone.textContent = 'Try again';
        procBtnDone.style.display = 'inline-block';
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }

    procBtnDone.addEventListener('click', function () {
        overlay.classList.remove('active');
        identifier.focus();
    });

    overlay.addEventListener('click', function (e) {
        if (e.target === this && procBtnDone.style.display === 'inline-block') {
            overlay.classList.remove('active');
        }
    });

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // FORGOT PASSWORD MODAL
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    function openForgotModal() {
        forgotModal.classList.add('show');
        fpDefault.style.display = 'block';
        fpSuccess.classList.remove('show');
        fpEmail.value = '';
        fpEmailGroup.classList.remove('success', 'error');
        fpSubmitBtn.disabled = false;
        fpSubmitBtn.classList.remove('loading');
        fpSubmitBtn.querySelector('.btn-text').textContent = 'Send reset link';
        setTimeout(() => fpEmail.focus(), 150);
    }

    function closeForgotModal() {
        forgotModal.classList.remove('show');
    }

    forgotPasswordBtn.addEventListener('click', openForgotModal);
    forgotModalClose.addEventListener('click', closeForgotModal);
    fpSuccessClose.addEventListener('click', closeForgotModal);
    forgotModal.addEventListener('click', function (e) {
        if (e.target === this) closeForgotModal();
    });

    // ESC — close both modal and sidebar
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeForgotModal();
            closeSidebar();
        }
    });

    // Forgot password — email validation
    function validateFpEmail() {
        const val = fpEmail.value.trim();
        if (val.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            fpEmailGroup.classList.remove('success');
            fpEmailGroup.classList.add('error');
            fpEmailError.textContent = 'Please enter a valid email address.';
            return false;
        }
        fpEmailGroup.classList.remove('error');
        fpEmailGroup.classList.add('success');
        return true;
    }

    fpEmail.addEventListener('input', validateFpEmail);
    fpEmail.addEventListener('blur', validateFpEmail);
    fpEmail.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') handleForgotPassword();
    });

    fpSubmitBtn.addEventListener('click', handleForgotPassword);

    async function handleForgotPassword() {
        if (!validateFpEmail()) {
            fpEmailGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        fpSubmitBtn.disabled = true;
        fpSubmitBtn.classList.add('loading');
        fpSubmitBtn.querySelector('.btn-text').textContent = 'Sending...';

        await apiCall('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email: fpEmail.value.trim() }),
        });

        fpSubmitBtn.disabled = false;
        fpSubmitBtn.classList.remove('loading');
        fpSubmitBtn.querySelector('.btn-text').textContent = 'Send reset link';

        // Always show success 🧐😏
        fpDefault.style.display = 'none';
        fpSentEmail.textContent = fpEmail.value.trim();
        fpSuccess.classList.add('show');
        fpEmail.value = '';
    }

    console.log('✅ SubHub Login page loaded');

})();
