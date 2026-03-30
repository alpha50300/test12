const { ensureFonts } = require('../utils/fonts');
const rouletteGame = require('./roulette');
const hideAndSeekGame = require('./hideAndSeek');
const flagsGame = require('./flags');
const fastGame = require('./fast');
const colorsGame = require('./colors');
const mathGame = require('./math');
const katGame = require('./kat');
const xoGame = require('./xo');
const fakkakGame = require('./fakkak');
const riddleGame = require('./riddle');
const rakkebGame = require('./rakkeb');
const boxGame = require('./box');
const loGame = require('./lo');
const jamGame = require('./jam');
// Config is likely at root or we pass client only
// Old code used config.json in ThailandGames, but now we probably just rely on client or root config.
// But wait, the games might use config?
// The games themselves don't seem to use config in the snippet I saw, they use client.
// The index.js used config for streaming presence.
// I will keep the presence logic but use root config if available, or just skip it if handled in main bot.
// Main bot index.js handles login, so we just need register functions.

function init(client) {
    console.log('[Games] Initializing games module...');
    try {
        ensureFonts();
    } catch (e) {
        console.error("Error ensuring fonts:", e);
    }

    rouletteGame.register(client);
    hideAndSeekGame.register(client);
    flagsGame.register(client);
    fastGame.register(client);
    colorsGame.register(client);
    mathGame.register(client);
    katGame.register(client);
    xoGame.register(client);
    fakkakGame.register(client);
    riddleGame.register(client);
    rakkebGame.register(client);
    boxGame.register(client);
    loGame.register(client);
    jamGame.register(client);

    console.log('[Games] All games registered.');
}

module.exports = { init };
