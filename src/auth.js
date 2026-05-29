import { config } from "./config.js";
import { getAccountByKey, recordUsage } from "./db.js";

function extractKey(req) {
  const header = req.get("authorization");
  if (header && header.startsWith("Bearer ")) return header.slice(7).trim();
  return req.get("x-api-key") || req.query.key || null;
}

export function quotaFor(plan) {
  return plan === "pro" ? config.quotas.pro : config.quotas.free;
}

// Express middleware: authenticates the request, enforces the monthly
// quota, and counts the call. Attaches `req.account` on success.
export function authAndMeter(req, res, next) {
  const key = extractKey(req);
  if (!key) {
    return res
      .status(401)
      .json({ error: "Missing API key. Pass ?key=, x-api-key header, or Bearer token." });
  }

  const account = getAccountByKey(key);
  if (!account) {
    return res.status(401).json({ error: "Invalid API key." });
  }

  const limit = quotaFor(account.plan);
  const used = recordUsage(account.id);
  if (used > limit) {
    return res.status(429).json({
      error: "Monthly quota exceeded.",
      plan: account.plan,
      limit,
      upgrade_url: `${config.baseUrl}/#pricing`,
    });
  }

  req.account = account;
  req.usageRemaining = limit - used;
  res.set("X-Quota-Limit", String(limit));
  res.set("X-Quota-Remaining", String(Math.max(0, limit - used)));
  next();
}
