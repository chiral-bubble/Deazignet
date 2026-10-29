/**
 * ProjectFilters Component (Designer View)
 * Search, multi-criteria dropdowns, active filter chips, and clear all.
 */

import type { ProjectFiltersState } from '../../services/projectsService';

export function renderProjectFilters(filters: ProjectFiltersState): string {
  // Categories & Subcategories
  const categories = ['All', 'Residential', 'Commercial', 'Hospitality', 'Civic', 'Landscape', 'Interior'];
  const locations = ['All', 'Los Angeles', 'London', 'Zurich', 'New York', 'Aspen', 'Geneva', 'Sydney', 'Kyoto', 'Austin', 'Vancouver', 'Milan'];

  const categoryOptions = categories
    .map((c) => `<option value="${c}" ${filters.category === c ? 'selected' : ''}>${c === 'All' ? 'Category: All' : c}</option>`)
    .join('');

  const locationOptions = locations
    .map((l) => `<option value="${l}" ${filters.location === l ? 'selected' : ''}>${l === 'All' ? 'Location: All' : l}</option>`)
    .join('');

  // Generate active filter chips
  const activeChips: { key: keyof ProjectFiltersState; label: string }[] = [];
  if (filters.search) activeChips.push({ key: 'search', label: `Search: "${filters.search}"` });
  if (filters.category && filters.category !== 'All') activeChips.push({ key: 'category', label: `Category: ${filters.category}` });
  if (filters.location && filters.location !== 'All') activeChips.push({ key: 'location', label: `Location: ${filters.location}` });
  if (filters.paymentType && filters.paymentType !== 'All') activeChips.push({ key: 'paymentType', label: `Payment: ${filters.paymentType}` });
  if (filters.minBudget || filters.maxBudget) {
    if (filters.minBudget && filters.maxBudget) activeChips.push({ key: 'minBudget', label: `$${filters.minBudget.toLocaleString()} - $${filters.maxBudget.toLocaleString()}` });
    else if (filters.minBudget) activeChips.push({ key: 'minBudget', label: `Above $${filters.minBudget.toLocaleString()}` });
    else if (filters.maxBudget) activeChips.push({ key: 'maxBudget', label: `Under $${filters.maxBudget.toLocaleString()}` });
  }
  if (filters.onlySaved) activeChips.push({ key: 'onlySaved', label: 'Saved projects only' });

  const chipsHtml = activeChips.length > 0
    ? `
      <div class="dez-active-chips-row">
        <span class="dez-chip-label">Active filters:</span>
        ${activeChips
          .map(
            (c) => `
          <span class="dez-filter-chip">
            <span>${c.label}</span>
            <button type="button" class="dez-chip-remove" data-remove-filter="${c.key}" aria-label="Remove filter ${c.label}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </span>
        `
          )
          .join('')}
        <button type="button" class="dez-clear-all-btn" id="dez-clear-filters-btn">Clear all</button>
      </div>
    `
    : '';

  return `
    <div class="dez-filters-container" id="dez-filters-container">
      <div class="dez-filters-row">
        <!-- Search Input -->
        <div class="dez-search-box">
          <span class="dez-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </span>
          <input 
            type="text" 
            class="dez-input-search" 
            id="dez-filter-search" 
            placeholder="Search projects by title or description..." 
            value="${filters.search || ''}"
          />
        </div>

        <!-- Category Dropdown -->
        <select class="dez-select-filter" id="dez-filter-category" aria-label="Category">
          ${categoryOptions}
        </select>

        <!-- Location Dropdown -->
        <select class="dez-select-filter" id="dez-filter-location" aria-label="Location">
          ${locationOptions}
        </select>

        <!-- Payment Type -->
        <select class="dez-select-filter" id="dez-filter-payment" aria-label="Payment Type">
          <option value="All" ${filters.paymentType === 'All' ? 'selected' : ''}>Payment: All</option>
          <option value="Milestone" ${filters.paymentType === 'Milestone' ? 'selected' : ''}>Milestone</option>
          <option value="Hourly" ${filters.paymentType === 'Hourly' ? 'selected' : ''}>Hourly</option>
        </select>

        <!-- Budget Range Dropdown -->
        <select class="dez-select-filter" id="dez-filter-budget" aria-label="Budget Range">
          <option value="all">Budget: Any</option>
          <option value="under-50" ${filters.maxBudget === 50000 ? 'selected' : ''}>Under $50,000</option>
          <option value="50-100" ${filters.minBudget === 50000 && filters.maxBudget === 100000 ? 'selected' : ''}>$50,000 – $100,000</option>
          <option value="above-100" ${filters.minBudget === 100000 ? 'selected' : ''}>Above $100,000</option>
        </select>

        <!-- Saved Projects Toggle -->
        <button 
          type="button" 
          class="dez-btn-saved-filter ${filters.onlySaved ? 'is-active' : ''}" 
          id="dez-filter-saved-toggle"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${filters.onlySaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <span>Saved</span>
        </button>
      </div>

      ${chipsHtml}
    </div>
  `;
}
