# Friendly Captcha Shopify backend

Cloudflare Worker for the Hyperlight Optics Shopify storefront. This source is prepared for review and local tests; it is **not deployed by this commit**.

## Implemented routes

| Route | Purpose |
|---|---|
| `GET /` | Health response |
| `POST /verify` | Existing Friendly Captcha v2 browser verification endpoint; retained |
| `GET /auth?shop=...` | Starts Shopify OAuth authorization |
| `GET /auth/callback` | Validates OAuth HMAC/state, exchanges the code, stores the offline token in KV |
| `POST /shopify-proxy/contact` | Verifies Shopify App Proxy signature and Friendly Captcha, then sends contact email through Resend |
| `POST /shopify-proxy/newsletter` | Verifies Shopify App Proxy signature and Friendly Captcha, then upserts a Shopify customer and records explicit email-marketing consent |

The App Proxy configuration must point to `/shopify-proxy`, with prefix `apps` and subpath `friendly-captcha`. Shopify forwards child paths, such as `/apps/friendly-captcha/contact`, to `/shopify-proxy/contact`.

## Required Cloudflare configuration

### Existing configuration to retain

- KV binding: `FRIENDLY_CAPTCHA_KV` → namespace ID `a1785f53c0384c2cb2051a799ddc908b`
- Secret: `FRC_API_KEY`
- Secret: `SHOPIFY_API_SECRET`
- Variable: `FRC_SITEKEY`

### Variables

`wrangler.jsonc` contains the known, non-secret deployment values. Confirm these before deployment:

- `SHOPIFY_APP_URL`
- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_SCOPES`
- `SHOPIFY_API_VERSION`
- `FRC_SITEKEY`
- `RESEND_FROM_EMAIL`

Set `SHOPIFY_API_KEY` to the Shopify app Client ID. It is an identifier, not a secret.

Set `CONTACT_TO_EMAIL` to the actual mailbox that should receive contact requests. This address has not been supplied and is deliberately not invented.

### Secrets to add only after prerequisites are ready

- `RESEND_API_KEY` — create only after Resend verifies `mail.hyperlightoptics.com`.
- Keep `FRC_API_KEY` and `SHOPIFY_API_SECRET` in Cloudflare Secrets; never add them to this repository.

Example PowerShell commands (run from this directory):

```powershell
npx wrangler secret put SHOPIFY_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CONTACT_TO_EMAIL
```

Wrangler prompts for each value. The Shopify Client ID and contact destination can also be configured as Worker variables instead of secrets; using secrets here avoids putting operational identifiers in command history. Never paste secret values into chat.

## Shopify Dev Dashboard draft

Keep the existing draft unpublished until the Worker is configured and tested.

- App URL: `https://friendly-captcha-backend.lemgenda-obrt.workers.dev/`
- Allowed redirection URL: `https://friendly-captcha-backend.lemgenda-obrt.workers.dev/auth/callback`
- Required scopes: `write_app_proxy,write_customers`
- Embedded app: `false`
- App Proxy prefix: `apps`
- App Proxy subpath: `friendly-captcha`
- App Proxy URL: `https://friendly-captcha-backend.lemgenda-obrt.workers.dev/shopify-proxy`

Do not publish or release the draft until the deployed Worker and callback URL are ready. OAuth must be completed by a Shopify user authorized to install apps and approve the requested scopes.

## Local checks

Requires Node.js 22 or later.

```powershell
npm test
```

Deploy only after the release checklist below is complete:

```powershell
npx wrangler deploy
```

This repository change does not deploy anything automatically.

## Important implementation boundaries

- The existing `/verify` endpoint remains available and keeps its storefront-origin check.
- Native Shopify `/contact` and customer-account endpoints are not intercepted. The migrated contact/newsletter forms must submit to the App Proxy endpoints.
- The newsletter route requires `newsletter_consent=yes`. The theme must display an unchecked, explicit consent checkbox before this route is enabled.
- The contact route preserves arbitrary `contact[...]` custom fields in the email body.
- No login, registration, password-recovery, checkout, or native customer-account flows are modified.
- Shopify-managed CAPTCHA remains enabled until the new contact and newsletter flows pass direct-request, invalid-token, keyboard, screen-reader, and end-to-end tests.

## Operational limitations and hardening before production

- KV-based per-IP throttling is best-effort because KV is eventually consistent and increments are not atomic. Add a Cloudflare WAF/rate-limiting rule for the App Proxy routes before production.
- App Proxy signatures authenticate that Shopify forwarded the request; they do not prove a human submitted it. CAPTCHA verification remains mandatory.
- App Proxy requests are timestamp-checked and scoped to the configured shop and proxy prefix.
- The Worker never logs submitted contact fields, email addresses, CAPTCHA tokens, or access tokens.
- OAuth state is short-lived and bound to the configured shop. The offline access token is stored in KV, not in source code.
- Resend must verify the sending domain before the contact route can work.
- Shopify protected-customer-data requirements and the store's approval for customer data access must be satisfied for Admin GraphQL customer operations.

## Release checklist

1. Confirm Resend domain status is **Verified**.
2. Set the actual contact-recipient mailbox and create the Resend API key.
3. Confirm the Client ID, callback URL, scopes, App Proxy URL, prefix, and subpath in the Shopify draft.
4. Configure Worker variables/secrets and verify the KV binding.
5. Run `npm test`; review all results.
6. Deploy the Worker from this directory.
7. Publish/release the Shopify app version and install/authorize it on the production store with an authorized Shopify account.
8. Confirm the OAuth callback stored an offline token in KV without exposing it.
9. Test App Proxy signatures, missing/invalid/expired/replayed CAPTCHA tokens, valid contact delivery, newsletter consent, and failure handling.
10. Only then update the theme forms and JavaScript. Preserve Shopify's native CAPTCHA for all unmigrated forms.

## Shopify API behavior

The newsletter flow uses `customerSet` to upsert by email, then `customerEmailMarketingConsentUpdate` to record the explicit consent. It does not pass a `tags` list to `customerSet`, because that field replaces existing customer tags.

References:

- Shopify OAuth: https://shopify.dev/docs/apps/build/authentication-authorization
- Shopify App Proxy: https://shopify.dev/docs/apps/build/online-store/app-proxies
- App Proxy signature verification: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
- Shopify `customerSet`: https://shopify.dev/docs/api/admin-graphql/2026-01/mutations/customerSet
- Shopify email consent mutation: https://shopify.dev/docs/api/admin-graphql/2026-01/mutations/customerEmailMarketingConsentUpdate
- Friendly Captcha v2 verification: https://developer.friendlycaptcha.com/docs/v2/getting-started/verify
- Resend API: https://resend.com/docs/api-reference/emails/send-email
