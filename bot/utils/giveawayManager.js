const { EmbedBuilder } = require('discord.js');
const FileSync = require('lowdb/adapters/FileSync');
const low = require('lowdb');

const adapter = new FileSync('data/giveaways.json');
const db = low(adapter);
db.defaults({ active: [], ended: [] }).write();

module.exports = {
    start: (client) => {
        // Check every minute
        setInterval(async () => {
            db.read();
            const giveaways = db.get('active').value();
            const now = Date.now();

            for (const g of giveaways) {
                if (now >= g.endTime) {
                    await module.exports.endGiveaway(client, g.messageId);
                }
            }
        }, 60 * 1000);
    },

    createGiveaway: async (client, { channelId, prize, duration, winnerCount, requiredRole, hostId, color }) => {
        db.read();
        const channel = client.channels.cache.get(channelId);
        if (!channel) throw new Error('Channel not found');

        const endTime = Date.now() + (duration * 60 * 1000);

        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`**Prize:** ${prize}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n**Hosted by:** <@${hostId}>\n\nReact with 🎉 to enter!`)
            .setColor(color || '#FF0000')
            .setFooter({ text: `${winnerCount} Winner(s)` })
            .setTimestamp(endTime);

        if (requiredRole) {
            embed.addFields({ name: 'Requirement', value: `Must have <@&${requiredRole}> role` });
        }

        const message = await channel.send({ embeds: [embed] });
        await message.react('🎉');

        db.get('active').push({
            messageId: message.id,
            channelId,
            guildId: channel.guild.id,
            prize,
            startTime: Date.now(),
            endTime,
            winnerCount,
            requiredRole,
            hostId,
            ended: false
        }).write();

        return message.id;
    },

    endGiveaway: async (client, messageId) => {
        db.read();
        const giveaway = db.get('active').find({ messageId }).value();
        if (!giveaway) return;

        const channel = client.channels.cache.get(giveaway.channelId);
        if (!channel) {
            // Channel deleted, just mark ended
            db.get('active').remove({ messageId }).write();
            db.get('ended').push({ ...giveaway, ended: true, winners: [] }).write();
            return;
        }

        try {
            const message = await channel.messages.fetch(messageId);
            const reaction = message.reactions.cache.get('🎉');
            let winners = [];

            if (reaction) {
                let users = await reaction.users.fetch();
                users = users.filter(u => !u.bot);

                // Filter by role requirement
                if (giveaway.requiredRole) {
                    const guild = channel.guild;
                    // We need members to check roles
                    // Fetching all members might be expensive but necessary for role check
                    // Optimization: filter only if necessary
                    const validUsers = [];
                    for (const [id, user] of users) {
                        try {
                            const member = await guild.members.fetch(id);
                            if (member.roles.cache.has(giveaway.requiredRole)) {
                                validUsers.push(user);
                            }
                        } catch (e) { /* user left or issue */ }
                    }
                    users = validUsers; // Array
                } else {
                    users = Array.from(users.values()); // Array
                }

                // Pick winners
                if (users.length > 0) {
                    for (let i = 0; i < giveaway.winnerCount; i++) {
                        if (users.length === 0) break;
                        const index = Math.floor(Math.random() * users.length);
                        winners.push(users[index]);
                        users.splice(index, 1);
                    }
                }
            }

            const winnerString = winners.length > 0 ? winners.map(w => `<@${w.id}>`).join(', ') : 'No valid entrants';

            const embed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY ENDED 🎉')
                .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${winnerString}\n**Hosted by:** <@${giveaway.hostId}>`)
                .setColor('#000000')
                .setFooter({ text: 'Ended' })
                .setTimestamp();

            await message.edit({ embeds: [embed] });

            if (winners.length > 0) {
                await channel.send(`🎉 Congratulations ${winnerString}! You won **${giveaway.prize}**!`);
            } else {
                await channel.send(`🎉 Giveaway ended. No valid winners for **${giveaway.prize}**.`);
            }

            // Move to ended
            db.get('active').remove({ messageId }).write();
            db.get('ended').push({ ...giveaway, ended: true, winners: winners.map(w => w.id) }).write();

        } catch (error) {
            console.error('[Giveaway] Error ending:', error);
        }
    },

    reroll: async (client, messageId) => {
        db.read();
        // Check ended db first
        let giveaway = db.get('ended').find({ messageId }).value();
        // Or check active (if forcing end via reroll logic, but usually reroll is post-end)

        if (!giveaway) return; // Must be ended

        const channel = client.channels.cache.get(giveaway.channelId);
        if (!channel) return;

        try {
            const message = await channel.messages.fetch(messageId);
            const reaction = message.reactions.cache.get('🎉');

            if (!reaction) return;

            let users = await reaction.users.fetch();
            users = users.filter(u => !u.bot);

            // Filter role
            if (giveaway.requiredRole) {
                const guild = channel.guild;
                const validUsers = [];
                for (const [id, user] of users) {
                    try {
                        const member = await guild.members.fetch(id);
                        if (member.roles.cache.has(giveaway.requiredRole)) validUsers.push(user);
                    } catch (e) { }
                }
                users = validUsers;
            } else {
                users = Array.from(users.values());
            }

            if (users.length === 0) return await channel.send('No valid entrants to reroll.');

            const winner = users[Math.floor(Math.random() * users.length)];
            await channel.send(`🎉 Reroll! The new winner is <@${winner.id}>!`);

        } catch (e) {
            console.error('[Giveaway] Reroll error:', e);
        }
    }
};
