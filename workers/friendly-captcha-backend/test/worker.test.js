import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker from "../src/index.js";

const env = {
  SHOPIFY_API_KEY: "test-client-id",
  SHOPIFY_API_SECRET: "test-client-secret",
  SHOPIFY_SHOP_DOMAIN: "9tn18h-qb.myshopify.com",
  SHOPIFY_APP_URL: "https://friendly-captcha-backend.lemgenda-obrt.workers.dev",
  SHOPIFY_SCOPES: "write_app_proxy,write_customers",
  FRC_SITEKEY: "test-sitekey",
  FRC_API_KEY: "test-frc-key",
  FRIENDLY_CAPTCHA_KV: {
    async get() { return null; },
    async put() {},
    async delete() {},
  },
};

test("health endpoint remains available", async () => {
  const response = await worker.fetch(new Request("https://worker.example/"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "Friendly Captcha verification",
    status: "running",
  });
});

test("unknown routes return 404", async () => {
  const response = await worker.fetch(new Request("https://worker.example/nope"), env);
  assert.equal(response.status, 404);
});

test("existing /verify route still enforces the storefront origin", async () => {
  const response = await worker.fetch(new Request("https://worker.example/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ response: "test-token" }),
  }), env);
  assert.equal(response.status, 403);
});

test("existing /verify route still verifies with Friendly Captcha", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  try {
    const response = await worker.fetch(new Request("https://worker.example/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://hyperlightoptics.com" },
      body: JSON.stringify({ response: "test-token" }),
    }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { valid: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Shopify proxy rejects a request without a valid signature", async () => {
  const response = await worker.fetch(new Request(
    "https://worker.example/shopify-proxy/contact?shop=9tn18h-qb.myshopify.com&timestamp=1893456000&path_prefix=%2Fapps%2Ffriendly-captcha",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "contact%5Bemail%5D=test%40example.com",
    },
  ), env);
  assert.equal(response.status, 401);
});

test("Shopify proxy validates the signature before requiring CAPTCHA", async () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = new URLSearchParams({
    shop: env.SHOPIFY_SHOP_DOMAIN,
    timestamp,
    path_prefix: "/apps/friendly-captcha",
    logged_in_customer_id: "",
  });
  const canonical = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("");
  const signature = createHmac("sha256", env.SHOPIFY_API_SECRET).update(canonical).digest("hex");
  params.set("signature", signature);

  const response = await worker.fetch(new Request(
    `https://worker.example/shopify-proxy/contact?${params.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "contact%5Bemail%5D=test%40example.com",
    },
  ), env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /CAPTCHA/);
});

test("OAuth start rejects a shop outside the configured allowlist", async () => {
  const response = await worker.fetch(new Request(
    "https://worker.example/auth?shop=attacker.myshopify.com",
  ), env);
  assert.equal(response.status, 400);
});
