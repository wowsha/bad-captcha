import { createCanvas } from '@napi-rs/canvas';
import crypto from 'crypto';

export default async function handler(req, res) {
    // ==== UNIVERSAL CORS ====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ==== CAPTCHA STORE ====
    global.captchaStore = global.captchaStore || {};

    if (req.method === 'GET') {
        const text = generateCaptchaText(5);
        const token = crypto.randomUUID();

        global.captchaStore[token] = { text, created: Date.now() };
        const imageBuffer = createCaptchaImage(text);

        return res.status(200).json({
            token,
            image: `data:image/png;base64,${imageBuffer.toString('base64')}`
        });
    }

    if (req.method === 'POST') {
        const { token, answer, behavior } = req.body;
        const record = global.captchaStore[token];

        if (!record) return res.status(400).json({ success: false, reason: 'Invalid token' });
        if (Date.now() - record.created < 1500) return res.json({ success: false, reason: 'Too fast' });
        if (!behavior?.mouseMoves || behavior.mouseMoves < 3) return res.json({ success: false, reason: 'Suspicious behavior' });

        if (answer.toLowerCase() === record.text.toLowerCase()) {
            delete global.captchaStore[token];
            return res.json({ success: true });
        }
        res.json({ success: false, reason: 'Wrong answer' });
    }
}

function generateCaptchaText(length) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createCaptchaImage(text) {
    const canvas = createCanvas(150, 50);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, 150, 50);

    for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random()})`;
        ctx.beginPath();
        ctx.arc(Math.random() * 150, Math.random() * 50, 1, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#000';
    ctx.rotate((Math.random() - 0.5) * 0.1);
    ctx.fillText(text, 20, 35);

    return canvas.toBuffer();
}
