// /api/verify.js
/**
 * POST { token, answer, behavior: { mouseMoves, timeTakenMs } }
 * Responds { success: true } or { success: false, reason: "..." }
 */

export default async function handler(req, res) {
  // universal CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, reason: "Method not allowed" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(await getRawBody(req));
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
    // expire tokens older than 10 minutes
    if (now - record.created > 10 * 60 * 1000) {
      store.delete(token);
      return res.status(400).json({ success: false, reason: "Token expired" });
    }

    // Behavioral checks (tunable)
    const timeTaken = (behavior && behavior.timeTakenMs) || (now - record.created);
    const mouseMoves = (behavior && behavior.mouseMoves) || 0;

    if (timeTaken < 700) {
      return res.json({ success: false, reason: "Too fast (suspicious)" });
    }
    if (mouseMoves < 2) {
      return res.json({ success: false, reason: "Insufficient interaction" });
    }

    // verify answer (case-insensitive)
    if (String(answer).trim().toLowerCase() === String(record.text).trim().toLowerCase()) {
      // success: delete token and return OK
      store.delete(token);
      return res.status(200).json({ success: true });
    } else {
      // optional: you may want to delete the token after N failures to prevent brute force
      store.delete(token);
      return res.status(200).json({ success: false, reason: "Wrong answer" });
    }
  } catch (err) {
    console.error("verify error:", err);
    return res.status(500).json({ success: false, reason: "Server error" });
  }
}

// helper to read raw body if req.body not parsed (Vercel typically parses JSON)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data || "{}"));
    req.on("error", reject);
  });
}
