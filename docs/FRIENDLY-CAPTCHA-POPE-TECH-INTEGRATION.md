# Friendly Captcha and Pope Tech Integration Plan

**Repository:** `lemgenda/zepter-tema`  
**Target storefront:** `https://hyperlightoptics.com`  
**Reviewed branch:** `wcag-22`  
**Decision status:** Pope Tech is ready for dashboard configuration. Friendly Captcha migration is **blocked pending a supported server-side integration design**.

This document records the implementation choices after reviewing the current Shopify theme. It intentionally does not add a front-end CAPTCHA widget or disable Shopify's protection until the server-side enforcement path is available.

## 1. Current theme architecture

The theme uses Shopify-native Liquid form tags:

| Storefront flow | Theme implementation | Shopify form type |
|---|---|---|
| Contact | `sections/contact-form.liquid` | `contact` |
| Newsletter | `snippets/newsletter-form.liquid` | `customer` with `contact[tags]=newsletter` |
| Customer login | `sections/main-login.liquid` | `customer_login` |
| Password recovery | `sections/main-login.liquid` | `recover_customer_password` |
| Customer registration | `sections/main-register.liquid` | `create_customer` |

The layout retains Shopify's `content_for_header`, and the contact form renders Shopify's spam-protection disclaimer. No custom hCaptcha script, hCaptcha widget markup, Friendly Captcha integration, server-side verification endpoint, or Pope Tech integration was found in the reviewed theme files.

The theme already has a WCAG 2.2 CI workflow at `.github/workflows/wcag-22.yml`, including Playwright and axe-based browser checks. Pope Tech should complement—not replace—these repository checks.

## 2. Friendly Captcha: implementation decision

### 2.1 Decision: do not replace Shopify hCaptcha with a theme-only integration

**Keep Shopify-managed hCaptcha enabled for now. Do not add Friendly Captcha scripts/widgets to the existing native forms and do not disable Shopify hCaptcha yet.**

Reasons:

1. Shopify automatically wires its CAPTCHA protection to supported native storefront forms. The theme currently uses those native forms.
2. Friendly Captcha's widget creates a `frc-captcha-response` token, but that token is not automatically verified by Shopify when Shopify receives a native form submission.
3. Friendly Captcha explicitly requires server-side verification. A successful browser-side widget or a JavaScript submit handler is not server-side enforcement.
4. A JavaScript handler that calls a verification endpoint and then submits the native Shopify form is bypassable: a bot can post directly to the Shopify form endpoint without running the browser JavaScript.
5. A theme cannot securely hold the Friendly Captcha API key or create a server-side enforcement hook for Shopify's native login, registration, and password-recovery endpoints.
6. Friendly Captcha's current Shopify product page says a fully pre-built Shopify integration is still in development and directs Enterprise customers to its support team for integration assistance.

This means that adding only a widget to `contact-form.liquid`, `newsletter-form.liquid`, `main-login.liquid`, or `main-register.liquid` would create the appearance of protection without proving that every submission is protected.

### 2.2 Recommended migration path

Before changing the storefront, request a supported Shopify integration design from Friendly Captcha and confirm which Shopify form types it can protect with authoritative server-side verification.

Use this order of preference:

1. **Preferred:** a supported Friendly Captcha Shopify integration that verifies tokens server-side and explicitly supports Shopify contact, newsletter, login, registration, and password-recovery flows.
2. **Conditional alternative:** a custom Shopify app/backend designed for the specific flows it can safely own. The backend must verify the Friendly Captcha token before accepting or processing the form data. Contact/newsletter may be moved to backend-owned submission flows if the app can safely process and forward them. Customer authentication must not be proxied or reimplemented casually.
3. **Fallback:** retain Shopify hCaptcha for native Shopify forms. Do not claim Friendly Captcha protection where no server-side enforcement exists.

Do not treat an App Proxy as a generic interception layer for Shopify's native form endpoints. An App Proxy can route requests addressed to the app proxy path; it does not automatically intercept Shopify's native `/contact`, `/account/login`, or customer registration endpoints.

### 2.3 Friendly Captcha account and API configuration

When the supported integration architecture has been agreed:

- Create an application for `hyperlightoptics.com`; add `www.hyperlightoptics.com` only if the storefront genuinely serves that hostname.
- Record the public sitekey as a deployment configuration value. A sitekey is not a secret, but it must not be guessed or fabricated.
- Create a server API key and store it only in the backend secret manager. Never commit it to Git, theme settings, Liquid, JavaScript, or GitHub source files.
- Prefer Friendly Captcha v2. The current v2 site SDK uses a pinned `@friendlycaptcha/sdk` version and the `frc-captcha` widget class. Do not copy the old `1.0.2` version from the original draft without checking the current release.
- Consider the dedicated EU endpoint if the Friendly Captcha account and sitekey are enabled for it. The widget and verification endpoint must use a compatible configured endpoint.
- Verify the submitted `frc-captcha-response` token server-side against the Friendly Captcha v2 siteverify API. Reject missing, invalid, expired, replayed, or otherwise unsuccessful responses. Never accept a client-supplied `success: true` value as proof.

### 2.4 Required security and functional acceptance tests

A migration is not complete until all of the following are demonstrated:

- A valid token is verified by the backend and the form's intended operation succeeds.
- Missing, malformed, expired, invalid, and replayed tokens are rejected by the backend.
- Direct HTTP submission that bypasses storefront JavaScript is rejected.
- The Friendly Captcha API key is absent from all browser requests, HTML, theme assets, source maps, and repository history.
- Verification failures produce an accessible, localized error and preserve entered form values where possible.
- Keyboard-only and screen-reader users can complete the flow.
- Login, registration, recovery, contact, and newsletter are tested independently; success on one form does not establish coverage for the others.
- Shopify hCaptcha is disabled only for the specific form categories that have been migrated and verified. Keep the remaining Shopify protections enabled.
- Rollback to Shopify hCaptcha is documented and tested.

## 3. Pope Tech: recommended monitoring configuration

### 3.1 Decision: configure Pope Tech in its dashboard, not in the theme

Pope Tech is a hosted crawler/scanner and reporting service. Its website registration, crawl configuration, scheduled scans, and report recipients belong in the Pope Tech dashboard. There is no reason to add a Pope Tech script to `layout/theme.liquid`.

The repository's Playwright/axe workflow should remain the source-controlled, pull-request/commit regression gate. Pope Tech provides complementary scheduled, site-wide WAVE-based monitoring and longitudinal reporting.

### 3.2 Website configuration

Create one website entry:

- Website URL: `https://hyperlightoptics.com/`
- Use the canonical hostname only; do not add the www hostname as a second website unless it serves a separate canonical storefront.
- Enable crawling and use the storefront sitemap where supported.
- Start with a page cap that matches the purchased Pope Tech tier. If the account includes 50 pages, use 50; do not assume that every Team account has the same entitlement.
- Start with crawl depth 3. Increase to 4 only if the initial crawl misses meaningful product, collection, or editorial pages.
- Use the normal WAVE scan engine/default scanner settings unless Pope Tech support recommends otherwise.
- Use a conservative/low scan rate initially if the storefront firewall, CDN, or bot controls throttle crawlers.

### 3.3 Page coverage and exclusions

Prioritize representative public templates rather than spending the page quota on many URL variants.

Include representative URLs for:

- Homepage.
- Main collection and at least one filtered collection state.
- Product detail pages, including a product with variants.
- FAQ and other editorial/content pages.
- Contact page.
- Search page.
- Public login and registration pages, if the crawler can access them without authentication.

Avoid duplicate crawl entries for:

- Tracking parameters and campaign parameters.
- Sorting/filter combinations that create large numbers of near-duplicate URLs.
- Predictive-search and query-result variants that do not represent distinct templates.
- Cart URLs with session-specific state.

Do not expect a normal public crawl to validate checkout or authenticated customer-account states. Those flows require dedicated authenticated/manual testing and the existing browser tests. Do not exclude an entire functional template merely because some query-string variants are redundant.

### 3.4 Schedule and reporting

After the initial crawl and scan are reviewed:

- Run the initial scan manually.
- Review both Errors and Alerts; manually validate alerts rather than treating every alert as a confirmed WCAG failure.
- Configure a weekly recurring scan for an actively maintained storefront. Monthly is acceptable only if the site changes infrequently.
- Send reports to the responsible accessibility/development mailbox and the client recipients authorized by the account owner.
- Prefer PDF for stakeholder distribution and retain the detailed results in Pope Tech for developer triage.
- Re-scan after fixes and record the scan date, scanned page count, unscanned pages, and remaining findings.

The exact schedule, report recipients, and page cap are account-level settings and cannot be safely committed in this theme repository.

### 3.5 Triage policy

For each new Pope Tech finding:

1. Confirm that the affected URL was successfully scanned.
2. Open the finding and inspect the actual DOM/context.
3. Classify it as a confirmed defect, a false positive, or a manual-review alert.
4. Fix confirmed theme defects in source code and add/extend an automated regression test where practical.
5. Re-scan the affected page and verify that the issue is resolved.
6. Record findings from app-generated or third-party content separately; fix them in the app configuration/vendor integration where possible.
7. Do not use a zero-error scan as proof of WCAG conformance. Automated tools cannot verify every success criterion or every assistive-technology interaction.

## 4. Existing accessibility app embeds

The current `config/settings_data.json` contains enabled app-embed entries for:

- Accessibility Spark
- Avada Accessibility
- UserWay

The repository state indicates all three embed blocks are enabled (`disabled: false`). This should be reviewed in Shopify Theme Editor before the next release.

**Recommendation:** avoid running three overlapping accessibility overlay widgets simultaneously. They can create competing controls, duplicate UI, extra scripts, and inconsistent assistive-technology behavior. Select at most one only if there is a documented business requirement and it passes the same manual accessibility tests as the theme. These widgets do not replace fixing the underlying theme or achieving WCAG conformance. Do not disable any embed without confirming its business owner and testing the storefront.

Pope Tech is a monitoring/scanning platform, not another storefront overlay, so it can be used alongside the theme's existing CI.

## 5. Repository changes and external prerequisites

### Safe repository-side work

- Keep Shopify-native CAPTCHA wiring intact until a server-enforced alternative is available.
- Keep the existing WCAG 2.2 CI workflow.
- Use this document as the implementation and release gate for the two services.
- Keep all credentials outside the repository.

### External actions required

| Action | Required access |
|---|---|
| Create Friendly Captcha application and sitekey | Friendly Captcha dashboard |
| Create Friendly Captcha API key | Friendly Captcha dashboard |
| Agree on server-side Shopify integration architecture | Friendly Captcha support and backend/app owner |
| Deploy and configure the verification backend | Backend hosting/account and secret manager |
| Change Shopify spam-protection settings | Shopify Admin |
| Add website, set page cap, crawl and scan | Pope Tech dashboard |
| Configure weekly schedule and recipients | Pope Tech dashboard |

No credentials, sitekey, API token, Pope Tech organization slug, or website ID were present in the repository. None should be invented or committed.

## 6. Official technical references

- Shopify theme CAPTCHA documentation: https://shopify.dev/docs/storefronts/themes/trust-security/captcha
- Shopify online-store preferences and hCaptcha: https://help.shopify.com/en/manual/online-store/setting-up/preferences
- Friendly Captcha Shopify integration status: https://friendlycaptcha.com/integrations/shopify-captcha/
- Friendly Captcha v2 hCaptcha migration: https://developer.friendlycaptcha.com/docs/v2/guides/migrating-from-hcaptcha
- Friendly Captcha v2 widget installation: https://developer.friendlycaptcha.com/docs/v2/getting-started/install
- Friendly Captcha v2 server verification: https://developer.friendlycaptcha.com/docs/v2/getting-started/verify
- Pope Tech API documentation: https://api.pope.tech/docs
- Pope Tech platform and manual-testing guidance: https://www.pope.tech/websites

---

**Final recommendation:** configure Pope Tech now in its hosted dashboard and retain the current CI checks. Do not switch off Shopify hCaptcha or add a Friendly Captcha widget to the native forms until a backend-enforced, form-by-form integration has been approved and tested.
