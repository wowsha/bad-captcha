(function(){
    let token = null;
    let mouseMoves = 0;

    // ===== COOKIE HANDLING =====
    function setCookie(name, value, hours) {
        const d = new Date();
        d.setTime(d.getTime() + (hours * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
    }
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // ===== CAPTCHA INIT =====
    async function initCaptcha() {
        // If cookie exists, skip
        if (getCookie('captcha_passed')) return;

        // Hide site content
        document.documentElement.innerHTML = '';
        document.documentElement.style.background = '#f8f8f8';

        // Track mouse
        document.addEventListener('mousemove', () => mouseMoves++);

        // Request CAPTCHA
        const res = await fetch('https://bad-captcha.vercel.app/api/captcha');
        const data = await res.json();
        token = data.token;

        // Create overlay
        const wrapper = document.createElement('div');
        wrapper.style = `
            position: fixed;top:0;left:0;width:100%;height:100%;
            display:flex;align-items:center;justify-content:center;
            background:#f8f8f8;z-index:999999;
        `;
        wrapper.innerHTML = `
            <div style="border:1px solid #ccc;padding:20px;background:#fff;text-align:center;box-shadow:0 0 10px rgba(0,0,0,0.2);">
                <h2>Verify you are human</h2>
                <img src="${data.image}" alt="CAPTCHA" style="border:1px solid #ccc;margin-bottom:10px"><br>
                <input type="text" placeholder="Enter CAPTCHA" id="captchaInput" style="padding:5px;margin-bottom:10px;width:150px;"><br>
                <button id="captchaBtn" style="padding:5px 10px;">Verify</button>
            </div>
        `;
        document.body.appendChild(wrapper);

        document.getElementById('captchaBtn').addEventListener('click', verifyCaptcha);
    }

    // ===== CAPTCHA VERIFY =====
    async function verifyCaptcha() {
        const answer = document.getElementById('captchaInput').value;
        const res = await fetch('https://bad-captcha.vercel.app/api/captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, answer, behavior: { mouseMoves } })
        });
        const result = await res.json();
        if (result.success) {
            setCookie('captcha_passed', 'true', 3); // lasts 3 hours
            location.reload();
        } else {
            alert(`Failed: ${result.reason}`);
        }
    }

    window.addEventListener('load', initCaptcha);
})();
