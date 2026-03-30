module.exports = {
    /**
     * Checks if a game is allowed to run in the given channel.
     * @param {Client} client Discord Client
     * @param {string} guildId Guild ID
     * @param {string} channelId Channel ID
     * @param {string} gameName Name of the game (key in settings.games)
     * @returns {boolean} True if allowed, false otherwise
     */
    isGameAllowed: (client, guildId, channelId, gameName) => {
        try {
            client.db.read(); // Ensure fresh data
            const settings = client.db.get('settings').value();

            // If no settings at all, allow
            if (!settings || !settings.games) return true;

            const gameSettings = settings.games[gameName];

            // If game not configured specifically, assume enabled (default behavior)
            if (!gameSettings) return true;

            // Check if disabled
            if (gameSettings.enabled === false) return false;

            // Check allowed channels
            // If channels array is empty, it usually means "All Channels" or "No Restriction"
            if (gameSettings.channels && Array.isArray(gameSettings.channels) && gameSettings.channels.length > 0) {
                if (!gameSettings.channels.includes(channelId)) return false;
            }

            return true;
        } catch (error) {
            console.error(`[GameChecks] Error checking permission for ${gameName}:`, error);
            return true; // Fail safe to allow
        }
    }
};
