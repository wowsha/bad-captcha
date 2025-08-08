// /public/captcha.js
(function () {
  // Set this to your deployed API domain
  const API_BASE = window.location.origin;

  const COOKIE_NAME = "bad_captcha_pass";
  const COOKIE_HOURS = 3;

  // helper cookies
  function setCookie(name, value, hours) {
    const d = new Date();
    d.setTime(d.getTime() + hours * 3600 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
  }
  function getCookie(name) {
    const v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? decodeURIComponent(v.pop()) : null;
  }

  // If user already passed, do nothing
  if (getCookie(COOKIE_NAME)) {
    return;
  }

  // Block/replace entire page with overlay while captcha active
  const originalHTML = document.documentElement.innerHTML;
  // Replace full page content with neutral background to avoid leak
  document.documentElement.innerHTML = "";
  document.documentElement.style.height = "100%";
  document.body.style.margin = "0";

  // Create overlay container
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f6f6f6;z-index:2147483647;";
  document.body.appendChild(overlay);

  // Build box
  const box = document.createElement("div");
  box.style.cssText =
    "width:min(440px,95%);background:#fff;border-radius:8px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,0.15);text-align:center;font-family:sans-serif;";
  overlay.appendChild(box);

  const title = document.createElement("h2");
  title.innerText = "Please verify you are human";
  title.style.margin = "0 0 12px 0";
  box.appendChild(title);

  const svgHolder = document.createElement("div");
  svgHolder.style.cssText = "margin:8px 0;";
  box.appendChild(svgHolder);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter the characters you see";
  input.style.cssText = "padding:8px 10px;margin-top:10px;width:70%;font-size:16px";
  box.appendChild(input);

  const btn = document.createElement("button");
  btn.innerText = "Verify";
  btn.style.cssText =
    "display:inline-block;padding:8px 12px;margin-left:10px;font-size:16px;cursor:pointer";
  box.appendChild(btn);

  const info = document.createElement("div");
  info.style.cssText = "margin-top:10px;color:#666;font-size:13px";
  box.appendChild(info);

  // behavior tracking
  let mouseMoves = 0;
  let startTime = Date.now();
  function onMove() {
    mouseMoves++;
  }
  window.addEventListener("mousemove", onMove);

  let currentToken = null;

  async function loadCaptcha() {
    try {
      info.innerText = "Loading captcha…";
      const r = await fetch(`${API_BASE}/api/captcha`);
      if (!r.ok) throw new Error("Network response not OK");
      const data = await r.json();
      currentToken = data.token;
      // place svg into holder
      svgHolder.innerHTML = data.svg;
      // ensure SVG scales
      const svgEl = svgHolder.querySelector("svg");
      if (svgEl) {
        svgEl.style.maxWidth = "100%";
        svgEl.style.height = "auto";
      }
      info.innerText = "Type the characters shown above";
    } catch (err) {
      console.error("captcha load error", err);
      info.innerText = "Failed to load captcha. Please try later.";
    }
  }

  async function verify() {
    try {
      info.innerText = "Verifying…";
      const answer = input.value || "";
      const timeTakenMs = Date.now() - startTime;
      const body = { token: currentToken, answer, behavior: { mouseMoves, timeTakenMs } };

      const r = await fetch(`${API_BASE}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Network error");
      const result = await r.json();
      if (result.success) {
        // set cookie on the *current* site so the site owner doesn't have to handle cookies
        setCookie(COOKIE_NAME, cryptoRandomString(24), COOKIE_HOURS);
        info.innerText = "Success — reloading the site...";
        // small delay so user sees message
        setTimeout(() => {
          // restore page (reload to ensure site loads normally)
          location.reload();
        }, 700);
      } else {
        info.innerText = `Failed: ${result.reason || "try again"}`;
        // refresh captcha after a failure
        mouseMoves = 0;
        startTime = Date.now();
        input.value = "";
        await loadCaptcha();
      }
    } catch (err) {
      console.error("verify error", err);
      info.innerText = "Verification failed (network). Try again.";
    }
  }

  btn.addEventListener("click", verify);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") verify();
  });

  // small helper to create random cookie value
  function cryptoRandomString(len = 16) {
    try {
      const arr = new Uint8Array(len);
      crypto.getRandomValues(arr);
      return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      // fallback
      return Math.random().toString(36).slice(2, 2 + len);
    }
  }

  // start
  loadCaptcha();
})();
