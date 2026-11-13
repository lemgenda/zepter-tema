const VERIFY_URL = "https://global.frcapi.com/api/v2/captcha/siteverify";
const RESEND_URL = "https://api.resend.com/emails";
const MAX_BODY_BYTES = 20_000;
const MAX_CAPTCHA_BYTES = 16_384;
const MAX_PROXY_AGE_SECONDS = 5 * 60;
const RATE_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT = 8;

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function textResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret, message, output = "hex") {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return output === "base64url" ? base64Url(signature) : hex(signature);
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function allowedShop(shop, env) {
  return typeof shop === "string" &&
    shop === env.SHOPIFY_SHOP_DOMAIN &&
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

function allowedOrigin(origin) {
  return origin === "https://hyperlightoptics.com";
}

function shopifyOAuthMessage(params) {
  return [...params.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

async function verifyOAuthHmac(url, secret) {
  const params = new URLSearchParams(url.search);
  const supplied = params.get("hmac");
  if (!supplied || params.getAll("hmac").length !== 1) return false;
  const calculated = await hmacSha256(secret, shopifyOAuthMessage(params));
  return safeEqual(supplied.toLowerCase(), calculated);
}

async function verifyAppProxy(url, secret) {
  const params = new URLSearchParams(url.search);
  const signatures = params.getAll("signature");
  if (signatures.length !== 1) return false;
  const supplied = signatures[0];
  const grouped = new Map();
  for (const [key, value] of params.entries()) {
    if (key === "signature") continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(value);
  }
  const message = [...grouped.entries()]
    .map(([key, values]) => `${key}=${values.join(",")}`)
    .sort()
    .join("");
  const calculated = await hmacSha256(secret, message);
  return safeEqual(supplied.toLowerCase(), calculated);
}

function isRecentTimestamp(value, maxAgeSeconds = MAX_PROXY_AGE_SECONDS) {
  if (!/^\d+$/.test(value || "")) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(value));
  return age <= maxAgeSeconds;
}

async function verifyCaptcha(token, env) {
  if (!env.FRC_API_KEY || !env.FRC_SITEKEY) {
    return { ok: false, status: 500, error: "CAPTCHA service is not configured." };
  }
  if (typeof token !== "string" || !token || new TextEncoder().encode(token).length > MAX_CAPTCHA_BYTES) {
    return { ok: false, status: 400, error: "CAPTCHA verification is required." };
  }

  try {
    const upstream = await fetch(VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env.FRC_API_KEY,
      },
      body: JSON.stringify({ response: token, sitekey: env.FRC_SITEKEY }),
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      return { ok: false, status: 502, error: "CAPTCHA verification is temporarily unavailable." };
    }
    const result = await upstream.json();
    if (typeof result.success !== "boolean") {
      return { ok: false, status: 502, error: "Invalid CAPTCHA verification response." };
    }
    if (!result.success) {
      return { ok: false, status: 403, error: "CAPTCHA verification failed. Please try again.", reason: result.error?.error_code || "invalid_response" };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: "CAPTCHA verification is temporarily unavailable." };
  }
}

async function readForm(request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("Request is too large.");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new Error("Request is too large.");
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/x-www-form-urlencoded") &&
      !contentType.includes("multipart/form-data")) {
    throw new Error("Unsupported form encoding.");
  }
  if (contentType.includes("multipart/form-data")) {
    const form = await new Response(raw, { headers: { "Content-Type": contentType } }).formData();
    const values = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") values[key] = value;
    }
    return values;
  }
  const params = new URLSearchParams(raw);
  const values = {};
  for (const [key, value] of params.entries()) {
    if (Object.hasOwn(values, key)) {
      values[key] = Array.isArray(values[key]) ? [...values[key], value] : [values[key], value];
    } else {
      values[key] = value;
    }
  }
  return values;
}

function scalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value, max = 2000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function consumeRateLimit(request, env, route) {
  if (!env.FRIENDLY_CAPTCHA_KV) return true;
  const forwarded = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
  const ip = forwarded.split(",")[0].trim();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const key = `rate:${route}:${hex(digest)}`;
  const now = Math.floor(Date.now() / 1000);
  const existing = await env.FRIENDLY_CAPTCHA_KV.get(key, "json");
  if (existing && existing.resetAt > now && existing.count >= RATE_LIMIT) return false;
  const next = existing && existing.resetAt > now
    ? { count: existing.count + 1, resetAt: existing.resetAt }
    : { count: 1, resetAt: now + RATE_WINDOW_SECONDS };
  await env.FRIENDLY_CAPTCHA_KV.put(key, JSON.stringify(next), { expirationTtl: RATE_WINDOW_SECONDS });
  return true;
}

async function getShopifyToken(shop, env) {
  const stored = await env.FRIENDLY_CAPTCHA_KV.get(`shopify-token:${shop}`, "json");
  return stored?.accessToken || null;
}

async function shopifyGraphql(shop, token, env, query, variables) {
  const version = env.SHOPIFY_API_VERSION || "2026-01";
  const response = await fetch(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Shopify API request failed.");
  const payload = await response.json();
  if (payload.errors?.length) throw new Error("Shopify GraphQL request failed.");
  return payload.data;
}

async function startOAuth(request, env) {
  if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_API_SECRET || !env.FRIENDLY_CAPTCHA_KV) {
    return textResponse("Shopify OAuth is not configured.", 503);
  }
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!allowedShop(shop, env)) return textResponse("Invalid shop.", 400);

  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = base64Url(stateBytes);
  await env.FRIENDLY_CAPTCHA_KV.put(
    `oauth-state:${state}`,
    JSON.stringify({ shop, createdAt: Date.now() }),
    { expirationTtl: 600 },
  );

  const callback = `${env.SHOPIFY_APP_URL}/auth/callback`;
  const authorize = new URL(`https://${shop}/admin/oauth/authorize`);
  authorize.searchParams.set("client_id", env.SHOPIFY_API_KEY);
  authorize.searchParams.set("scope", env.SHOPIFY_SCOPES || "write_app_proxy,write_customers");
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("state", state);
  return Response.redirect(authorize.toString(), 302);
}

async function finishOAuth(request, env) {
  if (!env.SHOPIFY_API_SECRET || !env.SHOPIFY_API_KEY || !env.FRIENDLY_CAPTCHA_KV) {
    return textResponse("Shopify OAuth is not configured.", 503);
  }
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!allowedShop(shop, env) || !code || !state || !(await verifyOAuthHmac(url, env.SHOPIFY_API_SECRET))) {
    return textResponse("Invalid Shopify OAuth callback.", 400);
  }

  const stateKey = `oauth-state:${state}`;
  const stateRecord = await env.FRIENDLY_CAPTCHA_KV.get(stateKey, "json");
  await env.FRIENDLY_CAPTCHA_KV.delete(stateKey);
  if (!stateRecord || stateRecord.shop !== shop || Date.now() - stateRecord.createdAt > 600_000) {
    return textResponse("Expired or mismatched OAuth state.", 400);
  }

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.SHOPIFY_API_KEY,
        client_secret: env.SHOPIFY_API_SECRET,
        code,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return textResponse("Shopify token exchange failed.", 502);
    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      return textResponse("Shopify did not return an access token.", 502);
    }
    await env.FRIENDLY_CAPTCHA_KV.put(
      `shopify-token:${shop}`,
      JSON.stringify({
        accessToken: tokenData.access_token,
        scope: tokenData.scope || "",
        installedAt: new Date().toISOString(),
      }),
    );
    return textResponse("Hyperlight Friendly Captcha has been authorized. You can close this page.");
  } catch {
    return textResponse("Shopify authorization could not be completed.", 502);
  }
}

async function handleContact(request, env) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.CONTACT_TO_EMAIL) {
    return jsonResponse({ ok: false, message: "Contact service is not configured yet." }, 503);
  }
  if (!(await consumeRateLimit(request, env, "contact"))) {
    return jsonResponse({ ok: false, message: "Too many attempts. Please wait and try again." }, 429);
  }

  let form;
  try {
    form = await readForm(request);
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message }, 400);
  }

  if (cleanText(scalar(form.website), 200)) {
    return jsonResponse({ ok: true, message: "Your message has been received." });
  }
  const captcha = await verifyCaptcha(scalar(form["frc-captcha-response"]) || scalar(form.response), env);
  if (!captcha.ok) return jsonResponse({ ok: false, message: captcha.error }, captcha.status);

  const email = cleanText(scalar(form["contact[email]"]), 254).toLowerCase();
  if (!validEmail(email)) return jsonResponse({ ok: false, message: "Enter a valid email address." }, 400);

  const fields = Object.entries(form)
    .filter(([key]) => key.startsWith("contact[") &&
      key !== "contact[email]" && key !== "contact[tags]" && key !== "contact[context]")
    .map(([key, value]) => {
      const label = key.slice(8, -1) || "Message";
      const values = Array.isArray(value) ? value : [value];
      return `${cleanText(label, 120)}:\n${values.map((item) => cleanText(item, 5000)).join(", ")}`;
    });
  const body = [
    "New contact form submission from hyperlightoptics.com",
    `Reply-to: ${email}`,
    "",
    ...fields,
  ].join("\n").slice(0, 15000);

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [env.CONTACT_TO_EMAIL],
        reply_to: email,
        subject: "New contact form submission — Hyperlight Optics",
        text: body,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return jsonResponse({ ok: false, message: "Your message could not be sent. Please try again later." }, 502);
    return jsonResponse({ ok: true, message: "Thank you. Your message has been sent." });
  } catch {
    return jsonResponse({ ok: false, message: "Your message could not be sent. Please try again later." }, 502);
  }
}

async function handleNewsletter(request, env) {
  if (!(await consumeRateLimit(request, env, "newsletter"))) {
    return jsonResponse({ ok: false, message: "Too many attempts. Please wait and try again." }, 429);
  }

  let form;
  try {
    form = await readForm(request);
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message }, 400);
  }

  if (cleanText(scalar(form.website), 200)) {
    return jsonResponse({ ok: true, message: "Thank you for your submission." });
  }
  const captcha = await verifyCaptcha(scalar(form["frc-captcha-response"]) || scalar(form.response), env);
  if (!captcha.ok) return jsonResponse({ ok: false, message: captcha.error }, captcha.status);

  const email = cleanText(scalar(form["contact[email]"]), 254).toLowerCase();
  if (!validEmail(email)) return jsonResponse({ ok: false, message: "Enter a valid email address." }, 400);
  if (scalar(form.newsletter_consent) !== "yes") {
    return jsonResponse({ ok: false, message: "Please confirm that you agree to receive email marketing." }, 400);
  }

  const shop = env.SHOPIFY_SHOP_DOMAIN;
  const token = await getShopifyToken(shop, env);
  if (!token) return jsonResponse({ ok: false, message: "Newsletter service is not connected to Shopify yet." }, 503);

  try {
    const customerData = await shopifyGraphql(shop, token, env, `
      mutation CustomerSet($identifier: CustomerSetIdentifiers, $input: CustomerSetInput!) {
        customerSet(identifier: $identifier, input: $input) {
          customer { id }
          userErrors { field message }
        }
      }
    `, {
      identifier: { email },
      input: { email },
    });
    const customerResult = customerData.customerSet;
    if (customerResult.userErrors?.length || !customerResult.customer?.id) {
      return jsonResponse({ ok: false, message: "Your subscription could not be saved. Please try again later." }, 502);
    }

    const consentData = await shopifyGraphql(shop, token, env, `
      mutation UpdateEmailConsent($input: CustomerEmailMarketingConsentUpdateInput!) {
        customerEmailMarketingConsentUpdate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }
    `, {
      input: {
        customerId: customerResult.customer.id,
        emailMarketingConsent: {
          consentUpdatedAt: new Date().toISOString(),
          marketingOptInLevel: "SINGLE_OPT_IN",
          marketingState: "SUBSCRIBED",
        },
      },
    });
    if (consentData.customerEmailMarketingConsentUpdate.userErrors?.length) {
      return jsonResponse({ ok: false, message: "Your subscription could not be confirmed. Please try again later." }, 502);
    }
    return jsonResponse({ ok: true, message: "Thank you for subscribing." });
  } catch {
    return jsonResponse({ ok: false, message: "Newsletter service is temporarily unavailable." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (url.pathname === "/" && request.method === "GET") {
      return jsonResponse({ service: "Friendly Captcha verification", status: "running" });
    }

    // Existing browser-side verification endpoint is intentionally preserved.
    if (url.pathname === "/verify") {
      if (!origin || !allowedOrigin(origin)) return jsonResponse({ error: "Origin not allowed" }, 403);
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
            "Vary": "Origin",
          },
        });
      }
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, {
        "Access-Control-Allow-Origin": origin,
      });
      if (!request.headers.get("Content-Type")?.includes("application/json")) {
        return jsonResponse({ error: "Content-Type must be application/json" }, 415, {
          "Access-Control-Allow-Origin": origin,
        });
      }
      let body;
      try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
          return jsonResponse({ error: "Request too large" }, 413, { "Access-Control-Allow-Origin": origin });
        }
        body = JSON.parse(raw);
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400, { "Access-Control-Allow-Origin": origin });
      }
      const result = await verifyCaptcha(body?.response, env);
      if (!result.ok) {
        if (result.status === 403) {
          return jsonResponse({ valid: false, reason: result.reason || "invalid_response" }, 403, {
            "Access-Control-Allow-Origin": origin,
          });
        }
        const legacyError = result.status === 500
          ? "Server configuration error"
          : result.status === 400
            ? "Invalid CAPTCHA response"
            : "CAPTCHA verification service unavailable";
        return jsonResponse({ error: legacyError }, result.status, {
          "Access-Control-Allow-Origin": origin,
        });
      }
      return jsonResponse({ valid: true }, 200, { "Access-Control-Allow-Origin": origin });
    }

    if (url.pathname === "/auth" && request.method === "GET") return startOAuth(request, env);
    if (url.pathname === "/auth/callback" && request.method === "GET") return finishOAuth(request, env);

    if (url.pathname === "/shopify-proxy/contact" || url.pathname === "/shopify-proxy/newsletter") {
      if (request.method !== "POST") return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
      if (!env.SHOPIFY_API_SECRET || !env.FRIENDLY_CAPTCHA_KV) {
        return jsonResponse({ ok: false, message: "Shopify proxy is not configured." }, 503);
      }
      if (!(await verifyAppProxy(url, env.SHOPIFY_API_SECRET))) {
        return jsonResponse({ ok: false, message: "Invalid Shopify proxy signature." }, 401);
      }
      const shop = url.searchParams.get("shop");
      if (!allowedShop(shop, env) || !isRecentTimestamp(url.searchParams.get("timestamp"))) {
        return jsonResponse({ ok: false, message: "Invalid or expired Shopify proxy request." }, 401);
      }
      const pathPrefix = url.searchParams.get("path_prefix");
      if (pathPrefix !== "/apps/friendly-captcha") {
        return jsonResponse({ ok: false, message: "Unexpected Shopify app proxy path." }, 403);
      }
      return url.pathname.endsWith("/contact")
        ? handleContact(request, env)
        : handleNewsletter(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
