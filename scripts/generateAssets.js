// scripts/generateAssets.js
// Generates SVG icon/splash templates + an HTML preview for VASTRA
// Run: node scripts/generateAssets.js
// Then convert icon.svg → icon.png (1024x1024), adaptive-icon.png (1024x1024)
//           splash.svg → splash.png (1284x2778)

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// ── Icon SVG (1024x1024) ──────────────────────────────────────────────────────
const iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1a14"/>
      <stop offset="50%" stop-color="#0d2b1f"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5DCAA5"/>
      <stop offset="100%" stop-color="#378ADD"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="200" fill="url(#bg)"/>
  <text x="512" y="620" font-family="Inter,Arial,sans-serif" font-size="520" font-weight="900" fill="url(#accent)" text-anchor="middle">V</text>
  <text x="512" y="820" font-family="Inter,Arial,sans-serif" font-size="100" font-weight="600" fill="rgba(255,255,255,0.4)" text-anchor="middle" letter-spacing="20">VASTRA</text>
</svg>`;

// ── Splash SVG (1284x2778 — iPhone 14 Pro Max) ────────────────────────────────
const splashSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
  <rect width="1284" height="2778" fill="#000000"/>
  <text x="642" y="1200" font-family="Inter,Arial,sans-serif" font-size="280" font-weight="900" fill="#5DCAA5" text-anchor="middle">V</text>
  <text x="642" y="1450" font-family="Inter,Arial,sans-serif" font-size="72" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="15">VASTRA</text>
  <text x="642" y="1550" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="400" fill="rgba(255,255,255,0.4)" text-anchor="middle">Merchandise Intelligence</text>
</svg>`;

// ── HTML preview (open in browser and screenshot to get PNGs) ─────────────────
const iconHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>VASTRA Icon Preview</title><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #111; display: flex; gap: 40px; padding: 40px; flex-wrap: wrap; font-family: Inter, Arial, sans-serif; }
  h2 { color: #fff; margin-bottom: 12px; font-size: 14px; }
  .section { display: flex; flex-direction: column; }
  .icon-wrap { width: 200px; height: 200px; border-radius: 40px; background: linear-gradient(135deg, #0a1a14, #0d2b1f, #000); display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
  .icon-v { font-size: 110px; font-weight: 900; background: linear-gradient(180deg, #5DCAA5, #378ADD); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; margin-top: 10px; }
  .icon-name { font-size: 18px; font-weight: 600; color: rgba(255,255,255,0.4); letter-spacing: 5px; margin-top: -6px; }
  .splash-wrap { width: 180px; height: 390px; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); }
  .splash-v { font-size: 80px; font-weight: 900; color: #5DCAA5; line-height: 1; }
  .splash-title { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 4px; margin-top: 8px; }
  .splash-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 6px; }
  .note { color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 20px; max-width: 500px; line-height: 1.6; }
  code { color: #5DCAA5; }
</style></head>
<body>
  <div class="section">
    <h2 style="color:rgba(255,255,255,0.6)">ICON (1024×1024)</h2>
    <div class="icon-wrap">
      <div class="icon-v">V</div>
      <div class="icon-name">VASTRA</div>
    </div>
  </div>
  <div class="section">
    <h2 style="color:rgba(255,255,255,0.6)">SPLASH (1284×2778)</h2>
    <div class="splash-wrap">
      <div class="splash-v">V</div>
      <div class="splash-title">VASTRA</div>
      <div class="splash-sub">Merchandise Intelligence</div>
    </div>
  </div>
  <div class="note">
    <p><strong style="color:#fff">To generate final PNGs:</strong></p>
    <p>1. Open <code>assets/icon.svg</code> in Inkscape / Figma / Adobe XD</p>
    <p>2. Export as <code>icon.png</code> (1024×1024) and <code>adaptive-icon.png</code> (1024×1024)</p>
    <p>3. Export <code>splash.svg</code> as <code>splash.png</code> (1284×2778)</p>
    <p>4. Place all PNGs in the <code>assets/</code> folder</p>
    <p>Or use an online SVG→PNG converter at the sizes above.</p>
  </div>
</body></html>`;

fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSVG);
fs.writeFileSync(path.join(assetsDir, 'splash.svg'), splashSVG);
fs.writeFileSync(path.join(assetsDir, 'icon_preview.html'), iconHTML);

console.log('✓ SVG assets written to /assets/');
console.log('  assets/icon.svg       — app icon (1024×1024)');
console.log('  assets/splash.svg     — splash screen (1284×2778)');
console.log('  assets/icon_preview.html — open in browser to preview');
console.log('');
console.log('Convert to PNG before building:');
console.log('  icon.svg         → icon.png (1024×1024)');
console.log('  icon.svg         → adaptive-icon.png (1024×1024)');
console.log('  splash.svg       → splash.png (1284×2778)');
