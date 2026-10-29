/**
 * CommandPalette Component (Cmd/Ctrl + K)
 * Keyboard-navigable studio spotlight search for quick navigation and actions.
 */

import { dashIcons } from './dashboardIcons';
import { initialProjects } from './dashboardData';
import type { NavTabId } from './FloatingRail';

export interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions' | 'Projects';
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
}

export function renderCommandPalette(): string {
  return `
    <div class="cmd-palette-backdrop" id="cmd-palette-backdrop" aria-hidden="true">
      <div class="cmd-palette-modal" id="cmd-palette-modal" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div class="cmd-search-row">
          <span class="cmd-search-icon">${dashIcons.search}</span>
          <input 
            type="text" 
            class="cmd-search-input" 
            id="cmd-search-input" 
            placeholder="Type a command or search projects... (Cmd+K)" 
            autocomplete="off" 
            spellcheck="false"
          />
          <kbd class="cmd-esc-badge" id="cmd-esc-btn">ESC</kbd>
        </div>

        <div class="cmd-results-container" id="cmd-results">
          <!-- Dynamic results rendered here -->
        </div>

        <div class="cmd-footer">
          <div class="cmd-tips">
            <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
            <span><kbd>↵</kbd> to select</span>
            <span><kbd>esc</kbd> to close</span>
          </div>
          <div class="cmd-brand">Dezignet Studio OS</div>
        </div>
      </div>
    </div>
  `;
}

export function initCommandPalette(
  onNavigateTab: (tabId: NavTabId) => void,
  onOpenNewProjectModal: () => void
): { open: () => void; close: () => void } {
  const backdrop = document.getElementById('cmd-palette-backdrop');
  const modal = document.getElementById('cmd-palette-modal');
  const input = document.getElementById('cmd-search-input') as HTMLInputElement | null;
  const resultsContainer = document.getElementById('cmd-results');
  const escBtn = document.getElementById('cmd-esc-btn');

  let selectedIndex = 0;
  let currentFilteredItems: CommandItem[] = [];

  // Base command registry
  function getCommands(): CommandItem[] {
    const staticCommands: CommandItem[] = [
      {
        id: 'nav-dashboard',
        category: 'Navigation',
        title: 'Go to Dashboard',
        subtitle: 'Overview & Bento Grid',
        icon: dashIcons.dashboard,
        action: () => onNavigateTab('dashboard')
      },
      {
        id: 'nav-projects',
        category: 'Navigation',
        title: 'Go to Client Projects',
        subtitle: 'Grid, List & Board Views',
        icon: dashIcons.projects,
        action: () => onNavigateTab('projects')
      },
      {
        id: 'nav-conversations',
        category: 'Navigation',
        title: 'Open Conversations',
        subtitle: '3 unread client messages',
        icon: dashIcons.conversations,
        action: () => onNavigateTab('conversations')
      },
      {
        id: 'nav-contracts',
        category: 'Navigation',
        title: 'View Active Contracts',
        subtitle: 'Signed agreements & escrow',
        icon: dashIcons.contracts,
        action: () => onNavigateTab('contracts')
      },
      {
        id: 'nav-payment-history',
        category: 'Navigation',
        title: 'View Payment History',
        subtitle: 'Financial ledger & invoices',
        icon: dashIcons.paymentHistory,
        action: () => onNavigateTab('paymentHistory')
      },
      {
        id: 'act-new-project',
        category: 'Actions',
        title: 'Post New Architecture Project',
        subtitle: 'Create design brief and budget',
        icon: dashIcons.plus,
        action: () => onOpenNewProjectModal()
      }
    ];

    const projectCommands: CommandItem[] = initialProjects.map((p) => ({
      id: `proj-${p.id}`,
      category: 'Projects',
      title: p.title,
      subtitle: `${p.category} • Budget $${p.budget.toLocaleString()} • ${p.status.toUpperCase()}`,
      icon: dashIcons.box,
      action: () => {
        onNavigateTab('projects');
        setTimeout(() => {
          const card = document.getElementById(`project-card-${p.id}`);
          card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    }));

    return [...staticCommands, ...projectCommands];
  }

  function renderList(query = '') {
    if (!resultsContainer) return;
    const all = getCommands();
    const cleanQuery = query.toLowerCase().trim();

    currentFilteredItems = cleanQuery
      ? all.filter(
          (c) =>
            c.title.toLowerCase().includes(cleanQuery) ||
            (c.subtitle && c.subtitle.toLowerCase().includes(cleanQuery))
        )
      : all;

    if (currentFilteredItems.length === 0) {
      resultsContainer.innerHTML = `
        <div class="cmd-empty">
          <p>No results found for "${query}"</p>
          <small>Try searching for "Projects", "Contracts" or "Palisades"</small>
        </div>
      `;
      return;
    }

    // Ensure selectedIndex is within bounds
    if (selectedIndex >= currentFilteredItems.length) {
      selectedIndex = 0;
    }

    // Group items by category
    const categories = ['Navigation', 'Actions', 'Projects'] as const;
    let html = '';
    let flatIndex = 0;

    categories.forEach((cat) => {
      const groupItems = currentFilteredItems.filter((i) => i.category === cat);
      if (groupItems.length === 0) return;

      html += `<div class="cmd-group-label">${cat}</div>`;
      groupItems.forEach((item) => {
        const isSelected = flatIndex === selectedIndex;
        html += `
          <div 
            class="cmd-result-item ${isSelected ? 'is-selected' : ''}" 
            data-index="${flatIndex}"
            role="option"
            aria-selected="${isSelected}"
          >
            <div class="cmd-item-icon">${item.icon}</div>
            <div class="cmd-item-text">
              <span class="cmd-item-title">${item.title}</span>
              ${item.subtitle ? `<span class="cmd-item-subtitle">${item.subtitle}</span>` : ''}
            </div>
            <span class="cmd-item-arrow">${dashIcons.arrowRight}</span>
          </div>
        `;
        flatIndex++;
      });
    });

    resultsContainer.innerHTML = html;

    // Click handler for result items
    resultsContainer.querySelectorAll('.cmd-result-item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index') || '0', 10);
        executeItem(idx);
      });
    });
  }

  function executeItem(index: number) {
    const item = currentFilteredItems[index];
    if (item) {
      closePalette();
      item.action();
    }
  }

  function openPalette() {
    backdrop?.classList.add('is-open');
    modal?.classList.add('is-open');
    selectedIndex = 0;
    if (input) {
      input.value = '';
      input.focus();
    }
    renderList('');
  }

  function closePalette() {
    backdrop?.classList.remove('is-open');
    modal?.classList.remove('is-open');
  }

  // Keyboard Navigation inside Palette
  input?.addEventListener('input', () => {
    selectedIndex = 0;
    renderList(input.value);
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentFilteredItems.length > 0) {
        selectedIndex = (selectedIndex + 1) % currentFilteredItems.length;
        renderList(input.value);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentFilteredItems.length > 0) {
        selectedIndex = (selectedIndex - 1 + currentFilteredItems.length) % currentFilteredItems.length;
        renderList(input.value);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeItem(selectedIndex);
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });

  // Global Shortcut Cmd+K / Ctrl+K
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (backdrop?.classList.contains('is-open')) {
        closePalette();
      } else {
        openPalette();
      }
    }
  });

  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closePalette();
  });

  escBtn?.addEventListener('click', closePalette);

  return { open: openPalette, close: closePalette };
}
