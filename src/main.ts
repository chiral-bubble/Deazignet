/**
 * Dezignet Main Entry Point
 * Full Browser History Routing Engine with Hash Redirect Fallback,
 * Role Guards, Staging Banner, Tester Controls, Admin Area, and Error Boundary.
 */

import './style.css';
import { initNavbar } from './components/navbar';
import { initHeroScroll } from './components/heroScroll';
import { initPageSections } from './components/pageSections';
import { initAuthPage } from './components/auth/AuthPage';
import { initDesignerApp } from './components/designer/DesignerApp';
import { renderLegalPage } from './components/legal/LegalPage';
import { renderLinkAuditPage } from './components/dev/LinkAuditPage';
import { renderClientDashboardPage } from './components/client/ClientDashboardPage';
import { renderMyProjectsPage } from './components/client/MyProjectsPage';
import { renderPostProjectWizard } from './components/client/PostProjectWizard';
import { renderClientProjectDetailsPage } from './components/client/ClientProjectDetailsPage';
import { renderCompareProposalsView } from './components/client/proposals/CompareProposalsView';
import { renderProposalDetailPage } from './components/client/proposals/ProposalDetailPage';
import { renderClientComingSoonPage, renderClientShell, initClientShell } from './components/client/ClientLayout';
import { renderClientAccountSettings } from './components/client/ClientAccountSettings';
import { renderClientPaymentsPage } from './components/client/ClientPaymentsPage';
import { renderHelpSupportPage } from './components/client/HelpSupportPage';
import { renderConversationsLayout, initConversations } from './components/designer/conversations/ConversationsLayout';
import { renderAdminPage } from './components/admin/AdminPage';
import { renderFeedbackTriggerButton, initFeedbackModal } from './components/common/FeedbackModal';
import { renderTesterControlsTrigger, initTesterControls } from './components/common/TesterControls';
import { getEnvironment, isTester } from './services/stagingService';
import { initAuth, getAuthState, subscribeToAuth, logOut } from './services/authService';
import { USE_MOCKS } from './lib/supabase';
import { logClientError } from './lib/errorLogger';

/**
 * Global navigation helper using HTML5 History API
 */
export function navigateTo(url: string): void {
  if (url.startsWith('#')) {
    const clean = url.replace(/^#\/?/, '/');
    window.history.pushState(null, '', clean);
  } else {
    window.history.pushState(null, '', url);
  }
  window.dispatchEvent(new Event('popstate'));
}

async function main() {
  const app = document.querySelector<HTMLDivElement>('#app')!;

  // Global Error Boundary container
  const errorBoundaryContainer = document.createElement('div');
  errorBoundaryContainer.id = 'error-boundary-view';
  errorBoundaryContainer.style.display = 'none';
  app.appendChild(errorBoundaryContainer);

  function showError(err: Error | string) {
    const message = typeof err === 'string' ? err : err?.message || 'An unexpected application error occurred.';
    logClientError(message, 'ErrorBoundary');
    errorBoundaryContainer.style.display = 'block';
    errorBoundaryContainer.innerHTML = `
      <div style="min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: Inter, sans-serif;">
        <div style="max-width: 480px; width: 100%; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 36px 32px; text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #FEF2F2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">Something went wrong</h1>
          <p style="font-size: 14px; color: #64748B; line-height: 1.5; margin: 0 0 24px;">
            We've logged this issue. Please try refreshing or return home.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="btn-err-retry" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 500; padding: 10px 18px; border-radius: 6px; cursor: pointer;">
              Retry
            </button>
            <a href="/" style="display: inline-block; background: #FFFFFF; border: 1px solid #E5E7EB; color: #0F172A; font-size: 13px; font-weight: 500; padding: 9px 18px; border-radius: 6px; text-decoration: none;">
              Go Home
            </a>
          </div>
        </div>
      </div>
    `;
    document.getElementById('btn-err-retry')?.addEventListener('click', () => {
      errorBoundaryContainer.style.display = 'none';
      handleRoute();
    });
  }

  window.addEventListener('error', (event) => {
    logClientError(event.error || event.message, 'window.onerror');
  });

  window.addEventListener('unhandledrejection', (event) => {
    logClientError(event.reason, 'window.onunhandledrejection');
  });

  // 1. Create Staging Banner Host (top of screen)
  const stagingBannerHost = document.createElement('div');
  stagingBannerHost.id = 'staging-banner-host';
  document.body.insertBefore(stagingBannerHost, document.body.firstChild);

  // 2. View Containers
  const landingContainer = document.createElement('div');
  landingContainer.id = 'landing-view';
  app.appendChild(landingContainer);

  const authContainer = document.createElement('div');
  authContainer.id = 'auth-view';
  authContainer.style.display = 'none';
  app.appendChild(authContainer);

  const dashboardContainer = document.createElement('div');
  dashboardContainer.id = 'dashboard-view';
  dashboardContainer.style.display = 'none';
  app.appendChild(dashboardContainer);

  const clientContainer = document.createElement('div');
  clientContainer.id = 'client-view';
  clientContainer.style.display = 'none';
  app.appendChild(clientContainer);

  const adminContainer = document.createElement('div');
  adminContainer.id = 'admin-view';
  adminContainer.style.display = 'none';
  app.appendChild(adminContainer);

  const legalContainer = document.createElement('div');
  legalContainer.id = 'legal-view';
  legalContainer.style.display = 'none';
  app.appendChild(legalContainer);

  const accessDeniedContainer = document.createElement('div');
  accessDeniedContainer.id = 'access-denied-view';
  accessDeniedContainer.style.display = 'none';
  app.appendChild(accessDeniedContainer);

  const notFoundContainer = document.createElement('div');
  notFoundContainer.id = 'not-found-view';
  notFoundContainer.style.display = 'none';
  app.appendChild(notFoundContainer);

  // 3. Floating Tester Bar (bottom-right)
  const testerDock = document.createElement('div');
  testerDock.id = 'tester-floating-dock';
  testerDock.style.cssText = 'position: fixed; bottom: 20px; right: 24px; z-index: 998; display: flex; align-items: center; gap: 10px; font-family: Inter, sans-serif;';
  document.body.appendChild(testerDock);

  function renderAccessDeniedView(role: string | null) {
    const isClient = role === 'client';
    accessDeniedContainer.innerHTML = `
      <div style="min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: Inter, sans-serif;">
        <div style="max-width: 480px; width: 100%; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 36px 32px; text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #FEF2F2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">Access Restricted</h1>
          <p style="font-size: 14px; color: #64748B; line-height: 1.5; margin: 0 0 24px;">
            Your account does not have authorization to view this area.
          </p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <a href="${isClient ? '/my-projects' : '/dashboard'}" style="display: inline-block; width: 100%; box-sizing: border-box; background: #2F7BE5; color: #FFFFFF; font-size: 14px; font-weight: 500; padding: 10px 16px; border-radius: 6px; text-decoration: none;">
              ${isClient ? 'Return to My Projects' : 'Return to Dashboard'}
            </a>
            <button id="btn-access-denied-logout" style="background: none; border: 1px solid #E5E7EB; color: #475569; font-size: 14px; font-weight: 500; padding: 9px 16px; border-radius: 6px; cursor: pointer;">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-access-denied-logout')?.addEventListener('click', async () => {
      await logOut();
      navigateTo('/login');
    });
  }

  function renderNotFoundView(role: string | null) {
    const isClient = role === 'client';
    const isDesigner = role === 'designer';
    const homeUrl = isClient ? '/my-projects' : isDesigner ? '/dashboard' : '/';
    const homeLabel = isClient ? 'Go to My Projects' : isDesigner ? 'Go to Dashboard' : 'Go to Homepage';

    notFoundContainer.innerHTML = `
      <div style="min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: Inter, sans-serif;">
        <div style="max-width: 480px; width: 100%; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 36px 32px; text-align: center;">
          <div style="font-size: 32px; font-weight: 700; color: #94A3B8; margin-bottom: 8px;">404</div>
          <h1 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">Page not found</h1>
          <p style="font-size: 14px; color: #64748B; line-height: 1.5; margin: 0 0 24px;">
            The page you requested does not exist or may have been relocated.
          </p>
          <a href="${homeUrl}" style="display: inline-block; background: #2F7BE5; color: #FFFFFF; font-size: 14px; font-weight: 500; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
            ${homeLabel}
          </a>
        </div>
      </div>
    `;
  }

  // Build Landing Base
  initNavbar(document.body);
  initHeroScroll(landingContainer);
  initPageSections(landingContainer);

  let dashboardInitialized = false;

  // Initialize Auth
  await initAuth();

  // Environment & Staging Banner Setup
  const env = await getEnvironment();
  if (env === 'staging') {
    stagingBannerHost.innerHTML = `
      <div style="background: #FFFBEB; border-bottom: 1px solid #FDE68A; color: #92400E; padding: 8px 16px; font-size: 12.5px; font-weight: 500; text-align: center; font-family: Inter, sans-serif; position: relative; z-index: 1001;">
        <span><strong>Test environment</strong> — Payments and emails are simulated. Please use test data only.</span>
      </div>
    `;

    // Initialize Tester UI
    const testerActive = await isTester();
    if (testerActive) {
      testerDock.innerHTML = `
        ${renderFeedbackTriggerButton()}
        ${renderTesterControlsTrigger()}
      `;
      initFeedbackModal();
      initTesterControls();
    }
  }

  // Intercept all internal anchor clicks for clean SPA navigation
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;
    const href = target.getAttribute('href');
    if (!href) return;

    // External link or anchor jump on landing
    if (href.startsWith('http://') || href.startsWith('https://') || target.target === '_blank') return;
    if (href.startsWith('#section-') || href === '#') return;

    // Legacy hash format href="#path" -> clean SPA navigation
    if (href.startsWith('#/')) {
      e.preventDefault();
      navigateTo(href.replace(/^#/, ''));
      return;
    }
    if (href.startsWith('#')) {
      e.preventDefault();
      navigateTo('/' + href.slice(1));
      return;
    }

    // Path link href="/path"
    if (href.startsWith('/')) {
      e.preventDefault();
      navigateTo(href);
    }
  });

  /**
   * Main Browser History Routing Handler
   */
  function handleRoute(): void {
    try {
      // 1. Hash redirect: If user arrives with /#path, convert to /path
      if (window.location.hash && !window.location.hash.startsWith('#section-')) {
        const hashTarget = window.location.hash.replace(/^#\/?/, '/');
        window.history.replaceState(null, '', hashTarget);
      }

      const pathname = window.location.pathname.toLowerCase();
      const search = window.location.search;
      const urlParams = new URLSearchParams(search);
      const navbar = document.getElementById('navbar');
      const authState = getAuthState();

      // Reset all view containers
      landingContainer.style.display = 'none';
      authContainer.style.display = 'none';
      dashboardContainer.style.display = 'none';
      clientContainer.style.display = 'none';
      adminContainer.style.display = 'none';
      legalContainer.style.display = 'none';
      accessDeniedContainer.style.display = 'none';
      notFoundContainer.style.display = 'none';
      errorBoundaryContainer.style.display = 'none';

      // --------------------------------------------------------------------------
      // Route: Administration (/admin)
      // --------------------------------------------------------------------------
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        document.title = 'Dezignet | Administration';
        if (navbar) navbar.style.display = 'none';

        if (!USE_MOCKS.auth && !authState.user) {
          navigateTo(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }

        if (authState.role !== 'admin') {
          renderAccessDeniedView(authState.role);
          accessDeniedContainer.style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'instant' });
          return;
        }

        adminContainer.style.display = 'block';
        renderAdminPage(adminContainer);
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      // --------------------------------------------------------------------------
      // Route: Legal & Dev Audit (/terms, /privacy, /dev/link-audit)
      // --------------------------------------------------------------------------
      if (pathname === '/terms' || pathname === '/privacy') {
        document.title = pathname === '/terms' ? 'Dezignet | Terms of Service' : 'Dezignet | Privacy Policy';
        legalContainer.style.display = 'block';
        legalContainer.innerHTML = renderLegalPage(pathname === '/terms' ? 'terms' : 'privacy');
        if (navbar) navbar.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      if (pathname === '/dev/link-audit') {
        document.title = 'Dezignet | Link Audit';
        legalContainer.style.display = 'block';
        legalContainer.innerHTML = renderLinkAuditPage();
        if (navbar) navbar.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      // --------------------------------------------------------------------------
      // Route: Client Workspace Routes
      // --------------------------------------------------------------------------
      const isClientPath =
        pathname === '/client-dashboard' ||
        (pathname === '/dashboard' && authState.role === 'client') ||
        pathname === '/my-projects' ||
        pathname.startsWith('/post-project') ||
        pathname.startsWith('/project-details') ||
        pathname.startsWith('/compare-proposals') ||
        pathname.startsWith('/proposal-detail') ||
        pathname === '/find-designers' ||
        (pathname === '/payments' && authState.role === 'client') ||
        (pathname === '/settings' && authState.role === 'client') ||
        (pathname === '/help' && authState.role === 'client') ||
        (pathname === '/help-support' && authState.role === 'client') ||
        (pathname.startsWith('/conversations') && authState.role === 'client');

      if (isClientPath) {
        if (!USE_MOCKS.auth && !authState.user) {
          navigateTo(`/login?redirect=${encodeURIComponent(pathname + search)}`);
          return;
        }

        clientContainer.style.display = 'block';
        if (navbar) navbar.style.display = 'none';
        const lingeringHeroDots = document.getElementById('hero-progress');
        if (lingeringHeroDots) lingeringHeroDots.remove();

        const projectId = urlParams.get('id') || undefined;

        if (pathname === '/client-dashboard' || (pathname === '/dashboard' && authState.role === 'client')) {
          document.title = 'Dezignet | Client Dashboard';
          renderClientDashboardPage(clientContainer);
        } else if (pathname.startsWith('/compare-proposals')) {
          document.title = 'Dezignet | Compare Proposals';
          const pId = urlParams.get('projectId') || '';
          const ids = (urlParams.get('ids') || '').split(',').filter(Boolean);
          renderCompareProposalsView(clientContainer, pId, ids);
        } else if (pathname.startsWith('/proposal-detail')) {
          document.title = 'Dezignet | Proposal Details';
          const propId = urlParams.get('id') || '';
          renderProposalDetailPage(clientContainer, propId);
        } else if (pathname.startsWith('/post-project')) {
          document.title = 'Dezignet | Post Project';
          renderPostProjectWizard(clientContainer, projectId);
        } else if (pathname.startsWith('/project-details') && projectId) {
          document.title = 'Dezignet | Project Details';
          const tab = urlParams.get('tab') || undefined;
          renderClientProjectDetailsPage(clientContainer, projectId, tab);
        } else if (pathname === '/find-designers') {
          document.title = 'Dezignet | Find Designers';
          renderClientComingSoonPage(clientContainer, 'Find Designers', 'find-designers', 'Search and match with licensed architectural and interior designers.');
        } else if (pathname === '/payments') {
          document.title = 'Dezignet | Payments & Escrow';
          renderClientPaymentsPage(clientContainer);
        } else if (pathname === '/settings') {
          document.title = 'Dezignet | Account Settings';
          renderClientAccountSettings(clientContainer);
        } else if (pathname === '/help' || pathname === '/help-support') {
          document.title = 'Dezignet | Help & Support';
          renderHelpSupportPage(clientContainer);
        } else if (pathname.startsWith('/conversations')) {
          document.title = 'Dezignet | Conversations';
          const convId = pathname.split('/')[2] || undefined;
          clientContainer.innerHTML = renderClientShell(
            { activeTab: 'conversations', pageTitle: 'Conversations' },
            renderConversationsLayout()
          );
          initClientShell(clientContainer);
          initConversations(
            clientContainer,
            { onShowToast: (title, msg) => alert(`${title}: ${msg}`) },
            convId
          );
        } else {
          document.title = 'Dezignet | My Projects';
          renderMyProjectsPage(clientContainer);
        }

        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      // --------------------------------------------------------------------------
      // Route: Designer Studio Routes
      // --------------------------------------------------------------------------
      const isDesignerPath =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/my-work') ||
        pathname.startsWith('/notifications') ||
        pathname.startsWith('/payments') ||
        pathname.startsWith('/billing') ||
        pathname.startsWith('/proposals') ||
        pathname.startsWith('/my-proposals') ||
        pathname.startsWith('/conversations') ||
        pathname.startsWith('/active-projects') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/help');

      const isSharedDashboardPath =
        pathname.startsWith('/client-projects') ||
        pathname.startsWith('/projects') ||
        pathname.startsWith('/designers') ||
        pathname.startsWith('/profile');

      if (isDesignerPath || isSharedDashboardPath) {
        if (!USE_MOCKS.auth && !authState.user) {
          navigateTo(`/login?redirect=${encodeURIComponent(pathname + search)}`);
          return;
        }

        if (!USE_MOCKS.auth && isDesignerPath && authState.role !== 'designer' && authState.role !== 'admin') {
          if (navbar) navbar.style.display = 'none';
          renderAccessDeniedView(authState.role);
          accessDeniedContainer.style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'instant' });
          return;
        }

        document.title = 'Dezignet | Designer Studio';
        dashboardContainer.style.display = 'block';
        if (navbar) navbar.style.display = 'none';
        const lingeringHeroDots = document.getElementById('hero-progress');
        if (lingeringHeroDots) lingeringHeroDots.remove();

        if (!dashboardInitialized) {
          initDesignerApp(async () => {
            await logOut();
            navigateTo('/');
          });
          dashboardInitialized = true;
        }

        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      // --------------------------------------------------------------------------
      // Route: Authentication (/login, /register, /signup, /reset-password)
      // --------------------------------------------------------------------------
      if (
        pathname === '/login' ||
        pathname === '/register' ||
        pathname === '/signup' ||
        pathname === '/auth' ||
        pathname === '/reset-password'
      ) {
        document.title = pathname === '/reset-password' ? 'Dezignet | Reset Password' : 'Dezignet | Sign In';
        authContainer.style.display = 'block';
        if (navbar) navbar.style.display = 'none';

        let mode: 'login' | 'register' | 'reset-password' = 'login';
        if (pathname === '/register' || pathname === '/signup') mode = 'register';
        if (pathname === '/reset-password') mode = 'reset-password';

        initAuthPage(mode);
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      // --------------------------------------------------------------------------
      // Route: Landing Homepage (/)
      // --------------------------------------------------------------------------
      if (pathname === '/' || pathname === '') {
        document.title = 'Dezignet — Architectural & Interior Design Platform';
        landingContainer.style.display = 'block';
        if (navbar) navbar.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      // --------------------------------------------------------------------------
      // Fallback: 404 Not Found
      // --------------------------------------------------------------------------
      document.title = 'Dezignet | Page Not Found';
      if (navbar) navbar.style.display = 'flex';
      renderNotFoundView(authState.role);
      notFoundContainer.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'instant' });

    } catch (err: any) {
      showError(err);
    }
  }

  window.addEventListener('popstate', handleRoute);

  // Guard against unnecessary route remounts on token refresh or window focus
  let lastAuthUserId: string | null = null;
  let lastAuthRole: string | null = null;

  subscribeToAuth((state) => {
    const currentUserId = state.user?.id || null;
    const currentRole = state.role || null;
    if (currentUserId !== lastAuthUserId || currentRole !== lastAuthRole) {
      lastAuthUserId = currentUserId;
      lastAuthRole = currentRole;
      handleRoute();
    }
  });

  // Initial Route Load
  handleRoute();
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    main().catch(console.error);
  });
} else {
  main().catch(console.error);
}
