/**
 * Navbar — Transparent over the hero, switches to solid white after scrolling past.
 */

export function initNavbar(container: HTMLElement): void {
  const nav = document.createElement('header');
  nav.className = 'navbar navbar--transparent';
  nav.id = 'navbar';

  nav.innerHTML = `
    <div class="navbar__inner">
      <a href="/" class="navbar__logo" id="navbar-logo">
        <svg class="navbar__logo-icon" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="8" fill="currentColor" fill-opacity="0.15"/>
          <path d="M10 26V10h5.5c2 0 3.5.5 4.5 1.5s1.5 2.3 1.5 4-.5 3-1.5 4-2.5 1.5-4.5 1.5H14v5h-4z" fill="currentColor"/>
          <path d="M18 17l8 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        Dezignet
      </a>
      <div class="navbar__actions">
        <a href="#how-it-works" class="navbar__link" id="nav-how-it-works">How It Works</a>
        <a href="#explore" class="navbar__link" id="nav-explore">Explore</a>
        <a href="#login" class="navbar__link" id="nav-login">Login</a>
        <a href="#register" class="btn btn--sm navbar__cta" id="nav-cta">Let's Get Started</a>
      </div>
    </div>
  `;

  container.appendChild(nav);

  // Logo click returns to landing top
  const logo = nav.querySelector('#navbar-logo') as HTMLAnchorElement | null;
  logo?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.location.hash) {
      window.location.hash = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Scroll listener for navbar state
  let isTransparent = true;

  function updateNavbar() {
    const heroWrapper = document.getElementById('hero-wrapper');
    if (!heroWrapper || heroWrapper.offsetParent === null) return;

    const heroBottom = heroWrapper.offsetTop + heroWrapper.offsetHeight;
    const scrollY = window.scrollY;
    const shouldBeTransparent = scrollY < heroBottom - window.innerHeight * 0.5;

    if (shouldBeTransparent && !isTransparent) {
      nav.classList.remove('navbar--solid');
      nav.classList.add('navbar--transparent');
      isTransparent = true;
    } else if (!shouldBeTransparent && isTransparent) {
      nav.classList.remove('navbar--transparent');
      nav.classList.add('navbar--solid');
      isTransparent = false;
    }
  }

  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();
}
