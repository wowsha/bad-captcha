// api/captcha.js
import { createCanvas } from '@napi-rs/canvas';

export default async function handler(req, res) {
  try {
    // --- Enable CORS for any origin ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    // --- Generate a random captcha text ---
    const captchaText = Math.random().toString(36).substring(2, 8).toUpperCase();

    // --- Create an image ---
    const width = 200;
    const height = 80;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // Text
    ctx.font = '40px Sans';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(captchaText, width / 2, height / 2);

    // Convert image to PNG buffer
    const buffer = await canvas.encode('png');

    // --- Send JSON with image as Base64 ---
    res.status(200).json({
      text: captchaText, // In production, store this server-side!
      image: `data:image/png;base64,${buffer.toString('base64')}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CAPTCHA generation failed' });
  }
}
