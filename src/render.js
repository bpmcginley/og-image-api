import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

const THEMES = {
  dark: { bg1: "#0f172a", bg2: "#1e293b", fg: "#f8fafc", muted: "#94a3b8", accent: "#38bdf8" },
  light: { bg1: "#ffffff", bg2: "#f1f5f9", fg: "#0f172a", muted: "#64748b", accent: "#2563eb" },
  sunset: { bg1: "#7c2d12", bg2: "#b91c1c", fg: "#fff7ed", muted: "#fed7aa", accent: "#fbbf24" },
  forest: { bg1: "#052e16", bg2: "#14532d", fg: "#f0fdf4", muted: "#bbf7d0", accent: "#4ade80" },
  grape: { bg1: "#2e1065", bg2: "#5b21b6", fg: "#faf5ff", muted: "#ddd6fe", accent: "#c084fc" },
};

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Only accept #rgb / #rrggbb (optional leading #). Anything else falls back,
// which prevents query params from injecting markup into SVG attributes.
function sanitizeColor(input, fallback) {
  if (typeof input !== "string") return fallback;
  const v = input.trim();
  if (/^#?[0-9a-fA-F]{3}$/.test(v) || /^#?[0-9a-fA-F]{6}$/.test(v)) {
    return v.startsWith("#") ? v : "#" + v;
  }
  return fallback;
}

// Lighten (pct > 0) or darken (pct < 0) a hex color.
function shade(hex, pct) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const f = 1 + pct;
  const channel = (i) =>
    Math.max(0, Math.min(255, Math.round(parseInt(full.slice(i, i + 2), 16) * f)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

// Greedy word-wrap using an approximate average glyph width.
function wrapText(text, fontSize, maxWidth, maxLines) {
  const avgCharWidth = fontSize * 0.56;
  const maxChars = Math.max(1, Math.floor(maxWidth / avgCharWidth));
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let last = lines[maxLines - 1];
    while (last.length > 3 && last.length > maxChars - 1) last = last.slice(0, -1);
    lines[maxLines - 1] = last.replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

// Build the theme, applying any per-request color overrides.
function resolveTheme(opts) {
  const base = THEMES[opts.theme] || THEMES.dark;
  const theme = { ...base };
  if (opts.bg) {
    const bg = sanitizeColor(opts.bg, base.bg1);
    theme.bg1 = bg;
    theme.bg2 = shade(bg, -0.28);
  }
  theme.accent = sanitizeColor(opts.accent, theme.accent);
  theme.fg = sanitizeColor(opts.fg, theme.fg);
  return theme;
}

export function buildSvg(opts, logoDataUri) {
  const theme = resolveTheme(opts);
  const title = opts.title || "Your title here";
  const description = opts.description || "";
  const eyebrow = opts.eyebrow || "";
  const footer = opts.footer || "";
  const hasLogo = Boolean(logoDataUri);

  const titleSize = title.length > 60 ? 60 : title.length > 35 ? 72 : 88;
  const titleLines = wrapText(title, titleSize, WIDTH - 160, 3);
  const descLines = description ? wrapText(description, 34, WIDTH - 160, 2) : [];

  // Vertical layout: logo (optional) at the top, then eyebrow, then the title
  // block grows downward so it never collides with what's above it.
  let eyebrowY;
  let titleTop;
  if (hasLogo && eyebrow) {
    eyebrowY = 170;
    titleTop = 240;
  } else if (hasLogo) {
    titleTop = 210;
  } else if (eyebrow) {
    eyebrowY = 120;
    titleTop = 215;
  } else {
    titleTop = 180;
  }

  const logoEl = hasLogo
    ? `<image x="80" y="60" height="56" width="260" preserveAspectRatio="xMinYMid meet" href="${logoDataUri}"/>`
    : "";

  const eyebrowEl = eyebrow
    ? `<text x="80" y="${eyebrowY}" font-size="28" font-weight="700" letter-spacing="3" fill="${theme.accent}" font-family="Segoe UI, Arial, Helvetica, sans-serif">${escapeXml(
        eyebrow.toUpperCase(),
      )}</text>`
    : "";

  let y = titleTop;
  const titleTspans = titleLines
    .map((line) => {
      const t = `<text x="80" y="${y}" font-size="${titleSize}" font-weight="800" fill="${theme.fg}" font-family="Segoe UI, Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`;
      y += titleSize * 1.12;
      return t;
    })
    .join("\n");

  let dy = y + 16;
  const descTspans = descLines
    .map((line) => {
      const t = `<text x="80" y="${dy}" font-size="34" fill="${theme.muted}" font-family="Segoe UI, Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`;
      dy += 46;
      return t;
    })
    .join("\n");

  const footerEl = footer
    ? `<text x="80" y="${HEIGHT - 60}" font-size="30" font-weight="600" fill="${theme.muted}" font-family="Segoe UI, Arial, Helvetica, sans-serif">${escapeXml(footer)}</text>`
    : "";

  const watermark = opts.watermark
    ? `<text x="${WIDTH - 40}" y="${HEIGHT - 40}" text-anchor="end" font-size="22" fill="${theme.muted}" opacity="0.8" font-family="Segoe UI, Arial, Helvetica, sans-serif">made with Unfurl · upgrade to remove</text>`
    : "";

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.bg1}"/>
      <stop offset="100%" stop-color="${theme.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="0" y="0" width="14" height="${HEIGHT}" fill="${theme.accent}"/>
  ${logoEl}
  ${eyebrowEl}
  ${titleTspans}
  ${descTspans}
  ${footerEl}
  ${watermark}
</svg>`;
}

// Fetch a remote logo and return it as a base64 data URI for embedding.
// Guarded against abuse: https/http only, short timeout, image types only,
// and a hard size cap. Any failure returns null so the render still succeeds.
async function fetchLogo(url) {
  if (typeof url !== "string") return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(parsed.href, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!resp.ok) return null;

    const type = (resp.headers.get("content-type") || "").split(";")[0].trim();
    if (!type.startsWith("image/")) return null;

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > 2 * 1024 * 1024) return null; // 2 MB cap

    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderPng(opts) {
  const logoDataUri = opts.logo ? await fetchLogo(opts.logo) : null;
  const svg = buildSvg(opts, logoDataUri);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const themeNames = Object.keys(THEMES);
