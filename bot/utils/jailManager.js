const { EmbedBuilder } = require('discord.js');

module.exports = {
    /**
     * Jails a user
     * @param {Object} client Discord Client
     * @param {Object} guild Discord Guild
     * @param {Object} member Discord Member
     * @param {Number} duration Duration in milliseconds
     * @param {String} reason Reason for jail
     * @param {Object} moderator Moderator who jailed
     */
    async jailUser(client, guild, member, duration, reason, moderator) {
        const db = client.db;
        db.read();

        // ensure jails array
        if (!db.has('jails').value()) {
            db.set('jails', []).write();
        }

        const jails = db.get('jails').value();
        const existing = jails.find(j => j.userId === member.id);

        // Get Jail Role ID from settings
        const settings = db.get('settings').value();
        const jailRoleId = settings.jailRole;

        if (!jailRoleId) {
            throw new Error('Jail Role is not configured in settings.');
        }

        const jailRole = guild.roles.cache.get(jailRoleId);
        if (!jailRole) {
            throw new Error('Jail Role configured but not found in guild.');
        }

        // Save old roles
        const oldRoles = member.roles.cache.filter(r => r.id !== guild.id && r.id !== jailRoleId).map(r => r.id);

        const jailData = {
            userId: member.id,
            userTag: member.user.tag,
            moderatorId: moderator.id,
            moderatorTag: moderator.tag,
            reason: reason,
            startTime: Date.now(),
            endTime: Date.now() + duration,
            roles: oldRoles,
            active: true
        };

        if (existing) {
            // Update existing
            const index = jails.findIndex(j => j.userId === member.id);
            jails[index] = jailData;
        } else {
            jails.push(jailData);
        }

        db.set('jails', jails).write();

        // Apply Jail Role and Remove others
        try {
            await member.roles.set([jailRoleId]);
        } catch (e) {
            console.error(`Failed to set jail role for ${member.user.tag}:`, e);
            throw new Error('Failed to manage roles. Check bot hierarchy.');
        }

        // DM User
        try {
            const timeStr = this.formatDuration(duration);
            const embed = new EmbedBuilder()
                .setTitle('🚫 You have been Jailed')
                .setColor('#FF0000')
                .addFields(
                    { name: 'Server', value: guild.name, inline: true },
                    { name: 'Moderator', value: moderator.tag, inline: true },
                    { name: 'Duration', value: timeStr, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();
            await member.send({ embeds: [embed] });
        } catch (e) {
            console.log(`Could not DM ${member.user.tag}`);
        }

        return jailData;
    },

    /**
     * Unjails a user
     * @param {Object} client Discord Client
     * @param {Object} guild Discord Guild
     * @param {Object} member Discord Member (might be null if left)
     * @param {String} userId ID if member is null
     */
    async unjailUser(client, guild, member, userId) {
        const db = client.db;
        db.read();
        const jails = db.get('jails').value() || [];
        const index = jails.findIndex(j => j.userId === (member ? member.id : userId));

        if (index === -1) return false;

        const jailData = jails[index];
        // Remove from DB (or mark inactive)
        jails.splice(index, 1);
        db.set('jails', jails).write();

        if (member) {
            const settings = db.get('settings').value();
            const jailRoleId = settings.jailRole;

            // Restore roles
            try {
                // Remove jail role
                if (jailRoleId && member.roles.cache.has(jailRoleId)) {
                    await member.roles.remove(jailRoleId);
                }
                // Add old roles
                if (jailData.roles && jailData.roles.length > 0) {
                    await member.roles.add(jailData.roles).catch(e => console.error("Could not add old roles back:", e));
                }
            } catch (e) {
                console.error(`Failed to restore roles for ${member.user.tag}:`, e);
            }

            // DM User
            try {
                const embed = new EmbedBuilder()
                    .setTitle('✅ You have been Unjailed')
                    .setColor('#00FF00')
                    .setDescription(`You are now free in **${guild.name}**.`)
                    .setTimestamp();
                await member.send({ embeds: [embed] });
            } catch (e) { }
        }

        return true;
    },

    /**
     * Checks for expired jails
     */
    async checkExpiredJails(client) {
        const db = client.db;
        db.read();
        const jails = db.get('jails').value() || [];
        const now = Date.now();

        const expired = jails.filter(j => j.endTime <= now);

        for (const j of expired) {
            const guild = client.guilds.cache.first(); // Assuming single guild bot primarily
            if (!guild) continue;

            const member = await guild.members.fetch(j.userId).catch(() => null);
            await this.unjailUser(client, guild, member, j.userId);
            console.log(`[Auto-Unjail] Released ${j.userTag}`);
        }
    },

    isJailed(client, userId) {
        const db = client.db;
        db.read();
        const jails = db.get('jails').value() || [];
        return jails.find(j => j.userId === userId);
    },

    formatDuration(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0) parts.push(`${seconds}s`);
        return parts.join(' ') || '0s';
    }
};
