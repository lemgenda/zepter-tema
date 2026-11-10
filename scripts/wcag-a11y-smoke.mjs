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

const viewports = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];
const report = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    for (const path of paths) {
      const url = new URL(path, baseUrl).toString();
      const result = { viewport: viewport.name, url, axeViolations: [], focus: null, textSpacing: null, smallTargets: [] };

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1200);

        const axe = await new AxeBuilder({ page })
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
