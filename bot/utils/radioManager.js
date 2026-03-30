const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');

let connection = null;
let player = null;
let currentChannelId = null;
let currentStation = null;

module.exports = {
    start: async (client) => {
        const db = client.db;
        db.read();
        const settings = db.get('settings').value();

        if (!settings) return;

        // Force Station as requested
        settings.radioStation = 'https://qurango.net/radio/mix';

        if (!settings.radioEnabled || !settings.radioChannel) {
            module.exports.stop();
            return;
        }

        // If already playing same station in same channel, do nothing
        if (connection && currentChannelId === settings.radioChannel && currentStation === settings.radioStation) {
            return;
        }

        currentChannelId = settings.radioChannel;
        currentStation = settings.radioStation;

        let channel;
        try {
            channel = await client.channels.fetch(settings.radioChannel).catch(() => null);
        } catch (e) {
            console.error('[Radio] Error fetching channel:', e);
            return;
        }

        if (!channel) {
            console.error('[Radio] Channel not found or bot cannot access it.');
            return;
        }

        // Check Permissions
        const permissions = channel.permissionsFor(client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            console.error(`[Radio] Missing permissions in ${channel.name}`);
            return;
        }

        // Check Blacklist
        if (settings.ignoredChannels && settings.ignoredChannels.includes(channel.id)) {
            console.log(`[Radio] Channel ${channel.name} is blacklisted.`);
            return;
        }

        try {
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: true
            });

            player = createAudioPlayer();
            const resource = createAudioResource(settings.radioStation, {
                inlineVolume: true
            });
            resource.volume.setVolume(1.0);

            player.play(resource);
            connection.subscribe(player);

            player.on(AudioPlayerStatus.Playing, () => {
                // optional: console.log('[Radio] Playing ' + settings.radioStation);
            });

            player.on('error', error => {
                console.error(`[Radio] Player Error: ${error.message}`);
                // Try to restart on error
                setTimeout(() => module.exports.start(client), 5000);
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                // Destroy properly
                try {
                    connection.destroy();
                } catch (e) { }
                connection = null;
            });

            console.log(`[Radio] Connected to ${channel.name}`);

        } catch (error) {
            console.error('[Radio] Connection Error:', error);
        }
    },

    stop: () => {
        if (player) {
            player.stop();
            player = null;
        }
        if (connection) {
            connection.destroy();
            connection = null;
        }
        currentChannelId = null;
        currentStation = null;
    },

    reload: (client) => {
        module.exports.start(client);
    }
};
