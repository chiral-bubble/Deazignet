import { chromium, type Browser, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';

interface OverflowViolation {
  tag: string;
  id: string;
  className: string;
  rect: { left: number; right: number; width: number; height: number };
  computedWidth: string;
  computedOverflow: string;
  textContentSnippet: string;
}

interface TapTargetViolation {
  tag: string;
  id: string;
  className: string;
  text: string;
  width: number;
  height: number;
}

interface AuditResult {
  route: string;
  role: 'anonymous' | 'designer' | 'client' | 'admin';
  width: number;
  scrollWidth: number;
  clientWidth: number;
  hasHorizontalOverflow: boolean;
  overflowingElements: OverflowViolation[];
  smallTapTargets: TapTargetViolation[];
  screenshotPath?: string;
}

const VIEWPORT_WIDTHS = [360, 375, 390, 414, 768, 1024];

interface RouteSpec {
  path: string;
  role: 'anonymous' | 'designer' | 'client' | 'admin';
  name: string;
}

const ROUTES_TO_AUDIT: RouteSpec[] = [
  // Anonymous / Public
  { path: '/', role: 'anonymous', name: 'landing' },
  { path: '/login', role: 'anonymous', name: 'auth-login' },
  { path: '/register', role: 'anonymous', name: 'auth-register' },
  { path: '/onboarding', role: 'anonymous', name: 'onboarding' },
  { path: '/terms', role: 'anonymous', name: 'legal-terms' },
  { path: '/privacy', role: 'anonymous', name: 'legal-privacy' },

  // Designer studio
  { path: '/dashboard', role: 'designer', name: 'designer-dashboard' },
  { path: '/client-projects', role: 'designer', name: 'designer-client-projects' },
  { path: '/my-work', role: 'designer', name: 'designer-my-work-projects' },
  { path: '/my-work/proposals', role: 'designer', name: 'designer-my-work-proposals' },
  { path: '/conversations', role: 'designer', name: 'designer-conversations' },
  { path: '/payments', role: 'designer', name: 'designer-payments-overview' },
  { path: '/payments/plan', role: 'designer', name: 'designer-payments-plan' },
  { path: '/settings', role: 'designer', name: 'designer-settings' },

  // Client workspace
  { path: '/client-dashboard', role: 'client', name: 'client-dashboard' },
  { path: '/my-projects', role: 'client', name: 'client-my-projects' },
  { path: '/find-designers', role: 'client', name: 'client-find-designers' },
  { path: '/post-project', role: 'client', name: 'client-post-project' },
  { path: '/compare-proposals', role: 'client', name: 'client-compare-proposals' },
  { path: '/payments', role: 'client', name: 'client-payments' },
  { path: '/settings', role: 'client', name: 'client-settings' },

  // Admin
  { path: '/admin', role: 'admin', name: 'admin-dashboard' },
];

async function runMobileAudit() {
  console.log('🚀 Starting Vite dev server for Mobile Responsiveness Audit...');
  const server: ViteDevServer = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { port: 5188, host: '127.0.0.1' },
    define: {
      'import.meta.env.VITE_USE_MOCKS_AUTH': JSON.stringify('true'),
    },
    logLevel: 'error',
  });
  await server.listen();
  const baseUrl = 'http://127.0.0.1:5188';
  console.log(`📡 Vite dev server running at ${baseUrl}`);

  const outputDir = path.resolve(process.cwd(), 'docs', 'mobile-audit');
  const screenshotsDir = path.resolve(outputDir, 'screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: true });
  const allResults: AuditResult[] = [];

  try {
    for (const route of ROUTES_TO_AUDIT) {
      console.log(`\n🔎 Auditing Route: ${route.path} (${route.role})`);

      for (const width of VIEWPORT_WIDTHS) {
        const context = await browser.newContext({
          viewport: { width, height: 800 },
          userAgent: width < 769 
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
            : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          deviceScaleFactor: 2,
          isMobile: width < 769,
          hasTouch: width < 769,
        });

        const page: Page = await context.newPage();

        // Inject simulated auth state into localStorage if not anonymous
        if (route.role !== 'anonymous') {
          await page.addInitScript((role) => {
            const mockUser = {
              id: role === 'designer' ? 'des-alexandre' : role === 'admin' ? 'admin-1' : 'client-1',
              email: role === 'designer' ? 'alexandre.sterling@dezignet.studio' : role === 'admin' ? 'admin@dezignet.com' : 'partner.client@dezignet.com',
              fullName: role === 'designer' ? 'Alexandre Sterling' : role === 'admin' ? 'System Administrator' : 'Dr. Eleanor Vance',
              role,
              onboardingCompleted: true
            };
            localStorage.setItem('dezignet_mock_role', role);
            localStorage.setItem('dezignet_auth_user', JSON.stringify(mockUser));
            localStorage.setItem('dezignet_mock_auth', 'true');
            // Force mock flags in localStorage
            localStorage.setItem('VITE_USE_MOCKS_AUTH', 'true');
          }, route.role);
        }

        try {
          await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          // Short delay for layout & rendering
          await page.waitForTimeout(600);

          // Audit page DOM for overflow & tap targets
          const pageMetrics = await page.evaluate((currWidth) => {
            const docEl = document.documentElement;
            const scrollW = docEl.scrollWidth;
            const clientW = docEl.clientWidth;
            const hasOverflow = scrollW > currWidth + 1;

            const overflowingElements: any[] = [];
            const smallTargets: any[] = [];

            // Traverse elements to find those that spill out
            const allElements = document.querySelectorAll('*');
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i] as HTMLElement;
              if (!el.getBoundingClientRect) continue;

              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden') continue;

              const rect = el.getBoundingClientRect();
              
              // Only check visible elements that extend horizontally past viewport
              if (rect.right > currWidth + 2 && rect.width > 0 && rect.height > 0) {
                // If it's a deliberate horizontal scroller, skip reporting its children
                let parent: HTMLElement | null = el.parentElement;
                let insideDeliberateScroll = false;
                while (parent) {
                  const pStyle = window.getComputedStyle(parent);
                  if (pStyle.overflowX === 'auto' || pStyle.overflowX === 'scroll') {
                    insideDeliberateScroll = true;
                    break;
                  }
                  parent = parent.parentElement;
                }

                if (!insideDeliberateScroll) {
                  overflowingElements.push({
                    tag: el.tagName.toLowerCase(),
                    id: el.id || '',
                    className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '',
                    rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height) },
                    computedWidth: style.width,
                    computedOverflow: style.overflowX,
                    textContentSnippet: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
                  });
                }
              }

              // Tap target audit for primary actionable elements (buttons, links, inputs)
              if (['button', 'a', 'input', 'select'].includes(el.tagName.toLowerCase())) {
                const isActionable = rect.width > 0 && rect.height > 0 && style.display !== 'none';
                if (isActionable && (rect.width < 44 || rect.height < 44)) {
                  // Only report primary/standalone buttons or navigation links
                  if (el.tagName.toLowerCase() === 'button' || el.classList.contains('dez-btn-primary') || el.classList.contains('dez-m-nav-item') || el.classList.contains('client-mobile-nav-item')) {
                    smallTargets.push({
                      tag: el.tagName.toLowerCase(),
                      id: el.id || '',
                      className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : '',
                      text: (el.textContent || (el as HTMLInputElement).value || '').trim().slice(0, 30),
                      width: Math.round(rect.width),
                      height: Math.round(rect.height)
                    });
                  }
                }
              }
            }

            return {
              scrollWidth: scrollW,
              clientWidth: clientW,
              hasHorizontalOverflow: hasOverflow,
              overflowingElements: overflowingElements.slice(0, 10), // top 10 offenders
              smallTapTargets: smallTargets.slice(0, 10)
            };
          }, width);

          // Save screenshots for 375 and 768 (and any viewport that has overflow)
          let screenshotPath: string | undefined;
          if (width === 375 || width === 768 || pageMetrics.hasHorizontalOverflow) {
            const fileName = `${route.name}-${width}px.png`;
            screenshotPath = path.join(screenshotsDir, fileName);
            await page.screenshot({ path: screenshotPath, fullPage: false });
          }

          const auditRecord: AuditResult = {
            route: route.path,
            role: route.role,
            width,
            scrollWidth: pageMetrics.scrollWidth,
            clientWidth: pageMetrics.clientWidth,
            hasHorizontalOverflow: pageMetrics.hasHorizontalOverflow,
            overflowingElements: pageMetrics.overflowingElements,
            smallTapTargets: pageMetrics.smallTapTargets,
            screenshotPath: screenshotPath ? path.relative(outputDir, screenshotPath) : undefined
          };

          allResults.push(auditRecord);

          const statusIcon = pageMetrics.hasHorizontalOverflow ? '❌ OVERFLOW' : '✅ OK';
          console.log(`  [${width}px] ${statusIcon} - scrollWidth: ${pageMetrics.scrollWidth}px vs clientWidth: ${pageMetrics.clientWidth}px (Offenders: ${pageMetrics.overflowingElements.length}, Small targets: ${pageMetrics.smallTapTargets.length})`);
        } catch (err: any) {
          console.error(`  [${width}px] ⚠️ Failed to audit ${route.path}:`, err.message);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
    console.log('\n🔒 Vite dev server and Playwright browser closed.');
  }

  // Generate Markdown Audit Report
  const totalAudited = allResults.length;
  const overflowFailures = allResults.filter(r => r.hasHorizontalOverflow);
  const targetFailures = allResults.filter(r => r.smallTapTargets.length > 0);

  let md = `# Mobile Responsiveness & Audit Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## 1. Executive Summary\n\n`;
  md += `- **Total Viewport Checks**: ${totalAudited}\n`;
  md += `- **Horizontal Overflow Violations**: ${overflowFailures.length}\n`;
  md += `- **Tap Target Size Violations (< 44px)**: ${targetFailures.length}\n`;
  md += `- **Tested Viewports**: ${VIEWPORT_WIDTHS.join(', ')} px\n\n`;

  md += `## 2. Horizontal Overflow Violations Table\n\n`;
  if (overflowFailures.length === 0) {
    md += `✅ **Zero horizontal overflow detected across all routes and tested viewports!**\n\n`;
  } else {
    md += `| Route | Role | Width | ScrollWidth | ClientWidth | Offending Elements Count |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const f of overflowFailures) {
      md += `| \`${f.route}\` | ${f.role} | ${f.width}px | ${f.scrollWidth}px | ${f.clientWidth}px | ${f.overflowingElements.length} |\n`;
    }
    md += `\n### Offending Elements Detail\n\n`;
    for (const f of overflowFailures) {
      if (f.overflowingElements.length > 0) {
        md += `#### \`${f.route}\` at ${f.width}px\n`;
        for (const el of f.overflowingElements) {
          md += `- **<${el.tag}>** \`${el.className || el.id || 'anonymous'}\`: rect right=${el.rect.right}px (viewport ${f.width}px), width=${el.rect.width}px. Text: _"${el.textContentSnippet}"_\n`;
        }
        md += `\n`;
      }
    }
  }

  md += `## 3. Tap Target Size Violations (< 44px)\n\n`;
  if (targetFailures.length === 0) {
    md += `✅ **All primary interactive elements meet the minimum 44px touch target guidelines.**\n\n`;
  } else {
    md += `| Route | Role | Width | Element | Text | Dimensions |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const tf of targetFailures) {
      for (const t of tf.smallTapTargets) {
        md += `| \`${tf.route}\` | ${tf.role} | ${tf.width}px | \`<${t.tag} class="${t.className}">\` | "${t.text}" | ${t.width}x${t.height}px |\n`;
      }
    }
    md += `\n`;
  }

  md += `## 4. Route Status Matrix\n\n`;
  md += `| Route | Role | 360px | 375px | 390px | 414px | 768px | 1024px |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const route of ROUTES_TO_AUDIT) {
    const rResults = allResults.filter(r => r.route === route.path && r.role === route.role);
    const cols = VIEWPORT_WIDTHS.map(w => {
      const match = rResults.find(r => r.width === w);
      if (!match) return '—';
      return match.hasHorizontalOverflow ? '❌' : '✅';
    });
    md += `| \`${route.path}\` | ${route.role} | ${cols.join(' | ')} |\n`;
  }

  const reportPath = path.join(outputDir, 'audit-report.md');
  fs.writeFileSync(reportPath, md, 'utf-8');
  console.log(`\n📄 Audit report saved to ${reportPath}`);
}

runMobileAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
