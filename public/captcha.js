(function () {
  function getCookie(name) {
    const v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? v.pop() : "";
  }

  function setCookie(name, value, minutes) {
    const expires = new Date(Date.now() + minutes * 60000).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
  }

  const CAPTCHA_COOKIE = "captcha_token";
  const captchaToken = getCookie(CAPTCHA_COOKIE);
  if (captchaToken) {
    // Token exists, skip captcha UI
    return;
  }

  const API_BASE = window.location.origin;

  const container = document.createElement("div");
  container.style =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;" +
    "background:#fff;display:flex;flex-direction:column;" +
    "justify-content:center;align-items:center;z-index:99999;padding:20px;";

  const info = document.createElement("div");
  info.style.marginBottom = "10px";
  info.style.fontFamily = "sans-serif";
  info.style.fontSize = "14px";
  info.style.color = "#333";
  info.innerText = "Please complete the CAPTCHA to continue";

  const svgContainer = document.createElement("div");
  svgContainer.style.marginBottom = "10px";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type captcha text here";
  input.style.fontSize = "18px";
  input.style.padding = "8px";
  input.style.width = "180px";
  input.autocomplete = "off";

  const button = document.createElement("button");
  button.innerText = "Verify";
  button.style.marginTop = "10px";
  button.style.padding = "8px 20px";
  button.style.fontSize = "16px";
  button.style.cursor = "pointer";

  container.appendChild(info);
  container.appendChild(svgContainer);
  container.appendChild(input);
  container.appendChild(button);
  document.body.appendChild(container);

  let currentToken = null;
  let mouseMoves = 0;
  let startTime = Date.now();

  window.addEventListener("mousemove", () => {
    mouseMoves++;
  });

  async function loadCaptcha() {
    try {
      info.innerText = "Loading CAPTCHA...";
      const res = await fetch(`${API_BASE}/api/captcha`);
      if (!res.ok) throw new Error("Network response not OK");
      const data = await res.json();
      currentToken = data.token;
      svgContainer.innerHTML = data.svg;
      input.value = "";
      info.innerText = "Please complete the CAPTCHA to continue";
      mouseMoves = 0;
      startTime = Date.now();
      input.focus();
    } catch (e) {
      info.innerText = "Captcha load error: " + e.message;
      console.error(e);
    }
  }

  async function verify() {
    const answer = input.value.trim();
    if (!answer) {
      info.innerText = "Please enter the captcha text";
      return;
    }
    info.innerText = "Verifying...";
    try {
      const timeTakenMs = Date.now() - startTime;
      const body = {
        token: currentToken,
        answer,
        behavior: {
          mouseMoves,
          timeTakenMs,
        },
      };

      const res = await fetch(`${API_BASE}/api/captcha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Network error: ${res.status} - ${txt}`);
      }

      const result = await res.json();
      if (result.success && result.token) {
        setCookie(CAPTCHA_COOKIE, result.token, 10);
        info.innerText = "Captcha passed! Reloading...";
        setTimeout(() => location.reload(), 1000);
      } else {
        info.innerText = "Captcha failed: " + (result.reason || "Try again");
        await loadCaptcha();
      }
    } catch (e) {
      info.innerText = "Verify error: " + e.message;
      console.error(e);
      await loadCaptcha();
    }
  }

  button.addEventListener("click", verify);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      verify();
    }
  });

  loadCaptcha();

  // Expose function to get token for use in API calls
  window.getCaptchaToken = function () {
    return getCookie(CAPTCHA_COOKIE);
  };
})();
