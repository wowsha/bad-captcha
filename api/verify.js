// /api/verify.js

export default async function handler(req, res) {
  // CORS headers to allow all origins
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
    // Vercel usually parses JSON automatically, but fallback if not:
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(await getRawBody(req));
    const { token, answer, behavior } = body || {};

    // Basic validation
    if (!token || typeof answer !== "string") {
      return res.status(400).json({ success: false, reason: "Missing token or answer" });
    }

    // Use same in-memory store from captcha.js
    const store = global.__captchaStore;
    if (!store || !store.has(token)) {
      return res.status(400).json({ success: false, reason: "Invalid or expired token" });
    }

    const record = store.get(token);
    const now = Date.now();

    // Expire tokens older than 10 minutes
    if (now - record.created > 10 * 60 * 1000) {
      store.delete(token);
      return res.status(400).json({ success: false, reason: "Token expired" });
    }

    // Behavioral heuristics (optional but helps block bots)
    const timeTaken = (behavior && behavior.timeTakenMs) || (now - record.created);
    const mouseMoves = (behavior && behavior.mouseMoves) || 0;

    if (timeTaken < 700) {
      return res.json({ success: false, reason: "Too fast (suspicious)" });
    }
    if (mouseMoves < 2) {
      return res.json({ success: false, reason: "Insufficient interaction" });
    }

    // Check answer (case-insensitive)
    if (answer.trim().toLowerCase() === record.text.trim().toLowerCase()) {
      store.delete(token); // Consume token on success
      return res.status(200).json({ success: true });
    } else {
      store.delete(token); // Optional: delete to prevent brute force
      return res.status(200).json({ success: false, reason: "Wrong answer" });
    }
  } catch (err) {
    console.error("verify error:", err);
    return res.status(500).json({ success: false, reason: "Server error" });
  }
}

// Helper to parse raw body if req.body is empty or a string (rare on Vercel)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data || "{}"));
    req.on("error", reject);
  });
}
