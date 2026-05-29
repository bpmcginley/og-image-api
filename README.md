# Unfurl

A self-hostable micro-SaaS that generates dynamic Open Graph / social-share
images (1200×630 PNG) from URL parameters. Ships with API-key auth, monthly
usage quotas, a free tier with watermark, and a Stripe subscription for the
paid tier — plus a landing page, live demo, and customer dashboard.

## What it does

`GET /api/og?title=...&description=...&theme=...&key=YOUR_KEY` → a PNG.

Customers paste that URL into their `<meta property="og:image">` tag and get a
custom share image with zero design work. Free keys are watermarked and capped;
Pro keys ($9/mo by default) are watermark-free with a high quota.

## Run locally

```bash
npm install
cp .env.example .env      # edit values
npm start                 # http://localhost:3000
```

Open the URL — the landing page has a live demo, signup (issues an API key),
pricing, and a dashboard.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/og` | Generate image (auth + metered) |
| GET | `/api/preview` | Watermarked demo render (no auth) |
| POST | `/api/signup` | `{email}` → issues an API key |
| GET | `/api/account?key=` | Plan + usage for a key |
| POST | `/api/billing/checkout` | `{key}` → Stripe Checkout URL |
| POST | `/api/billing/portal` | `{key}` → Stripe billing portal URL |
| POST | `/api/stripe/webhook` | Stripe webhook (flips plan on payment) |

Query params for `/api/og` and `/api/preview`: `title`, `description`,
`eyebrow`, `footer`, `theme` (`dark`, `light`, `sunset`, `forest`, `grape`).
The key may be passed as `?key=`, an `x-api-key` header, or `Authorization: Bearer`.

## Connecting YOUR Stripe (turning on revenue)

This is the part only you can do — it needs your identity and bank details.

1. Create a Stripe account at https://dashboard.stripe.com (do this yourself).
2. **Products → add a product**, add a recurring monthly price (e.g. $9/mo).
   Copy the price ID (`price_...`) into `STRIPE_PRICE_ID`.
3. **Developers → API keys** — copy the secret key into `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks → add endpoint**:
   - URL: `https://YOUR_DOMAIN/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
5. Set `BASE_URL` to your public URL and restart.

When `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` are set, the "Upgrade to Pro"
button goes live and paid webhooks automatically promote accounts to `pro`.

## Deploying

Any Node host works (Render, Railway, Fly.io, a VPS). Requirements:

- Node 18+.
- A persistent disk for `data.db` (SQLite). On ephemeral hosts, mount a volume
  or swap `db.js` for Postgres.
- Set all env vars from `.env.example`.
- Point a domain at it and serve over HTTPS (required by Stripe webhooks and by
  Twitter/LinkedIn when they fetch your `og:image`).

## Getting to $100 MRR

$100/mo ≈ 12 Pro subscribers at $9. The code is done; the growth levers are:

- **Distribution:** post on Product Hunt, r/webdev, Indie Hackers, X/Twitter
  dev community. A live, editable demo (already built) converts well.
- **SEO:** the landing page targets "dynamic og image" / "social share image
  api" — give it real copy and a custom domain.
- **Free tier as funnel:** the 200-image cap + watermark nudges active users to
  upgrade. Tune `FREE_MONTHLY_QUOTA` / price to taste.

## Notes / honest limitations

- Text layout uses approximate width-based word wrapping (no headless browser),
  which keeps it fast and cheap but isn't pixel-perfect for every font.
- SQLite is fine for early traffic; migrate to Postgres before serious scale.
- Add rate-limiting / a CDN cache in front of `/api/og` for production.
