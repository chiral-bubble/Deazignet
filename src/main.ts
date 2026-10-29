/**
 * Dezignet — Landing Page & App Entry Point
 *
 * Initializes:
 * 1. Navbar (transparent → solid transition)
 * 2. Hero scroll-scrubbed frame sequence with text chapters
 * 3. Page sections (How It Works, Manage Projects, Explore, Testimonials, FAQ, Footer)
 * 4. Auth Page (Double-slider Login & Registration)
 * 5. Architectural Designer Dashboard (Quiet luxury, editorial bento & project management)
 */

import './style.css';
import { initNavbar } from './components/navbar';
import { initHeroScroll } from './components/heroScroll';
import { initPageSections } from './components/pageSections';
import { renderAuthPage, initAuthPage } from './components/auth/AuthPage';
import { renderDesignerApp, initDesignerApp } from './components/designer/DesignerApp';

function main(): void {
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

  // 4. Build landing page
  initNavbar(document.body);
  initHeroScroll(landingContainer);
  initPageSections(landingContainer);

  let dashboardInitialized = false;

  // 5. Client-side hash router
  function handleRoute(): void {
    const rawHash = window.location.hash.toLowerCase();
    const navbar = document.getElementById('navbar');

    if (
      rawHash.startsWith('#dashboard') ||
      rawHash.startsWith('#my-work') ||
      rawHash.startsWith('#notifications') ||
      rawHash.startsWith('#payments') ||
      rawHash.startsWith('#billing') ||
      rawHash.startsWith('#proposals') ||
      rawHash.startsWith('#my-proposals') ||
      rawHash.startsWith('#conversations') ||
      rawHash.startsWith('#client-projects') ||
      rawHash.startsWith('#projects') ||
      rawHash.startsWith('#active-projects') ||
      rawHash.startsWith('#settings') ||
      rawHash.startsWith('#/designers') ||
      rawHash.startsWith('#designers') ||
      rawHash.startsWith('#profile')
    ) {
      landingContainer.style.display = 'none';
      authContainer.style.display = 'none';
      dashboardContainer.style.display = 'block';
      if (navbar) navbar.style.display = 'none';
      const lingeringHeroDots = document.getElementById('hero-progress');
      if (lingeringHeroDots) lingeringHeroDots.remove();

      if (!dashboardInitialized) {
        initDesignerApp(() => {
          // Log out callback: return to landing page
          window.location.hash = '';
        });
        dashboardInitialized = true;
      }

      window.scrollTo({ top: 0, behavior: 'instant' });
    } else if (rawHash === '#login' || rawHash === '#register' || rawHash === '#auth' || rawHash === '#signup') {
      landingContainer.style.display = 'none';
      dashboardContainer.style.display = 'none';
      authContainer.style.display = 'block';
      if (navbar) navbar.style.display = 'none';

      const mode = (rawHash === '#register' || rawHash === '#signup') ? 'register' : 'login';
      initAuthPage(mode);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      authContainer.style.display = 'none';
      dashboardContainer.style.display = 'none';
      landingContainer.style.display = 'block';
      if (navbar) navbar.style.display = 'flex';

      // Scroll to specific section if present (e.g. #how-it-works)
      if (rawHash && rawHash !== '#' && rawHash !== '#/') {
        const targetEl = document.querySelector(rawHash);
        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        }
      }
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
