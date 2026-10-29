/**
 * Dezignet — Landing Page & App Entry Point
 *
 * Initializes:
 * 1. Navbar (transparent → solid transition)
 * 2. Hero scroll-scrubbed frame sequence with text chapters
 * 3. Page sections (How It Works, Manage Projects, Explore, Testimonials, FAQ, Footer)
 * 4. Auth Page (Double-slider Login, Registration, Password Reset)
 * 5. Architectural Designer Dashboard with Route Guards & Session Handling
 */

import './style.css';
import { initNavbar } from './components/navbar';
import { initHeroScroll } from './components/heroScroll';
import { initPageSections } from './components/pageSections';
import { renderAuthPage, initAuthPage } from './components/auth/AuthPage';
import { renderDesignerApp, initDesignerApp } from './components/designer/DesignerApp';
import { initAuth, getAuthState, subscribeToAuth, logOut } from './services/authService';
import { USE_MOCKS } from './lib/supabase';

async function main(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  // 1. Create container for landing page view
  const landingContainer = document.createElement('div');
  landingContainer.id = 'landing-view';
  app.appendChild(landingContainer);

  // 2. Create container for auth page view
  const authContainer = document.createElement('div');
  authContainer.id = 'auth-view';
  authContainer.innerHTML = renderAuthPage();
  authContainer.style.display = 'none';
  app.appendChild(authContainer);

  // 3. Create container for designer dashboard view
  const dashboardContainer = document.createElement('div');
  dashboardContainer.id = 'dashboard-view';
  dashboardContainer.innerHTML = renderDesignerApp();
  dashboardContainer.style.display = 'none';
  app.appendChild(dashboardContainer);

  // 4. Create container for Role-Based Access Denied View
  const accessDeniedContainer = document.createElement('div');
  accessDeniedContainer.id = 'access-denied-view';
  accessDeniedContainer.style.display = 'none';
  accessDeniedContainer.innerHTML = `
    <div style="min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: Inter, sans-serif;">
      <div style="max-width: 480px; width: 100%; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 36px 32px; text-align: center;">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: #FEF2F2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h1 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">You don't have access</h1>
        <p style="font-size: 14px; color: #64748B; line-height: 1.5; margin: 0 0 24px;">
          This studio section is restricted to registered designers and architects. Your current account does not have authorization to view this workspace.
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="#client-projects" style="display: inline-block; width: 100%; box-sizing: border-box; background: #2F7BE5; color: #FFFFFF; font-size: 14px; font-weight: 500; padding: 10px 16px; border-radius: 6px; text-decoration: none;">
            Browse Client Projects
          </a>
          <button id="btn-access-denied-logout" style="background: none; border: 1px solid #E5E7EB; color: #475569; font-size: 14px; font-weight: 500; padding: 9px 16px; border-radius: 6px; cursor: pointer;">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  `;
  app.appendChild(accessDeniedContainer);

  document.getElementById('btn-access-denied-logout')?.addEventListener('click', async () => {
    await logOut();
    window.location.hash = '#login';
  });

  // 5. Build landing page
  initNavbar(document.body);
  initHeroScroll(landingContainer);
  initPageSections(landingContainer);

  let dashboardInitialized = false;

  // Initialize Auth state
  await initAuth();

  // 6. Client-side hash router with role guards
  function handleRoute(): void {
    const rawHash = window.location.hash.toLowerCase();
    const cleanHash = rawHash.split('?')[0];
    const navbar = document.getElementById('navbar');
    const authState = getAuthState();

    // Hide all main containers first
    landingContainer.style.display = 'none';
    authContainer.style.display = 'none';
    dashboardContainer.style.display = 'none';
    accessDeniedContainer.style.display = 'none';

    // Designer-only routes definition
    const isDesignerRoute =
      cleanHash.startsWith('#dashboard') ||
      cleanHash.startsWith('#my-work') ||
      cleanHash.startsWith('#notifications') ||
      cleanHash.startsWith('#payments') ||
      cleanHash.startsWith('#billing') ||
      cleanHash.startsWith('#proposals') ||
      cleanHash.startsWith('#my-proposals') ||
      cleanHash.startsWith('#conversations') ||
      cleanHash.startsWith('#active-projects') ||
      cleanHash.startsWith('#settings');

    // Marketplace / Shared Designer App views (e.g. Talent search, Public Profile, Client Projects)
    const isSharedDashboardRoute =
      cleanHash.startsWith('#client-projects') ||
      cleanHash.startsWith('#projects') ||
      cleanHash.startsWith('#/designers') ||
      cleanHash.startsWith('#designers') ||
      cleanHash.startsWith('#profile');

    if (isDesignerRoute || isSharedDashboardRoute) {
      // Route Guard 1: Authentication check
      if (!USE_MOCKS.auth && !authState.user) {
        // Redirect unauthenticated users to login, preserving intended destination
        const redirectParam = encodeURIComponent(window.location.hash);
        window.location.hash = `#login?redirect=${redirectParam}`;
        return;
      }

      // Route Guard 2: Role check for designer-exclusive routes
      if (!USE_MOCKS.auth && isDesignerRoute && authState.role !== 'designer' && authState.role !== 'admin') {
        if (navbar) navbar.style.display = 'none';
        accessDeniedContainer.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      // User is authorized
      dashboardContainer.style.display = 'block';
      if (navbar) navbar.style.display = 'none';
      const lingeringHeroDots = document.getElementById('hero-progress');
      if (lingeringHeroDots) lingeringHeroDots.remove();

      if (!dashboardInitialized) {
        initDesignerApp(async () => {
          await logOut();
          window.location.hash = '';
        });
        dashboardInitialized = true;
      }

      window.scrollTo({ top: 0, behavior: 'instant' });
    } else if (
      cleanHash === '#login' ||
      cleanHash === '#register' ||
      cleanHash === '#auth' ||
      cleanHash === '#signup' ||
      cleanHash === '#reset-password'
    ) {
      authContainer.style.display = 'block';
      if (navbar) navbar.style.display = 'none';

      let mode: 'login' | 'register' | 'reset-password' = 'login';
      if (cleanHash === '#register' || cleanHash === '#signup') mode = 'register';
      if (cleanHash === '#reset-password') mode = 'reset-password';

      initAuthPage(mode);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      landingContainer.style.display = 'block';
      if (navbar) navbar.style.display = 'flex';

      // Scroll to specific section if present (e.g. #how-it-works)
      if (cleanHash && cleanHash !== '#' && cleanHash !== '#/') {
        const targetEl = document.querySelector(cleanHash);
        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        }
      }
    }
  }

  window.addEventListener('hashchange', handleRoute);
  subscribeToAuth(() => {
    handleRoute();
  });

  handleRoute();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    main().catch(console.error);
  });
} else {
  main().catch(console.error);
}
