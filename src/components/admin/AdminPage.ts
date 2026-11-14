/**
 * AdminPage.ts
 * Entry point for Dezignet Administration Area (/admin)
 * Delegates rendering to the comprehensive AdminLayout component.
 */

import { renderAdminLayout } from './AdminLayout';

export function renderAdminPage(container: HTMLElement): void {
  renderAdminLayout(container, 'overview');
}
