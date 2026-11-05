/**
 * Navigation Utility — Clean SPA browser history navigation
 */
export function navigateTo(url: string): void {
  if (!url || url === '#' || url === '/') {
    window.history.pushState(null, '', '/');
  } else if (url.startsWith('#')) {
    const clean = url.replace(/^#\/?/, '/');
    window.history.pushState(null, '', clean);
  } else {
    window.history.pushState(null, '', url);
  }
  window.dispatchEvent(new Event('popstate'));
}

