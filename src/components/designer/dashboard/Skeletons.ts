/**
 * Plain Grey Skeleton Loaders for Designer Dashboard
 * Complies with strict rule: No shimmer gradients, plain grey blocks (#F3F4F6) only.
 */

export function renderSummarySkeleton(): string {
  return `
    <div class="dez-summary-skeleton" aria-label="Loading summary metrics" aria-busy="true">
      <div class="dez-summary-skel-block">
        <div class="dez-skel-line" style="width: 80px; height: 14px;"></div>
        <div class="dez-skel-line" style="width: 60px; height: 32px; margin: 8px 0 6px;"></div>
        <div class="dez-skel-line" style="width: 140px; height: 12px;"></div>
      </div>
      <div class="dez-summary-skel-block">
        <div class="dez-skel-line" style="width: 110px; height: 14px;"></div>
        <div class="dez-skel-line" style="width: 50px; height: 32px; margin: 8px 0 6px;"></div>
        <div class="dez-skel-line" style="width: 120px; height: 12px;"></div>
      </div>
      <div class="dez-summary-skel-block">
        <div class="dez-skel-line" style="width: 70px; height: 14px;"></div>
        <div class="dez-skel-line" style="width: 90px; height: 32px; margin: 8px 0 6px;"></div>
        <div class="dez-skel-line" style="width: 150px; height: 12px;"></div>
      </div>
      <div class="dez-summary-skel-block">
        <div class="dez-skel-line" style="width: 85px; height: 14px;"></div>
        <div class="dez-skel-line" style="width: 100px; height: 32px; margin: 8px 0 6px;"></div>
        <div class="dez-skel-line" style="width: 130px; height: 12px;"></div>
      </div>
    </div>
  `;
}

export function renderProjectsSkeleton(): string {
  return `
    <div class="dez-projects-skeleton" aria-busy="true">
      ${[1, 2].map(() => `
        <div class="dez-project-skel-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <div class="dez-skel-line" style="width: 280px; height: 18px; margin-bottom: 6px;"></div>
              <div class="dez-skel-line" style="width: 180px; height: 13px;"></div>
            </div>
            <div class="dez-skel-line" style="width: 70px; height: 22px; border-radius: 4px;"></div>
          </div>
          <div class="dez-skel-line" style="width: 100%; height: 6px; margin: 16px 0 12px; border-radius: 3px;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px;">
            <div class="dez-skel-line" style="width: 220px; height: 14px;"></div>
            <div class="dez-skel-line" style="width: 130px; height: 32px; border-radius: 6px;"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

export function renderListSkeleton(rows = 4): string {
  return `
    <div class="dez-list-skeleton" aria-busy="true">
      ${Array.from({ length: rows }).map(() => `
        <div class="dez-list-skel-row">
          <div class="dez-skel-line" style="width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;"></div>
          <div style="flex: 1;">
            <div class="dez-skel-line" style="width: 75%; height: 14px; margin-bottom: 6px;"></div>
            <div class="dez-skel-line" style="width: 50%; height: 12px;"></div>
          </div>
          <div class="dez-skel-line" style="width: 45px; height: 12px;"></div>
        </div>
      `).join('')}
    </div>
  `;
}

export function renderTableSkeleton(rows = 4): string {
  return `
    <div class="dez-table-skeleton" aria-busy="true">
      ${Array.from({ length: rows }).map(() => `
        <div class="dez-table-skel-row">
          <div class="dez-skel-line" style="width: 35%; height: 14px;"></div>
          <div class="dez-skel-line" style="width: 15%; height: 14px;"></div>
          <div class="dez-skel-line" style="width: 15%; height: 14px;"></div>
          <div class="dez-skel-line" style="width: 15%; height: 20px; border-radius: 4px;"></div>
          <div class="dez-skel-line" style="width: 10%; height: 14px;"></div>
        </div>
      `).join('')}
    </div>
  `;
}
