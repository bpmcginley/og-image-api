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

export function buildSvg(opts) {
  const theme = THEMES[opts.theme] || THEMES.dark;
  const title = opts.title || "Your title here";
  const description = opts.description || "";
  const eyebrow = opts.eyebrow || "";
  const footer = opts.footer || "";

  const titleSize = title.length > 60 ? 60 : title.length > 35 ? 72 : 88;
  const titleLines = wrapText(title, titleSize, WIDTH - 160, 3);
  const descLines = description ? wrapText(description, 34, WIDTH - 160, 2) : [];

  let y = 230 - (titleLines.length - 1) * (titleSize * 0.6);

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

  const eyebrowEl = eyebrow
    ? `<text x="80" y="120" font-size="28" font-weight="700" letter-spacing="3" fill="${theme.accent}" font-family="Segoe UI, Arial, Helvetica, sans-serif">${escapeXml(
        eyebrow.toUpperCase(),
      )}</text>`
    : "";

  const footerEl = footer
    ? `<text x="80" y="${HEIGHT - 60}" font-size="30" font-weight="600" fill="${theme.muted}" font-family="Segoe UI, Arial, Helvetica, sans-serif">${escapeXml(footer)}</text>`
    : "";

  const watermark = opts.watermark
    ? `<text x="${WIDTH - 40}" y="${HEIGHT - 40}" text-anchor="end" font-size="22" fill="${theme.muted}" opacity="0.8" font-family="Segoe UI, Arial, Helvetica, sans-serif">made with og-image-api · upgrade to remove</text>`
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
  ${eyebrowEl}
  ${titleTspans}
  ${descTspans}
  ${footerEl}
  ${watermark}
</svg>`;
}

export async function renderPng(opts) {
  const svg = buildSvg(opts);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const themeNames = Object.keys(THEMES);
