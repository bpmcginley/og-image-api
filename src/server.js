import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, stripeEnabled } from "./config.js";
import { renderPng, themeNames } from "./render.js";
import { authAndMeter, quotaFor } from "./auth.js";
import { createAccount, getAccountByEmail, getAccountByKey } from "./db.js";
import { createCheckout, createPortal, handleWebhook } from "./stripe.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Stripe webhook needs the raw body, so mount it BEFORE the JSON parser.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    if (!stripeEnabled) return res.status(503).end();
    try {
      const type = handleWebhook(req.body, req.get("stripe-signature"));
      res.json({ received: true, type });
    } catch (err) {
      res.status(400).send(`Webhook error: ${err.message}`);
    }
  },
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// --- Image generation ---
app.get("/api/og", authAndMeter, async (req, res) => {
  try {
    const png = await renderPng({
      title: req.query.title,
      description: req.query.description,
      eyebrow: req.query.eyebrow,
      footer: req.query.footer,
      theme: req.query.theme,
      logo: req.query.logo,
      bg: req.query.bg,
      accent: req.query.accent,
      fg: req.query.fg,
      watermark: req.account.plan !== "pro",
    });
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: "Render failed: " + err.message });
  }
});

// Free, unauthenticated preview (always watermarked) for the landing page.
app.get("/api/preview", async (req, res) => {
  try {
    const png = await renderPng({
      title: req.query.title,
      description: req.query.description,
      eyebrow: req.query.eyebrow,
      footer: req.query.footer,
      theme: req.query.theme,
      logo: req.query.logo,
      bg: req.query.bg,
      accent: req.query.accent,
      fg: req.query.fg,
      watermark: true,
    });
    res.set("Content-Type", "image/png");
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: "Render failed: " + err.message });
  }
});

// --- Account signup (issues an API key) ---
app.post("/api/signup", (req, res) => {
  const email = (req.body?.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email required." });
  }
  if (getAccountByEmail(email)) {
    return res
      .status(409)
      .json({ error: "An account with that email already exists." });
  }
  const account = createAccount(email);
  res.json({
    api_key: account.api_key,
    plan: account.plan,
    quota: quotaFor(account.plan),
  });
});

// --- Account status ---
app.get("/api/account", (req, res) => {
  const key = req.query.key || req.get("x-api-key");
  const account = getAccountByKey(key);
  if (!account) return res.status(401).json({ error: "Invalid API key." });
  res.json({
    email: account.email,
    plan: account.plan,
    quota: quotaFor(account.plan),
    used_this_month:
      account.usage_period === new Date().toISOString().slice(0, 7)
        ? account.usage_count
        : 0,
    stripe_enabled: stripeEnabled,
  });
});

// --- Billing ---
app.post("/api/billing/checkout", async (req, res) => {
  if (!stripeEnabled)
    return res.status(503).json({ error: "Billing not configured yet." });
  try {
    const url = await createCheckout(req.body?.key);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/billing/portal", async (req, res) => {
  if (!stripeEnabled)
    return res.status(503).json({ error: "Billing not configured yet." });
  try {
    const url = await createPortal(req.body?.key);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    themes: themeNames,
    stripe_enabled: stripeEnabled,
    commit: (process.env.RENDER_GIT_COMMIT || "local").slice(0, 7),
  });
});

app.listen(config.port, () => {
  console.log(`Unfurl listening on ${config.baseUrl} (port ${config.port})`);
  console.log(`Stripe billing: ${stripeEnabled ? "enabled" : "NOT configured"}`);
});
