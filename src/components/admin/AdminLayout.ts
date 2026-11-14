/**
 * AdminLayout.ts
 * Main Shell and Navigation for Dezignet Administration Console (/admin)
 * Orchestrates sidebar navigation, top executive status bar, MFA indicators, and section routing.
 */

import { getEffectiveAdminRole, isReauthRequired } from '../../services/adminConsoleService';
import { renderOverviewSection } from './OverviewSection';
import { renderUsersSection } from './UsersSection';
import { renderProjectsSection } from './ProjectsSection';
import { renderModerationSection } from './ModerationSection';
import { renderCredentialsSection } from './CredentialsSection';
import { renderDisputesSection } from './DisputesSection';
import { renderFinancialSection } from './FinancialSection';
import { renderPlansFeesSection } from './PlansFeesSection';
import { renderPromotionsSection } from './PromotionsSection';
import { renderAnalyticsSection } from './AnalyticsSection';
import { renderSupportSection } from './SupportSection';
import { renderRolesAuditSection } from './RolesAuditSection';
import { logOut } from '../../services/authService';

export type AdminSectionKey =
  | 'overview'
  | 'users'
  | 'projects'
  | 'moderation'
  | 'credentials'
  | 'disputes'
  | 'financial'
  | 'plans-fees'
  | 'promotions'
  | 'analytics'
  | 'support'
  | 'roles-audit';

export interface AdminNavTab {
  key: AdminSectionKey;
  label: string;
  badge?: string;
  iconSvg: string;
}

export const ADMIN_NAV_TABS: AdminNavTab[] = [
  {
    key: 'overview',
    label: 'Overview',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`
  },
  {
    key: 'users',
    label: 'Users & Safety',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
  },
  {
    key: 'projects',
    label: 'Projects',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
  },
  {
    key: 'moderation',
    label: 'Reports & Moderation',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
  },
  {
    key: 'credentials',
    label: 'Credentials Queue',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`
  },
  {
    key: 'disputes',
    label: 'Dispute Console',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
  },
  {
    key: 'financial',
    label: 'Refunds & Financial',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`
  },
  {
    key: 'plans-fees',
    label: 'Plans & Fees',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`
  },
  {
    key: 'promotions',
    label: 'Promotions',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`
  },
  {
    key: 'analytics',
    label: 'Analytics',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`
  },
  {
    key: 'support',
    label: 'Support Tickets',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`
  },
  {
    key: 'roles-audit',
    label: 'Roles & Audit Log',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
  }
];

export function renderAdminLayout(container: HTMLElement, initialSection: AdminSectionKey = 'overview'): void {
  const role = getEffectiveAdminRole();
  const reauthNeeded = isReauthRequired();

  container.innerHTML = `
    <div style="min-height: 100vh; background: #F8FAFC; font-family: Inter, sans-serif; color: #0F172A; display: flex; flex-direction: column;">
      <!-- Top Executive Bar -->
      <header style="background: #FFFFFF; border-bottom: 1px solid #E2E8F0; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <a href="/" style="display: flex; align-items: center; gap: 8px; font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #0F172A; text-decoration: none;">
            <img src="/logo.png" alt="Dezignet" style="width: 28px; height: 28px; border-radius: 6px; object-fit: contain;" />
            Dezignet
          </a>
          <span style="background: #0F172A; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
            Admin Console
          </span>
          <span style="background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
            ${role}
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 14px;">
          <!-- MFA Status Badge -->
          <div style="display: flex; align-items: center; gap: 6px; background: #F1F5F9; border: 1px solid #E2E8F0; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${reauthNeeded ? '#F59E0B' : '#10B981'}; display: inline-block;"></span>
            <span>MFA Protected (${reauthNeeded ? 'Re-Auth Required' : '15m Session Active'})</span>
          </div>

          <a href="/dashboard" style="font-size: 13px; color: #64748B; text-decoration: none; padding: 6px 12px; border-radius: 6px; border: 1px solid #E2E8F0;">
            Back to App
          </a>

          <button id="admin-signout-btn" style="background: none; border: 1px solid #CBD5E1; color: #0F172A; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer;">
            Sign Out
          </button>
        </div>
      </header>

      <!-- App Body (Sidebar + Content Stage) -->
      <div style="display: flex; flex: 1;">
        <!-- Left Sidebar Navigation -->
        <aside style="width: 260px; background: #FFFFFF; border-right: 1px solid #E2E8F0; padding: 20px 12px; flex-shrink: 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94A3B8; letter-spacing: 0.5px; padding: 0 12px 10px;">
            Platform Control
          </div>
          <nav style="display: flex; flex-direction: column; gap: 4px;">
            ${ADMIN_NAV_TABS.map(tab => `
              <button class="admin-nav-item" data-section="${tab.key}" style="background: none; border: none; width: 100%; text-align: left; padding: 10px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; color: #475569; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.15s ease;">
                <span style="display: flex; align-items: center; justify-content: center; width: 20px; color: #64748B;">
                  ${tab.iconSvg}
                </span>
                <span>${tab.label}</span>
              </button>
            `).join('')}
          </nav>
        </aside>

        <!-- Main Workspace Stage -->
        <main id="admin-main-stage" style="flex: 1; padding: 0 32px 48px; max-width: 1400px; width: 100%; box-sizing: border-box;">
          <!-- Active Section Content Injected Here -->
        </main>
      </div>
    </div>
  `;

  const mainStage = container.querySelector('#admin-main-stage') as HTMLElement;
  const navButtons = container.querySelectorAll('.admin-nav-item');
  const btnSignout = container.querySelector('#admin-signout-btn') as HTMLButtonElement;

  btnSignout.addEventListener('click', async () => {
    await logOut();
    window.location.href = '/login';
  });

  async function switchSection(key: AdminSectionKey) {
    navButtons.forEach(b => {
      const isCurrent = b.getAttribute('data-section') === key;
      (b as HTMLElement).style.background = isCurrent ? '#EFF6FF' : 'none';
      (b as HTMLElement).style.color = isCurrent ? '#2563EB' : '#475569';
      (b as HTMLElement).style.fontWeight = isCurrent ? '600' : '500';
      const iconSpan = (b as HTMLElement).querySelector('span');
      if (iconSpan) iconSpan.style.color = isCurrent ? '#2563EB' : '#64748B';
    });

    mainStage.innerHTML = '<div style="text-align: center; padding: 60px; color: #64748B;">Loading section...</div>';

    switch (key) {
      case 'overview':
        await renderOverviewSection(mainStage);
        break;
      case 'users':
        await renderUsersSection(mainStage);
        break;
      case 'projects':
        await renderProjectsSection(mainStage);
        break;
      case 'moderation':
        await renderModerationSection(mainStage);
        break;
      case 'credentials':
        await renderCredentialsSection(mainStage);
        break;
      case 'disputes':
        await renderDisputesSection(mainStage);
        break;
      case 'financial':
        await renderFinancialSection(mainStage);
        break;
      case 'plans-fees':
        await renderPlansFeesSection(mainStage);
        break;
      case 'promotions':
        await renderPromotionsSection(mainStage);
        break;
      case 'analytics':
        await renderAnalyticsSection(mainStage);
        break;
      case 'support':
        await renderSupportSection(mainStage);
        break;
      case 'roles-audit':
        await renderRolesAuditSection(mainStage);
        break;
    }
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-section') as AdminSectionKey;
      switchSection(target);
    });
  });

  switchSection(initialSection);
}
