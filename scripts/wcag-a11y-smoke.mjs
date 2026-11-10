import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('Usage: node scripts/wcag-a11y-smoke.mjs https://your-shopify-preview-url');
  process.exit(2);
}

const paths = (process.env.WCAG_TEST_PATHS || '/,/collections/all,/cart,/search?q=wcag')
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);

// Shopify preview credentials are carried in query parameters on the preview
// URL. Preserve them when navigating to each test path; otherwise /cart,
// /search, and collection checks silently fall back to the published theme.
const previewBase = new URL(baseUrl);
const buildTestUrl = (path) => {
  const target = new URL(path, previewBase);
  if (target.origin === previewBase.origin) {
    previewBase.searchParams.forEach((value, key) => {
      if (!target.searchParams.has(key)) target.searchParams.append(key, value);
    });
  }
  return target.toString();
};

const viewports = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'narrow-320', width: 320, height: 800 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];
const report = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();

    for (const path of paths) {
      const url = buildTestUrl(path);
      const result = { viewport: viewport.name, url, axeViolations: [], focus: null, textSpacing: null, smallTargets: [], diagnostics: null };

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1200);

        result.diagnostics = await page.evaluate(() => {
          const describe = (element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              id: element.id || null,
              className: typeof element.className === 'string' ? element.className : '',
              accessibleName: element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || '',
              text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 120),
              rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
              outerHTML: element.outerHTML.slice(0, 700),
            };
          };
          const headings = Array.from(document.querySelectorAll('h1')).map(describe);
          const slider = document.querySelector('#Slider-template--28718057521481__multicolumn_ym6DgV');
          const logoImages = Array.from(document.querySelectorAll('img[alt="Hyperlight Optics®"]')).map((img) => ({
            image: describe(img),
            parent: img.parentElement?.outerHTML.slice(0, 900) || null,
          }));
          const viewportWidth = document.documentElement.clientWidth;
          const overflowElements = Array.from(document.querySelectorAll('body *'))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return rect.width > 0 && rect.height > 0 && style.position !== 'fixed' &&
                (rect.right > viewportWidth + 1 || element.scrollWidth > element.clientWidth + 2);
            })
            .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)
            .slice(0, 20)
            .map(describe);
          return {
            h1Count: headings.length,
            h1: headings,
            logoImages,
            targetSlider: slider ? {
              attributes: Array.from(slider.attributes).map(({ name, value }) => ({ name, value })),
              outerHTML: slider.outerHTML.slice(0, 1200),
              nearestHeading: slider.parentElement?.querySelector('h1,h2,h3,h4,h5,h6')?.outerHTML || null,
            } : null,
            viewportWidth,
            overflowElements,
          };
        });

        const axe = await new AxeBuilder({ page })
          // Shopify's preview editor toolbar is injected outside the storefront and
          // is not part of the theme's accessibility surface.
          .exclude('#PBarNextFrame')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();

        result.axeViolations = axe.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        }));

        await page.keyboard.press('Tab');
        result.focus = await page.evaluate(() => {
          const element = document.activeElement;
          const style = getComputedStyle(element);
          const outlineVisible = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
          const shadowVisible = style.boxShadow !== 'none';
          return {
            tag: element?.tagName || null,
            id: element?.id || null,
            className: typeof element?.className === 'string' ? element.className : '',
            focusVisible: element?.matches(':focus-visible') || false,
            indicatorVisible: outlineVisible || shadowVisible,
          };
        });

        await page.addStyleTag({
          content: `
            html.wcag-spacing-test body,
            html.wcag-spacing-test body *:not(svg):not(path) {
              line-height: 1.5 !important;
              letter-spacing: 0.12em !important;
              word-spacing: 0.16em !important;
            }
            html.wcag-spacing-test p {
              margin-block-end: 2em !important;
            }
          `,
        });
        await page.evaluate(() => document.documentElement.classList.add('wcag-spacing-test'));
        result.textSpacing = await page.evaluate(() => ({
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        }));

        result.diagnostics.textSpacingOverflowElements = await page.evaluate(() => {
          const viewportWidth = document.documentElement.clientWidth;
          return Array.from(document.querySelectorAll('body *'))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return rect.width > 0 && rect.height > 0 && style.position !== 'fixed' &&
                (rect.right > viewportWidth + 1 || element.scrollWidth > element.clientWidth + 2);
            })
            .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)
            .slice(0, 30)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName,
                id: element.id || null,
                className: typeof element.className === 'string' ? element.className : '',
                text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 100),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
                outerHTML: element.outerHTML.slice(0, 500),
              };
            });
        });

        // The first overflow list can be dominated by intentionally off-canvas
        // slider slides. Report the actual page-width boundary separately and
        // collapse descendants so the element expanding the document is visible.
        result.diagnostics.pageWidthCandidates = await page.evaluate(() => {
          const viewportWidth = document.documentElement.clientWidth;
          const documentWidth = document.documentElement.scrollWidth;
          const describe = (element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const ancestors = [];
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
              const parentRect = parent.getBoundingClientRect();
              const parentStyle = getComputedStyle(parent);
              ancestors.push({
                tag: parent.tagName,
                id: parent.id || null,
                className: typeof parent.className === 'string' ? parent.className : '',
                left: Math.round(parentRect.left),
                right: Math.round(parentRect.right),
                width: Math.round(parentRect.width),
                scrollWidth: parent.scrollWidth,
                clientWidth: parent.clientWidth,
                overflowX: parentStyle.overflowX,
              });
              parent = parent.parentElement;
            }
            return {
              tag: element.tagName,
              id: element.id || null,
              className: typeof element.className === 'string' ? element.className : '',
              text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 100),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
              overflowX: style.overflowX,
              outerHTML: element.outerHTML.slice(0, 500),
              ancestors: ancestors.slice(0, 8),
            };
          };
          const candidates = Array.from(document.querySelectorAll('body *')).filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.position !== 'fixed' &&
              rect.right > viewportWidth + 1 && rect.left < documentWidth + 1 &&
              rect.right <= documentWidth + 2;
          });
          const roots = candidates.filter((element) =>
            !candidates.some((candidate) => candidate !== element && candidate.contains(element))
          );
          return {
            viewportWidth,
            documentWidth,
            bodyScrollWidth: document.body.scrollWidth,
            candidates: roots.slice(0, 20).map(describe),
          };
        });

        await page.emulateMedia({ forcedColors: 'active' });
        await page.waitForTimeout(250);
        result.reducedMotion = await page.evaluate(() => ({
          active: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          autoplayElementsRemaining: document.querySelectorAll('announcement-bar[autoplay], slideshow-element[autoplay], video-media[autoplay], video[autoplay]').length,
        }));
        result.forcedColorsFocus = await page.evaluate(() => {
          const element = document.activeElement;
          const style = getComputedStyle(element);
          return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
        });

        result.smallTargets = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button, input:not([type="hidden"]), select, textarea, [role="button"]'))
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return !element.disabled && rect.width > 0 && rect.height > 0 &&
                style.display !== 'none' && style.visibility !== 'hidden' &&
                (rect.width < 24 || rect.height < 24);
            })
            .slice(0, 30)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName,
                id: element.id,
                text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            });
        });

        if (result.axeViolations.length) failures.push(`${viewport.name} ${url}: axe reported ${result.axeViolations.length} violation(s)`);
        if (result.focus && !result.focus.indicatorVisible) failures.push(`${viewport.name} ${url}: first Tab stop has no detectable focus indicator`);
        if (result.textSpacing?.horizontalOverflow) failures.push(`${viewport.name} ${url}: horizontal overflow with WCAG text-spacing overrides`);
        if (result.reducedMotion?.autoplayElementsRemaining) failures.push(`${viewport.name} ${url}: autoplay media remains active with reduced motion enabled`);
        if (!result.forcedColorsFocus) failures.push(`${viewport.name} ${url}: focus indicator is not detectable in forced-colors mode`);
      } catch (error) {
        result.error = error.message;
        failures.push(`${viewport.name} ${url}: ${error.message}`);
      }

      report.push(result);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error('\nAccessibility smoke-test failures:');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exitCode = 1;
} else {
  console.log('\nAccessibility smoke tests passed. Review smallTargets manually for WCAG 2.5.8 exceptions and context.');
}
