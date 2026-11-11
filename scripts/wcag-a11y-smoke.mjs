import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('Usage: node scripts/wcag-a11y-smoke.mjs https://your-shopify-preview-url');
  process.exit(2);
}

const defaultPaths = [
  '/',
  '/products/001-yellow',
  '/collections/all',
  '/collections/all?sort_by=price-ascending&filter.p.m.custom.type2=gid%3A%2F%2Fshopify%2FMetaobject%2F103490552137',
  '/collections/outdoor',
  '/pages/faq',
  '/pages/contact',
  '/account/login',
  '/account',
  '/cart',
  '/search?q=glasses',
];
const paths = (process.env.WCAG_TEST_PATHS || defaultPaths.join(','))
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
      const result = { viewport: viewport.name, url, finalUrl: null, httpStatus: null, pageTitle: null, axeViolations: [], focus: null, textSpacing: null, smallTargets: [], diagnostics: null };

      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        result.httpStatus = response?.status() ?? null;
        result.finalUrl = page.url();
        result.pageTitle = await page.title();
        if (result.httpStatus !== null && result.httpStatus >= 400) {
          throw new Error(`HTTP ${result.httpStatus} while loading ${result.finalUrl}`);
        }

        // Shopify's new Customer Accounts are hosted on a separate origin and
        // are not rendered or styled by this theme. Record the redirect clearly
        // without treating the external account UI as a theme accessibility failure.
        if (result.finalUrl && new URL(result.finalUrl).origin !== previewBase.origin) {
          result.externalRedirect = true;
          result.externalOrigin = new URL(result.finalUrl).origin;
          result.skippedReason = 'Route redirects to a separately hosted service outside the theme control surface.';
          report.push(result);
          continue;
        }

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
          const primaryNavigation = Array.from(document.querySelectorAll('header nav[aria-label]')).map((nav) => ({
            label: nav.getAttribute('aria-label'),
            listRole: nav.querySelector(':scope > ul')?.getAttribute('role') || null,
            nativeListSemantics: nav.querySelector(':scope > ul')?.tagName === 'UL' && !nav.querySelector(':scope > ul')?.hasAttribute('role'),
            items: Array.from(nav.querySelectorAll(':scope > ul > li')).map((item) => {
              const control = item.querySelector(':scope > details > summary, :scope > a');
              const textWrapper = control?.querySelector(':scope > magnet-element');
              return {
                text: (control?.getAttribute('aria-label') || control?.textContent || '').trim(),
                controlTag: control?.tagName || null,
                itemRole: item.getAttribute('role') || null,
                nativeListItemSemantics: item.tagName === 'LI' && !item.hasAttribute('role'),
                hasRedundantAriaLabel: Boolean(control?.getAttribute('aria-label') && control.textContent?.trim()),
                textWrapperExposed: !textWrapper || !textWrapper.hasAttribute('aria-hidden'),
                decorativeCloneIsolated: !control?.querySelector('.btn-duplicate') || (control.querySelector('.btn-duplicate').getAttribute('aria-hidden') === 'true' && control.querySelector('.btn-duplicate').hasAttribute('inert') && control.querySelector('.btn-duplicate').textContent.trim() === '' && Boolean(control.querySelector('.btn-duplicate').getAttribute('data-label'))),
              };
            }),
          }));
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
            primaryNavigation,
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


        // Verify the first desktop navigation control is reachable immediately
        // after the logo in the real keyboard tab sequence.
        if (viewport.name === 'desktop') {
          result.navigationTabOrder = await page.evaluate(() => {
            const logo = document.querySelector('header .header__logo a[href="/"]');
            const nav = document.querySelector('header nav[aria-label]');
            if (!logo || !nav || !(logo.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING)) {
              return { applicable: false, reason: 'Logo does not precede primary navigation in this header layout.' };
            }

            const firstItem = nav.querySelector(':scope > ul > li:first-child');
            const expected = firstItem?.querySelector(':scope > details > summary, :scope > a');
            if (!expected) return { applicable: true, passed: false, reason: 'First primary navigation item has no direct summary or link.' };

            logo.focus();
            return {
              applicable: true,
              expectedText: (expected.getAttribute('aria-label') || expected.textContent || '').trim(),
              expectedTag: expected.tagName,
              expectedTabIndex: expected.tabIndex,
            };
          });
          if (result.navigationTabOrder?.applicable) {
            await page.keyboard.press('Tab');
            result.navigationTabOrder.actual = await page.evaluate(() => {
              const element = document.activeElement;
              return {
                tag: element?.tagName || null,
                text: (element?.getAttribute('aria-label') || element?.textContent || '').trim().slice(0, 120),
                isFirstPrimaryItem: Boolean(element?.matches('header nav[aria-label] > ul > li:first-child > details > summary, header nav[aria-label] > ul > li:first-child > a')),
                tabIndex: element?.tabIndex ?? null,
              };
            });
            result.navigationTabOrder.passed = result.navigationTabOrder.actual.isFirstPrimaryItem;
          }
        }

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
          const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"]';
          const targets = Array.from(document.querySelectorAll(selector)).filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const focusOnlySkipLink = element.matches('.sr-only.skip-link') && !element.matches(':focus');
            return !focusOnlySkipLink && !element.disabled && rect.width > 0 && rect.height > 0 &&
              style.display !== 'none' && style.visibility !== 'hidden';
          });
          return targets.filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 24 || rect.height < 24;
          }).slice(0, 50).map((element) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const neighbors = targets.filter((other) => other !== element).map((other) => {
              const otherRect = other.getBoundingClientRect();
              const dx = Math.max(otherRect.left - centerX, 0, centerX - otherRect.right);
              const dy = Math.max(otherRect.top - centerY, 0, centerY - otherRect.bottom);
              return { other, distance: Math.hypot(dx, dy) };
            }).sort((a, b) => a.distance - b.distance);
            const nearest = neighbors[0];
            return {
              tag: element.tagName,
              id: element.id,
              text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80),
              selector: element.matches('a[href]') ? 'link' : element.tagName.toLowerCase(),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              spacingExceptionCandidate: !neighbors.some((neighbor) => neighbor.distance < 12),
              nearestTarget: nearest ? {
                tag: nearest.other.tagName,
                id: nearest.other.id || null,
                text: (nearest.other.getAttribute('aria-label') || nearest.other.textContent || '').trim().slice(0, 60),
                distanceFrom24pxCircle: Number(nearest.distance.toFixed(1))
              } : null
            };
          });
        });

        // Contrast is a review queue, not an automatic failure: background images,
        // gradients, overlays and merchant-managed schemes need visual confirmation.
        result.contrastReview = await page.evaluate(() => {
          const parse = (value) => {
            const match = value.match(/rgba?\\(([^)]+)\\)/);
            if (!match) return null;
            const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
            return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
          };
          const luminance = ({ r, g, b }) => {
            const channel = (value) => {
              const normalized = value / 255;
              return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
          };
          const contrast = (a, b) => {
            const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
            return (values[0] + 0.05) / (values[1] + 0.05);
          };
          const visible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
              style.visibility !== 'hidden' && Number(style.opacity) > 0 &&
              (element.innerText || '').trim().length > 0;
          };
          const candidates = [];
          for (const element of document.querySelectorAll('body *')) {
            if (!visible(element) || element.children.length > 0 && !Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) continue;
            const style = getComputedStyle(element);
            const foreground = parse(style.color);
            if (!foreground || foreground.a < 0.99) continue;
            let background = null;
            let node = element;
            let hasImageBackground = false;
            while (node && node !== document.documentElement) {
              const nodeStyle = getComputedStyle(node);
              if (nodeStyle.backgroundImage !== 'none') hasImageBackground = true;
              const color = parse(nodeStyle.backgroundColor);
              if (color && color.a >= 0.99) { background = color; break; }
              node = node.parentElement;
            }
            if (!background || hasImageBackground) continue;
            const ratio = contrast(foreground, background);
            const fontSize = Number.parseFloat(style.fontSize);
            const large = fontSize >= 24 || (fontSize >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700);
            const required = large ? 3 : 4.5;
            if (ratio < required) {
              candidates.push({
                ratio: Number(ratio.toFixed(2)), required,
                text: (element.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 100),
                selector: element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (typeof element.className === 'string' && element.className.trim() ? '.' + element.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''),
                foreground: style.color,
                background: 'rgb(' + background.r + ', ' + background.g + ', ' + background.b + ')',
                fontSize: style.fontSize,
                fontWeight: style.fontWeight
              });
            }
          }
          return { sampledTextNodes: document.querySelectorAll('body *').length, lowContrastCandidates: candidates.sort((a, b) => a.ratio - b.ratio).slice(0, 40), note: 'Computed-color heuristic; manually verify gradients, images, opacity, overlays, hover/focus/disabled and every merchant color scheme.' };
        });

        result.imageAltReview = await page.evaluate(() => {
          const isRendered = (element) => {
            let node = element;
            while (node && node !== document.documentElement) {
              const style = getComputedStyle(node);
              if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') return false;
              node = node.parentElement;
            }
            return true;
          };
          return {
            images: document.images.length,
            missingAlt: Array.from(document.images).filter((img) => isRendered(img) && !img.hasAttribute('alt')).slice(0, 40).map((img) => ({ src: img.currentSrc || img.src, parent: img.parentElement?.outerHTML.slice(0, 400) })),
            emptyAltInsideNamedLink: Array.from(document.images).filter((img) => {
              const link = img.closest('a[href]');
              return isRendered(img) && img.hasAttribute('alt') && img.alt === '' && link && isRendered(link) &&
                link.getAttribute('tabindex') !== '-1' && !(link.innerText || '').trim() && !link.getAttribute('aria-label');
            }).slice(0, 30).map((img) => ({ src: img.currentSrc || img.src, link: img.closest('a[href]')?.outerHTML.slice(0, 500) }))
          };
        });

        if (path.startsWith('/products/')) {
          const picker = page.locator('variant-selects');
          const initialVariant = await page.locator('product-info [data-selected-variant]').first().textContent().catch(() => null);
          let initialId = null;
          try { initialId = initialVariant ? JSON.parse(initialVariant).id : null; } catch {}
          const radioOptions = picker.locator('input[type="radio"]:not(:checked):not(:disabled)');
          const selectOptions = picker.locator('select');
          let selectedControl = null;

          // Radio inputs are intentionally visually hidden; their associated
          // labels are the visible, clickable controls.
          for (const option of await radioOptions.all()) {
            const id = await option.getAttribute('id');
            const label = id ? page.locator(`label[for="${id}"]`).first() : option.locator('xpath=ancestor::label[1]');
            if (await label.count() && await label.isVisible()) {
              await label.click();
              selectedControl = 'radio';
              break;
            }
          }

          if (!selectedControl) {
            for (const select of await selectOptions.all()) {
              const alternative = await select.locator('option:not([disabled])').evaluateAll((items) => {
                const selected = items.find((option) => option.selected)?.value;
                return items.find((option) => option.value && option.value !== selected)?.value || null;
              });
              if (alternative) {
                await select.selectOption(alternative);
                selectedControl = 'select';
                break;
              }
            }
          }

          if (selectedControl) {
            try {
              await page.waitForFunction(({ initialId }) => {
                const raw = document.querySelector('product-info [data-selected-variant]')?.textContent;
                try { const current = raw ? JSON.parse(raw) : null; return Boolean(current?.id && current.id !== initialId); } catch { return false; }
              }, { initialId }, { timeout: 15000 });
            } catch {}
            await page.waitForTimeout(500);
            result.productVariantFlow = await page.evaluate(({ initialId, selectedControl }) => {
              const raw = document.querySelector('product-info [data-selected-variant]')?.textContent;
              let current = null;
              try { current = raw ? JSON.parse(raw) : null; } catch {}
              const picker = document.querySelector('variant-selects');
              const selected = picker?.querySelector('input[type="radio"]:checked, select option:checked');
              const pickup = document.querySelector('product-info pickup-availability');
              const changed = Boolean(current?.id && current.id !== initialId);
              return {
                tested: changed,
                control: selectedControl,
                initialVariantId: initialId,
                selectedVariantId: current?.id || null,
                selectedControlValue: selected?.value || null,
                variantChanged: changed,
                pickupVariantId: pickup?.getAttribute('data-variant-id') || null,
                pickupMatchesVariant: !pickup || !current?.id || pickup.getAttribute('data-variant-id') === String(current.id),
                priceStatusPresent: Boolean(document.querySelector('[id^="Price-"][aria-live], [id^="Price-"][role="status"]')),
                skuStatusPresent: Boolean(document.querySelector('[id^="Sku-"][aria-live], [id^="Sku-"][role="status"]'))
              };
            }, { initialId, selectedControl });
            if (!result.productVariantFlow.variantChanged) failures.push(`${viewport.name} ${url}: variant control did not change the selected variant ID`);
            if (!result.productVariantFlow.pickupMatchesVariant) failures.push(`${viewport.name} ${url}: pickup availability is not synchronized with selected variant`);
          } else {
            result.productVariantFlow = {
              tested: false,
              notApplicable: await picker.count() === 0,
              reason: await picker.count() === 0
                ? 'This product has no native Shopify variant picker; third-party product swatches are product links, not variant controls.'
                : 'No enabled alternative Shopify variant option is available in this product fixture.',
              pickerCount: await picker.count(),
              radioCount: await picker.locator('input[type="radio"]').count(),
              selectCount: await selectOptions.count()
            };
          }

          // PL Swatches renders cross-product links, not Shopify variant inputs.
          // Test that separate interaction honestly instead of reporting it as a variant change.
          const currentHandle = new URL(page.url()).pathname.split('/').filter(Boolean).pop();
          const swatchSelector = '#pl-swatches-embed-copied a[data-handle]';
          const alternateIndex = await page.locator(swatchSelector).evaluateAll((anchors, current) =>
            anchors.findIndex((anchor) => anchor.dataset.handle && anchor.dataset.handle !== current),
            currentHandle
          );
          if (alternateIndex >= 0) {
            const targetSwatch = page.locator(swatchSelector).nth(alternateIndex);
            const alternateHandle = await targetSwatch.getAttribute('data-handle');
            if (alternateHandle) {
              await targetSwatch.click();
              try {
                await page.waitForFunction((handle) => location.pathname.endsWith('/' + handle), alternateHandle, { timeout: 10000 });
              } catch {}
              result.productSwatchNavigation = {
                tested: new URL(page.url()).pathname.endsWith('/' + alternateHandle),
                fromHandle: currentHandle,
                toHandle: alternateHandle,
                finalUrl: page.url()
              };
              if (!result.productSwatchNavigation.tested) failures.push(`${viewport.name} ${url}: product swatch did not navigate to its linked product`);
            }
          }
        }

        if (path.startsWith('/collections/') || path.startsWith('/search')) {
          result.facetsInteraction = { tested: false, reason: 'No enabled facet checkbox with an exposed label was found.' };
          const drawerTrigger = page.locator('.facet-wrapper > button[aria-controls="FacetDrawer"]').first();
          if (await drawerTrigger.count() && await drawerTrigger.isVisible()) {
            const expanded = await drawerTrigger.getAttribute('aria-expanded');
            if (expanded !== 'true') await drawerTrigger.click();
            await page.locator('#FacetDrawer').waitFor({ state: 'visible', timeout: 8000 });
          }

          // Facet groups are native <details>; opening the drawer alone does not
          // expose checkbox labels inside collapsed filter accordions.
          const facetGroups = page.locator('#FacetDrawer .facet-form details[data-filter]');
          for (const group of await facetGroups.all()) {
            if (!(await group.evaluate((node) => node.open))) {
              const summary = group.locator(':scope > summary').first();
              if (await summary.count() && await summary.isVisible()) await summary.click();
            }
          }

          const candidates = page.locator('#FacetDrawer .facet-form input[type="checkbox"]:not([disabled])');
          let facetIndex = -1;
          const checkboxOptions = await candidates.all();
          for (let index = 0; index < checkboxOptions.length; index += 1) {
            const candidate = checkboxOptions[index];
            const visibleLabelIndex = await candidate.evaluate((input) =>
              Array.from(input.labels || []).findIndex((label) => {
                const rect = label.getBoundingClientRect();
                const style = getComputedStyle(label);
                return rect.width > 0 && rect.height > 0 &&
                  style.display !== 'none' && style.visibility !== 'hidden';
              })
            );
            if (visibleLabelIndex >= 0) {
              facetIndex = index;
              break;
            }
          }

          if (facetIndex >= 0) {
            const facet = candidates.nth(facetIndex);
            const beforeUrl = page.url();
            const beforeCount = await page.locator('#ProductCount').innerText().catch(() => '');
            await facet.evaluate((input) => {
              const label = Array.from(input.labels || []).find((item) => {
                const rect = item.getBoundingClientRect();
                const style = getComputedStyle(item);
                return rect.width > 0 && rect.height > 0 &&
                  style.display !== 'none' && style.visibility !== 'hidden';
              });
              if (!label) throw new Error('Facet checkbox has no visible associated label');
              label.click();
            });
            await page.waitForFunction((beforeUrl) => location.href !== beforeUrl, beforeUrl, { timeout: 12000 }).catch(() => {});
            await page.waitForTimeout(500);
            const afterCount = await page.locator('#ProductCount').innerText().catch(() => '');
            result.facetsInteraction = {
              tested: true,
              checked: await facet.isChecked().catch(() => false),
              urlChanged: page.url() !== beforeUrl,
              productCountBefore: beforeCount,
              productCountAfter: afterCount,
              productCountChanged: beforeCount !== afterCount,
              formPresent: await page.locator('.facet-form[is="facet-form"][data-history]').count() > 0,
              drawerOpened: await page.locator('#FacetDrawer').count() > 0,
              openedFacetGroups: await page.locator('#FacetDrawer .facet-form details[data-filter][open]').count()
            };
            if (!result.facetsInteraction.checked && !result.facetsInteraction.urlChanged) {
              failures.push(`${viewport.name} ${url}: facet click neither checked the filter nor changed the URL`);
            }
          } else {
            result.facetsInteraction = {
              tested: false,
              reason: 'Drawer opened, but no enabled checkbox with a visible associated label was available.',
              drawerOpened: await page.locator('#FacetDrawer').count() > 0,
              facetGroupCount: await facetGroups.count(),
              openFacetGroupCount: await page.locator('#FacetDrawer .facet-form details[data-filter][open]').count(),
              checkboxCount: await candidates.count()
            };
          }
        }

        result.carouselReview = await page.evaluate(() => Array.from(document.querySelectorAll('slider-element[role="region"][aria-roledescription="carousel"]')).map((slider) => ({
          label: slider.getAttribute('aria-label') || slider.getAttribute('aria-labelledby') || '',
          cardCount: slider.querySelectorAll('.card').length,
          focusableControls: Array.from(slider.querySelectorAll('button')).map((button) => ({ name: button.getAttribute('aria-label') || button.innerText.trim(), disabled: button.disabled, tabIndex: button.tabIndex })),
          slides: Array.from(slider.querySelectorAll('.card')).slice(0, 12).map((card) => ({ ariaHidden: card.getAttribute('aria-hidden'), inert: card.hasAttribute('inert'), focusables: card.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length }))
        })));

        if (result.axeViolations.length) failures.push(`${viewport.name} ${url}: axe reported ${result.axeViolations.length} violation(s)`);
        if (viewport.name === 'desktop' && result.diagnostics?.primaryNavigation?.some((nav) =>
          !nav.nativeListSemantics || nav.items.some((item) => !item.nativeListItemSemantics || item.hasRedundantAriaLabel || !item.textWrapperExposed || !item.decorativeCloneIsolated)
        )) failures.push(`${viewport.name} ${url}: desktop navigation does not preserve native list semantics or exposes redundant labels or an interactive/accessibility-exposed animation clone`);
        if (result.navigationTabOrder?.applicable && !result.navigationTabOrder.passed) failures.push(`${viewport.name} ${url}: Tab after the logo does not focus the first primary navigation item`);
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
