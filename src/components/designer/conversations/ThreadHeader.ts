/**
 * ThreadHeader Component
 * Top bar of the active conversation thread:
 * - Client name & location
 * - Project title linked
 * - Proposal status chip
 * - Actions menu (View proposal, View project, Mute, Archive, Report)
 * - Toggle button for context side panel
 */

import { type SharedConversation } from '../../../mocks/dataset';
import { muteConversation, archiveConversation } from '../../../services/conversationsService';

export function renderThreadHeader(conv: SharedConversation): string {
  return `
    <div class="dez-thread-header" style="padding: 14px 20px; border-bottom: 1px solid #E5E7EB; background: #FFFFFF; display: flex; justify-content: space-between; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10;">
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
        <!-- Mobile back to conversation list button -->
        <button type="button" class="dez-btn-secondary dez-mobile-back-btn" id="btn-conv-mobile-back" style="display: none; height: 32px; padding: 0 8px;" aria-label="Back to conversations">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <img
          src="${conv.clientAvatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'}"
          alt="${conv.clientName}"
          style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0;"
        />

        <div style="min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 600; font-size: 14px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${conv.clientName}
            </span>
            <span class="dez-status-pill pill-grey" style="font-size: 11px;">
              ${conv.proposalStatus}
            </span>
          </div>
          <div style="font-size: 12px; color: #6B7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            <a href="#proposals/${conv.proposalId || 'prop-1'}" style="color: #4B5563; text-decoration: none; font-weight: 500;">
              ${conv.projectTitle}
            </a>
            • ${conv.clientLocation}
          </div>
        </div>
      </div>

      <!-- Actions & Menu -->
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <button
          type="button"
          class="dez-btn-secondary"
          id="btn-toggle-context-panel"
          title="Toggle project details"
          style="height: 32px; padding: 0 10px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 4px;"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span class="dez-desktop-only">Details</span>
        </button>

        <div class="dez-dropdown-container" style="position: relative;">
          <button type="button" class="dez-btn-secondary" id="btn-thread-menu" style="height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>

          <div class="dez-menu-dropdown" id="thread-menu-dropdown" style="display: none; position: absolute; right: 0; top: 38px; width: 190px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); padding: 4px; z-index: 50;">
            <a href="#my-work/proposals/${conv.proposalId || 'prop-1'}" class="dez-menu-item" style="display: block; padding: 8px 12px; font-size: 13px; color: #374151; text-decoration: none; border-radius: 4px;">
              View proposal
            </a>
            <a href="#my-work/projects" class="dez-menu-item" style="display: block; padding: 8px 12px; font-size: 13px; color: #374151; text-decoration: none; border-radius: 4px;">
              View active project
            </a>
            <button type="button" class="dez-menu-item" id="btn-menu-mute" style="width: 100%; text-align: left; padding: 8px 12px; font-size: 13px; color: #374151; background: none; border: none; cursor: pointer; border-radius: 4px;">
              ${conv.isMuted ? 'Unmute conversation' : 'Mute conversation'}
            </button>
            <button type="button" class="dez-menu-item" id="btn-menu-archive" style="width: 100%; text-align: left; padding: 8px 12px; font-size: 13px; color: #374151; background: none; border: none; cursor: pointer; border-radius: 4px;">
              ${conv.isArchived ? 'Unarchive' : 'Archive conversation'}
            </button>
            <div style="height: 1px; background: #E5E7EB; margin: 4px 0;"></div>
            <button type="button" class="dez-menu-item" id="btn-menu-report" style="width: 100%; text-align: left; padding: 8px 12px; font-size: 13px; color: #DC2626; background: none; border: none; cursor: pointer; border-radius: 4px;">
              Report conversation
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initThreadHeader(
  container: HTMLElement,
  conv: SharedConversation,
  callbacks: {
    onBackToList: () => void;
    onToggleSidePanel: () => void;
    onOpenReport: () => void;
    onRefreshThread: () => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const btnBack = container.querySelector('#btn-conv-mobile-back');
  const btnTogglePanel = container.querySelector('#btn-toggle-context-panel');
  const btnMenu = container.querySelector('#btn-thread-menu');
  const dropdown = container.querySelector('#thread-menu-dropdown') as HTMLElement;
  const btnMute = container.querySelector('#btn-menu-mute');
  const btnArchive = container.querySelector('#btn-menu-archive');
  const btnReport = container.querySelector('#btn-menu-report');

  btnBack?.addEventListener('click', callbacks.onBackToList);
  btnTogglePanel?.addEventListener('click', callbacks.onToggleSidePanel);

  btnMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown) {
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
  });

  document.addEventListener('click', () => {
    if (dropdown) dropdown.style.display = 'none';
  });

  btnMute?.addEventListener('click', async () => {
    const next = !conv.isMuted;
    await muteConversation(conv.id, next);
    callbacks.onShowToast(next ? 'Conversation Muted' : 'Conversation Unmuted', '', 'info');
    callbacks.onRefreshThread();
  });

  btnArchive?.addEventListener('click', async () => {
    const next = !conv.isArchived;
    await archiveConversation(conv.id, next);
    callbacks.onShowToast(next ? 'Archived' : 'Unarchived', '', 'info');
    callbacks.onRefreshThread();
  });

  btnReport?.addEventListener('click', callbacks.onOpenReport);
}
