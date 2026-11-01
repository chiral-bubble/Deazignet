/**
 * Navbar — Transparent over the hero, switches to solid white after scrolling past.
 * Reflects logged-in vs logged-out state:
 * - Logged out: How It Works, Explore, Login (#login), Let's Get Started (#signup)
 * - Logged in: How It Works, Explore, Go to dashboard (#dashboard or #my-projects) + Avatar Menu
 */

import { getAuthState, subscribeToAuth, logOut } from '../services/authService';

export function initNavbar(container: HTMLElement): void {
  const nav = document.createElement('header');
  nav.className = 'navbar navbar--transparent';
  nav.id = 'navbar';

  function renderNavContent() {
    const authState = getAuthState();
    const user = authState.user;

    const dashboardRoute = user?.role === 'client' ? '#client-dashboard' : '#dashboard';

    nav.innerHTML = `
      <div class="navbar__inner">
        <a href="/" class="navbar__logo" id="navbar-logo">
          <svg class="navbar__logo-icon" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="currentColor" fill-opacity="0.15"/>
            <path d="M10 26V10h5.5c2 0 3.5.5 4.5 1.5s1.5 2.3 1.5 4-.5 3-1.5 4-2.5 1.5-4.5 1.5H14v5h-4z" fill="currentColor"/>
            <path d="M18 17l8 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          Dezignet
        </a>
        <div class="navbar__actions">
          <a href="#how-it-works" class="navbar__link" id="nav-how-it-works">How It Works</a>
          <a href="#explore" class="navbar__link" id="nav-explore">Explore</a>
          
          ${user ? `
            <a href="${dashboardRoute}" class="btn btn--sm navbar__cta" id="nav-goto-dashboard" style="display: inline-flex; align-items: center; gap: 8px;">
              Go to dashboard
            </a>
            <div class="nav-user-avatar-wrap" style="position: relative; display: inline-block;">
              <button id="btn-nav-avatar" style="width: 34px; height: 34px; border-radius: 50%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                ${user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'U'}
              </button>
              <div id="nav-avatar-menu" style="display: none; position: absolute; right: 0; top: 42px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); width: 180px; z-index: 100; padding: 6px 0;">
                <div style="padding: 8px 14px; border-bottom: 1px solid #F1F5F9; font-size: 12px;">
                  <div style="font-weight: 600; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.fullName}</div>
                  <div style="color: #64748B; font-size: 11px; text-transform: capitalize;">${user.role}</div>
                </div>
                <a href="${user.role === 'client' ? '#my-projects' : '#settings'}" style="display: block; padding: 8px 14px; font-size: 13px; color: #334155; text-decoration: none;">Account Settings</a>
                <a href="mailto:support@dezignet.studio" style="display: block; padding: 8px 14px; font-size: 13px; color: #334155; text-decoration: none;">Help</a>
                <div style="border-top: 1px solid #F1F5F9; margin-top: 4px;">
                  <button id="btn-nav-logout" style="width: 100%; text-align: left; padding: 8px 14px; font-size: 13px; color: #DC2626; background: none; border: none; cursor: pointer;">
                    Log out
                  </button>
                </div>
              </div>
            </div>
          ` : `
            <a href="#login" class="navbar__link" id="nav-login">Login</a>
            <a href="#signup" class="btn btn--sm navbar__cta" id="nav-cta">Let's Get Started</a>
          `}
        </div>
      </div>
    `;

    // Logo click returns to landing top
    const logo = nav.querySelector('#navbar-logo') as HTMLAnchorElement | null;
    logo?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.location.hash) {
        window.location.hash = '';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Avatar Menu toggle
    const avatarBtn = nav.querySelector('#btn-nav-avatar');
    const avatarMenu = nav.querySelector('#nav-avatar-menu') as HTMLElement | null;
    avatarBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (avatarMenu) {
        avatarMenu.style.display = avatarMenu.style.display === 'block' ? 'none' : 'block';
      }
    });

    // Close avatar menu on document click
    document.addEventListener('click', () => {
      if (avatarMenu) avatarMenu.style.display = 'none';
    });

    // Logout button click
    const logoutBtn = nav.querySelector('#btn-nav-logout');
    logoutBtn?.addEventListener('click', async () => {
      await logOut();
      window.location.hash = '';
    });
  }

  container.appendChild(nav);
  renderNavContent();

  // Re-render when auth changes
  subscribeToAuth(() => {
    renderNavContent();
  });

  // Scroll listener for navbar state
  let isTransparent = true;

  function updateNavbar() {
    const heroWrapper = document.getElementById('hero-wrapper');
    if (!heroWrapper || heroWrapper.offsetParent === null) return;

    const heroBottom = heroWrapper.offsetTop + heroWrapper.offsetHeight;
    const scrollY = window.scrollY;
    const shouldBeTransparent = scrollY < heroBottom - window.innerHeight * 0.5;

    if (shouldBeTransparent && !isTransparent) {
      nav.classList.remove('navbar--solid');
      nav.classList.add('navbar--transparent');
      isTransparent = true;
    } else if (!shouldBeTransparent && isTransparent) {
      nav.classList.remove('navbar--transparent');
      nav.classList.add('navbar--solid');
      isTransparent = false;
    }
  }

  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();
}
