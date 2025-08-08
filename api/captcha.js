import crypto from "crypto";

global.__captchaStore = global.__captchaStore || new Map();
global.__captchaSessions = global.__captchaSessions || new Map();

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
  const w = 220,
    h = 80;
  const chars = text.split("");
  let letters = "";
  const startX = 30;
  const step = 36;
  chars.forEach((ch, i) => {
    const rx = startX + i * step + (Math.random() - 0.5) * 6;
    const ry = 45 + (Math.random() - 0.5) * 8;
    const rotate = (Math.random() - 0.5) * 30;
    letters += `<g transform="translate(${rx},${ry}) rotate(${rotate})">
      <text x="0" y="0" font-family="sans-serif" font-size="36" font-weight="700" 
            text-anchor="middle" dominant-baseline="central" fill="#111">${escapeHtml(
              ch
            )}</text>
    </g>`;
  });

  let lines = "";
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * w,
      y1 = Math.random() * h;
    const x2 = Math.random() * w,
      y2 = Math.random() * h;
    const sw = 1 + Math.random() * 2;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-opacity="0.12" stroke-width="${sw}" />`;
  }

  let dots = "";
  for (let i = 0; i < 25; i++) {
    const cx = Math.random() * w,
      cy = Math.random() * h,
      r = Math.random() * 1.8;
    dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#000" fill-opacity="0.12" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="100%" height="100%" fill="#f5f5f5"/>
    ${lines}
    ${dots}
    ${letters}
  </svg>`;
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data || "{}"));
    req.on("error", reject);
  });
}

function base64Encode(str) {
  return Buffer.from(str).toString("base64");
}

function base64Decode(str) {
  return Buffer.from(str, "base64").toString();
}

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress ||
    ""
  );
}

// Check session validity
export function verifySession(token, ip) {
  try {
    const sessionId = base64Decode(token);
    if (!global.__captchaSessions.has(sessionId)) return false;

    const sess = global.__captchaSessions.get(sessionId);
    if (sess.ip !== ip) return false;

    if (Date.now() - sess.created > 10 * 60 * 1000) {
      global.__captchaSessions.delete(sessionId);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    // Return captcha SVG + token
    try {
      const text = generateText(5);
      const token = crypto.randomUUID();
      const created = Date.now();
      global.__captchaStore.set(token, { text, created });
      setTimeout(() => global.__captchaStore.delete(token), 10 * 60 * 1000);

      const svg = makeSvg(text);
      return res.status(200).json({ token, svg });
    } catch (e) {
      return res.status(500).json({ error: "Failed to generate captcha" });
    }
  }

  if (req.method === "POST") {
    try {
      const body =
        req.body && typeof req.body === "object"
          ? req.body
          : JSON.parse(await getRawBody(req));
      const { token, answer, behavior } = body || {};

      if (!token || typeof answer !== "string") {
        return res.status(400).json({ success: false, reason: "Missing token or answer" });
      }

      const store = global.__captchaStore;
      if (!store || !store.has(token)) {
        return res.status(400).json({ success: false, reason: "Invalid or expired token" });
      }

      const record = store.get(token);
      const now = Date.now();

      if (now - record.created > 10 * 60 * 1000) {
        store.delete(token);
        return res.status(400).json({ success: false, reason: "Token expired" });
      }

      // Behavioral checks
      const timeTaken = (behavior && behavior.timeTakenMs) || (now - record.created);
      const mouseMoves = (behavior && behavior.mouseMoves) || 0;

      if (timeTaken < 700) {
        return res.json({ success: false, reason: "Too fast (suspicious)" });
      }
      if (mouseMoves < 2) {
        return res.json({ success: false, reason: "Insufficient interaction" });
      }

      if (answer.trim().toLowerCase() === record.text.trim().toLowerCase()) {
        store.delete(token);

        // Create session ID tied to IP
        const sessionId = crypto.randomUUID();
        const ip = getClientIp(req);
        global.__captchaSessions.set(sessionId, { ip, created: now });
        setTimeout(() => global.__captchaSessions.delete(sessionId), 10 * 60 * 1000);

        const encodedToken = base64Encode(sessionId);
        return res.status(200).json({ success: true, token: encodedToken });
      } else {
        store.delete(token);
        return res.status(200).json({ success: false, reason: "Wrong answer" });
      }
    } catch (err) {
      console.error("captcha verify error:", err);
      return res.status(500).json({ success: false, reason: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
