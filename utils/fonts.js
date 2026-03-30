const path = require('path');
const fs = require('fs');
const { GlobalFonts } = require('@napi-rs/canvas');

const FONT_FAMILY = 'Cairo';
let registered = false;

function ensureFonts() {
  if (registered) return;

  const fontPath = path.join(__dirname, '..', 'assets', 'fonts', 'Cairo-Regular.ttf');

  try {
    if (!fs.existsSync(fontPath)) {
      console.warn(`[fonts] Cairo font not found at: ${fontPath}`);
      registered = true;
      return;
    }

    const ok = GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
    if (!ok) {
      console.warn(`[fonts] Failed to register Cairo font from: ${fontPath}`);
    }
  } catch (err) {
    console.warn('[fonts] Error while registering Cairo font:', err);
  } finally {
    registered = true;
  }
}

module.exports = {
  ensureFonts,
  FONT_FAMILY
};
