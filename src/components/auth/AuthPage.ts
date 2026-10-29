/**
 * AuthPage Component — Double-Slider Sliding Login & Registration
 *
 * Inspired by the classic double-slider overlay animation:
 * - 850px x 550px rounded luxury container (border-radius: 30px)
 * - Two 50% form boxes: Login and Registration
 * - Toggle-box overlay with a giant rounded pill (width: 300%, border-radius: 150px)
 *   expanding to 100% at the midpoint and settling on 50%
 * - Transition timings: 1.8s ease-in-out on the sliding panel, .6s ease-in-out 1.2s on form boxes
 * - Styled with Dezignet architectural bronze/gold & deep charcoal aesthetic
 */

import './authPage.css';

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
  google: `<svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"/>
  </svg>`,
  facebook: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>`,
  github: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>`,
  linkedin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
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
      <!-- Architectural Softly Blurred Background -->
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
              
              <!-- Username/Email Field -->
              <div class="input-box">
                <input type="text" id="login-username" placeholder="Username or Email" required autocomplete="username" />
                <span class="input-icon">${icons.user}</span>
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
                <span class="btn-glow"></span>
              </button>

              <!-- Social Login Divider -->
              <div class="social-divider">
                <span>or continue with</span>
              </div>

              <!-- Social Login Icons -->
              <div class="social-icons">
                <button type="button" class="social-btn" title="Sign in with Google" aria-label="Google">
                  ${icons.google}
                </button>
                <button type="button" class="social-btn" title="Sign in with Facebook" aria-label="Facebook">
                  ${icons.facebook}
                </button>
                <button type="button" class="social-btn" title="Sign in with GitHub" aria-label="GitHub">
                  ${icons.github}
                </button>
                <button type="button" class="social-btn" title="Sign in with LinkedIn" aria-label="LinkedIn">
                  ${icons.linkedin}
                </button>
              </div>
            </form>
          </div>

          <!-- 2. Form Box: REGISTRATION (Left side when active) -->
          <div class="form-box register" id="register-form-box">
            <form class="auth-form" id="register-form" onsubmit="return false;">
              <h2 class="auth-title">Create Account</h2>
              <p class="auth-subtitle">Join the premier network for architects & engineers.</p>
              
              <!-- Username Field -->
              <div class="input-box">
                <input type="text" id="reg-username" placeholder="Full Name or Studio" required autocomplete="name" />
                <span class="input-icon">${icons.user}</span>
              </div>

              <!-- Email Field -->
              <div class="input-box">
                <input type="email" id="reg-email" placeholder="Professional Email" required autocomplete="email" />
                <span class="input-icon">${icons.mail}</span>
              </div>

              <!-- Password Field -->
              <div class="input-box">
                <input type="password" id="reg-password" placeholder="Create Password" required autocomplete="new-password" />
                <span class="input-icon">${icons.lock}</span>
              </div>

              <!-- Register Submit Button -->
              <button type="submit" class="btn-auth-submit" id="btn-register-submit">
                <span>Register</span>
                <span class="btn-glow"></span>
              </button>

              <!-- Social Register Divider -->
              <div class="social-divider">
                <span>or register with</span>
              </div>

              <!-- Social Register Icons -->
              <div class="social-icons">
                <button type="button" class="social-btn" title="Register with Google" aria-label="Google">
                  ${icons.google}
                </button>
                <button type="button" class="social-btn" title="Register with Facebook" aria-label="Facebook">
                  ${icons.facebook}
                </button>
                <button type="button" class="social-btn" title="Register with GitHub" aria-label="GitHub">
                  ${icons.github}
                </button>
                <button type="button" class="social-btn" title="Register with LinkedIn" aria-label="LinkedIn">
                  ${icons.linkedin}
                </button>
              </div>
            </form>
          </div>

          <!-- 3. Toggle-Box Overlay with 300% Width Pill Shape -->
          <div class="toggle-box" aria-hidden="true">
            <!-- Sliding Pill Layer -->
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
      </main>
    </div>
  `;
}

/**
 * Attaches event listeners and handles sliding transitions for AuthPage.
 */
export function initAuthPage(initialMode: 'login' | 'register' = 'login'): void {
  const container = document.getElementById('auth-container');
  const registerToggleBtn = document.getElementById('register-toggle-btn');
  const loginToggleBtn = document.getElementById('login-toggle-btn');
  const backHomeBtn = document.getElementById('auth-back-home');

  if (!container) return;

  // Set initial state according to requested mode
  if (initialMode === 'register') {
    container.classList.add('active');
  } else {
    container.classList.remove('active');
  }

  // Handle Switch to Registration
  registerToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    container.classList.add('active');
    // Update URL hash without reload
    history.replaceState(null, '', '#register');
  });

  // Handle Switch to Login
  loginToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    container.classList.remove('active');
    // Update URL hash without reload
    history.replaceState(null, '', '#login');
  });

  // Back to home button
  backHomeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '';
  });

  // Wire demo form submissions with subtle feedback -> redirect to Designer Dashboard
  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login-submit') as HTMLButtonElement | null;
    if (btn) {
      btn.innerHTML = `<span>Authenticating...</span>`;
      btn.style.opacity = '0.7';
      setTimeout(() => {
        btn.innerHTML = `<span>Welcome! Entering Studio...</span>`;
        btn.style.background = 'linear-gradient(135deg, #2F7BE5, #1d4ed8)';
        setTimeout(() => {
          window.location.hash = '#dashboard';
        }, 500);
      }, 700);
    } else {
      window.location.hash = '#dashboard';
    }
  });

  const registerForm = document.getElementById('register-form');
  registerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-register-submit') as HTMLButtonElement | null;
    if (btn) {
      btn.innerHTML = `<span>Creating Studio Profile...</span>`;
      btn.style.opacity = '0.7';
      setTimeout(() => {
        btn.innerHTML = `<span>Profile Created! Entering...</span>`;
        btn.style.background = 'linear-gradient(135deg, #2F7BE5, #1d4ed8)';
        setTimeout(() => {
          window.location.hash = '#dashboard';
        }, 500);
      }, 700);
    } else {
      window.location.hash = '#dashboard';
    }
  });

  // Social buttons quick demo redirect to dashboard
  container.querySelectorAll('.social-btn').forEach((sbtn) => {
    sbtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#dashboard';
    });
  });
}
