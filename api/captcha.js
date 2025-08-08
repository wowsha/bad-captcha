// /api/captcha.js
import crypto from "crypto";

/**
 * Simple in-memory store for tokens -> { text, created }
 * Note: ephemeral. For production use Redis or DB.
 */
global.__captchaStore = global.__captchaStore || new Map();

function generateText(length = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function makeSvg(text) {
  // Basic noisy/distorted svg: random rotations for letters, lines / circles as noise
  const w = 220, h = 80;
  const chars = text.split("");
  let letters = "";
  const startX = 30;
  const step = 36;
  chars.forEach((ch, i) => {
    const rx = startX + i * step + (Math.random() - 0.5) * 6;
    const ry = 45 + (Math.random() - 0.5) * 8;
    const rotate = (Math.random() - 0.5) * 30; // degrees
    letters += `<g transform="translate(${rx},${ry}) rotate(${rotate})">
      <text x="0" y="0" font-family="sans-serif" font-size="36" font-weight="700" 
            text-anchor="middle" dominant-baseline="central" fill="#111">${escapeHtml(ch)}</text>
    </g>`;
  });

  // random lines
  let lines = "";
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * w, y1 = Math.random() * h;
    const x2 = Math.random() * w, y2 = Math.random() * h;
    const sw = 1 + Math.random() * 2;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-opacity="0.12" stroke-width="${sw}" />`;
  }

  // noise circles
  let dots = "";
  for (let i = 0; i < 25; i++) {
    const cx = Math.random() * w, cy = Math.random() * h, r = Math.random() * 1.8;
    dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#000" fill-opacity="0.12" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="100%" height="100%" fill="#f5f5f5"/>
    ${lines}
    ${dots}
    ${letters}
  </svg>`;

  return svg;
}

export default function handler(req, res) {
  // universal CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const text = generateText(5);
    const token = crypto.randomUUID();

    // store server-side with creation time (expire after 10 minutes)
    const created = Date.now();
    global.__captchaStore.set(token, { text, created });

    // schedule cleanup (simple)
    setTimeout(() => global.__captchaStore.delete(token), 10 * 60 * 1000);

    const svg = makeSvg(text);
    // respond with token + svg (svg as string)
    return res.status(200).json({ token, svg });
  } catch (err) {
    console.error("captcha error:", err);
    return res.status(500).json({ error: "failed to generate captcha" });
  }
}
