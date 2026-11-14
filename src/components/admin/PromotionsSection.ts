/**
 * PromotionsSection.ts
 * Designer Promotions & Sponsored Placements CRUD
 * Enforces feature gate behind promotions_enabled app setting (defaults to false).
 */

import {
  adminGetPromotionsEnabled,
  adminTogglePromotionsEnabled,
  adminGetPromotions,
  adminCreatePromotion,
  adminDeletePromotion,
  type PromotionItem
} from '../../services/adminConsoleService';

export async function renderPromotionsSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Designer Marketplace Promotions
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Manage sponsored placements, hero spotlights, and discovery highlights. Gated by feature setting.
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="promo-create-btn" style="background: #2563EB; border: none; color: #FFFFFF; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
            + Create Promotion
          </button>
        </div>
      </div>

      <!-- Feature Flag Toggle Card -->
      <div id="promo-flag-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <strong style="font-size: 15px; color: #0F172A;">Feature Status: <span id="flag-status-text">Checking...</span></strong>
            <span id="flag-badge" style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;"></span>
          </div>
          <p style="font-size: 13px; color: #64748B; margin: 0;">
            Setting key <code>promotions_enabled</code> controls whether sponsored badges and priority placements render in client search.
          </p>
        </div>
        <button id="btn-toggle-flag" style="font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
          Toggle Feature
        </button>
      </div>

      <!-- Promotions List Table -->
      <div id="promotions-table-container" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading promotions...</div>
      </div>
    </div>
  `;

  const flagStatusText = container.querySelector('#flag-status-text') as HTMLElement;
  const flagBadge = container.querySelector('#flag-badge') as HTMLElement;
  const btnToggleFlag = container.querySelector('#btn-toggle-flag') as HTMLButtonElement;
  const tableContainer = container.querySelector('#promotions-table-container') as HTMLElement;
  const btnCreatePromo = container.querySelector('#promo-create-btn') as HTMLButtonElement;

  async function syncFlag() {
    const enabled = await adminGetPromotionsEnabled();
    if (enabled) {
      flagStatusText.textContent = 'Active (Live in Marketplace)';
      flagBadge.textContent = 'Enabled';
      flagBadge.style.background = '#DCFCE7';
      flagBadge.style.color = '#15803D';
      btnToggleFlag.textContent = 'Disable Promotions Feature';
      btnToggleFlag.style.background = '#FEF2F2';
      btnToggleFlag.style.border = '1px solid #FCA5A5';
      btnToggleFlag.style.color = '#DC2626';
    } else {
      flagStatusText.textContent = 'Disabled (Default)';
      flagBadge.textContent = 'Disabled';
      flagBadge.style.background = '#F1F5F9';
      flagBadge.style.color = '#475569';
      btnToggleFlag.textContent = 'Enable Promotions Feature';
      btnToggleFlag.style.background = '#059669';
      btnToggleFlag.style.border = 'none';
      btnToggleFlag.style.color = '#FFFFFF';
    }
  }

  async function loadPromotions() {
    const list: PromotionItem[] = await adminGetPromotions();

    if (list.length === 0) {
      tableContainer.innerHTML = `
        <div style="text-align: center; padding: 48px; color: #64748B;">
          No active or scheduled promotions. Click "+ Create Promotion" to configure sponsored placements.
        </div>
      `;
      return;
    }

    tableContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
        <thead>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-weight: 600;">
            <th style="padding: 12px 16px;">Designer</th>
            <th style="padding: 12px 16px;">Placement</th>
            <th style="padding: 12px 16px;">Label & Campaign</th>
            <th style="padding: 12px 16px;">Duration</th>
            <th style="padding: 12px 16px;">Status</th>
            <th style="padding: 12px 16px; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(p => `
            <tr style="border-bottom: 1px solid #F1F5F9;">
              <td style="padding: 12px 16px;">
                <div style="font-weight: 600; color: #0F172A;">${p.designerName}</div>
                <div style="font-size: 11px; color: #64748B;">${p.designerEmail}</div>
              </td>
              <td style="padding: 12px 16px;">
                <span style="background: #E0F2FE; color: #0369A1; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                  ${p.placement.replace('_', ' ')}
                </span>
              </td>
              <td style="padding: 12px 16px;">
                <div style="font-weight: 500; color: #0F172A;">${p.label || 'Sponsored'}</div>
                ${p.notes ? `<div style="font-size: 11px; color: #64748B;">${p.notes}</div>` : ''}
              </td>
              <td style="padding: 12px 16px; font-size: 12px; color: #475569;">
                ${new Date(p.startsAt).toLocaleDateString()} &rarr; ${new Date(p.endsAt).toLocaleDateString()}
              </td>
              <td style="padding: 12px 16px;">
                <span style="background: ${p.isActive ? '#DCFCE7; color: #15803D;' : '#F1F5F9; color: #64748B;'}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
                  ${p.isActive ? 'Active' : 'Expired'}
                </span>
              </td>
              <td style="padding: 12px 16px; text-align: right;">
                <button class="btn-delete-promo" data-id="${p.id}" style="background: #FFFFFF; border: 1px solid #FCA5A5; color: #DC2626; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
                  Remove
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    tableContainer.querySelectorAll('.btn-delete-promo').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        if (confirm('Remove this promotion placement?')) {
          await adminDeletePromotion(id);
          await loadPromotions();
        }
      });
    });
  }

  btnToggleFlag.addEventListener('click', async () => {
    const current = await adminGetPromotionsEnabled();
    await adminTogglePromotionsEnabled(!current);
    await syncFlag();
  });

  btnCreatePromo.addEventListener('click', async () => {
    const name = window.prompt('Enter designer name for promotion:', 'Studio ArchForm');
    if (!name) return;

    const placementChoice = window.prompt('Enter placement (search_top, featured_card, hero, badge):', 'featured_card') as any;
    if (!placementChoice) return;

    await adminCreatePromotion({
      designerId: 'des-' + Date.now(),
      designerName: name,
      designerEmail: name.toLowerCase().replace(/\s+/g, '') + '@example.com',
      placement: placementChoice,
      durationDays: 14,
      label: 'Spotlight Partner',
      notes: 'Administrative promotional grant'
    });

    await loadPromotions();
  });

  await syncFlag();
  await loadPromotions();
}
