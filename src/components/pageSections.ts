/**
 * Page Sections — How It Works, Manage Projects, Explore Projects,
 * Testimonials, FAQ, and Footer.
 */

import { renderHowItWorks, initHowItWorks } from './howItWorks/HowItWorks';

/* ---- SVG Icons ---- */
const icons = {
  plus: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>`,
  chat: `💬`,
  shield: `🛡️`,
  clock: `⏱️`,
  folder: `📂`,
  star: `★`,
  check: `✓`,
};

/* ---- How It Works (Delegated to revamped HowItWorks component) ---- */
function howItWorks(): string {
  return renderHowItWorks();
}

/* ---- Manage Projects ---- */
function manageProjects(): string {
  return `
    <section class="section" id="manage-projects">
      <div class="container">
        <div class="manage__grid">
          <div class="manage__visual">
            <div class="manage__mockup">
              <div class="manage__mockup-header">
                <span class="manage__mockup-dot manage__mockup-dot--red"></span>
                <span class="manage__mockup-dot manage__mockup-dot--yellow"></span>
                <span class="manage__mockup-dot manage__mockup-dot--green"></span>
              </div>
              <div class="manage__mockup-row">
                <div class="manage__mockup-avatar"></div>
                <div class="manage__mockup-line"></div>
                <span class="manage__mockup-badge manage__mockup-badge--active">Active</span>
              </div>
              <div class="manage__mockup-row">
                <div class="manage__mockup-avatar" style="background: linear-gradient(135deg, #f59e0b, #ef4444)"></div>
                <div class="manage__mockup-line manage__mockup-line--short"></div>
                <span class="manage__mockup-badge manage__mockup-badge--review">In Review</span>
              </div>
              <div class="manage__mockup-row">
                <div class="manage__mockup-avatar" style="background: linear-gradient(135deg, #22c55e, #06b6d4)"></div>
                <div class="manage__mockup-line"></div>
                <span class="manage__mockup-badge manage__mockup-badge--pending">Pending</span>
              </div>
              <div class="manage__mockup-row">
                <div class="manage__mockup-avatar" style="background: linear-gradient(135deg, #8b5cf6, #ec4899)"></div>
                <div class="manage__mockup-line manage__mockup-line--short"></div>
                <span class="manage__mockup-badge manage__mockup-badge--active">Active</span>
              </div>
            </div>
          </div>
          <div class="manage__features">
            <div class="section__header" style="text-align:left;margin:0 0 1.5rem">
              <p class="section__eyebrow">All-in-One Dashboard</p>
              <h2 class="section__title">Manage Projects with Ease</h2>
            </div>
            <div class="manage__feature" id="feature-messaging">
              <div class="manage__feature-icon">${icons.chat}</div>
              <div>
                <p class="manage__feature-title">Real-time Messaging</p>
                <p class="manage__feature-desc">Communicate directly with your designer through built-in chat, file sharing, and video calls.</p>
              </div>
            </div>
            <div class="manage__feature" id="feature-milestones">
              <div class="manage__feature-icon">${icons.clock}</div>
              <div>
                <p class="manage__feature-title">Milestone Tracking</p>
                <p class="manage__feature-desc">Break projects into milestones with clear deliverables, deadlines, and payment releases.</p>
              </div>
            </div>
            <div class="manage__feature" id="feature-files">
              <div class="manage__feature-icon">${icons.folder}</div>
              <div>
                <p class="manage__feature-title">File Management</p>
                <p class="manage__feature-desc">Organize blueprints, renders, and documents in one centralized project workspace.</p>
              </div>
            </div>
            <div class="manage__feature" id="feature-payments">
              <div class="manage__feature-icon">${icons.shield}</div>
              <div>
                <p class="manage__feature-title">Secure Payments</p>
                <p class="manage__feature-desc">Funds are held in escrow and released only when you approve the work. Your money is always protected.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* ---- Explore Projects ---- */
function exploreProjects(): string {
  // Project card data using gradient placeholders
  const projects = [
    {
      gradient: 'linear-gradient(135deg, #1a2a4a 0%, #2F7BE5 100%)',
      category: 'Architecture',
      title: 'Modern Hillside Residence',
      budget: '$45,000',
      proposals: '12 proposals',
    },
    {
      gradient: 'linear-gradient(135deg, #0f3d21 0%, #22c55e 100%)',
      category: 'Landscape Design',
      title: 'Urban Rooftop Garden',
      budget: '$18,500',
      proposals: '8 proposals',
    },
    {
      gradient: 'linear-gradient(135deg, #3b1a45 0%, #a78bfa 100%)',
      category: 'Interior Design',
      title: 'Luxury Penthouse Renovation',
      budget: '$72,000',
      proposals: '23 proposals',
    },
    {
      gradient: 'linear-gradient(135deg, #2a1a05 0%, #f59e0b 100%)',
      category: 'Structural Engineering',
      title: 'Commercial Office Retrofit',
      budget: '$120,000',
      proposals: '6 proposals',
    },
    {
      gradient: 'linear-gradient(135deg, #1a1a2e 0%, #e74c3c 100%)',
      category: 'Architecture',
      title: 'Coastal Beach House',
      budget: '$95,000',
      proposals: '18 proposals',
    },
    {
      gradient: 'linear-gradient(135deg, #0a2540 0%, #06b6d4 100%)',
      category: 'Interior Design',
      title: 'Boutique Hotel Lobby',
      budget: '$55,000',
      proposals: '15 proposals',
    },
  ];

  const cards = projects
    .map(
      (p, i) => `
      <div class="project-card" id="project-card-${i + 1}">
        <div class="project-card__image" style="background: ${p.gradient}; height: 200px;"></div>
        <div class="project-card__body">
          <p class="project-card__category">${p.category}</p>
          <h3 class="project-card__title">${p.title}</h3>
          <div class="project-card__meta">
            <span class="project-card__meta-item">${p.budget}</span>
            <span class="project-card__meta-item">${p.proposals}</span>
          </div>
        </div>
      </div>
    `
    )
    .join('');

  return `
    <section class="section section--alt" id="explore">
      <div class="container">
        <div class="section__header">
          <p class="section__eyebrow">Browse Opportunities</p>
          <h2 class="section__title">Explore Featured Projects</h2>
          <p class="section__description">Discover projects from clients around the world looking for talented design professionals like you.</p>
        </div>
        <div class="explore__grid">
          ${cards}
        </div>
      </div>
    </section>
  `;
}

/* ---- Testimonials ---- */
function testimonials(): string {
  const reviews = [
    {
      stars: 5,
      quote: 'Dezignet transformed how I find clients. Within a week of joining, I had three solid project leads. The platform is intuitive and the payment system gives both sides confidence.',
      name: 'Sarah Mitchell',
      initials: 'SM',
      role: 'Interior Designer, NYC',
    },
    {
      stars: 5,
      quote: 'We needed an architect for our restaurant renovation. Dezignet connected us with someone who understood our vision perfectly. The result exceeded our expectations.',
      name: 'James & Maria Torres',
      initials: 'JT',
      role: 'Restaurant Owners, Miami',
    },
    {
      stars: 5,
      quote: 'As a landscape architect, finding quality clients used to be my biggest challenge. Dezignet changed that overnight. The proposal system is brilliantly designed.',
      name: 'David Chen',
      initials: 'DC',
      role: 'Landscape Architect, Seattle',
    },
  ];

  const cards = reviews
    .map(
      (r, i) => `
      <div class="testimonial-card" id="testimonial-${i + 1}">
        <div class="testimonial-card__stars">${Array(r.stars).fill(icons.star).join('')}</div>
        <p class="testimonial-card__quote">"${r.quote}"</p>
        <div class="testimonial-card__author">
          <div class="testimonial-card__avatar">${r.initials}</div>
          <div>
            <p class="testimonial-card__name">${r.name}</p>
            <p class="testimonial-card__role">${r.role}</p>
          </div>
        </div>
      </div>
    `
    )
    .join('');

  return `
    <section class="section" id="testimonials">
      <div class="container">
        <div class="section__header">
          <p class="section__eyebrow">What People Say</p>
          <h2 class="section__title">Trusted by Designers & Clients</h2>
          <p class="section__description">Join thousands of professionals who have found success through our platform.</p>
        </div>
        <div class="testimonials__grid">
          ${cards}
        </div>
      </div>
    </section>
  `;
}

/* ---- FAQ ---- */
function faq(): string {
  const questions = [
    {
      q: 'How does Dezignet work?',
      a: 'Dezignet connects clients with design professionals. Clients post their project with details and budget, then receive proposals from qualified architects, interior designers, landscape architects and engineers. They can review portfolios, chat with designers, and hire the perfect match—all within the platform.',
    },
    {
      q: 'Is it free to post a project?',
      a: 'Yes! Posting a project on Dezignet is completely free. You only pay when you hire a designer and approve their work. Our escrow system ensures your payments are secure.',
    },
    {
      q: 'How are designers verified?',
      a: 'All designers go through a verification process that includes license verification, portfolio review, and identity confirmation. We also collect and display client reviews to help you make informed decisions.',
    },
    {
      q: 'What types of projects can I post?',
      a: 'You can post any design or construction project—residential architecture, commercial interiors, landscape design, structural engineering, renovations, new builds, and more. If it involves design, we have professionals ready to help.',
    },
    {
      q: 'How does payment work?',
      a: 'Payments are managed through our secure escrow system. You define milestones for your project, fund them upfront, and the designer gets paid only when you approve the deliverables for each milestone. This protects both parties.',
    },
    {
      q: 'Can I become a designer on Dezignet?',
      a: 'Absolutely! If you are a licensed architect, interior designer, landscape architect, or engineer, you can create a free profile, showcase your portfolio, and start receiving project invitations from clients worldwide.',
    },
  ];

  const items = questions
    .map(
      (q, i) => `
      <div class="faq-item" id="faq-item-${i + 1}">
        <button class="faq-item__question" aria-expanded="false" aria-controls="faq-answer-${i}">
          ${q.q}
          <svg class="faq-item__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="10" y1="4" x2="10" y2="16"/>
            <line x1="4" y1="10" x2="16" y2="10"/>
          </svg>
        </button>
        <div class="faq-item__answer" id="faq-answer-${i}" role="region">
          <div class="faq-item__answer-inner">${q.a}</div>
        </div>
      </div>
    `
    )
    .join('');

  return `
    <section class="section section--alt" id="faq">
      <div class="container">
        <div class="section__header">
          <p class="section__eyebrow">Questions?</p>
          <h2 class="section__title">Frequently Asked Questions</h2>
          <p class="section__description">Everything you need to know about getting started with Dezignet.</p>
        </div>
        <div class="faq__list">
          ${items}
        </div>
      </div>
    </section>
  `;
}

/* ---- Footer ---- */
function footer(): string {
  return `
    <footer class="footer" id="footer">
      <div class="container">
        <div class="footer__grid">
          <div class="footer__brand">
            <div class="footer__logo">Dezignet</div>
            <p class="footer__tagline">The premier marketplace connecting clients with licensed architects, interior designers, landscape architects, and engineers worldwide.</p>
          </div>
          <div>
            <h4 class="footer__col-title">Platform</h4>
            <nav class="footer__links">
              <a href="#" class="footer__link">How It Works</a>
              <a href="#" class="footer__link">Browse Projects</a>
              <a href="#" class="footer__link">Find Designers</a>
              <a href="#" class="footer__link">Pricing</a>
            </nav>
          </div>
          <div>
            <h4 class="footer__col-title">Company</h4>
            <nav class="footer__links">
              <a href="#" class="footer__link">About Us</a>
              <a href="#" class="footer__link">Careers</a>
              <a href="#" class="footer__link">Blog</a>
              <a href="#" class="footer__link">Contact</a>
            </nav>
          </div>
          <div>
            <h4 class="footer__col-title">Support</h4>
            <nav class="footer__links">
              <a href="#" class="footer__link">Help Center</a>
              <a href="#" class="footer__link">Terms of Service</a>
              <a href="#" class="footer__link">Privacy Policy</a>
              <a href="#" class="footer__link">Trust & Safety</a>
            </nav>
          </div>
        </div>
        <div class="footer__bottom">
          <span>© 2026 Dezignet. All rights reserved.</span>
          <div class="footer__socials">
            <a href="#" class="footer__social-link" aria-label="Twitter">𝕏</a>
            <a href="#" class="footer__social-link" aria-label="LinkedIn">in</a>
            <a href="#" class="footer__social-link" aria-label="Instagram">📷</a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

/* ---- Init All Sections ---- */
export function initPageSections(container: HTMLElement): void {
  const sectionsHtml =
    howItWorks() +
    manageProjects() +
    exploreProjects() +
    testimonials() +
    faq() +
    footer();

  const wrapper = document.createElement('div');
  wrapper.innerHTML = sectionsHtml;

  // Append each section
  while (wrapper.firstChild) {
    container.appendChild(wrapper.firstChild);
  }

  // Wire up FAQ accordion
  initFaqAccordion();

  // Initialize How It Works interactive animations
  initHowItWorks();
}

function initFaqAccordion(): void {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-item__question') as HTMLButtonElement;
    btn?.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Close all
      faqItems.forEach((fi) => {
        fi.classList.remove('open');
        fi.querySelector('.faq-item__question')?.setAttribute('aria-expanded', 'false');
      });
      // Toggle current
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}
