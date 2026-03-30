const { EmbedBuilder } = require('discord.js');

let purgeIntervals = [];
let postIntervals = [];

module.exports = {
    start: (client) => {
        // Clear existing intervals
        purgeIntervals.forEach(clearInterval);
        postIntervals.forEach(clearInterval);
        purgeIntervals = [];
        postIntervals = [];

        const db = client.db;
        db.read();
        const settings = db.get('settings').value();

        if (!settings) return;

        // --- AUTO PURGE ---
        if (settings.autoPurge && Array.isArray(settings.autoPurge)) {
            settings.autoPurge.forEach(task => {
                if (!task.channelId || !task.interval) return;

                const ms = task.interval * 60 * 60 * 1000; // Hours to ms

                const interval = setInterval(async () => {
                    const channel = client.channels.cache.get(task.channelId);
                    if (!channel) return;

                    try {
                        // Purge max 100 newer than 14 days
                        const deleted = await channel.bulkDelete(100, true);
                        console.log(`[AutoPurge] Deleted ${deleted.size} messages in ${channel.name}`);

                        // Optional: Send temporary log
                        // const msg = await channel.send(\`🧹 Auto Purge: Cleared \${deleted.size} messages.\`);
                        // setTimeout(() => msg.delete().catch(() => {}), 5000);

                    } catch (err) {
                        console.error(`[AutoPurge] Error in ${channel.name}:`, err);
                    }
                }, ms);

                purgeIntervals.push(interval);
            });
        }

        // --- AUTO POST ---
        if (settings.autoPost && Array.isArray(settings.autoPost)) {
            settings.autoPost.forEach(task => {
                if (!task.channelId || !task.interval || !task.content) return;

                const ms = task.interval * 60 * 60 * 1000; // Hours to ms

                const interval = setInterval(async () => {
                    const channel = client.channels.cache.get(task.channelId);
                    if (!channel) return;

                    try {
                        let contentPayload = {};

                        // Parse JSON or String
                        try {
                            // If content starts with { or [, assume JSON
                            if (task.content.trim().startsWith('{')) {
                                const parsed = JSON.parse(task.content);
                                // Support simple embed structure from JSON
                                if (parsed.embed) {
                                    contentPayload.embeds = [parsed.embed];
                                } else if (parsed.embeds) {
                                    contentPayload.embeds = parsed.embeds;
                                } else {
                                    contentPayload.embeds = [parsed]; // Assume root is embed
                                }
                                if (parsed.content) contentPayload.content = parsed.content;
                            } else {
                                contentPayload.content = task.content;
                            }
                        } catch (e) {
                            // Fallback as plain text
                            contentPayload.content = task.content;
                        }

                        // Image Override
                        if (task.image) {
                            if (!contentPayload.embeds) {
                                const embed = new EmbedBuilder()
                                    .setDescription(contentPayload.content || 'Auto Post')
                                    .setImage(task.image)
                                    .setColor('#5865F2');
                                contentPayload.embeds = [embed];
                                contentPayload.content = null; // Clear content if moving to embed
                            } else {
                                // Add image to first embed
                                // Re-construct embed to modify
                                const oldEmbed = contentPayload.embeds[0];
                                const newEmbed = new EmbedBuilder(oldEmbed).setImage(task.image);
                                contentPayload.embeds[0] = newEmbed;
                            }
                        }

                        await channel.send(contentPayload);
                        console.log(`[AutoPost] Sent message in ${channel.name}`);

                    } catch (err) {
                        console.error(`[AutoPost] Error in ${channel.name}:`, err);
                    }
                }, ms);

                postIntervals.push(interval);
            });
        }

        console.log(`[ScheduleManager] Started ${purgeIntervals.length} purge tasks and ${postIntervals.length} post tasks.`);
    },

    reload: (client) => {
        module.exports.start(client);
    }
};
