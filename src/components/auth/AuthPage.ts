/**
 * AuthPage Component — Double-Slider Sliding Login & Registration
 * Connected to Supabase Auth with Role Whitelisting, Password Reset, and Error States
 */

import './authPage.css';
import { logIn, signUp, sendPasswordResetEmail, resetPassword } from '../../services/authService';

/* ---- SVG Icons ---- */
const icons = {
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>`,
  lock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>`,
  arrowLeft: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>`,
  logo: `<svg class="auth-header-logo-icon" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="#2F7BE5" fill-opacity="0.2"/>
    <path d="M10 26V10h5.5c2 0 3.5.5 4.5 1.5s1.5 2.3 1.5 4-.5 3-1.5 4-2.5 1.5-4.5 1.5H14v5h-4z" fill="#2F7BE5"/>
    <path d="M18 17l8 9" stroke="#2F7BE5" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`
};

export function renderAuthPage(): string {
  return `
    <div class="auth-page-wrapper" id="auth-page">
      <!-- Architectural Atmosphere Background -->
      <div class="auth-page-bg" aria-hidden="true">
        <div class="auth-bg-overlay"></div>
        <div class="auth-ambient-orb auth-ambient-orb--1"></div>
        <div class="auth-ambient-orb auth-ambient-orb--2"></div>
      </div>

      <!-- Header Navigation Bar -->
      <header class="auth-header">
        <a href="#" class="auth-back-link" id="auth-back-home" title="Return to Landing Page">
          <span class="auth-back-icon">${icons.arrowLeft}</span>
          <span class="auth-back-text">Back to Dezignet</span>
        </a>

        <div class="auth-brand-badge">
          ${icons.logo}
          <span class="auth-brand-name">Dezignet</span>
        </div>
      </header>

      <!-- Main Center Sliding Auth Container -->
      <main class="auth-main-content">
        <div class="auth-slider-container" id="auth-container">
          
          <!-- 1. Form Box: LOGIN (Right side by default) -->
          <div class="form-box login" id="login-form-box">
            <form class="auth-form" id="login-form" onsubmit="return false;">
              <h2 class="auth-title">Welcome Back</h2>
              <p class="auth-subtitle">Access your architectural portfolio and client projects.</p>
              
              <!-- Inline Error/Success Box -->
              <div class="auth-feedback-msg" id="login-feedback" style="display: none;"></div>

              <!-- Email Field -->
              <div class="input-box">
                <input type="email" id="login-email" placeholder="Professional Email" required autocomplete="email" />
                <span class="input-icon">${icons.mail}</span>
              </div>

              <!-- Password Field -->
              <div class="input-box">
                <input type="password" id="login-password" placeholder="Password" required autocomplete="current-password" />
                <span class="input-icon">${icons.lock}</span>
              </div>

              <!-- Forgot Password Link -->
              <div class="forgot-link-wrap">
                <a href="#forgot" class="forgot-link" id="login-forgot-link">Forgot Password?</a>
              </div>

              <!-- Login Submit Button -->
              <button type="submit" class="btn-auth-submit" id="btn-login-submit">
                <span>Login</span>
              </button>
            </form>
          </div>

          <!-- 2. Form Box: REGISTRATION (Left side when active) -->
          <div class="form-box register" id="register-form-box">
            <form class="auth-form" id="register-form" onsubmit="return false;">
              <h2 class="auth-title">Create Account</h2>
              <p class="auth-subtitle">Join the premier network for architects & engineers.</p>
              
              <!-- Inline Error/Success Box -->
              <div class="auth-feedback-msg" id="register-feedback" style="display: none;"></div>

              <!-- Role Selector (Designer vs Client) -->
              <div class="auth-role-selector">
                <span class="auth-role-heading">Account Type:</span>
                <div class="auth-role-radios">
                  <label class="auth-role-chip">
                    <input type="radio" name="signup-role" value="designer" checked />
                    <span>Designer / Architect</span>
                  </label>
                  <label class="auth-role-chip">
                    <input type="radio" name="signup-role" value="client" />
                    <span>Client / Project Owner</span>
                  </label>
                </div>
              </div>

              <!-- Full Name Field -->
              <div class="input-box">
                <input type="text" id="reg-fullname" placeholder="Full Name or Studio Name" required autocomplete="name" />
                <span class="input-icon">${icons.user}</span>
              </div>

              <!-- Email Field -->
              <div class="input-box">
                <input type="email" id="reg-email" placeholder="Professional Email" required autocomplete="email" />
                <span class="input-icon">${icons.mail}</span>
              </div>

              <!-- Password Field -->
              <div class="input-box">
                <input type="password" id="reg-password" placeholder="Password (min 8 characters)" minlength="8" required autocomplete="new-password" />
                <span class="input-icon">${icons.lock}</span>
              </div>

              <!-- Register Submit Button -->
              <button type="submit" class="btn-auth-submit" id="btn-register-submit">
                <span>Register</span>
              </button>
            </form>
          </div>

          <!-- 3. Toggle-Box Overlay with 300% Width Pill Shape -->
          <div class="toggle-box" aria-hidden="true">
            <div class="toggle-pill">
              <div class="toggle-pill-pattern"></div>
            </div>

            <!-- Left Panel (Visible during Login) -->
            <div class="toggle-panel toggle-left">
              <div class="toggle-brand-tag">DEZIGNET EXCLUSIVE</div>
              <h1 class="toggle-heading">Hello, Welcome!</h1>
              <p class="toggle-desc">Don't have an account? Post your design brief or join our curated network of licensed architects.</p>
              <button type="button" class="btn-toggle register-btn" id="register-toggle-btn">
                <span>Register</span>
              </button>
            </div>

            <!-- Right Panel (Visible during Registration) -->
            <div class="toggle-panel toggle-right">
              <div class="toggle-brand-tag">DEZIGNET PLATFORM</div>
              <h1 class="toggle-heading">Welcome Back!</h1>
              <p class="toggle-desc">Already have an account? Sign in to track ongoing projects, proposals, and escrow payments.</p>
              <button type="button" class="btn-toggle login-btn" id="login-toggle-btn">
                <span>Login</span>
              </button>
            </div>
          </div>

        </div>

        <!-- 4. Forgot Password Modal -->
        <div class="auth-modal-overlay" id="forgot-modal" style="display: none;">
          <div class="auth-modal-card">
            <h3 class="auth-modal-title">Reset Your Password</h3>
            <p class="auth-modal-subtitle">Enter your email and we'll send you a secure password reset link.</p>
            <div class="auth-feedback-msg" id="forgot-feedback" style="display: none;"></div>
            
            <div class="input-box" style="margin-top: 1rem;">
              <input type="email" id="forgot-email" placeholder="Professional Email" required />
              <span class="input-icon">${icons.mail}</span>
            </div>

            <div class="auth-modal-actions">
              <button type="button" class="btn-auth-secondary" id="btn-forgot-cancel">Cancel</button>
              <button type="button" class="btn-auth-primary" id="btn-forgot-send">Send Reset Link</button>
            </div>
          </div>
        </div>

        <!-- 5. Reset Password Modal (When arriving via link) -->
        <div class="auth-modal-overlay" id="reset-modal" style="display: none;">
          <div class="auth-modal-card">
            <h3 class="auth-modal-title">Set New Password</h3>
            <p class="auth-modal-subtitle">Enter your new secure password below.</p>
            <div class="auth-feedback-msg" id="reset-feedback" style="display: none;"></div>
            
            <div class="input-box" style="margin-top: 1rem;">
              <input type="password" id="reset-new-password" placeholder="New Password (min 8 characters)" minlength="8" required />
              <span class="input-icon">${icons.lock}</span>
            </div>

            <div class="auth-modal-actions">
              <button type="button" class="btn-auth-primary" id="btn-reset-save">Save New Password</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
}

function showFeedback(elId: string, message: string, isError = true) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.style.padding = '8px 12px';
  el.style.borderRadius = '6px';
  el.style.fontSize = '0.85rem';
  el.style.marginBottom = '12px';
  el.style.lineHeight = '1.4';
  if (isError) {
    el.style.background = '#FEF2F2';
    el.style.color = '#B91C1C';
    el.style.border = '1px solid #FECACA';
  } else {
    el.style.background = '#ECFDF5';
    el.style.color = '#047857';
    el.style.border = '1px solid #A7F3D0';
  }
}

/**
 * Attaches event listeners and handles sliding transitions for AuthPage.
 */
export function initAuthPage(initialMode: 'login' | 'register' | 'reset-password' = 'login'): void {
  const container = document.getElementById('auth-container');
  const registerToggleBtn = document.getElementById('register-toggle-btn');
  const loginToggleBtn = document.getElementById('login-toggle-btn');
  const backHomeBtn = document.getElementById('auth-back-home');
  const forgotLink = document.getElementById('login-forgot-link');
  const forgotModal = document.getElementById('forgot-modal');
  const resetModal = document.getElementById('reset-modal');

  if (!container) return;

  if (initialMode === 'reset-password') {
    if (resetModal) resetModal.style.display = 'flex';
  } else if (initialMode === 'register') {
    container.classList.add('active');
  } else {
    container.classList.remove('active');
  }

  // Switch to Registration
  registerToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    container.classList.add('active');
    history.replaceState(null, '', '#register');
  });

  // Switch to Login
  loginToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    container.classList.remove('active');
    history.replaceState(null, '', '#login');
  });

  // Back to home
  backHomeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '';
  });

  // Handle Login submission
  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('login-email') as HTMLInputElement | null;
    const passInput = document.getElementById('login-password') as HTMLInputElement | null;
    const btn = document.getElementById('btn-login-submit') as HTMLButtonElement | null;

    const email = emailInput?.value.trim() || '';
    const password = passInput?.value || '';

    if (!email || !password) {
      showFeedback('login-feedback', 'Please enter your email and password.', true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>Signing in...</span>`;
    }

    const res = await logIn(email, password);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Login</span>`;
    }

    if (!res.success) {
      showFeedback('login-feedback', res.error || 'Invalid email or password.', true);
      return;
    }

    // Success: check redirect query param
    showFeedback('login-feedback', 'Login successful! Redirecting...', false);

    const hashParts = window.location.hash.split('?redirect=');
    const targetRedirect = hashParts.length > 1 ? decodeURIComponent(hashParts[1]) : '#dashboard';

    setTimeout(() => {
      window.location.hash = targetRedirect;
    }, 400);
  });

  // Handle Registration submission
  const registerForm = document.getElementById('register-form');
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('reg-fullname') as HTMLInputElement | null;
    const emailInput = document.getElementById('reg-email') as HTMLInputElement | null;
    const passInput = document.getElementById('reg-password') as HTMLInputElement | null;
    const roleRadio = document.querySelector('input[name="signup-role"]:checked') as HTMLInputElement | null;
    const btn = document.getElementById('btn-register-submit') as HTMLButtonElement | null;

    const fullName = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const password = passInput?.value || '';
    const role = (roleRadio?.value === 'designer' ? 'designer' : 'client');

    if (!fullName || !email || !password) {
      showFeedback('register-feedback', 'All fields are required.', true);
      return;
    }

    if (password.length < 8) {
      showFeedback('register-feedback', 'Password must be at least 8 characters long.', true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>Creating account...</span>`;
    }

    const res = await signUp({ email, password, fullName, role });

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Register</span>`;
    }

    if (!res.success) {
      showFeedback('register-feedback', res.error || 'Registration failed.', true);
      return;
    }

    if (res.requiresConfirmation) {
      showFeedback(
        'register-feedback',
        'Account created! We have sent a confirmation email to ' + email + '. Please verify your email to log in.',
        false
      );
    } else {
      showFeedback('register-feedback', 'Account created! Redirecting to dashboard...', false);
      setTimeout(() => {
        window.location.hash = '#dashboard';
      }, 500);
    }
  });

  // Forgot password modal
  forgotLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (forgotModal) forgotModal.style.display = 'flex';
  });

  document.getElementById('btn-forgot-cancel')?.addEventListener('click', () => {
    if (forgotModal) forgotModal.style.display = 'none';
  });

  document.getElementById('btn-forgot-send')?.addEventListener('click', async () => {
    const emailInput = document.getElementById('forgot-email') as HTMLInputElement | null;
    const email = emailInput?.value.trim() || '';
    const sendBtn = document.getElementById('btn-forgot-send') as HTMLButtonElement | null;

    if (!email) {
      showFeedback('forgot-feedback', 'Please enter your registered email.', true);
      return;
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
    }

    const res = await sendPasswordResetEmail(email);

    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Reset Link';
    }

    if (!res.success) {
      showFeedback('forgot-feedback', res.error || 'Failed to send reset link.', true);
    } else {
      showFeedback(
        'forgot-feedback',
        'Reset link sent! Please check your email inbox.',
        false
      );
    }
  });

  // Reset password form save
  document.getElementById('btn-reset-save')?.addEventListener('click', async () => {
    const newPassInput = document.getElementById('reset-new-password') as HTMLInputElement | null;
    const newPass = newPassInput?.value || '';
    const saveBtn = document.getElementById('btn-reset-save') as HTMLButtonElement | null;

    if (newPass.length < 8) {
      showFeedback('reset-feedback', 'Password must be at least 8 characters long.', true);
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Updating...';
    }

    const res = await resetPassword(newPass);

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save New Password';
    }

    if (!res.success) {
      showFeedback('reset-feedback', res.error || 'Failed to update password.', true);
    } else {
      showFeedback('reset-feedback', 'Password updated successfully! Logging you in...', false);
      setTimeout(() => {
        window.location.hash = '#dashboard';
      }, 700);
    }
  });
}
