/**
 * ProjectCard Component — Supports Grid, List, and Board views.
 * Architectural cover art fallback, status indicators, milestone progress, and 3D spotlight.
 */

import { dashIcons } from './dashboardIcons';
import type { ProjectItem } from './dashboardData';

export function renderProjectCardGrid(project: ProjectItem): string {
  // Status chip mapping
  const statusLabels = {
    pending: 'Pending Proposals',
    ongoing: 'Ongoing Architecture',
    completed: 'Completed'
  };

  // Stacked avatars
  const avatarsHtml = (project.designerAvatars || [])
    .map(
      (a) =>
        `<span class="dash-avatar-stacked" style="background:${a.color}" title="${a.name}">${a.initials}</span>`
    )
    .join('');

  // Fallback blueprint pattern SVG if no image
  const coverHtml = project.coverImage
    ? `<img src="${project.coverImage}" alt="${project.title}" class="project-cover-img" loading="lazy" />`
    : `
      <div class="project-cover-fallback project-cover-fallback--${project.category.toLowerCase()}">
        <svg class="project-blueprint-svg" viewBox="0 0 400 225" fill="none" stroke="currentColor">
          <line x1="0" y1="50" x2="400" y2="50" stroke-width="1" stroke-dasharray="4 4" />
          <line x1="0" y1="175" x2="400" y2="175" stroke-width="1" stroke-dasharray="4 4" />
          <line x1="100" y1="0" x2="100" y2="225" stroke-width="1" stroke-dasharray="4 4" />
          <line x1="300" y1="0" x2="300" y2="225" stroke-width="1" stroke-dasharray="4 4" />
          <rect x="120" y="70" width="160" height="90" rx="8" stroke-width="1.5" />
          <circle cx="200" cy="115" r="30" stroke-width="1" />
        </svg>
        <span class="project-fallback-cat">${project.category}</span>
      </div>
    `;

  // Ongoing milestone bar vs proposals count
  let footerMetricsHtml = '';
  if (project.status === 'ongoing' && typeof project.progress === 'number') {
    footerMetricsHtml = `
      <div class="project-milestone-wrap">
        <div class="project-milestone-label">
          <span>Milestone Progress</span>
          <strong>${project.progress}%</strong>
        </div>
        <div class="project-milestone-bar">
          <div class="project-milestone-fill" style="width: ${project.progress}%"></div>
        </div>
      </div>
    `;
  } else {
    footerMetricsHtml = `
      <div class="project-proposals-wrap">
        <div class="project-avatars-row">${avatarsHtml}</div>
        <span class="project-proposals-count">${project.proposalsCount || 0} proposals</span>
      </div>
    `;
  }

  return `
    <article class="project-card project-card--grid" id="project-card-${project.id}" data-status="${project.status}">
      <div class="project-card-spotlight" aria-hidden="true"></div>

      <!-- 16:9 Cover Area -->
      <div class="project-cover-wrap">
        ${coverHtml}
        <div class="project-cover-gradient" aria-hidden="true"></div>

        <!-- Overlaid Status Chip & Bookmark -->
        <div class="project-cover-top">
          <span class="project-status-chip project-status-chip--${project.status}">
            <span class="status-pulse-dot"></span>
            <span>${statusLabels[project.status]}</span>
          </span>
          <span class="project-category-badge">${project.category}</span>
        </div>
      </div>

      <!-- Card Content -->
      <div class="project-card-body">
        <h3 class="project-title">${project.title}</h3>
        <p class="project-desc">${project.description}</p>

        <!-- Key Facts Row -->
        <div class="project-facts-grid">
          <div class="fact-item fact-item--budget">
            <span class="fact-label">BUDGET</span>
            <span class="fact-val fact-val--money">$${project.budget.toLocaleString()}</span>
          </div>
          <div class="fact-item">
            <span class="fact-label">TIMELINE</span>
            <span class="fact-val">${project.duration}</span>
          </div>
          <div class="fact-item">
            <span class="fact-label">LOCATION</span>
            <span class="fact-val fact-val--loc" title="${project.location}">
              ${dashIcons.location}
              <span>${project.location.split(',')[0]}</span>
            </span>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="project-card-footer">
          ${footerMetricsHtml}
          <button type="button" class="btn-view-project" data-project-id="${project.id}">
            <span>View Project</span>
            <span class="view-arrow">${dashIcons.arrowRight}</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

export function renderProjectCardList(project: ProjectItem): string {
  return `
    <div class="project-row" id="project-row-${project.id}" data-status="${project.status}">
      <div class="project-row-status">
        <span class="status-pulse-dot status-pulse-dot--${project.status}"></span>
      </div>
      <div class="project-row-main">
        <h4 class="project-row-title">${project.title}</h4>
        <div class="project-row-meta">
          <span class="project-row-cat">${project.category}</span>
          <span>•</span>
          <span class="project-row-loc">${project.location}</span>
        </div>
      </div>
      <div class="project-row-budget">
        <span class="fact-label">BUDGET</span>
        <span class="fact-val--money">$${project.budget.toLocaleString()}</span>
      </div>
      <div class="project-row-timeline">
        <span class="fact-label">DEADLINE</span>
        <span>${project.deadline}</span>
      </div>
      <div class="project-row-progress">
        ${
          project.status === 'ongoing'
            ? `<div class="project-milestone-bar" style="width:90px"><div class="project-milestone-fill" style="width:${project.progress}%"></div></div><small>${project.progress}%</small>`
            : `<span class="project-row-badge">${project.proposalsCount || 0} Proposals</span>`
        }
      </div>
      <div class="project-row-action">
        <button type="button" class="btn-row-view" data-project-id="${project.id}">
          <span>View</span>
          ${dashIcons.arrowRight}
        </button>
      </div>
    </div>
  `;
}

export function renderProjectCardBoard(project: ProjectItem): string {
  return `
    <div class="project-board-card" id="project-board-${project.id}" data-status="${project.status}" draggable="true">
      <div class="board-card-header">
        <span class="project-category-badge">${project.category}</span>
        <span class="board-card-budget">$${project.budget.toLocaleString()}</span>
      </div>
      <h4 class="board-card-title">${project.title}</h4>
      <p class="board-card-desc">${project.description}</p>
      <div class="board-card-footer">
        <span class="board-card-time">${dashIcons.clock} ${project.duration}</span>
        <button type="button" class="btn-board-view" data-project-id="${project.id}">
          ${dashIcons.arrowRight}
        </button>
      </div>
    </div>
  `;
}
